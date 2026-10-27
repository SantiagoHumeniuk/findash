// src/features/portfolio/components/portfolio-selector.tsx

import React, { useState } from 'react';
import { usePortfolio } from '../../../hooks/use-portfolio';
import { Check, ChevronsUpDown, Plus, Trash2, LayoutGrid } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '../../../components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '../../../components/ui/popover';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { usePlanLimits } from '../../../hooks/use-plan-limits';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import { UpgradeModal } from '../../../components/shared/upgrade-modal';

export const PortfolioSelector = React.memo(function PortfolioSelector() {
    const { portfolios, currentPortfolio, selectPortfolio, createPortfolio, deletePortfolio } = usePortfolio();
    const [open, setOpen] = useState(false);
    const [showNewPortfolioDialog, setShowNewPortfolioDialog] = useState(false);
    const [newPortfolioName, setNewPortfolioName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    // Delete state
    const [portfolioToDelete, setPortfolioToDelete] = useState<number | null>(null);

    const { isAtLimit, limitMessage, limit, currentPlan } = usePlanLimits('portfolios', portfolios.length);

    const handleCreate = async () => {
        if (!newPortfolioName.trim()) return;

        setIsCreating(true);
        try {
            await createPortfolio(newPortfolioName);
            setNewPortfolioName('');
            setShowNewPortfolioDialog(false);
            setOpen(false);
            toast.success('Portafolio creado exitosamente');
        } catch {
            toast.error('Error al crear el portafolio');
        } finally {
            setIsCreating(false);
        }
    };

    const handleOpenCreate = () => {
        if (isAtLimit) {
            setShowUpgradeModal(true);
        } else {
            setShowNewPortfolioDialog(true);
        }
    };

    const handleDelete = async () => {
        if (!portfolioToDelete) return;
        setIsDeleting(true);
        try {
            await deletePortfolio(portfolioToDelete);
            toast.success('Portafolio eliminado');
        } catch (error) {
            console.error('Error deleting portfolio:', error);
            toast.error('Error al eliminar portafolio', {
                description: error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
            });
        } finally {
            setPortfolioToDelete(null);
            setIsDeleting(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-[250px] justify-between"
                    >
                        <div className="flex items-center gap-2 truncate">
                            {currentPortfolio ? (
                                <span>{currentPortfolio.name}</span>
                            ) : (
                                <>
                                    <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                                    <span>Todas las Inversiones</span>
                                </>
                            )}
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0">
                    <Command>
                        <CommandInput placeholder="Buscar portafolio..." />
                        <CommandList>
                            <CommandEmpty>No se encontraron portafolios.</CommandEmpty>
                            <CommandGroup>
                                <CommandItem
                                    value="Todas las Inversiones"
                                    onSelect={() => {
                                        selectPortfolio(null);
                                        setOpen(false);
                                    }}
                                    className="flex items-center gap-2"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            currentPortfolio === null ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                                    Todas las Inversiones
                                </CommandItem>
                            </CommandGroup>
                            <CommandSeparator />
                            <CommandGroup heading="Mis Portafolios">
                                {portfolios.map((portfolio) => (
                                    <CommandItem
                                        key={portfolio.id}
                                        value={portfolio.name}
                                        onSelect={() => {
                                            selectPortfolio(portfolio.id);
                                            setOpen(false);
                                        }}
                                        className="group flex justify-between items-center"
                                    >
                                        <div className="flex items-center">
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    currentPortfolio?.id === portfolio.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {portfolio.name}
                                        </div>
                                        <div
                                            role="button"
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPortfolioToDelete(portfolio.id);
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3 text-destructive" aria-hidden="true" />
                                            <span className="sr-only">Eliminar portafolio {portfolio.name}</span>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                            <CommandSeparator />
                            <CommandGroup>
                                <CommandItem onSelect={handleOpenCreate}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Crear Nuevo Portafolio
                                </CommandItem>
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            <Dialog open={showNewPortfolioDialog} onOpenChange={setShowNewPortfolioDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Crear Nuevo Portafolio</DialogTitle>
                        <DialogDescription>
                            Organiza tus activos en un nuevo grupo.
                            {isAtLimit && <span className="block text-destructive mt-2">{limitMessage}</span>}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Input
                                id="name"
                                placeholder="Ej: Acciones Tecnológicas"
                                value={newPortfolioName}
                                onChange={(e) => setNewPortfolioName(e.target.value)}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Plan actual: <span className="font-medium capitalize">{currentPlan}</span>.
                            Estás usando {portfolios.length} de {limit} portafolios permitidos.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewPortfolioDialog(false)}>Cancelar</Button>
                        <Button onClick={() => void handleCreate()} disabled={!newPortfolioName.trim() || isCreating || isAtLimit}>
                            {isCreating ? 'Creando...' : 'Crear Portafolio'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!portfolioToDelete} onOpenChange={(open) => !open && setPortfolioToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará el portafolio y todo su historial de transacciones asociado.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void handleDelete()} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                {isDeleting ? 'Eliminando...' : 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <UpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                featureName="Múltiples Portafolios"
                requiredPlan="plus"
            />
        </div>
    );
});
