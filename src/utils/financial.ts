// src/utils/financial.ts

export interface Indicator {
  label: string;
  apiFields: string[];
  compute?: (raw: Record<string, number>) => number | null;
  lowerIsBetter: boolean;
  green: number;
  yellow: number;
  asPercent?: boolean;
  isLargeNumber?: boolean;
  unit?: 'currency' | 'count';
  displayOnly?: boolean;
  explanation: string;
}

export type IndicatorConfig = Record<string, Indicator>;

/**
 * Configuración central para todos los indicadores financieros de la aplicación.
 * Define cómo se obtienen, calculan, evalúan y explican.
 */
export const indicatorConfig: IndicatorConfig = {
  // ——— Valoración
  PER: {
    label: 'PER',
    apiFields: ['pe', 'peRatioTTM', 'priceEarningsRatioTTM'],
    compute: (raw: Record<string, number>) => {
      const ey = raw.earningsYieldTTM ?? raw.earningsYield ?? null;
      const n = (ey === null || ey === undefined) ? null : Number(ey);
      return (n && Number.isFinite(n) && n !== 0) ? (1 / n) : null;
    },
    lowerIsBetter: true, green: 15, yellow: 25,
    explanation: 'Mide cuántos años de beneficios se necesitarían para recuperar el precio de la acción. Un valor bajo sugiere que puede estar barata, pero depende mucho del sector: en tecnología un PER de 40 puede ser normal, mientras que en un banco un PER de 15 ya podría considerarse caro. Lo clave es compararlo con competidores directos.',
  },
  forwardPER: {
    label: 'PER forward',
    apiFields: ['forwardPE'],
    lowerIsBetter: true, green: 15, yellow: 25,
    explanation: 'PER estimado usando las ganancias esperadas para los próximos 12 meses. Es una proyección, no una ganancia ya reportada.',
  },
  epsTTM: {
    label: 'EPS TTM',
    apiFields: ['trailingEPS', 'trailingEps'],
    lowerIsBetter: false, green: 0, yellow: 0,
    unit: 'currency',
    displayOnly: true,
    explanation: 'Ganancia por acción de los últimos doce meses.',
  },
  epsForward: {
    label: 'EPS forward',
    apiFields: ['forwardEPS', 'forwardEps'],
    lowerIsBetter: false, green: 0, yellow: 0,
    unit: 'currency',
    displayOnly: true,
    explanation: 'Ganancia por acción estimada para los próximos doce meses.',
  },
  targetPrice: {
    label: 'Precio objetivo medio',
    apiFields: ['targetConsensus', 'targetMeanPrice'],
    lowerIsBetter: false, green: 0, yellow: 0,
    unit: 'currency',
    displayOnly: true,
    explanation: 'Precio objetivo medio estimado por los analistas.',
  },
  analystCount: {
    label: 'Analistas',
    apiFields: ['lastMonthCount', 'numberOfAnalystOpinions'],
    lowerIsBetter: false, green: 0, yellow: 0,
    unit: 'count',
    displayOnly: true,
    explanation: 'Cantidad de analistas que participan de la estimación.',
  },
  pegRatio: {
    label: 'PEG Ratio',
    apiFields: ['pegRatioTTM', 'pegRatio'],
    lowerIsBetter: true, green: 1.0, yellow: 1.5,
    explanation: 'Ratio favorito de Peter Lynch. Compara el PER con la tasa de crecimiento de la empresa. Un valor menor a 1 indica que la acción está barata en relación a su crecimiento. Entre 1 y 1.5 es un precio razonable, y mayor a 2 suele considerarse cara.',
  },
  priceToBook: {
    label: 'Price to Book',
    apiFields: ['priceToBookRatioTTM', 'pbRatioTTM', 'priceToBook'],
    lowerIsBetter: true, green: 1.5, yellow: 3,
    explanation: 'Compara el precio de la acción con el valor contable de la empresa. Si está por debajo de 1.5, podrías estar pagando menos de lo que valen sus activos netos. Es especialmente útil en industrias con muchos activos físicos (bancos, fábricas). Un valor alto muestra que el mercado le da gran peso a los activos intangibles (marca, patentes) y al potencial de crecimiento futuro.',
  },
  priceToSales: {
    label: 'Price to Sales',
    apiFields: ['priceToSalesRatioTTM', 'psTTM', 'priceToSales'],
    lowerIsBetter: true, green: 2, yellow: 4,
    explanation: 'Relaciona el precio de la acción con las ventas de la empresa. Es muy útil en compañías que todavía no generan ganancias. Un valor bajo suele ser mejor, especialmente en empresas jóvenes en crecimiento o en industrias cíclicas como la automotriz. Además, es un ratio difícil de manipular contablemente.',
  },
  pfc_ratio: {
    label: 'Price/FCF',
    apiFields: ['priceToFreeCashFlowsRatioTTM', 'pfcRatioTTM'],
    lowerIsBetter: true, green: 15, yellow: 25,
    explanation: 'Funciona como el PER, pero usa el flujo de caja libre: el dinero real que genera la empresa. Indica qué tan cara está respecto al efectivo que produce. Muchos inversores lo prefieren al PER porque el flujo de caja es menos manipulable y refleja mejor la capacidad de la compañía para pagar deudas, dividendos o reinvertir.',
  },
  evToEbitda: {
    label: 'EV/EBITDA',
    apiFields: ['enterpriseValueOverEBITDATTM', 'evToEBITDATTM', 'evToEBITDA'],
    lowerIsBetter: true, green: 10, yellow: 15,
    explanation: 'Compara el valor total de la empresa (incluyendo su deuda) con sus ganancias brutas. Un número bajo indica que puede estar barata. Es más completo que el PER porque incorpora la deuda y permite comparar mejor compañías con diferentes estructuras de financiamiento. Es muy usado en fusiones y adquisiciones.',
  },
  evToSales: {
    label: 'EV/Ventas',
    apiFields: ['evToSalesTTM', 'enterpriseValueToSalesTTM'],
    lowerIsBetter: true, green: 3, yellow: 5,
    explanation: 'Relaciona el valor total de la empresa (incluida la deuda) con sus ventas. Sirve para comparar compañías sin que influyan impuestos, márgenes o depreciación. Es útil para obtener una visión rápida de cuánto paga el mercado por cada dólar de ventas.',
  },
  grahamNumber: {
    label: 'Nº de Graham',
    apiFields: ['grahamNumberTTM'],
    lowerIsBetter: false, // Better if price is below this number
    green: 1, yellow: 1, // Color logic would be custom: green if price < grahamNumber
    explanation: 'Calcula un valor intrínseco teórico de la acción. Según Benjamin Graham, si el precio de mercado está por debajo de este número, la acción podría estar infravalorada para un inversor conservador.',
  },
  earningsYield: {
    label: 'Rdto. Ganancias (%)',
    apiFields: ['earningsYieldTTM'],
    lowerIsBetter: false, green: 8, yellow: 5, asPercent: true,
    explanation: 'Es el inverso del PER (Ganancias por Acción / Precio). Muestra las ganancias como un porcentaje del precio de la acción, permitiendo compararlo con el rendimiento de los bonos.',
  },

  // ——— Rentabilidad
  grossMargin: {
    label: 'Margen Bruto (%)',
    apiFields: ['grossProfitMarginTTM', 'grossMarginTTM'],
    lowerIsBetter: false, green: 0.40, yellow: 0.20, asPercent: true,
    explanation: 'De cada $100 vendidos, muestra cuánto queda después de pagar el costo de los productos. Un margen superior al 40% refleja un negocio muy rentable. Si se mantiene alto y estable, suele ser señal de una ventaja competitiva (moat) como una marca fuerte que permite cobrar precios más altos.',
  },
  operatingMargin: {
    label: 'Margen Op. (%)',
    apiFields: ['operatingMarginTTM', 'operatingIncomeMarginTTM'],
    lowerIsBetter: false, green: 0.15, yellow: 0.05, asPercent: true,
    explanation: 'De cada $100 vendidos, indica cuánto gana la empresa con su actividad principal. Un margen mayor al 15% habla de eficiencia y solidez. Además, si aumenta con el tiempo significa que la gestión está logrando operar cada vez de forma más eficiente.',
  },
  roe: {
    label: 'ROE (%)',
    apiFields: ['returnOnEquityTTM', 'roeTTM'],
    lowerIsBetter: false, green: 0.15, yellow: 0.10, asPercent: true,
    explanation: 'Mide la rentabilidad que obtiene la empresa sobre el dinero invertido por los accionistas. Un ROE superior al 15% se considera excelente. Sin embargo, un ROE muy alto a veces se debe al uso excesivo de deuda, por lo que conviene mirarlo junto con el ratio Debt/Equity.',
  },
  roa: {
    label: 'ROA (%)',
    apiFields: ['returnOnAssetsTTM', 'roaTTM'],
    lowerIsBetter: false, green: 0.05, yellow: 0.02, asPercent: true,
    explanation: 'Muestra qué tan eficientemente la empresa utiliza sus activos (máquinas, oficinas, etc.) para generar beneficios. Un ROA mayor al 5% se considera saludable y es ideal para comparar empresas de un mismo sector con activos similares, como aerolíneas.',
  },
  roic: {
    label: 'ROIC (%)',
    apiFields: ['returnOnInvestedCapitalTTM', 'roicTTM'],
    lowerIsBetter: false, green: 0.10, yellow: 0.07, asPercent: true,
    explanation: 'Indica el retorno sobre todo el capital invertido (tanto de accionistas como de deuda). Un valor mayor al 10% sugiere que la empresa crea valor sostenidamente. Es uno de los indicadores más importantes: si supera al costo de capital, la empresa realmente está generando riqueza para sus dueños.',
  },
  rdToRevenue: {
    label: 'I+D / Ingresos (%)',
    apiFields: ['researchAndDevelopementToRevenueTTM'],
    lowerIsBetter: false, green: 0.1, yellow: 0.05, asPercent: true,
    explanation: 'Porcentaje de los ingresos que se reinvierte en Investigación y Desarrollo. Crucial para empresas de tecnología e innovación.',
  },

  // ——— Salud financiera
  debtToEquity: {
    label: 'Debt/Equity',
    apiFields: ['debtToEquityTTM', 'debtToEquity'],
    lowerIsBetter: true, green: 0.5, yellow: 1.0,
    explanation: 'Compara la deuda de la empresa con el capital de los accionistas. Un valor por debajo de 0.5 indica bajo endeudamiento y menor riesgo. Lo aceptable varía según la industria: compañías con ingresos muy estables (como utilities) pueden manejar más deuda de forma segura.',
  },
  netDebtToEBITDA: {
    label: 'Deuda Neta/EBITDA',
    apiFields: ['netDebtToEBITDATTM', 'netDebtToEBITDA'],
    lowerIsBetter: true, green: 1.5, yellow: 3.0,
    explanation: 'Muestra cuántos años necesitaría la empresa para pagar toda su deuda neta usando sus ganancias. Menos de 3 años es un nivel cómodo. Usa deuda neta (deuda total menos efectivo disponible), lo que refleja mejor la capacidad real de pago. Es muy seguido por agencias de rating.',
  },
  debt_to_assets: {
    label: 'Deuda/Activos (%)',
    apiFields: ['debtToAssetsTTM', 'debtToAssets'],
    lowerIsBetter: true, green: 0.4, yellow: 0.6, asPercent: true,
    explanation: 'Indica qué parte de los activos de la empresa está financiada con deuda. Menos del 40% se considera conservador. Si es alto, aumenta el riesgo porque en caso de quiebra los acreedores cobran antes que los accionistas.',
  },
  currentRatio: {
    label: 'Current Ratio',
    apiFields: ['currentRatioTTM', 'currentRatio'],
    lowerIsBetter: false, green: 2.0, yellow: 1.0,
    explanation: 'Mide si la empresa puede pagar sus deudas de corto plazo con efectivo y activos líquidos. Un valor mayor a 1 es lo mínimo necesario. Sin embargo, un ratio demasiado alto (como 4 o 5) podría indicar que la empresa no está aprovechando bien su dinero y lo mantiene inactivo.',
  },
  cashConversionCycle: {
    label: 'CCC (días)',
    apiFields: ['cashConversionCycleTTM', 'cashConversionCycle'],
    lowerIsBetter: true, green: 0, yellow: 20,
    explanation: 'Es el tiempo que tarda la empresa en transformar sus productos en efectivo. Cuanto más bajo o incluso negativo, mejor: significa que cobra antes de pagar. Un CCC negativo es una gran ventaja competitiva, como en Amazon o Mercado Libre, que cobran al instante y pagan semanas después.',
  },
  dso: {
    label: 'DSO (días)',
    apiFields: ['daysOfSalesOutstandingTTM'],
    lowerIsBetter: true, green: 40, yellow: 60,
    explanation: 'Días de Ventas Pendientes de Cobro. El número promedio de días que tarda una empresa en cobrar sus facturas. Un número bajo es mejor.',
  },
  dio: {
    label: 'DIO (días)',
    apiFields: ['daysOfInventoryOutstandingTTM'],
    lowerIsBetter: true, green: 30, yellow: 60,
    explanation: 'Días de Inventario Pendiente. El número promedio de días que el inventario permanece en el almacén antes de venderse. Refleja la eficiencia de la cadena de suministro.',
  },
  incomeQualityTTM: {
    label: 'Calidad Ingresos (%)',
    apiFields: ['incomeQualityTTM', 'incomeQuality'],
    lowerIsBetter: false, green: 1.0, yellow: 0.8, asPercent: true,
    explanation: 'Compara el flujo de caja operativo con las ganancias reportadas. Un valor cercano a 1 indica que las ganancias son "reales" y sostenibles. Más Info: Si este ratio es consistentemente bajo (<0.8), podría ser una señal de alerta. Podría indicar que la empresa está teniendo dificultades para convertir sus ventas en efectivo real, lo que puede afectar su capacidad para pagar deudas o dividendos.',
  },

  // ——— Dividendos / Flujos
  dividendYield: {
    label: 'Rend. Dividendo (%)',
    apiFields: ['dividendYieldTTM', 'dividendYield'],
    compute: (raw: Record<string, number>) => {
      const price = Number(raw.price);
      const div = Number(raw.lastDividend);
      if (Number.isFinite(price) && price > 0 && Number.isFinite(div) && div >= 0) return (div / price); // Quitamos * 100 para que asPercent funcione
      return null;
    },
    lowerIsBetter: false, green: 0.03, yellow: 0.01, asPercent: true,
    explanation: 'Es el porcentaje de tu inversión que la empresa te devuelve cada año como dividendos. Funciona como un "alquiler" por tener la acción. Más Info: Es muy atractivo para inversores que buscan ingresos regulares. Sin embargo, un rendimiento altísimo puede ser una señal de alerta, ya que podría deberse a una caída brusca del precio de la acción por problemas en la empresa.',
  },
  dividendPerShare: {
    label: 'Dividendo Anual (USD)',
    apiFields: ['lastDividend'],
    lowerIsBetter: false, green: 2, yellow: 0.5,
    explanation: 'El monto total en dólares que la empresa paga por cada acción en un año. Es el valor absoluto del dividendo, útil para calcular ingresos.',
  },
  payout_ratio: {
    label: 'Payout Ratio (%)',
    apiFields: ['payoutRatioTTM', 'payoutRatio'],
    lowerIsBetter: true, green: 0.60, yellow: 0.80, asPercent: true,
    explanation: 'Qué porcentaje de sus ganancias reparte la empresa como dividendos. Si es muy alto (>80%), podría ser difícil de mantener en el futuro. Más Info: En empresas jóvenes y en crecimiento, un payout bajo es bueno, porque significa que reinvierten el dinero para crecer más rápido. En empresas maduras y estables, se espera un payout más alto.',
  },
  fcfYield: {
    label: 'FCF Yield (%)',
    apiFields: ['freeCashFlowYieldTTM', 'fcfYieldTTM'],
    lowerIsBetter: false, green: 0.05, yellow: 0.02, asPercent: true,
    compute: (raw: Record<string, number>) => {
      const pfc = Number(raw.priceToFreeCashFlowsRatioTTM);
      return (Number.isFinite(pfc) && pfc > 0) ? (1 / pfc) : null;
    },
    explanation: 'Compara el dinero real que genera la empresa con el precio de la acción. Un rendimiento alto significa que estás comprando una gran capacidad de generar efectivo. Más Info: Muestra la capacidad potencial de la empresa para aumentar dividendos, recomprar acciones o pagar deuda. Para muchos, es una medida más pura del retorno real que la empresa genera para el inversor.',
  },

  // ——— Riesgo / Tamaño
  beta: {
    label: 'Beta',
    apiFields: ['beta'],
    lowerIsBetter: true, green: 0.8, yellow: 1.2,
    explanation: 'Mide la volatilidad de la acción respecto al mercado. Una Beta de 1 implica que se mueve igual que el mercado; menor a 1, es más estable; mayor a 1, más volátil. Por ejemplo, si el mercado sube 10%, una acción con Beta 1.2 subiría 12%, pero también caería más fuerte si el mercado baja.',
  },
  marketCap: {
    label: 'Capitalización (USD)',
    apiFields: ['marketCap'],
    lowerIsBetter: false, green: 1e12, yellow: 1e11, isLargeNumber: true,
    explanation: 'Es el valor total de todas las acciones de la empresa en bolsa. Indica el tamaño de la compañía. Se suele clasificar en Large-Cap, Mid-Cap y Small-Cap: las grandes son más estables, mientras que las pequeñas tienen más potencial de crecimiento, pero también mayor riesgo.',
  },
  relativeVolume: {
    label: 'Volumen Relativo',
    apiFields: [], // Es calculado
    compute: (raw: Record<string, number>) => {
      const vol = Number(raw.volume);
      const avgVol = Number(raw.averageVolume);
      return (avgVol > 0 && Number.isFinite(vol)) ? (vol / avgVol) : null;
    },
    lowerIsBetter: false, green: 2, yellow: 1.5,
    explanation: 'Compara el volumen de hoy con el promedio. Un valor > 1.5 indica un interés inusual en la acción, a menudo por noticias importantes.',
  },

  // --- Momentum: ¿Cuál es la tendencia del precio? ---
  rsi14: {
    label: 'RSI (14)',
    apiFields: [],
    lowerIsBetter: false, green: 70, yellow: 50,
    explanation: 'Es un “termómetro” del precio. Por encima de 70 la acción está sobrecomprada (posiblemente cara), y por debajo de 30 sobrevendida (posiblemente barata). Se usa como señal de giro, aunque nunca de forma aislada sino junto a otros indicadores.',
  },
  sma50: {
    label: 'SMA 50',
    apiFields: ['priceAvg50'],
    lowerIsBetter: false, green: 0, yellow: 0,
    explanation: 'Es el precio promedio de los últimos 50 días. Ayuda a identificar la tendencia de corto plazo: si el precio está por encima, suele indicar tendencia alcista; por debajo, bajista.',
  },
  sma200: {
    label: 'SMA 200',
    apiFields: ['priceAvg200'],
    lowerIsBetter: false, green: 0, yellow: 0,
    explanation: 'Es el precio promedio de los últimos 200 días. Marca la tendencia de largo plazo y es de las medias más seguidas. Cotizar por encima de ella es visto como señal de fortaleza a largo plazo.',
  },
  smaSignal: {
    label: 'Señal SMA 50/200',
    apiFields: ['priceAvg50', 'priceAvg200'],
    compute: (raw: Record<string, number>) => {
      const sma50 = Number(raw.priceAvg50);
      const sma200 = Number(raw.priceAvg200);
      return (sma50 && sma200 && sma50 > sma200) ? 1 : 0;
    },
    lowerIsBetter: false, green: 1, yellow: 0,
    explanation: 'Si la media de 50 días está por encima de la de 200, es una señal alcista (Cruce Dorado). Si está por debajo, se considera bajista (Cruce de la Muerte).',
  },

  // ——— Datos por Acción (Per Share)
  eps: {
    label: 'EPS (Beneficio/Acción)',
    apiFields: ['netIncomePerShare', 'eps'],
    lowerIsBetter: false, green: 0, yellow: 0,
    explanation: 'Earnings Per Share. Es el beneficio neto dividido por el número de acciones. Indica cuánto dinero gana la empresa por cada acción que posees. Fundamental para calcular el PER.',
  },
  revenuePerShare: {
    label: 'Ventas por Acción',
    apiFields: ['revenuePerShare'],
    lowerIsBetter: false, green: 0, yellow: 0,
    explanation: 'Muestra cuántos dólares de ventas corresponden a cada acción. Útil para ver si el crecimiento de las ventas es real o se diluye por la emisión de nuevas acciones.',
  },
  cashPerShare: {
    label: 'Efectivo por Acción',
    apiFields: ['cashPerShare'],
    lowerIsBetter: false, green: 0, yellow: 0,
    explanation: 'La cantidad de dinero en efectivo y equivalentes que respalda cada acción. Un valor alto da seguridad financiera y opciones para invertir o capear crisis.',
  },
  bookValuePerShare: {
    label: 'Valor Libro por Acción',
    apiFields: ['bookValuePerShare'],
    lowerIsBetter: false, green: 0, yellow: 0,
    explanation: 'El valor contable de la empresa dividido por sus acciones. Si la empresa liquidara todos sus activos y pagara todas sus deudas, esto es teóricamente lo que recibiría cada accionista.',
  },
  fcfPerShare: {
    label: 'FCF por Acción',
    apiFields: ['freeCashFlowPerShare'],
    lowerIsBetter: false, green: 0, yellow: 0,
    explanation: 'Flujo de Caja Libre por acción. Muestra cuánto efectivo real genera la empresa para cada accionista después de mantener sus operaciones. Es clave para pagar dividendos sostenibles.',
  },

  // ——— Eficiencia
  assetTurnover: {
    label: 'Rotación de Activos',
    apiFields: ['assetTurnover'],
    lowerIsBetter: false, green: 1, yellow: 0.5,
    explanation: 'Mide cuántos dólares de ventas genera la empresa por cada dólar que tiene en activos. Un ratio alto indica que la empresa es muy eficiente usando sus recursos para vender. Varía mucho por industria (retail alto, software bajo).',
  },
  inventoryTurnover: {
    label: 'Rotación Inventario',
    apiFields: ['inventoryTurnover'],
    lowerIsBetter: false, green: 6, yellow: 4,
    explanation: 'Indica cuántas veces al año la empresa vende y repone su inventario completo. Un número alto es bueno (venden rápido), uno bajo puede indicar exceso de stock o productos obsoletos.',
  },
  receivablesTurnover: {
    label: 'Rotación Ctas/Cobrar',
    apiFields: ['receivablesTurnover'],
    lowerIsBetter: false, green: 8, yellow: 6,
    explanation: 'Mide la eficiencia con la que la empresa cobra a sus clientes. Un ratio alto significa que cobran rápido, lo cual es vital para el flujo de caja.',
  },

  // ——— Solvencia Extra
  interestCoverage: {
    label: 'Cobertura de Intereses',
    apiFields: ['interestCoverageRatio', 'interestCoverage'],
    lowerIsBetter: false, green: 5, yellow: 3,
    explanation: 'Indica la facilidad con la que la empresa puede pagar los intereses de su deuda con sus ganancias operativas. Un ratio menor a 1.5 es peligroso; idealmente buscamos > 3 o 5.',
  }
};