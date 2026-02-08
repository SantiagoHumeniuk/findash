// src/features/dashboard/components/ticker-input/ticker-add-form.tsx

import { useState, useEffect } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../components/ui/tabs';
import { SearchIcon, Check, Plus } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../../components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../../components/ui/popover";
import { cn } from "../../../../lib/utils";
import { searchAssets, SearchResult } from '../../../../services/api/search-api';
import { useConfig } from '../../../../hooks/use-config';

interface TickerAddFormProps {
  onAddTicker: (ticker: string) => void;
}

export function TickerAddForm({ onAddTicker }: TickerAddFormProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<"ticker" | "name">("ticker");
  const [tickerInput, setTickerInput] = useState("");

  const isFetching = useIsFetching(); // Estado global de React Query
  const config = useConfig();

  // Efecto de búsqueda con Debounce y protección contra Race Conditions - Solo para búsqueda por nombre
  useEffect(() => {
    if (searchMode !== "name") return; // Solo buscar cuando estemos en modo "nombre"
    
    let isActive = true; // ✅ Bandera para saber si el componente/efecto sigue vigente

    const delayDebounceFn = setTimeout(() => {
      void (async () => {
        if (!inputValue || inputValue.trim().length < 1) {
          setResults([]);
          return;
        }

      setLoading(true);
      try {
        const data = await searchAssets(inputValue, config);

        // ✅ Solo actualizamos el estado si este efecto sigue siendo el "activo"
        if (isActive) {
          setResults(data);
        }
      } catch (error) {
        console.error("Error searching assets:", error);
        if (isActive) setResults([]);
      } finally {
        if (isActive) setLoading(false);
      }
      })();
    }, 300); // 300ms debounce

    // Cleanup function
    return () => {
      isActive = false; // ✅ Cancelamos la validez de la promesa pendiente al desmontar o cambiar input
      clearTimeout(delayDebounceFn);
    };
  }, [inputValue, config, searchMode]);

  const handleSelect = (currentValue: string) => {
    // Normalizamos a mayúsculas porque los tickers son estándar así
    const ticker = currentValue.toUpperCase();
    setValue(ticker === value ? "" : ticker);
    setOpen(false);
    onAddTicker(ticker);
    setInputValue(""); // Limpiar input tras selección
  };

  const handleTickerSubmit = () => {
    const ticker = tickerInput.trim().toUpperCase();
    if (ticker) {
      onAddTicker(ticker);
      setTickerInput("");
    }
  };

  const handleTickerKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTickerSubmit();
    }
  };

  return (
    <div className="flex items-center space-x-4">
      <Tabs 
        value={searchMode} 
        onValueChange={(value) => {
          setSearchMode(value as "ticker" | "name");
          // Limpiar estados cuando cambiamos de modo
          setInputValue("");
          setTickerInput("");
          setValue("");
          setResults([]);
        }}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 mb-3">
          <TabsTrigger value="ticker">Por Ticker</TabsTrigger>
          <TabsTrigger value="name">Por Nombre</TabsTrigger>
        </TabsList>
        
        <TabsContent value="ticker" className="space-y-2">
          <div className="flex items-center space-x-2">
            <Input
              placeholder="Escribe el ticker (ej. AAPL, MSFT)..."
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value)}
              onKeyPress={handleTickerKeyPress}
              className="flex-1"
              disabled={isFetching > 0}
            />
            <Button 
              onClick={handleTickerSubmit}
              disabled={!tickerInput.trim() || isFetching > 0}
              size="sm"
            >
              <Plus className="h-4 w-4" />
              Añadir
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Escribe directamente el símbolo del activo (ej. AAPL para Apple Inc.)
          </p>
        </TabsContent>
        
        <TabsContent value="name" className="space-y-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between text-muted-foreground hover:text-foreground"
                disabled={isFetching > 0}
              >
                <span className="truncate">
                  {value ? value : "Buscar activo por nombre..."}
                </span>
                <SearchIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command shouldFilter={false}> {/* Importante: false porque filtramos en servidor/API */}
                <CommandInput
                  placeholder="Escribe nombre de empresa..."
                  value={inputValue}
                  onValueChange={setInputValue}
                />
                <CommandList>
                  {loading && (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      Buscando...
                    </div>
                  )}

                  {!loading && results.length === 0 && inputValue.length > 0 && (
                    <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                  )}

                  {!loading && results.map((result) => (
                    <CommandItem
                      key={result.symbol}
                      value={result.symbol}
                      onSelect={handleSelect}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === result.symbol ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col w-full overflow-hidden">
                        <div className="flex justify-between items-center">
                          <span className="font-medium flex items-center gap-1.5">
                            {result.symbol}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                            {result.exchangeShortName}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground truncate" title={result.name}>
                          {result.name}
                        </span>
                      </div>
                    </CommandItem>
                  ))}

                  {/* Opción de añadido manual si no hay coincidencias exactas */}
                  {!loading && inputValue.length > 0 && !results.some(r => r.symbol === inputValue.toUpperCase()) && (
                    <>
                      <div className="px-2 py-1.5 text-xs text-muted-foreground bg-muted/50 font-medium mt-1">
                        Acción manual
                      </div>
                      <CommandItem
                        value={inputValue}
                        onSelect={() => handleSelect(inputValue)}
                        className="cursor-pointer"
                      >
                        <Check className="mr-2 h-4 w-4 opacity-0" />
                        <div className="flex flex-col">
                          <span className="font-medium">{inputValue.toUpperCase()}</span>
                          <span className="text-xs text-muted-foreground">Agregar manualmente</span>
                        </div>
                      </CommandItem>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">
            Busca empresas por nombre y selecciona de los resultados
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}