import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { AssetLogo } from '../../../components/ui/asset-logo';
import { useAssetLogos } from '../../../hooks/use-asset-logos';
import {
    fetchYahooEarningsCalendar,
    fetchYahooEconomicCalendar,
} from '../../../services/api/yahoo-finance-api';
import { formatCompact } from '../../asset-detail/components/insights/insight-formatters';

const COUNTRIES = [
    { code: 'US', label: 'Estados Unidos' },
    { code: 'EU', label: 'Zona euro' },
    { code: 'GB', label: 'Reino Unido' },
    { code: 'DE', label: 'Alemania' },
    { code: 'JP', label: 'Japón' },
    { code: 'CN', label: 'China' },
    { code: 'BR', label: 'Brasil' },
    { code: 'MX', label: 'México' },
    { code: 'CA', label: 'Canadá' },
    { code: 'ALL', label: 'Todos los países' },
];

const TIMING_LABELS: Record<string, string> = {
    BMO: 'Antes de la apertura',
    AMC: 'Después del cierre',
    TAS: 'Horario no informado',
    TNS: 'Horario no informado',
};

/** Monday of the week containing `date`, in local time. */
function startOfWeek(date: Date): Date {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return start;
}

function toIsoDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateTime(value: string): { day: string; time: string } {
    const date = new Date(value);
    return {
        day: date.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
        time: date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    };
}

/**
 * Weekly economic releases (actual, consensus and prior) and large-cap earnings
 * reports from Yahoo Finance's calendars.
 */
export const EconomicCalendar = () => {
    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
    const [country, setCountry] = useState('US');
    const from = toIsoDate(weekStart);
    const to = toIsoDate(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7));

    const economic = useQuery({
        queryKey: ['economic-calendar', from, to, country],
        queryFn: () => fetchYahooEconomicCalendar(from, to, country === 'ALL' ? null : country),
        staleTime: 15 * 60 * 1000,
    });
    const earnings = useQuery({
        queryKey: ['earnings-calendar', from, to],
        queryFn: () => fetchYahooEarningsCalendar(from, to),
        staleTime: 15 * 60 * 1000,
    });
    const earningsRows = useMemo(
        () => [...(earnings.data ?? [])].sort((left, right) => (right.marketCap ?? 0) - (left.marketCap ?? 0)),
        [earnings.data],
    );
    const logos = useAssetLogos(earningsRows.slice(0, 50).map((row) => row.symbol));

    const moveWeek = (weeks: number) =>
        setWeekStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7 * weeks));
    const weekLabel = `${weekStart.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} – ${new Date(
        weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6,
    ).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}`;

    const loadingState = <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    const errorState = (error: unknown) => (
        <div className="p-4 text-destructive">
            {error instanceof Error ? error.message : 'No se pudo cargar el calendario.'}
        </div>
    );

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Semana del {weekLabel}</CardTitle>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => moveWeek(-1)} aria-label="Semana anterior">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>Esta semana</Button>
                    <Button variant="outline" size="icon" onClick={() => moveWeek(1)} aria-label="Semana siguiente">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="economic">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <TabsList>
                            <TabsTrigger value="economic">Indicadores económicos</TabsTrigger>
                            <TabsTrigger value="earnings">Resultados de empresas</TabsTrigger>
                        </TabsList>
                        <Select value={country} onValueChange={setCountry}>
                            <SelectTrigger className="w-full sm:w-[200px]" aria-label="País de los indicadores">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {COUNTRIES.map((option) => (
                                    <SelectItem key={option.code} value={option.code}>{option.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <TabsContent value="economic">
                        {economic.isLoading ? loadingState : economic.isError ? errorState(economic.error) : (
                            <div className="overflow-x-auto rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>País</TableHead>
                                            <TableHead>Indicador</TableHead>
                                            <TableHead>Período</TableHead>
                                            <TableHead className="text-right">Actual</TableHead>
                                            <TableHead className="text-right">Consenso</TableHead>
                                            <TableHead className="text-right">Anterior</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(economic.data ?? []).length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                                                    No hay indicadores publicados para esta semana.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {(economic.data ?? []).map((event, index) => {
                                            const { day, time } = formatDateTime(event.date);
                                            return (
                                                <TableRow key={`${event.date}-${event.event}-${index}`}>
                                                    <TableCell className="whitespace-nowrap">
                                                        <span className="font-medium capitalize">{day}</span>
                                                        <span className="ml-2 text-xs text-muted-foreground">{time}</span>
                                                    </TableCell>
                                                    <TableCell><Badge variant="outline">{event.country}</Badge></TableCell>
                                                    <TableCell className="font-medium">{event.event}</TableCell>
                                                    <TableCell className="text-muted-foreground">{event.period ?? ''}</TableCell>
                                                    <TableCell className="text-right font-semibold tabular-nums">{event.actual ?? '—'}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{event.consensus ?? '—'}</TableCell>
                                                    <TableCell className="text-right tabular-nums text-muted-foreground">
                                                        {event.prior ?? '—'}
                                                        {event.revisedPrior && event.revisedPrior !== event.prior && (
                                                            <span className="ml-1 text-xs" title="Valor publicado originalmente">({event.revisedPrior})</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="earnings">
                        <p className="mb-3 text-xs text-muted-foreground">
                            Empresas que cotizan en EE. UU. con capitalización mayor a USD 10.000 millones, ordenadas por tamaño.
                        </p>
                        {earnings.isLoading ? loadingState : earnings.isError ? errorState(earnings.error) : (
                            <div className="overflow-x-auto rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Empresa</TableHead>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead className="hidden md:table-cell">Momento</TableHead>
                                            <TableHead className="text-right">EPS estimado</TableHead>
                                            <TableHead className="text-right">EPS real</TableHead>
                                            <TableHead className="text-right">Sorpresa</TableHead>
                                            <TableHead className="hidden text-right sm:table-cell">Capitalización</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {earningsRows.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                                                    No hay reportes de grandes empresas esta semana.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {earningsRows.map((row) => {
                                            const { day } = formatDateTime(row.date);
                                            // Yahoo reports a 0% surprise before the company publishes its EPS.
                                            const surprise = row.epsActual === null ? null : row.surprisePercent;
                                            return (
                                                <TableRow key={`${row.symbol}-${row.date}`}>
                                                    <TableCell>
                                                        <Link to={`/asset/${row.symbol}`} className="flex items-center gap-2 hover:underline">
                                                            <AssetLogo symbol={row.symbol} name={row.companyName} src={logos[row.symbol]} lookup={false} className="size-7" />
                                                            <span>
                                                                <span className="font-semibold">{row.symbol}</span>
                                                                <span className="block max-w-[180px] truncate text-xs text-muted-foreground">{row.companyName}</span>
                                                            </span>
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap capitalize">{day}</TableCell>
                                                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                                                        {TIMING_LABELS[row.timing ?? ''] ?? 'Horario no informado'}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">{row.epsEstimate?.toFixed(2) ?? '—'}</TableCell>
                                                    <TableCell className="text-right font-semibold tabular-nums">{row.epsActual?.toFixed(2) ?? '—'}</TableCell>
                                                    <TableCell className={`text-right tabular-nums ${surprise === null ? '' : surprise >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {surprise === null ? '—' : `${surprise >= 0 ? '+' : ''}${surprise.toFixed(1)}%`}
                                                    </TableCell>
                                                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatCompact(row.marketCap, 'USD')}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
};
