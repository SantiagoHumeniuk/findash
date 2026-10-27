import { Banknote, Calendar } from "lucide-react";
import { Button } from "./button"
import {
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from "./dialog"
import { Input } from "./input"
import { Label } from "./label"
import React from "react";

// Definiendo un tipo para los datos del dividendo para mayor claridad
interface Dividend {
    symbol: string;
    dividend: number | null;
    paymentDate: string;
};

// Se reciben las props de forma destructurada para un código más limpio
export function CalculateDividendModal({ dividend }: { dividend: Dividend }) {
    const [nominales, setNominales] = React.useState('');

    // Se calcula el total en una variable para mantener el JSX más legible
    const totalEstimado = (parseFloat(nominales) || 0) * (dividend.dividend ?? 0);

    return (
        <DialogContent className="w-11/12 sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">
                    Calcular Dividendo para <span className="text-primary">{dividend?.symbol}</span>
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                    Ingresa la cantidad de acciones que posees para estimar tu ganancia.
                </DialogDescription>
            </DialogHeader>

            {/* Usamos space-y para un espaciado vertical consistente */}
            <div className="grid gap-4 sm:gap-6 py-3 sm:py-4">
                
                {/* --- SECCIÓN DE ENTRADA DEL USUARIO --- */}
                <div className="grid gap-1.5 sm:gap-2">
                    <Label htmlFor="nominales-input" className="font-semibold text-xs sm:text-sm">Cantidad de Acciones</Label>
                    <Input
                        id="nominales-input"
                        type="number"
                        placeholder="Ej: 100"
                        min="0"
                        value={nominales}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNominales(e.target.value)}
                        className="col-span-3 text-sm sm:text-base"
                    />
                </div>

                {/* --- SECCIÓN DE DATOS INFORMATIVOS --- */}
                <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 border rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm text-muted-foreground">
                            <Banknote className="inline w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 text-chart-2" /> Dividendo por Acción
                        </span>
                        <span className="font-semibold text-sm sm:text-base">
                            {dividend.dividend === null ? 'No disponible' : `$${dividend.dividend.toFixed(4)}`}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm text-muted-foreground">
                            <Calendar className="inline w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 text-chart-3" /> Fecha de Pago
                        </span>
                        <span className="font-semibold text-sm sm:text-base">
                            {dividend?.paymentDate ? new Date(dividend.paymentDate).toLocaleDateString("es-ES") : ''}
                        </span>
                    </div>
                </div>

                {/* --- SECCIÓN DEL RESULTADO FINAL CON ÉNFASIS --- */}
                <div className="p-3 sm:p-4 text-center border-2 border-green-500 rounded-lg bg-green-50">
                    <Label className="text-xs sm:text-sm font-semibold text-green-800">TOTAL ESTIMADO A RECIBIR</Label>
                    <div className="mt-1 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-green-700">
                        ${totalEstimado.toFixed(2)}
                    </div>
                </div>

            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline" size="sm" type="button" className="text-xs sm:text-sm">Cerrar</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    )
}