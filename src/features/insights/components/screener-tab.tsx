
import { useMemo, useState } from 'react';
import { useScreenerData } from '../hooks/use-screener';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import { Loader2, FilterX, Search } from 'lucide-react';

export function ScreenerTab() {
    const { data: assets, isLoading, error } = useScreenerData();

    // Filters State
    const [searchTerm, setSearchTerm] = useState('');
    const [sector, setSector] = useState<string>('all');
    const [lynchCategory, setLynchCategory] = useState<string>('all');

    // Custom Ranges
    const [maxPe, setMaxPe] = useState<number>(100);
    const [maxPeg, setMaxPeg] = useState<number>(5);
    const [minYield, setMinYield] = useState<number>(0);

    // Derived Sectors
    const sectors = useMemo(() => {
        if (!assets) return [];
        const s = new Set(assets.map(a => a.sector).filter(Boolean));
        return Array.from(s).sort();
    }, [assets]);

    // Filtering Logic
    const filteredAssets = useMemo(() => {
        if (!assets) return [];

        return assets.filter(asset => {
            // 1. Search Term
            if (searchTerm) {
                const terms = searchTerm.toLowerCase().split(' ');
                const text = `${asset.symbol} ${asset.companyName}`.toLowerCase();
                if (!terms.every(t => text.includes(t))) return false;
            }

            // 2. Sector
            if (sector !== 'all' && asset.sector !== sector) return false;

            // 3. Quantitative Filters
            const pe = asset.PER;
            const peg = asset.pegRatio;
            const divYield = asset.dividendYield;

            // Handle missing data by allowing it to pass (lenient filtering)
            // Only filter OUT if the value exists AND exceeds the limit
            if (typeof pe === 'number' && pe > maxPe) return false;
            if (typeof peg === 'number' && peg > maxPeg) return false;
            // For min yield, we want to filter OUT if value is known to be less than min
            // If missing (undefined), treat as 0 for yield (usually implies no dividend)
            const yieldVal = typeof divYield === 'number' ? divYield * 100 : 0;
            if (yieldVal < minYield) return false;

            // 4. Lynch Categories
            if (lynchCategory !== 'all') {
                // Specific logic per category
                if (lynchCategory === 'fastGrower') {
                    // High growth (>20%), Low PEG (<1)
                    // If PEG is missing, treat as high (fail)
                    const p = typeof peg === 'number' ? peg : 999;
                    if (p >= 1 || (typeof asset.roe === 'number' && asset.roe < 0.15)) return false;
                }
                if (lynchCategory === 'stalwart') {
                    // Moderate growth, mod PE
                    // If PE is missing, treat as invalid (fail)
                    const p = typeof pe === 'number' ? pe : -1;
                    if (p > 20 || p < 10) return false;
                }
                if (lynchCategory === 'slowGrower') {
                    // High Dividend
                    const y = typeof divYield === 'number' ? divYield : 0;
                    if (y < 0.03) return false;
                }
                if (lynchCategory === 'assetPlay') {
                    // Price < Book
                    const pb = asset.priceToBook;
                    if (typeof pb !== 'number' || pb > 1) return false;
                }
            }

            return true;
        });
    }, [assets, searchTerm, sector, lynchCategory, maxPe, maxPeg, minYield]);

    if (isLoading) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
    }

    if (error) {
        return <div className="text-red-500 p-4">Error cargando datos del screener.</div>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Filtros de Búsqueda</CardTitle>
                    <CardDescription>Refina tu búsqueda utilizando criterios fundamentales y categorías de Peter Lynch.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6">

                    {/* Top Row: Search & Categories */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Buscar Activo</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Símbolo o empresa..."
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Categoría Peter Lynch</Label>
                            <Select value={lynchCategory} onValueChange={setLynchCategory}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    <SelectItem value="fastGrower">Fast Growers (Crecimiento Rápido)</SelectItem>
                                    <SelectItem value="stalwart">Stalwarts (Empresas Sólidas)</SelectItem>
                                    <SelectItem value="slowGrower">Slow Growers (Alto Dividendo)</SelectItem>
                                    <SelectItem value="assetPlay">Asset Plays (Infravaloradas por Activos)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Sector</Label>
                            <Select value={sector} onValueChange={setSector}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Middle Row: Sliders / Numeric */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <Label>Máx P/E Ratio: {maxPe}</Label>
                            </div>
                            <Input
                                type="range"
                                min={5}
                                max={100}
                                step={1}
                                value={maxPe}
                                onChange={e => setMaxPe(Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <Label>Máx PEG Ratio: {maxPeg.toFixed(1)}</Label>
                            </div>
                            <Input
                                type="range"
                                min={0.1}
                                max={5}
                                step={0.1}
                                value={maxPeg}
                                onChange={e => setMaxPeg(Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <Label>Mín Dividend Yield: {minYield}%</Label>
                            </div>
                            <Input
                                type="range"
                                min={0}
                                max={10}
                                step={0.5}
                                value={minYield}
                                onChange={e => setMinYield(Number(e.target.value))}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSector('all');
                                setLynchCategory('all');
                                setSearchTerm('');
                                setMaxPe(100);
                                setMaxPeg(5);
                                setMinYield(0);
                            }}
                            className="gap-2"
                        >
                            <FilterX className="h-4 w-4" />
                            Limpiar Filtros
                        </Button>
                    </div>

                </CardContent>
            </Card>

            {/* Results Table */}
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Símbolo</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Sector</TableHead>
                            <TableHead className="text-right">Precio</TableHead>
                            <TableHead className="text-right">P/E</TableHead>
                            <TableHead className="text-right">PEG</TableHead>
                            <TableHead className="text-right">Div. Yield</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAssets.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                    No se encontraron activos con estos criterios.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredAssets.slice(0, 50).map(asset => {
                                const pe = typeof asset.PER === 'number' && Number.isFinite(asset.PER) ? asset.PER.toFixed(2) : '';
                                const peg = typeof asset.pegRatio === 'number' && Number.isFinite(asset.pegRatio) ? asset.pegRatio.toFixed(2) : '';
                                const div = typeof asset.dividendYield === 'number' && Number.isFinite(asset.dividendYield) ? (asset.dividendYield * 100).toFixed(2) + '%' : '';

                                return (
                                    <TableRow key={asset.symbol}>
                                        <TableCell className="font-medium">{asset.symbol}</TableCell>
                                        <TableCell className="max-w-[180px] truncate" title={asset.companyName}>
                                            {asset.companyName}
                                        </TableCell>
                                        <TableCell>{asset.sector}</TableCell>
                                        <TableCell className="text-right">${asset.currentPrice.toFixed(2)}</TableCell>
                                        <TableCell className="text-right">{pe}</TableCell>
                                        <TableCell className="text-right font-mono text-xs">{peg}</TableCell>
                                        <TableCell className="text-right text-green-600">{div}</TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="text-xs text-muted-foreground text-right px-2">
                Mostrando primeros 50 resultados de {filteredAssets.length} encontrados.
            </div>
        </div>
    );
}
