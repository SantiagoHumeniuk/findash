# Asset Detail Feature

## 📋 Descripción

Feature que muestra información detallada de un activo financiero individual. Incluye datos de precio, métricas clave, valoración DCF, calificación, información de la empresa y análisis financiero completo.

## 🏗️ Estructura del Feature

```
asset-detail/
├── components/
│   ├── error-states/        # Estados de error
│   │   ├── loading-error.tsx
│   │   └── not-found-error.tsx
│   ├── financials/          # Tab de métricas financieras
│   │   ├── asset-financials-tab.tsx
│   │   └── financial-metric-card.tsx
│   ├── header/              # Encabezado del activo
│   │   └── asset-header.tsx
│   ├── profile/             # Tab de perfil
│   │   ├── asset-profile-tab.tsx
│   │   ├── company-info-item.tsx
│   ├── rating/              # Componentes de calificación
│   │   ├── dcf-card.tsx
│   │   ├── dcf-valuation-card.tsx
│   │   ├── rating-scorecard.tsx
│   │   └── rating-stars.tsx
│   ├── skeleton/            # Loading skeleton
│   │   └── asset-detail-skeleton.tsx
│   ├── asset-detail-tabs.tsx
│   └── index.ts             # Barrel export
├── lib/                     # Utilidades
│   └── asset-formatters.ts  # Funciones de formateo
├── pages/                   # Páginas
│   └── asset-detail-page.tsx
├── types/                   # Tipos TypeScript
│   └── asset-detail.types.ts
└── README.md
```

## 🎯 Componentes Principales

### Página Principal
- **AssetDetailPage**: Orquestador principal de las secciones Perfil, Gráfico, Finanzas, Noticias, Ratings y Evolución

### Header y Métricas
- **AssetHeader**: Logo, nombre y símbolo; las cotizaciones y métricas se muestran en Finanzas.

### Calificación y Valoración
- Las tarjetas de DCF y calificaciones no se muestran en el experimento Yahoo-only porque Yahoo no ofrece esos conjuntos de datos.

### Tabs de Contenido
- **AssetProfileTab**: Información general de la empresa
- **AssetFinancialsTab**: Tablas históricas de estados financieros para fuentes que proveen esos datos. En el flujo Yahoo-only no se muestra la pestaña Fundamentales: los campos Yahoo se reservan para cálculos y otras vistas de la app.
- **CompanyInfoItem**: Campo individual de información corporativa

### Estados de Error
- **LoadingError**: Error al cargar datos del servidor
- **NotFoundError**: Activo no encontrado
- **AssetDetailSkeleton**: Loading skeleton completo

## 📦 Tipos Principales

```typescript
// Importados de src/types/dashboard.ts
AssetData           # Datos del activo normalizados antes de mostrarlos por sección
AssetRating         # Tipo legado; Yahoo Finance no provee calificaciones equivalentes

// Locales en types/asset-detail.types.ts
ErrorStateProps     # Props para componentes de error
FinancialMetric     # Métrica individual {label, value}
FinancialSection    # Sección con múltiples métricas
```

## 🛠️ Utilidades

### asset-formatters.ts
- `formatLargeNumber(num)`: Formatea números grandes (1.5B, 250M, etc.)
- `formatPrice(price)`: Formatea precios con símbolo de dólar
- `formatPercentage(percent)`: Formatea porcentajes con %
- `calculateDCFDifference(current, dcf)`: Calcula diferencia porcentual

## 🔗 Dependencias

### Internas
- `src/types/dashboard.ts`: Tipos de datos principales
- `src/utils/financial.ts`: Configuración de indicadores financieros
- `features/dashboard/hooks/use-asset-data.ts`: Hook para cargar datos
- `features/dashboard/components/historical-performance-chart.tsx`: Gráfico histórico

### Externas
- `react-router-dom`: Navegación y parámetros de URL
- `recharts`: Gráficos financieros
- `framer-motion`: Animaciones de entrada
- `lucide-react`: Iconos

## 📊 Métricas del Feature

### Antes de la refactorización
- **8 archivos** de componentes
- **~620 líneas** de código
- Lógica duplicada en múltiples archivos
- Componentes de 150+ líneas

### Después de la refactorización
- **24 archivos** de componentes
- **~800 líneas** de código (mejor organizadas)
- **3 archivos** de utilidades compartidas
- **1 archivo** de tipos locales
- Componentes de 30-70 líneas promedio
- Separación clara de responsabilidades

### Mejoras Clave
- ✅ Componentes de error reutilizables
- ✅ Utilidades de formateo centralizadas
- ✅ Configuración de charts separada
- ✅ Sub-features organizadas por dominio (error-states, profile, financials, rating, metrics)
- ✅ Barrel exports para imports limpios
- ✅ JSDoc completo en todos los exports
- ✅ Tipos TypeScript estrictos

## 🚀 Uso

### Navegación
```typescript
// Desde cualquier componente
<Link to={`/dashboard/${symbol}`}>Ver detalle</Link>

// Ejemplo: /dashboard/AAPL
```

### Integración con Dashboard
El feature se integra automáticamente con el Dashboard hook `use-asset-data`:
```typescript
const { data, isLoading, isError } = useAssetData(symbol);
```

## 🎨 Diseño y UX

### Responsive Design
- **Móvil**: Grid 1 columna, tabs verticales
- **Tablet**: Grid 2-3 columnas
- **Desktop**: Grid completo 6 columnas para métricas

### Estados
- **Loading**: Skeleton con placeholders animados
- **Error**: Mensaje claro + botón de vuelta
- **Not Found**: Mensaje específico con símbolo buscado
- **Success**: Contenido completo con animación de entrada

### Animaciones
- Fade in inicial (0.4s)
- Transición de tabs (0.3s)
- Skeleton pulso

## 📝 Patrones de Código

### Componentes Funcionales
```typescript
export function ComponentName({ prop }: Props) {
  return <div>...</div>;
}
```

### Barrel Exports
```typescript
// components/index.ts
export { ComponentA } from './folder/component-a';
export { ComponentB } from './folder/component-b';
```

### JSDoc
```typescript
/**
 * Descripción breve del componente.
 * 
 * Detalles adicionales de uso o comportamiento.
 * 
 * @example
 * ```tsx
 * <Component prop="value" />
 * ```
 */
```

### Props con Tipos Estrictos
```typescript
interface Props {
  /** Descripción de la prop */
  required: string;
  optional?: number;
}
```

## 🔄 Próximas Mejoras

- [ ] Tab de noticias con noticias de Yahoo Finance
- [ ] Gráficos adicionales (candlesticks, volumen)
- [ ] Comparación con competidores
- [ ] Alertas de precio
- [ ] Agregar a favoritos
- [ ] Compartir enlace directo

## 📚 Referencias

- [Recharts Documentation](https://recharts.org/)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Framer Motion](https://www.framer.com/motion/)
