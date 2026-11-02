import { usePageMeta } from '../../../hooks/use-page-meta';
import { EconomicCalendar } from '../components/EconomicCalendar';
import { Calendar } from 'lucide-react';

export default function EconomicCalendarPage() {
  usePageMeta('Calendario económico y de resultados', 'Indicadores económicos por país y reportes de resultados de las grandes empresas, semana a semana.');
    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="container-wide stack-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 sm:pb-6 mb-4 sm:mb-6 border-b">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg">
                            <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Calendario Económico</h1>
                            <p className="text-muted-foreground text-xs sm:text-sm">
                                Próximos eventos e indicadores económicos de todo el mundo.
                            </p>
                        </div>
                    </div>
                </div>

                <EconomicCalendar />
            </div>
        </div>
    );
}
