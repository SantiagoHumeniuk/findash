# Dashboard Feature

Dashboard principal de análisis financiero con 6 módulos especializados y gestión dinámica de tickers.

## 📋 Estructura

```
dashboard/
├── types/
│   └── dashboard-local.types.ts      # Interfaces de props locales
├── lib/
│   └── dashboard-utils.ts            # 7 utilidades para validación y normalización
├── components/
│   ├── analysis/                     # Componentes de análisis (5)
│   │   ├── correlation-matrix.tsx
│   │   ├── fundamentals-table.tsx
│   │   ├── price-analysis-table.tsx
│   │   ├── radar-comparison.tsx
│   │   └── summary-analysis.tsx
│   ├── charts/                       # Gráficos (1)
│   │   └── historical-performance-chart.tsx
│   ├── empty-state/                  # Estados vacíos (1)
│   │   └── empty-dashboard.tsx
│   ├── skeleton/                     # Skeletons (1)
│   │   └── dashboard-skeleton.tsx
│   ├── tabs/                         # Sistema de pestañas (1)
│   │   └── dashboard-tabs.tsx
│   ├── ticker-input/                 # Gestión de tickers (3)
│   │   ├── ticker-add-form.tsx
│   │   ├── ticker-badge.tsx
│   │   └── selected-tickers-list.tsx
│   └── index.ts                      # Barrel export
└── pages/
    └── dashboard-page.tsx             # Página principal
```

## 🎯 Componentes Principales

### Analysis Components

#### `correlation-matrix.tsx`
Matriz de correlación entre activos con exportación a PNG/PDF/CSV.

**Props:**
```typescript
interface CorrelationMatrixProps {
  assets: AssetData[];
}
```

**Características:**
- Cálculo de correlaciones de Pearson entre retornos históricos
- Mapa de calor visual con escala de colores
- Tooltips con valores precisos y fechas
- Exportación multi-formato (PNG/PDF/CSV)
- Manejo de datos faltantes

#### `fundamentals-table.tsx`
Tabla comparativa de fundamentales con métricas clave.

**Props:**
```typescript
interface FundamentalsTableProps {
  assets: AssetData[];
}
```

**Características:**
- 12 métricas fundamentales (P/E, P/B, ROE, etc.)
- Ordenamiento por cualquier columna
- Indicadores de calidad (ROE > 15%, Debt/Equity < 2)
- Tooltips explicativos para cada métrica
- Exportación a PDF

#### `price-analysis-table.tsx`
Análisis técnico de precios con indicadores avanzados.

**Props:**
```typescript
interface PriceAnalysisTableProps {
  assets: AssetData[];
}
```

**Características:**
- 15+ indicadores técnicos
- Rangos de 52 semanas y All-Time High
- Porcentajes de cambio con indicadores visuales
- Volumen promedio y ratio actual
- Integración con modal de transacciones
- Exportación a PDF con tema dark/light

#### `radar-comparison.tsx`
Comparación visual multidimensional con gráfico de radar.

**Props:**
```typescript
interface RadarComparisonProps {
  assets: AssetData[];
}
```

**Características:**
- 6 dimensiones de análisis
- Gráfico radar interactivo con Recharts
- Normalización de métricas heterogéneas
- Colores distintos por activo (hasta 10)
- Exportación a PNG

#### `summary-analysis.tsx`
Análisis inteligente con puntuación y recomendación.

**Props:**
```typescript
interface SummaryAnalysisProps {
  assets: AssetData[];
}
```

**Características:**
- Sistema de puntuación 0-100
- Análisis de fortalezas y debilidades
- Recomendación BUY/HOLD/SELL
- Identificación de mejor/peor activo
- Cards con iconos descriptivos

**Nota:** Exporta por defecto. Usar `import SummaryAnalysis from ...`

### Charts Components

#### `historical-performance-chart.tsx`
Gráfico de líneas temporal de rendimiento.

**Props:**
```typescript
interface HistoricalPerformanceChartProps {
  assets: AssetData[];
}
```

**Características:**
- Múltiples series de tiempo
- Selector de período (1M, 3M, 6M, YTD, 1Y, MAX)
- Colores distintos por activo
- Sincronización de fechas
- Tooltips con valores y cambios porcentuales

### Ticker Input Components

#### `ticker-add-form.tsx`
Formulario de adición de tickers con validación.

**Props:**
```typescript
interface TickerAddFormProps {
  onAddTicker: (ticker: string) => void;
}
```

**Características:**
- Validación de formato en mayúsculas
- Indicador de carga durante fetch
- El formulario de búsqueda permanece disponible mientras se cargan los activos del dashboard
- Prevención de duplicados
- Placeholder con ejemplos

#### `ticker-badge.tsx`
Badge individual de ticker con botón de eliminación.

**Props:**
```typescript
interface TickerBadgeProps {
  ticker: string;
  onRemove: (ticker: string) => void;
}
```

**Características:**
- Animación de entrada con Framer Motion
- Hover effect
- Icono X para eliminar
- Variante "secondary" de badge

#### `selected-tickers-list.tsx`
Lista animada de tickers seleccionados.

**Props:**
```typescript
interface SelectedTickersListProps {
  tickers: string[];
  onRemoveTicker: (ticker: string) => void;
}
```

**Características:**
- AnimatePresence para transiciones
- Layout responsive (grid)
- Delegación de eliminación a TickerBadge

### Empty State Components

#### `empty-dashboard.tsx`
Pantalla vacía con animación e instrucciones.

**Características:**
- Animación de fade-in con Framer Motion
- Icono de ChartCandlestick
- Mensaje de bienvenida
- Instrucciones claras

### Skeleton Components

#### `dashboard-skeleton.tsx`
Skeleton loading para estado inicial.

**Características:**
- 3 skeletons rectangulares
- Altura variable (200px, 300px, 400px)
- Animación pulsante de shadcn/ui

### Tabs Components

#### `dashboard-tabs.tsx`
Sistema de pestañas que orquesta todos los análisis.

**Props:**
```typescript
interface DashboardTabsProps {
  assets: AssetData[];
  isLoading: boolean;
}
```

**Características:**
- 6 pestañas con iconos descriptivos
- Lazy loading de componentes pesados
- Manejo de estados de carga por pestaña
- Responsive (list vertical en móvil)

**Pestañas:**
1. **Análisis de Precios** - Indicadores técnicos
2. **Fundamentales** - Métricas de valoración
3. **Correlación** - Matriz de correlaciones
4. **Comparación** - Radar multidimensional
5. **Rendimiento Histórico** - Gráfico temporal
6. **Análisis General** - Puntuación y recomendación

## 🛠️ Utilidades

### `dashboard-utils.ts`

```typescript
// Validación de formato ticker
isValidTicker(ticker: string): boolean

// Normalización a mayúsculas y trim
normalizeTicker(ticker: string): string

// Filtrado de activos válidos
filterValidAssets(assets: (AssetData | null)[]): AssetData[]

// Detección de queries en loading
hasLoadingQueries(queries: UseQueryResult[]): boolean

// Verificación de carga inicial
isInitialLoad(queries: UseQueryResult[]): boolean

// Extracción de símbolos únicos
extractUniqueSymbols(holdings: any[]): string[]

// Comparación de arrays de strings
arraysEqual(a: string[], b: string[]): boolean
```

## 📦 Tipos Locales

### `dashboard-local.types.ts`

```typescript
// Props para componentes de análisis
interface CorrelationMatrixProps { assets: AssetData[] }
interface FundamentalsTableProps { assets: AssetData[] }
interface PriceAnalysisTableProps { assets: AssetData[] }
interface RadarComparisonProps { assets: AssetData[] }
interface HistoricalPerformanceChartProps { assets: AssetData[] }
```

**Nota:** `AssetData` está definido en `src/types/dashboard.ts` (tipo global).

## 🔄 Flujo de Datos

```
DashboardPage
  ├─ useDashboard() → selectedTickers (Context)
  ├─ usePortfolio() → holdings (Supabase)
  ├─ useQueries() → Fetch paralelo de tickers (TanStack Query)
  │   ├─ Query por ticker individual
  │   └─ Cache automático (5 min staleTime)
  └─ Renderizado condicional:
      ├─ isInitialLoad → DashboardSkeleton
      ├─ validAssets.length === 0 → EmptyDashboard
      └─ validAssets.length > 0 → DashboardTabs
          └─ Distribuye assets[] a cada pestaña
```

## 🎨 Características UX

### Gestión de Estado
- **Loading inicial:** Skeleton animado
- **Loading por ticker:** Indicador en formulario
- **Estado vacío:** Animación y mensaje amigable
- **Error handling:** Filtrado silencioso de activos con error

### Animaciones
- **Framer Motion:** Entry/exit en tickers y empty state
- **Skeletons:** Pulse effect de shadcn/ui
- **Hover effects:** Badges y botones

### Responsive Design
- **Tabs:** Vertical en móvil, horizontal en desktop
- **Grid de tickers:** 1-4 columnas según viewport
- **Formulario:** Stacked en móvil, inline en desktop
- **Tablas:** Horizontal scroll en móvil

### Exportación
- **PDF:** PriceAnalysis, Fundamentals (con temas)
- **PNG:** CorrelationMatrix, RadarComparison
- **CSV:** CorrelationMatrix

## 🧪 Dependencias Clave

```json
{
  "react": "^19.0.0",
  "react-router-dom": "^7.1.3",
  "@tanstack/react-query": "^5.x",
  "framer-motion": "^11.x",
  "recharts": "^2.x",
  "lucide-react": "latest"
}
```

## 📊 Métricas

- **Componentes totales:** 12
- **Utilidades:** 7 funciones
- **Tipos locales:** 5 interfaces
- **Líneas de código:** ~1,500+
- **Pestañas de análisis:** 6

## 🚀 Uso

```tsx
import { DashboardPage } from '@/features/dashboard/pages/dashboard-page';

// En router
<Route path="/dashboard" element={<DashboardPage />} />
```

**O con barrel export:**
```tsx
import { 
  PriceAnalysisTable,
  FundamentalsTable,
  CorrelationMatrix,
  RadarComparison,
  HistoricalPerformanceChart
} from '@/features/dashboard/components';

// SummaryAnalysis es default export
import SummaryAnalysis from '@/features/dashboard/components';
```

## 🔍 Consideraciones

### Performance
- Queries paralelos con TanStack Query
- Cache de 5 minutos
- Lazy loading de componentes pesados (Recharts)
- Memoization en cálculos costosos (correlaciones)

### Accesibilidad
- Tooltips con ARIA
- Keyboard navigation en tabs
- Color contrast ratio WCAG AA
- Screen reader friendly

### Mantenibilidad
- Separación por tipo (analysis, charts, etc.)
- Barrel export para imports limpios
- Tipos TypeScript estrictos
- Utilidades reutilizables

## 📝 Notas de Refactorización

**Cambios realizados:**
1. Reorganización en subdirectorios por tipo
2. Creación de `dashboard-local.types.ts` (props)
3. Extracción de 7 utilidades a `dashboard-utils.ts`
4. Creación de `ticker-badge.tsx` (antes inline)
5. Creación de `empty-dashboard.tsx` (antes inline)
6. Actualización de imports (4 niveles arriba: `../../../../`)
7. Barrel export en `components/index.ts`
8. Renombre: `price-analisys-table.tsx` → `price-analysis-table.tsx`

**Antes:** 10 componentes en `components/`  
**Después:** 12 componentes en 6 subdirectorios + types + lib

---

**Última actualización:** Enero 2025  
**Versión:** 2.0 (Refactorización completa)
