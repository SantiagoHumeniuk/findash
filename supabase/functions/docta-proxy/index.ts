// supabase/functions/docta-proxy/index.ts

// Deno Edge Function for Docta Capital API
// - OAuth2 client_credentials token cached in module scope
// - Proxies requests from frontend so secrets never reach the browser
// - Only administrators may call it: the app does not use it, and anyone with the public key could before

type DoctaMethod = 'GET' | 'POST';

interface DoctaProxyRequest {
  endpointPath: string;
  method?: DoctaMethod;
  body?: Record<string, unknown>;
}

interface TokenResponse {
  access_token: string;
  expires_in: number; // seconds
}

import { forbidden, isAdministrator } from '../_shared/admin.ts';

let cachedToken: { token: string; expiresAtMs: number } | null = null;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get('DOCTA_CLIENT_ID');
  const clientSecret = Deno.env.get('DOCTA_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Missing DOCTA_CLIENT_ID/DOCTA_CLIENT_SECRET in Edge Function env');
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs - now > 30_000) {
    return cachedToken.token;
  }

  const res = await fetch('https://api.doctacapital.com.ar/api/v1/auth/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Docta auth failed: ${res.status} ${text}`);
  }

  const tokenJson = JSON.parse(text) as TokenResponse;
  if (!tokenJson?.access_token || !tokenJson?.expires_in) {
    throw new Error('Docta auth: invalid token response');
  }

  // Refresh a bit earlier than expiry
  cachedToken = {
    token: tokenJson.access_token,
    expiresAtMs: Date.now() + tokenJson.expires_in * 1000,
  };

  return cachedToken.token;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed', message: 'Use POST' });
  }

  if (!await isAdministrator(req)) return forbidden();

  try {
    const payload = (await req.json()) as DoctaProxyRequest;

    if (!payload || typeof payload.endpointPath !== 'string' || payload.endpointPath.trim().length === 0) {
      return json(400, { error: 'bad_request', message: 'endpointPath is required' });
    }

    const method: DoctaMethod = payload.method ?? 'GET';
    const endpointPath = payload.endpointPath.replace(/^\//, '');

    const token = await getAccessToken();

    const targetUrl = `https://api.doctacapital.com.ar/${endpointPath}`;

    const upstream = await fetch(targetUrl, {
      method,
      headers: {
        'authorization': `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: method === 'POST' ? JSON.stringify(payload.body ?? {}) : undefined,
    });

    const upstreamText = await upstream.text();

    if (!upstream.ok) {
      return json(upstream.status, {
        error: 'upstream_error',
        status: upstream.status,
        message: 'Docta API request failed',
        details: upstreamText,
        endpointPath,
      });
    }

    const data = upstreamText.length ? JSON.parse(upstreamText) : null;
    return json(200, data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json(500, { error: 'internal_error', message });
  }
});
