// src/features/bonds/pages/bonds-page.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign,
  TrendingUp,
  RefreshCw,
  ArrowRightLeft,
  Search,
  ExternalLink,
  Percent,
  Calendar,
  Layers,
  Sparkles,
  Calculator,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from '@/components/charts/lazy-recharts';
import {
  fetchUnifiedDolares,
  fetchInflacion,
  fetchPlazosFijos,
  fetchUva,
  getCurvaLecapYTasaFija,
  recalcularMetricasLecap,
  DolarCotizacion,
  InflacionDato,
  PlazoFijoDato,
  UvaDato,
  LecapInstrumento,
} from '@/services/macro-api';

export default function BondsPage() {
  const [activeTab, setActiveTab] = useState<'macro' | 'lecaps'>('macro');

  // Estados de Dólares y Macro
  const [provider, setProvider] = useState<'argentinadatos' | 'dolarazo'>('argentinadatos');
  const [activeSourceUsed, setActiveSourceUsed] = useState<string>('argentinadatos');
  const [dolares, setDolares] = useState<DolarCotizacion[]>([]);
  const [inflacion, setInflacion] = useState<InflacionDato[]>([]);
  const [plazosFijos, setPlazosFijos] = useState<PlazoFijoDato[]>([]);
  const [uvaList, setUvaList] = useState<UvaDato[]>([]);
  const [loadingMacro, setLoadingMacro] = useState<boolean>(true);
  const [errorMacro, setErrorMacro] = useState<string | null>(null);

  // Estados del Conversor de Moneda
  const [conversorMonto, setConversorMonto] = useState<number>(100000);
  const [conversorDireccion, setConversorDireccion] = useState<'ARS_TO_USD' | 'USD_TO_ARS'>('ARS_TO_USD');

  // Buscador de Plazos Fijos
  const [searchBanco, setSearchBanco] = useState<string>('');

  // Estados de Curva LECAP y Tasa Fija
  const [instrumentos, setInstrumentos] = useState<LecapInstrumento[]>([]);
  const [curvaMetric, setCurvaMetric] = useState<'tem' | 'tna' | 'tea'>('tem');
  const [filtroTipo, setFiltroTipo] = useState<'TODOS' | 'LECAP' | 'BONCAP'>('TODOS');
  const [searchInstrumento, setSearchInstrumento] = useState<string>('');

  // Estados del Simulador de Inversión
  const [simuladorMonto, setSimuladorMonto] = useState<number>(1000000);
  const [selectedTickerSim, setSelectedTickerSim] = useState<string>('S30S6');
  const [precioPersonalizado, setPrecioPersonalizado] = useState<string>('');

  // Carga inicial de datos
  const loadMacroData = async (preferredProvider: 'argentinadatos' | 'dolarazo') => {
    setLoadingMacro(true);
    setErrorMacro(null);
    try {
      const [dolaresRes, inflacionRes, pfRes, uvaRes] = await Promise.allSettled([
        fetchUnifiedDolares(preferredProvider),
        fetchInflacion(),
        fetchPlazosFijos(),
        fetchUva(),
      ]);

      if (dolaresRes.status === 'fulfilled') {
        setDolares(dolaresRes.value.dolares);
        setActiveSourceUsed(dolaresRes.value.sourceUsed);
      } else {
        console.error('Error cargando dólares:', dolaresRes.reason);
      }

      if (inflacionRes.status === 'fulfilled') {
        setInflacion(inflacionRes.value);
      }

      if (pfRes.status === 'fulfilled') {
        setPlazosFijos(pfRes.value);
      }

      if (uvaRes.status === 'fulfilled') {
        setUvaList(uvaRes.value);
      }
    } catch (err: any) {
      setErrorMacro('No se pudieron obtener algunas variables macroeconómicas.');
    } finally {
      setLoadingMacro(false);
    }
  };

  useEffect(() => {
    loadMacroData(provider);
    const instList = getCurvaLecapYTasaFija();
    setInstrumentos(instList);
  }, []);

  const handleProviderChange = (newProvider: 'argentinadatos' | 'dolarazo') => {
    setProvider(newProvider);
    loadMacroData(newProvider);
  };

  // Filtrado de Plazos Fijos
  const filteredPlazosFijos = useMemo(() => {
    if (!searchBanco.trim()) return plazosFijos.slice(0, 15);
    return plazosFijos
      .filter((b) => b.entidad.toLowerCase().includes(searchBanco.toLowerCase()))
      .slice(0, 15);
  }, [plazosFijos, searchBanco]);

  // Filtrado de instrumentos de Curva LECAP
  const filteredInstrumentos = useMemo(() => {
    return instrumentos.filter((inst) => {
      const matchesTipo =
        filtroTipo === 'TODOS'
          ? true
          : filtroTipo === 'LECAP'
          ? inst.tipo === 'LECAP'
          : inst.tipo !== 'LECAP';
      const matchesSearch =
        inst.ticker.toLowerCase().includes(searchInstrumento.toLowerCase()) ||
        inst.nombre.toLowerCase().includes(searchInstrumento.toLowerCase());
      return matchesTipo && matchesSearch;
    });
  }, [instrumentos, filtroTipo, searchInstrumento]);

  // Datos para el gráfico de la curva de rendimientos
  const chartDataCurva = useMemo(() => {
    return filteredInstrumentos.map((inst) => ({
      ticker: inst.ticker,
      dias: inst.diasAlVencimiento,
      tasa: inst[curvaMetric],
      tipo: inst.tipo,
      fechaVencimiento: inst.fechaVencimiento,
      precio: inst.precio,
      tem: inst.tem,
      tna: inst.tna,
      tea: inst.tea,
    }));
  }, [filteredInstrumentos, curvaMetric]);

  // Inflación últimos 12 meses para el gráfico
  const inflacionReciente = useMemo(() => {
    if (!inflacion || inflacion.length === 0) return [];
    return inflacion.slice(-12).map((item) => {
      const date = new Date(item.fecha);
      const mes = date.toLocaleString('es-AR', { month: 'short' });
      const year = date.getFullYear().toString().slice(-2);
      return {
        periodo: `${mes} ${year}`,
        valor: item.valor,
        fecha: item.fecha,
      };
    });
  }, [inflacion]);

  // Datos del instrumento seleccionado para el simulador
  const selectedInstrumento = useMemo(() => {
    return instrumentos.find((i) => i.ticker === selectedTickerSim) || instrumentos[0];
  }, [instrumentos, selectedTickerSim]);

  // Cálculos del simulador
  const simuladorCalculo = useMemo(() => {
    if (!selectedInstrumento) return null;

    const precioCompra = precioPersonalizado
      ? parseFloat(precioPersonalizado)
      : selectedInstrumento.precio;
    const precioFinal = selectedInstrumento.valorTecnico || 130;

    const metricas = recalcularMetricasLecap(selectedInstrumento, precioCompra);
    const gananciaDirecta = (precioFinal - precioCompra) / precioCompra;

    const capitalFinalLecap = simuladorMonto * (1 + gananciaDirecta);
    const gananciaLecap = capitalFinalLecap - simuladorMonto;

    // Comparación contra Plazo Fijo promedio (~22% TNA)
    const tnaPfEstimada = plazosFijos.length > 0 ? (plazosFijos[0].tnaClientes || 0.22) * 100 : 22;
    const dias = selectedInstrumento.diasAlVencimiento;
    const rendimientoPf = (tnaPfEstimada / 100) * (dias / 365);
    const capitalFinalPf = simuladorMonto * (1 + rendimientoPf);
    const gananciaPf = capitalFinalPf - simuladorMonto;

    const diferenciaPesos = gananciaLecap - gananciaPf;

    return {
      precioCompra,
      metricas,
      capitalFinalLecap,
      gananciaLecap,
      gananciaLecapPorcentaje: Number((gananciaDirecta * 100).toFixed(2)),
      tnaPfEstimada,
      capitalFinalPf,
      gananciaPf,
      diferenciaPesos,
      lecapConviene: diferenciaPesos >= 0,
      dias,
    };
  }, [selectedInstrumento, simuladorMonto, precioPersonalizado, plazosFijos]);

  // Dólares clave para badges del header
  const dolarBlue = dolares.find((d) => d.casa === 'blue');
  const dolarMep = dolares.find((d) => d.casa === 'bolsa');
  const dolarOficial = dolares.find((d) => d.casa === 'oficial');
  const ultimaInflacion = inflacionReciente.length > 0 ? inflacionReciente[inflacionReciente.length - 1] : null;
  const ultimoUva = uvaList.length > 0 ? uvaList[uvaList.length - 1] : null;

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
      {/* Header Principal */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
              Renta Fija & Variables Macro
            </h1>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 gap-1 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              En Vivo
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Monitor de cotizaciones cambiarias, variables macroeconómicas con APIs abiertas y Curva de Rendimientos de LECAPs y Bonos.
          </p>
        </div>

        {/* Badges rápidos de mercado */}
        <div className="flex flex-wrap items-center gap-2">
          {dolarBlue && (
            <div className="bg-card/70 border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium">Blue:</span>
              <span className="font-bold text-foreground">
                ${dolarBlue.compra} / ${dolarBlue.venta}
              </span>
              {dolarBlue.brechaVenta !== undefined && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-blue-500/20 text-blue-300">
                  +{dolarBlue.brechaVenta}%
                </Badge>
              )}
            </div>
          )}

          {dolarMep && (
            <div className="bg-card/70 border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium">MEP:</span>
              <span className="font-bold text-emerald-400">${dolarMep.venta}</span>
            </div>
          )}

          {ultimaInflacion && (
            <div className="bg-card/70 border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium">IPC {ultimaInflacion.periodo}:</span>
              <span className="font-bold text-amber-400">{ultimaInflacion.valor}%</span>
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            className="h-9 px-3 gap-1.5 border-white/15 hover:bg-white/10"
            onClick={() => loadMacroData(provider)}
            disabled={loadingMacro}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingMacro ? 'animate-spin' : ''}`} />
            <span className="text-xs hidden sm:inline">Actualizar</span>
          </Button>
        </div>
      </div>

      {/* Selector de Pestañas Principales (Las 2 opciones solicitadas) */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-xl mx-auto h-12 p-1 bg-muted/40 border border-white/10 rounded-xl">
          <TabsTrigger
            value="macro"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold transition-all"
          >
            <DollarSign className="h-4 w-4" />
            <span>1. Dólares & Variables Macro</span>
          </TabsTrigger>
          <TabsTrigger
            value="lecaps"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold transition-all"
          >
            <TrendingUp className="h-4 w-4" />
            <span>2. Curva LECAP & Tasa Fija</span>
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* PESTAÑA 1: DÓLARES & VARIABLES MACRO (ArgentinaDatos y Dolarazo) */}
        {/* ========================================================================= */}
        <TabsContent value="macro" className="space-y-6 mt-6">
          {/* Barra de control de fuente de datos */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-card/60 backdrop-blur-md border border-white/10">
            <div className="flex items-center gap-2 text-xs">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span className="text-muted-foreground">
                Datos provistos por APIs abiertas de código abierto:
              </span>
              <span className="font-semibold text-foreground">
                {activeSourceUsed === 'argentinadatos' ? 'ArgentinaDatos.com' : 'Dolarazo.com.ar'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Fuente preferida:</span>
              <div className="inline-flex rounded-lg border border-border p-0.5 bg-background/50">
                <button
                  onClick={() => handleProviderChange('argentinadatos')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    provider === 'argentinadatos'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  ArgentinaDatos
                </button>
                <button
                  onClick={() => handleProviderChange('dolarazo')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    provider === 'dolarazo'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Dolarazo
                </button>
              </div>
            </div>
          </div>

          {/* Grid de Cotizaciones de Dólares */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-400" />
                Cotizaciones de los Distintos Tipos de Dólares
              </h2>
              {dolarOficial && (
                <span className="text-xs text-muted-foreground">
                  Base Oficial Venta: ${dolarOficial.venta} ARS
                </span>
              )}
            </div>

            {loadingMacro && dolares.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="h-36 rounded-xl bg-card/40 border border-white/5 animate-pulse p-4" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {dolares.map((dolar) => {
                  const isOficial = dolar.casa === 'oficial';
                  const isBlue = dolar.casa === 'blue';
                  const isMep = dolar.casa === 'bolsa';
                  const isCcl = dolar.casa === 'contadoconliqui';

                  return (
                    <Card
                      key={dolar.casa}
                      className={`relative overflow-hidden transition-all duration-200 hover:border-white/20 hover:shadow-lg ${
                        isBlue
                          ? 'border-blue-500/40 bg-gradient-to-b from-blue-950/20 to-card/60'
                          : isMep
                          ? 'border-emerald-500/40 bg-gradient-to-b from-emerald-950/20 to-card/60'
                          : isCcl
                          ? 'border-purple-500/40 bg-gradient-to-b from-purple-950/20 to-card/60'
                          : 'bg-card/50 border-white/10'
                      }`}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm tracking-tight text-foreground">
                            {dolar.nombre}
                          </span>
                          {!isOficial && dolar.brechaVenta !== undefined && (
                            <Badge
                              variant="outline"
                              className={`text-[11px] font-semibold ${
                                dolar.brechaVenta > 20
                                  ? 'border-amber-500/30 text-amber-300 bg-amber-500/10'
                                  : 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10'
                              }`}
                            >
                              Brecha +{dolar.brechaVenta}%
                            </Badge>
                          )}
                          {isOficial && (
                            <Badge variant="outline" className="text-[11px] border-white/20 text-muted-foreground">
                              Referencia
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
                          <div>
                            <span className="text-[11px] text-muted-foreground uppercase font-medium">Compra</span>
                            <p className="text-xl font-extrabold text-foreground">
                              ${dolar.compra > 0 ? Number(dolar.compra).toFixed(2) : '-'}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] text-muted-foreground uppercase font-medium">Venta</span>
                            <p className="text-xl font-extrabold text-emerald-400">
                              ${Number(dolar.venta).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="text-[10px] text-muted-foreground flex justify-between items-center pt-1">
                          <span>Fecha: {dolar.fecha.slice(0, 10)}</span>
                          <span className="text-xs font-medium text-white/50">{dolar.casa.toUpperCase()}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Conversor Multidólar Inteligente */}
          <Card className="bg-card/40 border-white/10 backdrop-blur-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-blue-400" />
                Conversor Inteligente Multidólar
              </CardTitle>
              <CardDescription className="text-xs">
                Simula en tiempo real la conversión entre Pesos Argentinos y todas las cotizaciones del mercado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full sm:w-72">
                  <Input
                    type="number"
                    value={conversorMonto}
                    onChange={(e) => setConversorMonto(Math.max(0, Number(e.target.value)))}
                    className="h-11 pl-8 text-base font-semibold bg-background/50 border-white/15"
                    placeholder="Monto a convertir"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                    {conversorDireccion === 'ARS_TO_USD' ? '$' : 'u$s'}
                  </span>
                </div>

                <div className="inline-flex rounded-lg border border-border p-0.5 bg-background/50">
                  <button
                    onClick={() => setConversorDireccion('ARS_TO_USD')}
                    className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                      conversorDireccion === 'ARS_TO_USD'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Pesos (ARS) ➔ Dólares (USD)
                  </button>
                  <button
                    onClick={() => setConversorDireccion('USD_TO_ARS')}
                    className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                      conversorDireccion === 'USD_TO_ARS'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Dólares (USD) ➔ Pesos (ARS)
                  </button>
                </div>
              </div>

              {/* Grid de resultados de conversión */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
                {dolares.slice(0, 6).map((d) => {
                  const valorCambio = conversorDireccion === 'ARS_TO_USD' ? d.venta : d.compra;
                  const resultado =
                    conversorDireccion === 'ARS_TO_USD'
                      ? valorCambio > 0
                        ? (conversorMonto / valorCambio).toFixed(2)
                        : '0'
                      : (conversorMonto * valorCambio).toLocaleString('es-AR', {
                          maximumFractionDigits: 0,
                        });

                  return (
                    <div
                      key={d.casa}
                      className="p-3 rounded-lg bg-background/40 border border-white/5 space-y-1"
                    >
                      <span className="text-xs text-muted-foreground font-medium block truncate">
                        {d.nombre}
                      </span>
                      <p className="text-lg font-bold text-foreground">
                        {conversorDireccion === 'ARS_TO_USD' ? `u$s ${resultado}` : `$ ${resultado}`}
                      </p>
                      <span className="text-[10px] text-muted-foreground block">
                        T.C: ${valorCambio}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Variables Macro complementarias: Inflación, Plazos Fijos y UVA */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Gráfico de Inflación Mensual */}
            <Card className="lg:col-span-7 bg-card/40 border-white/10 backdrop-blur-md">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Percent className="h-4 w-4 text-amber-400" />
                      Inflación Mensual IPC (Últimos 12 Meses)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Datos oficiales extraídos mediante ArgentinaDatos API
                    </CardDescription>
                  </div>
                  {ultimaInflacion && (
                    <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-300">
                      Último: {ultimaInflacion.valor}% mensual
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full pt-4">
                  {inflacionReciente.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={inflacionReciente} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                        <XAxis dataKey="periodo" stroke="#888888" fontSize={11} tickLine={false} />
                        <YAxis stroke="#888888" fontSize={11} tickLine={false} unit="%" />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="p-2 bg-popover/95 border border-border rounded-lg shadow-xl text-xs space-y-1">
                                  <p className="font-bold text-foreground">{data.periodo}</p>
                                  <p className="text-amber-400 font-semibold">Inflación: {data.valor}%</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                          {inflacionReciente.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.valor > 4 ? '#f87171' : entry.valor > 2.5 ? '#fbbf24' : '#34d399'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                      Cargando datos de inflación...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Tarjeta de Coeficiente UVA / CER */}
            <Card className="lg:col-span-5 bg-card/40 border-white/10 backdrop-blur-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-teal-400" />
                  Valor UVA / CER Actual
                </CardTitle>
                <CardDescription className="text-xs">
                  Unidad de Valor Adquisitivo actualizada diariamente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {ultimoUva ? (
                  <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 space-y-2">
                    <span className="text-xs text-teal-300 font-medium">Valor UVA al {ultimoUva.fecha}:</span>
                    <p className="text-3xl font-extrabold text-foreground">
                      ${Number(ultimoUva.valor).toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ajusta por el Coeficiente de Estabilización de Referencia (CER). Utilizado para bonos CER y créditos hipotecarios.
                    </p>
                  </div>
                ) : (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    Cargando índice UVA...
                  </div>
                )}

                {/* Últimos registros UVA */}
                {uvaList.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-muted-foreground">Evolución reciente:</span>
                    <div className="divide-y divide-white/5 text-xs">
                      {uvaList.slice(-4).reverse().map((u) => (
                        <div key={u.fecha} className="py-2 flex justify-between items-center">
                          <span className="text-muted-foreground">{u.fecha}</span>
                          <span className="font-bold text-foreground">${Number(u.valor).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Ranking de Tasas de Plazo Fijo por Banco */}
          <Card className="bg-card/40 border-white/10 backdrop-blur-md">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-400" />
                    Comparador de Tasas de Plazo Fijo en Pesos (BCRA)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Tasas Nominales Anuales (TNA) informadas por entidades bancarias
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar banco..."
                    value={searchBanco}
                    onChange={(e) => setSearchBanco(e.target.value)}
                    className="h-9 pl-8 text-xs bg-background/50 border-white/15"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-white/10 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-white/10">
                    <tr>
                      <th className="p-3">Entidad Financiera</th>
                      <th className="p-3 text-right">TNA Clientes</th>
                      <th className="p-3 text-right">TNA No Clientes</th>
                      <th className="p-3 text-right">TEM Estimada</th>
                      <th className="p-3 text-center">Acceso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredPlazosFijos.map((banco, idx) => {
                      const tnaPercent = banco.tnaClientes ? banco.tnaClientes * 100 : 0;
                      const temEstimada = Number((tnaPercent / 12).toFixed(2));
                      return (
                        <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                            {banco.logo && (
                              <img
                                src={banco.logo}
                                alt={banco.entidad}
                                className="h-5 w-5 object-contain rounded-full bg-white p-0.5"
                                onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                              />
                            )}
                            <span className="truncate max-w-xs">{banco.entidad}</span>
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-400">
                            {tnaPercent > 0 ? `${tnaPercent.toFixed(2)}%` : '-'}
                          </td>
                          <td className="p-3 text-right text-muted-foreground">
                            {banco.tnaNoClientes ? `${(banco.tnaNoClientes * 100).toFixed(2)}%` : '-'}
                          </td>
                          <td className="p-3 text-right text-foreground font-medium">
                            ~{temEstimada}%
                          </td>
                          <td className="p-3 text-center">
                            {banco.enlace ? (
                              <a
                                href={banco.enlace}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                              >
                                Ver <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* PESTAÑA 2: CURVA LECAP & CURVA TASA FIJA (Renta Fija Soberana en Pesos) */}
        {/* ========================================================================= */}
        <TabsContent value="lecaps" className="space-y-6 mt-6">
          {/* Tarjetas resumen de tasas en la curva */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card/40 border-white/10 backdrop-blur-md">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Corto Plazo (&lt; 60 días)</span>
                <p className="text-2xl font-bold text-emerald-400">TEM 1.85% - 2.05%</p>
                <span className="text-xs text-muted-foreground">TNA equivalente: ~22% - 25%</span>
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-white/10 backdrop-blur-md">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Mediano Plazo (60 - 180 días)</span>
                <p className="text-2xl font-bold text-blue-400">TEM 2.15% - 2.32%</p>
                <span className="text-xs text-muted-foreground">TNA equivalente: ~26% - 28%</span>
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-white/10 backdrop-blur-md">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Largo Plazo (&gt; 180 días)</span>
                <p className="text-2xl font-bold text-purple-400">TEM 2.35% - 2.45%</p>
                <span className="text-xs text-muted-foreground">TNA equivalente: ~28% - 30%</span>
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-white/10 backdrop-blur-md">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Plazo Fijo vs LECAP</span>
                <p className="text-2xl font-bold text-amber-400">+250 bps</p>
                <span className="text-xs text-muted-foreground">Spread a favor de LECAP en TNA</span>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico Interactivo de la Curva de Rendimientos (Yield Curve) */}
          <Card className="bg-card/40 border-white/10 backdrop-blur-md">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                    Curva Soberana de Rendimientos a Tasa Fija (LECAPs & BONCAPs)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Estructura temporal de tasas en pesos según días al vencimiento
                  </CardDescription>
                </div>

                {/* Controles de métrica y filtros */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-lg border border-border p-0.5 bg-background/50 text-xs">
                    <button
                      onClick={() => setCurvaMetric('tem')}
                      className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
                        curvaMetric === 'tem'
                          ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      TEM (%)
                    </button>
                    <button
                      onClick={() => setCurvaMetric('tna')}
                      className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
                        curvaMetric === 'tna'
                          ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      TNA (%)
                    </button>
                    <button
                      onClick={() => setCurvaMetric('tea')}
                      className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
                        curvaMetric === 'tea'
                          ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      TEA / TIR (%)
                    </button>
                  </div>

                  <div className="inline-flex rounded-lg border border-border p-0.5 bg-background/50 text-xs">
                    <button
                      onClick={() => setFiltroTipo('TODOS')}
                      className={`px-2.5 py-1.5 font-medium rounded-md transition-colors ${
                        filtroTipo === 'TODOS'
                          ? 'bg-blue-600 text-white'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setFiltroTipo('LECAP')}
                      className={`px-2.5 py-1.5 font-medium rounded-md transition-colors ${
                        filtroTipo === 'LECAP'
                          ? 'bg-blue-600 text-white'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      LECAPs
                    </button>
                    <button
                      onClick={() => setFiltroTipo('BONCAP')}
                      className={`px-2.5 py-1.5 font-medium rounded-md transition-colors ${
                        filtroTipo === 'BONCAP'
                          ? 'bg-blue-600 text-white'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      BONCAPs
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartDataCurva}
                    margin={{ top: 15, right: 30, left: 0, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis
                      dataKey="dias"
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      label={{
                        value: 'Días al Vencimiento (Plazo Residual)',
                        position: 'insideBottom',
                        offset: -15,
                        fill: '#888888',
                        fontSize: 12,
                      }}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      domain={['auto', 'auto']}
                      unit="%"
                      label={{
                        value: curvaMetric.toUpperCase() + ' (%)',
                        angle: -90,
                        position: 'insideLeft',
                        fill: '#888888',
                        fontSize: 12,
                      }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="p-3 bg-popover/95 border border-border rounded-lg shadow-xl text-xs space-y-1.5 backdrop-blur-md">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-extrabold text-foreground text-sm">{data.ticker}</span>
                                <Badge variant="secondary" className="text-[10px]">{data.tipo}</Badge>
                              </div>
                              <p className="text-muted-foreground">Vencimiento: {data.fechaVencimiento} ({data.dias} días)</p>
                              <div className="pt-1 border-t border-white/10 space-y-0.5">
                                <p className="text-emerald-400 font-bold">TEM: {data.tem}% mensual</p>
                                <p className="text-blue-400 font-medium">TNA: {data.tna}% anual</p>
                                <p className="text-purple-400 font-medium">TEA / TIR: {data.tea}%</p>
                                <p className="text-muted-foreground">Precio ref: ${data.precio}</p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="tasa"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#064e3b' }}
                      activeDot={{ r: 8, fill: '#34d399', stroke: '#ffffff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de Instrumentos y Simulador de Inversión */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Tabla de Instrumentos */}
            <Card className="lg:col-span-8 bg-card/40 border-white/10 backdrop-blur-md">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layers className="h-4 w-4 text-emerald-400" />
                      Instrumentos en el Mercado Secundario
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Detalle de LECAPs y Bonos con tasas efectivas mensuales y nominales anuales
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-56">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Filtrar por ticker..."
                      value={searchInstrumento}
                      onChange={(e) => setSearchInstrumento(e.target.value)}
                      className="h-9 pl-8 text-xs bg-background/50 border-white/15"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-white/10 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-white/10">
                      <tr>
                        <th className="p-3">Ticker</th>
                        <th className="p-3">Vencimiento</th>
                        <th className="p-3 text-right">Días</th>
                        <th className="p-3 text-right">Precio ($)</th>
                        <th className="p-3 text-right">TEM (%)</th>
                        <th className="p-3 text-right">TNA (%)</th>
                        <th className="p-3 text-right">TEA / TIR</th>
                        <th className="p-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredInstrumentos.map((inst) => {
                        const isSelected = inst.ticker === selectedTickerSim;
                        return (
                          <tr
                            key={inst.ticker}
                            className={`transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-primary/10 border-l-2 border-l-primary'
                                : 'hover:bg-white/[0.02]'
                            }`}
                            onClick={() => {
                              setSelectedTickerSim(inst.ticker);
                              setPrecioPersonalizado('');
                            }}
                          >
                            <td className="p-3 font-bold text-foreground">
                              <div className="flex items-center gap-1.5">
                                <span>{inst.ticker}</span>
                                <Badge
                                  variant="secondary"
                                  className={`text-[9px] px-1 py-0 ${
                                    inst.tipo === 'LECAP' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-purple-500/20 text-purple-300'
                                  }`}
                                >
                                  {inst.tipo}
                                </Badge>
                              </div>
                            </td>
                            <td className="p-3 text-muted-foreground">{inst.fechaVencimiento}</td>
                            <td className="p-3 text-right font-medium">{inst.diasAlVencimiento} d</td>
                            <td className="p-3 text-right font-semibold text-foreground">${inst.precio.toFixed(2)}</td>
                            <td className="p-3 text-right font-bold text-emerald-400">{inst.tem.toFixed(2)}%</td>
                            <td className="p-3 text-right font-medium text-blue-400">{inst.tna.toFixed(2)}%</td>
                            <td className="p-3 text-right font-medium text-purple-400">{inst.tea.toFixed(2)}%</td>
                            <td className="p-3 text-center">
                              <Button
                                size="sm"
                                variant={isSelected ? 'default' : 'outline'}
                                className="h-7 px-2 text-[11px]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTickerSim(inst.ticker);
                                  setPrecioPersonalizado('');
                                }}
                              >
                                {isSelected ? 'Seleccionado' : 'Simular'}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Simulador de Rendimiento de Inversión */}
            <Card className="lg:col-span-4 bg-card/40 border-white/10 backdrop-blur-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-primary" />
                  Simulador de Inversión
                </CardTitle>
                <CardDescription className="text-xs">
                  Proyecta tu ganancia en {selectedInstrumento ? selectedInstrumento.ticker : 'LECAP'} vs Plazo Fijo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Selector de Monto */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Capital a Invertir (ARS):</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                    <Input
                      type="number"
                      value={simuladorMonto}
                      onChange={(e) => setSimuladorMonto(Math.max(1000, Number(e.target.value)))}
                      className="pl-7 font-bold text-foreground bg-background/50"
                    />
                  </div>
                </div>

                {/* Instrumento Seleccionado */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Instrumento:</label>
                  <select
                    value={selectedTickerSim}
                    onChange={(e) => {
                      setSelectedTickerSim(e.target.value);
                      setPrecioPersonalizado('');
                    }}
                    className="w-full h-10 px-3 rounded-md bg-background/50 border border-white/15 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {instrumentos.map((i) => (
                      <option key={i.ticker} value={i.ticker}>
                        {i.ticker} - Vto: {i.fechaVencimiento} ({i.diasAlVencimiento}d) - TEM: {i.tem}%
                      </option>
                    ))}
                  </select>
                </div>

                {/* Precio de compra (editable) */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <label className="font-semibold text-muted-foreground">Precio de Compra ($ cada 100 VN):</label>
                    <span className="text-[11px] text-muted-foreground">
                      Ref: ${selectedInstrumento?.precio}
                    </span>
                  </div>
                  <Input
                    type="number"
                    step="0.05"
                    placeholder={selectedInstrumento?.precio.toString()}
                    value={precioPersonalizado}
                    onChange={(e) => setPrecioPersonalizado(e.target.value)}
                    className="text-xs bg-background/50"
                  />
                </div>

                {/* Tarjeta de Resultados */}
                {simuladorCalculo && (
                  <div className="p-4 rounded-xl bg-gradient-to-b from-muted/30 to-muted/10 border border-white/10 space-y-3">
                    <div>
                      <span className="text-xs text-muted-foreground font-medium">Capital Final al Vencimiento:</span>
                      <p className="text-2xl font-black text-emerald-400">
                        ${Math.round(simuladorCalculo.capitalFinalLecap).toLocaleString('es-AR')} ARS
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/10">
                      <div>
                        <span className="text-muted-foreground">Ganancia Neta:</span>
                        <p className="font-bold text-foreground">
                          +${Math.round(simuladorCalculo.gananciaLecap).toLocaleString('es-AR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground">Rendimiento:</span>
                        <p className="font-bold text-emerald-400">
                          +{simuladorCalculo.gananciaLecapPorcentaje}%
                        </p>
                      </div>
                    </div>

                    {/* Comparativa vs Plazo Fijo */}
                    <div className="pt-2 border-t border-white/10 space-y-1.5 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>En Plazo Fijo ganarías:</span>
                        <span className="font-medium text-foreground">
                          +${Math.round(simuladorCalculo.gananciaPf).toLocaleString('es-AR')}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span className="text-muted-foreground">Ventaja de la LECAP:</span>
                        <span
                          className={
                            simuladorCalculo.diferenciaPesos >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }
                        >
                          {simuladorCalculo.diferenciaPesos >= 0 ? '+' : ''}$
                          {Math.round(simuladorCalculo.diferenciaPesos).toLocaleString('es-AR')} ARS
                        </span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Badge
                        variant="outline"
                        className={`w-full justify-center py-1 text-xs gap-1.5 ${
                          simuladorCalculo.lecapConviene
                            ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10'
                            : 'border-amber-500/30 text-amber-300 bg-amber-500/10'
                        }`}
                      >
                        <Sparkles className="h-3 w-3" />
                        {simuladorCalculo.lecapConviene
                          ? `La LECAP rinde más que el Plazo Fijo por ${simuladorCalculo.dias} días`
                          : 'El Plazo Fijo ofrece una tasa competitiva para este plazo'}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
