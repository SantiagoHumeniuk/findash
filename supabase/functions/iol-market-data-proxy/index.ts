import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const IOL_API_URL = "https://api.iolinversiones.com";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type IolToken = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

type IolQuote = {
  symbol: string;
  market: string;
  settlement_term: string;
  currency: string;
  prices: {
    current: number;
    close: number;
    open: number;
    high: number;
    low: number;
    previous_close: number;
  };
  change: { amount: number; percent: number };
  volume: { amount: number; shares: number };
  last_updated: string;
};

type IolBookLevel = { position: number; price: number; size: number };
type IolDepth = {
  symbol: string;
  market: string;
  settlement_term: string;
  bids: IolBookLevel[];
  asks: IolBookLevel[];
  last_updated: string;
};

type MarketRequest = {
  symbol: string;
  market: "BCBA" | "NYSE" | "NASDAQ";
  term: "T0" | "T1";
};

type ParsedRequest = {
  action: "test" | "quote" | "depth" | "batch";
  requests: MarketRequest[];
};

type TokenCache = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

class IolApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly traceId?: string,
  ) {
    super(message);
  }
}

class RequestError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function requiredNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (!isFiniteNumber(value)) {
    throw new IolApiError("IOL devolvió una cotización incompleta.", 502);
  }
  return value;
}

async function parseEnvelope(response: Response) {
  const payload: unknown = await response.json().catch(() => null);
  if (!isRecord(payload)) {
    throw new IolApiError(
      "IOL devolvió una respuesta inválida.",
      response.status,
    );
  }
  const apiError = isRecord(payload.error) ? payload.error : null;
  const meta = isRecord(payload.meta) ? payload.meta : null;
  return {
    data: payload.data,
    error: apiError && typeof apiError.message === "string"
      ? apiError.message
      : null,
    traceId: meta && typeof meta.trace_id === "string"
      ? meta.trace_id
      : undefined,
  };
}

function parseToken(
  value: unknown,
  status: number,
  traceId?: string,
): IolToken {
  if (
    !isRecord(value) ||
    typeof value.access_token !== "string" ||
    typeof value.refresh_token !== "string" ||
    !isFiniteNumber(value.expires_in) ||
    value.expires_in <= 0
  ) {
    throw new IolApiError("IOL devolvió un token inválido.", status, traceId);
  }
  return {
    access_token: value.access_token,
    refresh_token: value.refresh_token,
    expires_in: value.expires_in,
  };
}

function parseQuote(value: unknown): IolQuote {
  if (
    !isRecord(value) || !isRecord(value.prices) || !isRecord(value.change) ||
    !isRecord(value.volume)
  ) {
    throw new IolApiError("IOL devolvió una cotización incompleta.", 502);
  }
  if (
    typeof value.symbol !== "string" ||
    typeof value.market !== "string" ||
    typeof value.settlement_term !== "string" ||
    typeof value.currency !== "string" ||
    typeof value.last_updated !== "string"
  ) {
    throw new IolApiError("IOL devolvió una cotización incompleta.", 502);
  }
  return {
    symbol: value.symbol,
    market: value.market,
    settlement_term: value.settlement_term,
    currency: value.currency,
    prices: {
      current: requiredNumber(value.prices, "current"),
      close: requiredNumber(value.prices, "close"),
      open: requiredNumber(value.prices, "open"),
      high: requiredNumber(value.prices, "high"),
      low: requiredNumber(value.prices, "low"),
      previous_close: requiredNumber(value.prices, "previous_close"),
    },
    change: {
      amount: requiredNumber(value.change, "amount"),
      percent: requiredNumber(value.change, "percent"),
    },
    volume: {
      amount: requiredNumber(value.volume, "amount"),
      shares: requiredNumber(value.volume, "shares"),
    },
    last_updated: value.last_updated,
  };
}

function parseDepth(value: unknown): IolDepth {
  if (
    !isRecord(value) || !Array.isArray(value.bids) || !Array.isArray(value.asks)
  ) {
    throw new IolApiError("IOL devolvió un libro de órdenes inválido.", 502);
  }
  if (
    typeof value.symbol !== "string" ||
    typeof value.market !== "string" ||
    typeof value.settlement_term !== "string" ||
    typeof value.last_updated !== "string"
  ) {
    throw new IolApiError("IOL devolvió un libro de órdenes incompleto.", 502);
  }

  const parseLevels = (levels: unknown[]): IolBookLevel[] =>
    levels.flatMap((level) => {
      if (
        !isRecord(level) ||
        !isFiniteNumber(level.position) ||
        !isFiniteNumber(level.price) ||
        !isFiniteNumber(level.size)
      ) return [];
      return [{
        position: level.position,
        price: level.price,
        size: level.size,
      }];
    });

  return {
    symbol: value.symbol,
    market: value.market,
    settlement_term: value.settlement_term,
    bids: parseLevels(value.bids),
    asks: parseLevels(value.asks),
    last_updated: value.last_updated,
  };
}

async function authenticate(
  grant:
    | { grant_type: "password"; username: string; password: string }
    | { grant_type: "refresh_token"; refresh_token: string },
): Promise<IolToken> {
  const response = await fetch(`${IOL_API_URL}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(grant),
  });
  const envelope = await parseEnvelope(response);
  if (!response.ok || envelope.error) {
    throw new IolApiError(
      envelope.error || "IOL rechazó la autenticación.",
      response.status,
      envelope.traceId,
    );
  }
  return parseToken(envelope.data, response.status, envelope.traceId);
}

async function getAccessToken(forcePasswordGrant = false): Promise<string> {
  const now = Date.now();
  if (
    !forcePasswordGrant && tokenCache && tokenCache.expiresAt > now + 30_000
  ) {
    return tokenCache.accessToken;
  }

  const username = Deno.env.get("IOL_USERNAME");
  const password = Deno.env.get("IOL_PASSWORD");
  if (!username || !password) {
    throw new IolApiError(
      "Faltan los secretos IOL_USERNAME o IOL_PASSWORD en Supabase.",
      503,
    );
  }

  let token: IolToken;
  if (!forcePasswordGrant && tokenCache?.refreshToken) {
    try {
      token = await authenticate({
        grant_type: "refresh_token",
        refresh_token: tokenCache.refreshToken,
      });
    } catch (error) {
      if (
        !(error instanceof IolApiError) ||
        (error.status !== 400 && error.status !== 401)
      ) throw error;
      console.warn(
        "IOL refresh token rejected; requesting a new token with password grant.",
      );
      token = await authenticate({
        grant_type: "password",
        username,
        password,
      });
    }
  } else {
    token = await authenticate({ grant_type: "password", username, password });
  }

  tokenCache = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: now + token.expires_in * 1000,
  };
  return tokenCache.accessToken;
}

async function fetchIol(path: string, retryAuth = true): Promise<unknown> {
  const response = await fetch(`${IOL_API_URL}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${await getAccessToken()}`,
    },
  });
  const envelope = await parseEnvelope(response);
  if (response.status === 401 && retryAuth) {
    tokenCache = null;
    await getAccessToken(true);
    return fetchIol(path, false);
  }
  if (!response.ok || envelope.error || envelope.data == null) {
    throw new IolApiError(
      envelope.error || `IOL respondió HTTP ${response.status}.`,
      response.status,
      envelope.traceId,
    );
  }
  return envelope.data;
}

function parseMarketRequest(
  payload: unknown,
  useTestDefaults = false,
): MarketRequest {
  if (!isRecord(payload)) {
    throw new RequestError("Cada instrumento debe ser un objeto JSON.");
  }
  const symbol = payload.symbol === undefined && useTestDefaults
    ? "GGAL"
    : payload.symbol;
  const market = payload.market === undefined && useTestDefaults
    ? "BCBA"
    : payload.market;
  const term = payload.term === undefined && useTestDefaults
    ? "T0"
    : payload.term;
  if (typeof symbol !== "string" || !/^[A-Z0-9.^=-]{1,15}$/i.test(symbol)) {
    throw new RequestError("El símbolo es inválido.");
  }
  if (market !== "BCBA" && market !== "NYSE" && market !== "NASDAQ") {
    throw new RequestError("El mercado debe ser BCBA, NYSE o NASDAQ.");
  }
  if (term !== "T0" && term !== "T1") {
    throw new RequestError("El plazo debe ser T0 o T1.");
  }
  return { symbol: symbol.toUpperCase(), market, term };
}

function parseRequest(payload: unknown): ParsedRequest {
  if (!isRecord(payload)) {
    throw new RequestError(
      "El cuerpo de la solicitud debe ser un objeto JSON.",
    );
  }
  const action = payload.action === undefined ? "test" : payload.action;
  if (
    action !== "test" && action !== "quote" && action !== "depth" &&
    action !== "batch"
  ) {
    throw new RequestError("La acción debe ser test, quote, depth o batch.");
  }
  if (action === "batch") {
    if (
      !Array.isArray(payload.requests) || payload.requests.length === 0 ||
      payload.requests.length > 40
    ) {
      throw new RequestError(
        "El lote debe contener entre 1 y 40 instrumentos.",
      );
    }
    return {
      action,
      requests: payload.requests.map((request) => parseMarketRequest(request)),
    };
  }
  return {
    action,
    requests: [parseMarketRequest(payload, action === "test")],
  };
}

function marketDataPath(
  symbol: string,
  market: string,
  term: string,
  resource: "quote" | "depth",
) {
  return `/broker/market-data/${
    encodeURIComponent(symbol)
  }/${resource}?market=${market}&term=${term}`;
}

function topOfBook(depth: IolDepth) {
  const bid = depth.bids.find((level) => level.price > 0 && level.size > 0);
  const ask = depth.asks.find((level) => level.price > 0 && level.size > 0);
  return {
    bid: bid ? { price: bid.price, size: bid.size } : null,
    ask: ask ? { price: ask.price, size: ask.size } : null,
    lastUpdated: depth.last_updated,
  };
}

async function fetchMarketData(request: MarketRequest) {
  const quotePath = marketDataPath(
    request.symbol,
    request.market,
    request.term,
    "quote",
  );
  const depthPath = marketDataPath(
    request.symbol,
    request.market,
    request.term,
    "depth",
  );
  const [quotePayload, depthPayload] = await Promise.all([
    fetchIol(quotePath),
    fetchIol(depthPath),
  ]);
  return {
    request,
    quote: parseQuote(quotePayload),
    topOfBook: topOfBook(parseDepth(depthPayload)),
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        results[index] = await mapper(items[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Método no permitido." }, {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const input = parseRequest(await request.json());
    if (input.action === "batch") {
      await getAccessToken();
      const results = await mapWithConcurrency(
        input.requests,
        3,
        async (item) => {
          try {
            return await fetchMarketData(item);
          } catch (error) {
            return {
              request: item,
              error: error instanceof Error
                ? error.message
                : "Error desconocido.",
              ...(error instanceof IolApiError && error.traceId
                ? { traceId: error.traceId }
                : {}),
            };
          }
        },
      );
      return Response.json({
        fetchedAt: new Date().toISOString(),
        results,
      }, { headers: corsHeaders });
    }

    const marketRequest = input.requests[0];

    if (input.action === "quote") {
      const quote = parseQuote(
        await fetchIol(
          marketDataPath(
            marketRequest.symbol,
            marketRequest.market,
            marketRequest.term,
            "quote",
          ),
        ),
      );
      return Response.json({ quote }, { headers: corsHeaders });
    }
    if (input.action === "depth") {
      const depth = parseDepth(
        await fetchIol(
          marketDataPath(
            marketRequest.symbol,
            marketRequest.market,
            marketRequest.term,
            "depth",
          ),
        ),
      );
      return Response.json({ depth, topOfBook: topOfBook(depth) }, {
        headers: corsHeaders,
      });
    }

    const marketData = await fetchMarketData(marketRequest);
    const quote = marketData.quote;
    const book = marketData.topOfBook;
    return Response.json({
      ok: true,
      credentialsAccepted: true,
      marketDataAvailable: Number.isFinite(quote.prices?.current) &&
        quote.prices.current > 0,
      orderBookAvailable: book.bid !== null && book.ask !== null,
      quote: {
        symbol: quote.symbol,
        market: quote.market,
        settlementTerm: quote.settlement_term,
        currency: quote.currency,
        currentPrice: quote.prices?.current ?? null,
        lastUpdated: quote.last_updated,
      },
      topOfBook: book,
      checkedAt: new Date().toISOString(),
    }, { headers: corsHeaders });
  } catch (error) {
    const status = error instanceof IolApiError
      ? (error.status === 401
        ? 502
        : error.status >= 400 && error.status < 500
        ? 502
        : error.status)
      : error instanceof RequestError || error instanceof SyntaxError
      ? 400
      : 502;
    const message = error instanceof Error
      ? error.message
      : "Error desconocido.";
    console.error("IOL market data proxy error:", message);
    return Response.json(
      {
        error: message,
        ...(error instanceof IolApiError && error.traceId
          ? { traceId: error.traceId }
          : {}),
      },
      { status, headers: corsHeaders },
    );
  }
});
