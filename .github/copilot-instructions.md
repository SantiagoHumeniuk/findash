# Financytics - AI Coding Agent Instructions

## Project Overview
Financytics is a React 19 + TypeScript financial analysis platform using Vite, Supabase (auth/db/edge functions), TanStack Query, and shadcn/ui components. The app provides comparative asset analysis, portfolio management, and financial tools for investors.

## Architecture Principles

**AUDIT NOTE (Oct 2025):** The audit revealed inconsistencies in this structure. Features like `blog`, `contact`, and `watchlist` lack the full `hooks/`, `lib/`, `types/` subdirectories. A key goal is to refactor these features to match the standard.

### Feature-Sliced Design
Code is organized by business domain in `src/features/`, NOT by file type. Each feature should be self-contained with its own `pages/`, `components/`, `hooks/`, `lib/`, and `types/`.

Example structure:
```
src/features/dashboard/
  ├── pages/dashboard-page.tsx
  ├── components/radar-comparison.tsx
  ├── hooks/use-asset-data.ts
```

**When adding functionality:** Find the relevant feature folder first. Only use global `src/components/` for truly shared UI components (like shadcn/ui primitives).

### Data Flow Pattern
1.  **Server State:** TanStack Query manages ALL API data.
2.  **Global Client State:** React Context for auth (`AuthProvider`), runtime configuration (`ConfigProvider`), and cross-feature UI state (`DashboardProvider`, `PortfolioProvider`).
3.  **Local State:** `useState`/`useReducer` for component-specific state.

**AUDIT NOTE (Oct 2025):** The audit confirmed `DashboardProvider` is used for sharing state like selected tickers. It also discovered `PortfolioProvider`, which seems to manage portfolio-specific state. Its role needs to be clearly defined and documented.

**Query Pattern Example:**
```typescript
// Hook wraps React Query with proper queryKey structure
export function useAssetData(ticker: string) {
  const { user, profile } = useAuth();
  const config = useConfig();
  
  return useQuery<AssetData>({
    queryKey: ['assetData', ticker, config, user, profile],
    queryFn: fetchTickerData, // Lives in src/services/api/asset-api.ts
    enabled: !!ticker,
  });
}
```

**Key architectural files:**
- `src/main.tsx` - Route configuration with lazy loading and route guards
- `src/App.tsx` - Layout shell with sidebar/header
- `docs/ARCHITECTURE.md` - Full architectural decisions and rationale

## Critical Development Workflows

### Running the App
```bash
npm run dev          # Starts Vite dev server on localhost:5173
npm run build        # TypeScript check + production build
npm run lint         # ESLint validation
```

### Environment Setup
Required env vars in `.env`:
```
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
```

The app also loads runtime config from `public/config.json` which controls:
- `useMockData` flag for development
- Market data provider (`marketDataProvider: "yahoo-finance"`, served by the `yahoo-finance-proxy` Edge Function)
- Role-based limits (API calls, portfolios per user role)
- Free tier symbols list

**Access config:** `const config = useConfig()` (from `ConfigProvider`)

### Authentication Flow
The app uses Supabase Auth with role-based access control (RBAC):
- Roles: `basico`, `plus`, `premium`, `administrador`
- Route guards: `<ProtectedRoute>`, `<GuestRoute>`, `<AdminRoute>` in `src/main.tsx`
- User state: `const { user, profile } = useAuth()` anywhere in the tree

**Profile schema** (from `src/types/auth.ts`):
```typescript
interface Profile {
  role: 'basico' | 'plus' | 'premium' | 'administrador';
  api_calls_made: number;
  last_api_call_date: Date;
  can_upload_blog: boolean;
  onboarding_completed: boolean;
  // ...
}
```

## Project-Specific Conventions

### Component Modularization Pattern
**Every feature follows a strict modular structure** to maintain code quality and testability. When refactoring or creating new features, use this organization:

```
src/features/feature-name/
├── pages/              # Page-level orchestrator components (thin, 50-100 lines)
├── components/         # Feature-specific UI components
│   └── index.ts        # Barrel export for easy imports
├── hooks/              # Feature-specific custom hooks
├── lib/                # Utility functions (type guards, helpers)
├── types/              # TypeScript interfaces and types
└── utils/              # Pure functions (calculations, formatters)
```

**Refactoring Rules:**
1. **Page components are orchestrators** - They only coordinate child components, manage context, and handle validation. Max 100 lines.
2. **Extract sections into dedicated components** - Each logical section (hero, features, forms) becomes its own component file.
3. **Separate concerns by folder:**
   - `components/` = UI rendering
   - `lib/` = utilities and helpers
   - `types/` = TypeScript definitions
   - `hooks/` = React hooks with side effects

**Example: Refactored Info Page**
```typescript
// pages/info-page.tsx (ORCHESTRATOR - 70 lines)
const InfoPage: React.FC = () => {
  const { user } = useAuth();
  const config = useConfig();
  
  // Validation only
  if (!isInfoPageConfig(config.infoPage)) {
    return <div>Loading...</div>;
  }
  
  // Render sections declaratively
  return (
    <div>
      <HeroSection {...heroProps} />
      <FeaturesSection {...featuresProps} />
      <TestimonialsSection {...testimonialsProps} />
      <FinalCtaSection {...ctaProps} />
    </div>
  );
};

// components/hero-section.tsx (FOCUSED - single responsibility)
export const HeroSection: React.FC<HeroSectionProps> = ({ title, subtitle, ctaText, ctaLink }) => {
  return (
    <section>
      <motion.h1>{title}</motion.h1>
      <motion.p>{subtitle}</motion.p>
      <Link to={ctaLink}>
        <Button>{ctaText}</Button>
      </Link>
    </section>
  );
};
```

**Barrel Exports:** Always create `components/index.ts` for clean imports:
```typescript
// components/index.ts
export { HeroSection } from './hero-section';
export { FeaturesSection } from './features-section';
// ... etc
```

### JSDoc Documentation Standard
**All exported components, functions, and types MUST have complete JSDoc comments.** This is a critical quality standard.

**AUDIT NOTE (Oct 2025):** The audit revealed significant gaps in documentation. Over 70% of components and hooks lack proper JSDoc. Priority targets for documentation are:
-   `src/features/dashboard/components/analysis/fundamentals-table.tsx`
-   `src/features/portfolio/components/charts/portfolio-charts.tsx`
-   `src/hooks/use-watchlist.ts`

```typescript
/**
 * Brief one-line description of what this component does.
 * 
 * Optional longer explanation with usage context and behavior details.
 * 
 * @example
 * ```tsx
 * <HeroSection
 *   title="Welcome"
 *   subtitle="Get started today"
 *   ctaText="Sign Up"
 *   ctaLink="/register"
 * />
 * ```
 * 
 * @remarks
 * Any important notes about performance, side effects, or gotchas
 */
export const HeroSection: React.FC<HeroSectionProps> = (props) => { ... }

/**
 * Props for the HeroSection component.
 * @property title - Main heading text
 * @property subtitle - Supporting description text
 * @property ctaText - Call-to-action button label
 * @property ctaLink - Route path for CTA button
 */
interface HeroSectionProps {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
}
```

### Performance Optimizations
**Always** wrap expensive components with `React.memo` and memoize expensive calculations with `React.useMemo`.

**AUDIT NOTE (Oct 2025):** The audit identified key components that need performance optimizations. These are high-priority refactoring targets:
-   `fundamentals-table.tsx`: The cells within the table should be memoized.
-   `historical-performance-chart.tsx`: Data passed to Recharts should be memoized with `useMemo`.

```typescript
export const RadarComparison = React.memo(function RadarComparison({ assets }) {
  const chartData = React.useMemo(() => {
    // Heavy computation here
  }, [assets]);
  // ...
});
```

Components with heavy calculations (charts, tables) in `src/features/dashboard/components/` all follow this pattern.

### TypeScript Patterns
- **Strict mode enabled** - no implicit `any`.
- Use `unknown` instead of `any` for external data and API error handling. Validate with type guards.
- API responses validated before processing (see `src/services/api/asset-api.ts`).
- **Type organization:**
  - Global types in `src/types/` by domain (auth, dashboard, portfolio, config)
  - Feature-specific types in `src/features/[feature]/types/`
  - Component prop types defined inline or in same file

**Type Guards Pattern:**
When dealing with external/runtime data, create dedicated type guard functions in `lib/type-guards.ts`:

```typescript
// features/info/lib/type-guards.ts
export function isInfoPageConfig(obj: unknown): obj is InfoPageConfig {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  
  // Validate all required properties
  return (
    typeof o.title === 'string' &&
    typeof o.subtitle === 'string' &&
    // ... exhaustive checks
  );
}

// Usage in component
const config = useConfig();
if (!isInfoPageConfig(config.infoPage)) {
  return <LoadingFallback />;
}
// Now config.infoPage is properly typed
```

### Styling with Tailwind + shadcn/ui
- Use `cn()` utility from `src/lib/utils.ts` to merge Tailwind classes: `className={cn("base-class", conditional && "extra-class")}`
- shadcn components are in `src/components/ui/` - copy/paste from shadcn, then customize
- Theme handled by `ThemeProvider` (supports dark mode via `next-themes`)

**AUDIT NOTE (Oct 2025):** The audit found a direct `fetch` call in `src/features/contact/pages/contact-page.tsx`. This MUST be refactored to use a Supabase Edge Function proxy to align with architectural principles.

### API Calls via Supabase Edge Functions
**Never** call external APIs directly from the frontend. All interactions must be proxied through Supabase Edge Functions.

```typescript
// src/services/api/yahoo-finance-api.ts pattern
const { data } = await supabase.functions.invoke('yahoo-finance-proxy', {
  body: { symbols: [ticker] }, // or { action: 'search' | 'news' | 'screener' | 'dividends' | 'sectors' | 'history' | 'filings', ... }
});
```

**Caching layer:** `asset_data_cache` table stores processed data for 1 hour before refetching.

**Rate limiting:** `checkApiLimit()` enforces per-role daily limits before API calls.

## Key Integration Points

### Supabase Tables
- `profiles` - Extended user data with role/permissions
- `transactions` - Portfolio buy/sell records
- `portfolios` - User portfolio configurations
- `asset_data_cache` - Cached API responses (1hr TTL)

### External Dependencies
- **Yahoo Finance:** Quotes, statements, analysts, peers, news, screeners and sector indexes through `yahoo-finance-proxy` (unofficial endpoints, no API key). Ratios, DCF and rating are computed client-side in `src/services/api/yahoo-fundamentals.ts`.
- **SEC EDGAR:** Statement fallback and filings for US issuers (needs the `SEC_USER_AGENT` secret).
- **Damodaran:** Country risk premiums bundled in `src/data/damodaran-country-risk.json` (`node scripts/update-damodaran-risk.mjs`).
- **Recharts:** All chart visualizations (historical, radar, correlation matrix)
- **React Router v7:** Client-side routing with lazy loading
- **Framer Motion:** Animations (minimal usage)

### Feature Communication
Features communicate through:
1. **Shared hooks:** `use-auth`, `use-config` (global context)
2. **URL params:** Asset detail pages use `:symbol` param
3. **Dashboard context:** `useDashboard()` provides `selectedTickers` array shared across dashboard components

## Common Tasks

### Adding a New Feature
1. **Create folder structure:**
   ```bash
   mkdir -p src/features/my-feature/{pages,components,hooks,lib,types}
   ```

2. **Create page component** in `pages/my-feature-page.tsx`:
   - Keep it thin (orchestrator pattern)
   - Import and compose section components
   - Add JSDoc documentation

3. **Create section components** in `components/`:
   - One file per logical section
   - Add props interface with JSDoc
   - Create `index.ts` barrel export

4. **Add route** in `src/main.tsx` with lazy loading:
   ```typescript
   const MyFeaturePage = React.lazy(() => import('./features/my-feature/pages/my-feature-page'));
   ```

5. **Add sidebar link** in `src/components/ui/app-sidebar.tsx`

6. **Add role visibility** using `isLinkVisible()` from `src/utils/sidebar-visibility.ts`

### Refactoring an Existing Component
**Follow the modularization pattern** (see example: `src/features/info/`):

1. **Analyze responsibilities** - Identify distinct concerns (UI sections, validation, utilities)

2. **Extract types first:**
   - Create `types/` folder with interfaces
   - Move all type definitions and interfaces

3. **Extract utilities:**
   - Type guards → `lib/type-guards.ts`
   - Helper functions → `lib/helpers.ts`
   - Icon maps, constants → `lib/`

4. **Extract components:**
   - Each section/card/form → separate component file
   - Add props interfaces with JSDoc
   - Use descriptive names: `hero-section.tsx`, `feature-card.tsx`

5. **Refactor page component:**
   - Remove all extracted code
   - Import and compose new components
   - Should be ~50-100 lines (orchestration only)

6. **Create barrel export:**
   - Add `components/index.ts` with all exports
   - Simplifies imports in parent components

### Adding a Data Query
1. Create service function in `src/services/api/` or `src/services/data/`
2. Wrap in custom hook using `useQuery` or `useMutation`
3. Place hook in appropriate feature's `hooks/` folder
4. Use `queryClient` from `src/lib/react-query.ts` (already configured with 5min stale time)

### Adding a shadcn Component
```bash
npx shadcn@latest add button  # Copies to src/components/ui/button.tsx
```
Then customize Tailwind classes as needed. Configuration in `components.json`.

## Code Quality Standards

### Component Size Limits
- **Page components:** 50-100 lines (orchestrators only)
- **Section components:** 50-150 lines (single responsibility)
- **Utility functions:** 20-50 lines (focused, testable)
- **If a file exceeds these limits**, consider breaking it down further

### Naming Conventions
- **Components:** PascalCase, descriptive names - `HeroSection`, `FeatureCard`, `TestimonialsCarousel`
- **Files:** kebab-case matching component - `hero-section.tsx`, `feature-card.tsx`
- **Hooks:** camelCase with "use" prefix - `useAssetData`, `useAuth`
- **Types:** PascalCase with clear suffixes - `HeroSectionProps`, `FeatureItem`, `InfoPageConfig`
- **Utilities:** camelCase, verb-based - `isInfoPageConfig`, `getIcon`, `formatCurrency`

### Import Organization
```typescript
// 1. React and external libraries
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

// 2. Internal UI components (absolute imports via @/)
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// 3. Feature components (relative imports)
import { HeroSection } from '../components/hero-section';

// 4. Hooks and utilities
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

// 5. Types
import type { InfoPageConfig } from '../types/info-config.types';
```

### When to Extract a Component
Extract when you see:
- ✅ **Repeated JSX patterns**
- ✅ **Logical sections** (e.g., hero, features, contact form)
- ✅ **Complex conditional rendering**
- ✅ **Component file exceeds 150 lines**
- ✅ **Reusability potential**

**AUDIT NOTE (Oct 2025):** The audit identified several monolithic components that are prime candidates for refactoring. Use these as examples of what to break down:
-   `src/features/blog/pages/blog-post-page.tsx` (>400 lines)
-   `src/features/plans/pages/plans-page.tsx` (>350 lines)
-   `src/features/blog/components/blog-editor-form.tsx` (>300 lines)
-   `src/features/portfolio/components/modals/add-transaction-modal.tsx` (>250 lines) - Its logic should be extracted into a `useTransactionForm` hook.

**Example - Before/After:**
```typescript
// ❌ BEFORE: Monolithic (350 lines)
const InfoPage = () => {
  // 150 lines of type guards, utilities, icon maps
  // 200 lines of JSX with all sections inline
}

// ✅ AFTER: Modular (70 lines)
const InfoPage = () => {
  const config = useConfig();
  if (!isInfoPageConfig(config)) return <Loading />;
  
  return (
    <>
      <HeroSection {...config.hero} />
      <FeaturesSection {...config.features} />
      <TestimonialsSection {...config.testimonials} />
    </>
  );
}
```

## Notes
- **React 19:** Uses new hooks but maintains compatibility with existing patterns
- **No separate test suite:** Tests referenced in README but not currently implemented
- **Windows development:** This project runs on Windows with PowerShell - use `;` for command chaining
- **Mock data mode:** Set `useMockData: true` in `public/config.json` for development without API limits
- **Refactoring reference:** See `src/features/info/` for a complete example of proper modularization
