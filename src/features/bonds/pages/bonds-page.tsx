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
  Zap,
} from 'lucide-react';
import {
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
  DolarCotizacion,
  InflacionDato,
  PlazoFijoDato,
  UvaDato,
} from '@/services/macro-api';
import { Data912FixedIncome } from '../components/data912-fixed-income';

export default function BondsPage() {
  const [activeTab, setActiveTab] = useState<'macro' | 'live'>('live');

  // Estados de Dólares y Macro
  const [dolares, setDolares] = useState<DolarCotizacion[]>([]);
  const [inflacion, setInflacion] = useState<InflacionDato[]>([]);
  const [plazosFijos, setPlazosFijos] = useState<PlazoFijoDato[]>([]);
  const [uvaList, setUvaList] = useState<UvaDato[]>([]);
  const [loadingMacro, setLoadingMacro] = useState<boolean>(true);
  const [macroErrors, setMacroErrors] = useState<string[]>([]);

  // Estados del Conversor de Moneda
  const [conversorMonto, setConversorMonto] = useState<number>(100000);
  const [conversorDireccion, setConversorDireccion] = useState<'ARS_TO_USD' | 'USD_TO_ARS'>('ARS_TO_USD');

  // Buscador de Plazos Fijos
  const [searchBanco, setSearchBanco] = useState<string>('');

  // Carga inicial de datos
  const loadMacroData = async (preferredProvider: 'argentinadatos' | 'dolarazo') => {
    setLoadingMacro(true);
    const [dolaresRes, inflacionRes, pfRes, uvaRes] = await Promise.allSettled([
      fetchUnifiedDolares(preferredProvider),
      fetchInflacion(),
      fetchPlazosFijos(),
      fetchUva(),
    ]);
    const failures: string[] = [];
    if (dolaresRes.status === 'rejected') {
      failures.push(`dólares: ${dolaresRes.reason instanceof Error ? dolaresRes.reason.message : 'error desconocido'}`);
    }
    if (inflacionRes.status === 'rejected') {
      failures.push(`inflación: ${inflacionRes.reason instanceof Error ? inflacionRes.reason.message : 'error desconocido'}`);
    }
    if (pfRes.status === 'rejected') {
      failures.push(`plazos fijos: ${pfRes.reason instanceof Error ? pfRes.reason.message : 'error desconocido'}`);
    }
    if (uvaRes.status === 'rejected') {
      failures.push(`UVA: ${uvaRes.reason instanceof Error ? uvaRes.reason.message : 'error desconocido'}`);
    }
    setMacroErrors(failures);

    if (dolaresRes.status === 'fulfilled') {
      setDolares(dolaresRes.value.dolares);
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
    setLoadingMacro(false);
  };

  useEffect(() => {
    void loadMacroData('argentinadatos');
  }, []);

  // Filtrado de Plazos Fijos
  const filteredPlazosFijos = useMemo(() => {
    if (!searchBanco.trim()) return plazosFijos.slice(0, 15);
    return plazosFijos
      .filter((b) => b.entidad.toLowerCase().includes(searchBanco.toLowerCase()))
      .slice(0, 15);
  }, [plazosFijos, searchBanco]);

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
            onClick={() => { void loadMacroData('argentinadatos'); }}
            disabled={loadingMacro}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingMacro ? 'animate-spin' : ''}`} />
            <span className="text-xs hidden sm:inline">Actualizar</span>
          </Button>
        </div>
      </div>

      {/* Market data and live fixed income */}
      <Tabs value={activeTab} onValueChange={(val) => {
        if (val === 'macro' || val === 'live') setActiveTab(val);
      }} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-3xl mx-auto h-12 p-1 bg-muted/40 border border-white/10 rounded-xl">
          <TabsTrigger
            value="live"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold transition-all"
          >
            <TrendingUp className="h-4 w-4" />
            <span>1. Renta Fija en Vivo</span>
          </TabsTrigger>
          <TabsTrigger
            value="macro"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold transition-all"
          >
            <DollarSign className="h-4 w-4" />
            <span>2. Dólares & Variables Macro</span>
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* PESTAÑA 1: DÓLARES & VARIABLES MACRO */}
        {/* ========================================================================= */}
        <TabsContent value="macro" className="space-y-6 mt-6">
          {macroErrors.length > 0 && (
            <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              No se pudieron cargar algunas variables: {macroErrors.join(' · ')}
            </div>
          )}
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
                              ${dolar.compra > 0 ? Number(dolar.compra).toFixed(2) : ''}
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
                      Datos oficiales actualizados
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
                            if (active && payload?.length) {
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
                            {tnaPercent > 0 ? `${tnaPercent.toFixed(2)}%` : ''}
                          </td>
                          <td className="p-3 text-right text-muted-foreground">
                            {banco.tnaNoClientes ? `${(banco.tnaNoClientes * 100).toFixed(2)}%` : ''}
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
                            ) : null}
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

        <TabsContent value="live" className="space-y-6 mt-6">
          <Data912FixedIncome plazosFijos={plazosFijos} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
