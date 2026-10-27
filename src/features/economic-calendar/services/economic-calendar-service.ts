import { EconomicEvent } from '../types';

export const fetchEconomicCalendar = (): Promise<EconomicEvent[]> => {
    return Promise.reject(new Error(
        'Yahoo Finance no publica un calendario de indicadores macroeconómicos. Esta vista no está disponible en el experimento Yahoo-only.',
    ));
};
