import { useEffect, useState } from 'react';
import { fetchEconomicCalendar } from '../services/economic-calendar-service';
import { EconomicEvent } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Badge } from '../../../components/ui/badge';
import PaginationDemo from '../../../components/ui/pagination-demo';
import { Loader2 } from 'lucide-react';

export const EconomicCalendar = () => {
    const [events, setEvents] = useState<EconomicEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        const loadEvents = async () => {
            try {
                const data = await fetchEconomicCalendar();
                setEvents(data);
            } catch (loadError) {
                setError(loadError instanceof Error ? loadError.message : 'Error al cargar el calendario económico');
            } finally {
                setLoading(false);
            }
        };
        void loadEvents();
    }, []);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    if (error) return <div className="text-destructive p-4">{error}</div>;

    const translateImpact = (impact: string) => {
        switch (impact) {
            case 'High': return 'Alto';
            case 'Medium': return 'Medio';
            case 'Low': return 'Bajo';
            case 'None': return 'Ninguno';
            default: return impact;
        }
    }

    const getImpactVariant = (impact: string): "default" | "secondary" | "destructive" | "outline" => {
        switch (impact) {
            case 'High': return 'destructive';
            case 'Medium': return 'secondary';
            case 'Low': return 'outline';
            default: return 'default';
        }
    };

    // Pagination logic
    const totalPages = Math.ceil(events.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentEvents = events.slice(startIndex, startIndex + itemsPerPage);

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Eventos Económicos</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Hora</TableHead>
                                <TableHead>País</TableHead>
                                <TableHead>Evento</TableHead>
                                <TableHead>Impacto</TableHead>
                                <TableHead className="text-right">Actual</TableHead>
                                <TableHead className="text-right">Previsto</TableHead>
                                <TableHead className="text-right">Anterior</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentEvents.map((event, index) => (
                                <TableRow key={index}>
                                    <TableCell className="font-medium">
                                        {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </TableCell>
                                    <TableCell>{event.country}</TableCell>
                                    <TableCell>{event.event}</TableCell>
                                    <TableCell>
                                        <Badge variant={getImpactVariant(event.impact)}>{translateImpact(event.impact)}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {event.actual !== null ? `${event.actual}${event.unit ?? ''}` : ''}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {event.estimate !== null ? `${event.estimate}${event.unit ?? ''}` : ''}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {event.previous !== null ? `${event.previous}${event.unit ?? ''}` : ''}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex justify-center mt-8">
                    <PaginationDemo
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                </div>
            </CardContent>
        </Card>
    );
};
