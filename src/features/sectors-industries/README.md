# Sectores e Industrias

## Descripción General

Feature completa para analizar el performance histórico de sectores e industrias del mercado financiero. Permite a los usuarios visualizar y comparar el rendimiento de diferentes sectores económicos e industrias específicas a través del tiempo.

## Estructura de Archivos

```
src/features/sectors-industries/
├── pages/
│   └── sectors-industries-page.tsx    # Página principal (orchestrator)
├── components/
│   ├── selector.tsx                   # Selector de industria/sector
│   ├── stats-card.tsx                 # Tarjeta de estadísticas
│   ├── performance-chart.tsx          # Gráfico de líneas
│   ├── performance-table.tsx          # Tabla de datos
│   ├── yahoo-finance-test.tsx         # Prueba temporal de cotizaciones y métricas Yahoo
│   ├── skeleton.tsx                   # Loading skeleton
│   └── index.ts                       # Barrel export
├── hooks/
│   ├── use-industries.ts              # Hook para industrias
│   ├── use-sectors.ts                 # Hook para sectores
│   ├── use-industry-performance.ts    # Hook para performance de industria
│   ├── use-sector-performance.ts      # Hook para performance de sector
│   └── index.ts                       # Barrel export
├── types/
│   └── index.ts                       # Tipos TypeScript
└── lib/
    └── format-utils.ts                # Utilidades de formato
```

## Endpoints Utilizados

### 1. Available Industries
- **Endpoint:** `stable/available-industries`
- **Método:** GET
- **Respuesta:** Lista de todas las industrias disponibles
- **Cache:** 1 hora

### 2. Available Sectors
- **Endpoint:** `stable/available-sectors`
- **Método:** GET
- **Respuesta:** Lista de todos los sectores disponibles
- **Cache:** 1 hora

### 3. Historical Industry Performance
- **Endpoint:** `stable/historical-industry-performance?industry={name}`
- **Método:** GET
- **Respuesta:** Performance histórico diario de una industria específica
- **Cache:** 15 minutos

### 4. Historical Sector Performance
- **Endpoint:** `stable/historical-sector-performance?sector={name}`
- **Método:** GET
- **Respuesta:** Performance histórico diario de un sector específico
- **Cache:** 15 minutos

## Componentes Principales

### SectorsIndustriesPage
Página principal que orquesta toda la funcionalidad. Implementa un sistema de tabs para alternar entre vista de industrias y sectores.

**Características:**
- Interface con tabs (Industrias / Sectores)
- Selectores dropdown para elegir industria o sector
- 4 tarjetas de estadísticas (Último, Promedio, Máximo, Mínimo)
- Gráfico de líneas con histórico de performance
- Tabla con los últimos 15 registros

### Selector
Componente reutilizable para seleccionar industria o sector.

### StatsCard
Muestra una estadística individual con formato de porcentaje y colores dinámicos (verde/rojo).

### PerformanceChart
Gráfico de líneas usando Recharts que visualiza el cambio promedio diario en el tiempo.

**Optimizaciones:**
- React.memo para evitar re-renders innecesarios
- useMemo para procesar datos del gráfico

### PerformanceTable
Tabla que muestra los registros más recientes de performance con formato legible.

## Prueba temporal de Yahoo Finance

La pestaña **Yahoo Finance** (se abre por defecto), consulta símbolos individuales de Tecnología
(por defecto AAPL, MSFT, NVDA y GOOGL). Permite probar otros tickers, hasta un máximo
de 8 por consulta. Para cada símbolo muestra precio, PER trailing, PER forward, EPS
trailing/forward, capitalización, estado del mercado y hora de la última cotización
con su antigüedad. Los ratios se muestran por activo; no se calcula un PER agregado
del sector.

Las consultas se realizan mediante `supabase/functions/yahoo-finance-proxy`, que
obtiene el crumb/cookie requerido por Yahoo Finance y solicita `quoteSummary`.
Despliega esta función en el mismo proyecto Supabase configurado para la aplicación
antes de probar la pestaña:

```bash
supabase functions deploy yahoo-finance-proxy
```

Yahoo Finance puede no devolver ciertos campos para algunos símbolos, y los tiempos
de mercado pueden estar retrasados. Los campos ausentes se muestran como
**No disponible**; la hora que se muestra corresponde a la cotización reportada por
Yahoo, junto con el momento de recepción de la respuesta.

### Fallback automático al buscar un activo

La carga de activos intenta FMP primero. Si FMP falla, devuelve un símbolo inexistente,
o se alcanzó el límite de llamadas de FMP, `fetchTickerData` consulta el mismo proxy
Yahoo Finance para el ticker buscado. En ese caso el dashboard muestra cotización,
PER trailing y forward PER cuando Yahoo los entregue, etiqueta el activo como
**Yahoo Finance · fallback** y excluye los datos incompletos de las puntuaciones
fundamentales. Si también falla Yahoo, se usan datos guardados cuando existan; de lo
contrario se muestran ambos errores.

## Hooks Personalizados

### useIndustries()
Obtiene la lista de todas las industrias disponibles.

```typescript
const { data: industries, isLoading, error } = useIndustries();
```

### useSectors()
Obtiene la lista de todos los sectores disponibles.

```typescript
const { data: sectors, isLoading, error } = useSectors();
```

### useIndustryPerformance(industry, enabled)
Obtiene el performance histórico de una industria específica.

```typescript
const { data, isLoading, error } = useIndustryPerformance('Biotechnology');
```

### useSectorPerformance(sector, enabled)
Obtiene el performance histórico de un sector específico.

```typescript
const { data, isLoading, error } = useSectorPerformance('Energy');
```

## Tipos TypeScript

```typescript
interface Industry {
  industry: string;
}

interface Sector {
  sector: string;
}

interface HistoricalIndustryPerformance {
  date: string;              // YYYY-MM-DD
  industry: string;
  exchange: string;
  averageChange: number;     // Cambio porcentual
}

interface HistoricalSectorPerformance {
  date: string;              // YYYY-MM-DD
  sector: string;
  exchange: string;
  averageChange: number;     // Cambio porcentual
}

type ViewMode = 'industries' | 'sectors';
```

## Utilidades

### format-utils.ts
Contiene funciones helper para formateo y cálculos:

- `formatPercentage(value, decimals)` - Formatea un número como porcentaje con signo
- `getPercentageColor(value)` - Retorna clase de Tailwind según valor positivo/negativo
- `formatDate(dateString)` - Formatea fecha a formato legible en español
- `calculateStats(data)` - Calcula min, max, promedio y último valor

## Flujo de Datos

1. **Carga Inicial:** Se obtienen listas de industrias y sectores desde la API
2. **Selección:** Usuario elige una industria o sector del dropdown
3. **Fetch Performance:** Se dispara query para obtener datos históricos
4. **Cálculo de Stats:** Se procesan los datos para calcular estadísticas
5. **Renderizado:** Se muestran las tarjetas, gráfico y tabla con los datos

## Configuración

### config.json
Los endpoints están registrados en `public/config.json`:

```json
{
  "api": {
    "fmpProxyEndpoints": {
      "availableIndustries": "stable/available-industries",
      "availableSectors": "stable/available-sectors",
      "historicalIndustryPerformance": "stable/historical-industry-performance",
      "historicalSectorPerformance": "stable/historical-sector-performance"
    }
  }
}
```

### Sidebar
Link agregado en la sección "Herramientas" del sidebar:

```json
{
  "to": "/sectors-industries",
  "label": "Sectores e Industrias",
  "icon": "Factory",
  "requiresAuth": true
}
```

## Rutas

- **Path:** `/sectors-industries`
- **Protección:** Requiere autenticación (`ProtectedRoute`)
- **Lazy Loading:** ✅ Implementado
- **Error Boundary:** ✅ Implementado con nombre "Sectors & Industries"

## Performance y Optimización

### React Query
- **Stale Time:** 1 hora para listas (industries/sectors)
- **Stale Time:** 15 minutos para datos de performance
- **Cache Time:** 24 horas para listas, 30 minutos para performance

### React
- `React.memo` en `PerformanceChart` para evitar re-renders
- `React.useMemo` para cálculos de estadísticas y procesamiento de datos del gráfico

### Loading States
- Skeleton screen completo mientras carga data inicial
- Spinner individual para performance data
- Estados vacíos con mensajes claros

## Testing Manual

### Casos de Prueba

1. **Carga Inicial**
   - [ ] Skeleton se muestra correctamente
   - [ ] Las listas de industrias y sectores se cargan
   - [ ] No hay errores de consola

2. **Selección de Industria**
   - [ ] Dropdown funciona correctamente
   - [ ] Se cargan datos de performance
   - [ ] Estadísticas se calculan correctamente
   - [ ] Gráfico se renderiza sin errores
   - [ ] Tabla muestra datos formateados

3. **Selección de Sector**
   - [ ] Mismas validaciones que industria
   - [ ] Cambio de tabs funciona correctamente

4. **Edge Cases**
   - [ ] Manejo de errores de API
   - [ ] Estado cuando no hay datos
   - [ ] Loading states entre transiciones

## Mejoras Futuras

- [ ] Agregar filtros por fecha
- [ ] Comparación lado a lado de múltiples industrias/sectores
- [ ] Exportar datos a CSV/Excel
- [ ] Gráficos adicionales (barras, áreas)
- [ ] Indicadores técnicos sobre el gráfico
- [ ] Búsqueda/filtrado en los dropdowns

## Dependencias

- **React Query:** Manejo de estado del servidor
- **Recharts:** Visualización de datos
- **Lucide React:** Íconos
- **shadcn/ui:** Componentes UI (Card, Table, Select, Tabs, etc.)
- **Sonner:** Toast notifications

## Notas Importantes

- Todos los componentes siguen el patrón Feature-Sliced Design
- JSDoc completo en todos los exports
- Performance optimizada con memoization
- Error handling robusto
- Loading states en todos los niveles
- Responsive design implementado
