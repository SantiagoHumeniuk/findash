// src/main.tsx

import React, { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/react-query';

// Suprimir warnings de desarrollo no críticos
import './lib/suppress-dev-warnings';

import './index.css';
import App from './App.tsx';
import { AuthProvider } from './providers/auth-provider.tsx';
import { ConfigProvider } from './providers/config-provider.tsx';
import { DashboardProvider } from './providers/dashboard-provider.tsx';
import { PortfolioProvider } from './providers/portfolio-provider.tsx';
import { initPerformanceMonitoring } from './lib/performance.ts';

// Skeleton loaders
import { PageSkeleton, AuthPageSkeleton } from './components/ui/page-skeleton.tsx';
import { DashboardSkeleton } from './features/dashboard/components/skeleton/dashboard-skeleton.tsx';
import { PortfolioSkeleton } from './features/portfolio/components/skeleton/portfolio-skeleton.tsx';
import { AssetDetailSkeleton } from './features/asset-detail/components/skeleton/asset-detail-skeleton.tsx';
import { SuspenseFallback } from './components/suspense';
import { ErrorBoundary } from './components/error-boundary';

// Importación de los guardianes de rutas
import { ProtectedRoute } from './features/auth/components/protected-route.tsx';
import { GuestRoute } from './features/auth/components/guest-route.tsx';
import { AdminRoute } from './features/auth/components/admin-route.tsx';

// Lazy loading de páginas
const LoginPage = React.lazy(() => import('./features/auth/pages/login-page.tsx'));
const RegisterPage = React.lazy(() => import('./features/auth/pages/register-page.tsx'));
const ForgotPasswordPage = React.lazy(() => import('./features/auth/pages/forgot-password-page.tsx'));
const ResetPasswordPage = React.lazy(() => import('./features/auth/pages/reset-password-page.tsx'));
const InfoPage = React.lazy(() => import('./features/info/pages/info-page.tsx'));
const NotFoundPage = React.lazy(() => import('./features/not-found/pages/not-found-page.tsx'));
const DashboardPage = React.lazy(() => import('./features/dashboard/pages/dashboard-page.tsx'));
const AssetDetailPage = React.lazy(() => import('./features/asset-detail/pages/asset-detail-page.tsx'));
const PortfolioPage = React.lazy(() => import('./features/portfolio/pages/portfolio-page.tsx'));
const BondsPage = React.lazy(() => import('./features/bonds/pages/bonds-page.tsx'));
const NewsPage = React.lazy(() => import('./features/news/pages/news-page.tsx'));
const MarketMoversPage = React.lazy(() => import('./features/market-movers/pages/MarketMoversPage.tsx'));
const ProfilePage = React.lazy(() => import('./features/profile/pages/profile-page.tsx'));
const SuggestionsPage = React.lazy(() => import('./features/suggestions/pages/suggestion-page.tsx'));
const AdminPage = React.lazy(() => import('./features/admin/pages/admin-page.tsx'));
const RetirementCalculatorPage = React.lazy(() => import('./features/retirement/pages/retirement-calculator-page.tsx'));
const WatchlistPage = React.lazy(() => import('./features/watchlist/pages/watchlist-page.tsx'));
const InsightsPage = React.lazy(() => import('./features/insights/pages/insights-page.tsx'));
const SectorsIndustriesPage = React.lazy(() => import('./features/sectors-industries/pages/sectors-industries-page.tsx'));
const BlogListPage = React.lazy(() => import('./features/blog/pages/blog-list-page.tsx'));
const BlogPostPage = React.lazy(() => import('./features/blog/pages/blog-post-page.tsx'));
const CreateBlogPage = React.lazy(() => import('./features/blog/pages/create-blog-page.tsx'));
const EditBlogPage = React.lazy(() => import('./features/blog/pages/edit-blog-page.tsx'));
const MyBlogsPage = React.lazy(() => import('./features/blog/pages/my-blogs-page.tsx'));
const BookmarkedBlogsPage = React.lazy(() => import('./features/blog/pages/bookmarked-blogs-page.tsx'));
const ContactPage = React.lazy(() => import('./features/contact/pages/contact-page.tsx'));
const PlansPage = React.lazy(() => import('./features/plans/pages/plans-page.tsx'));

const router = createBrowserRouter([
    {
        element: <App />,
        children: [
            // --- Ruta Pública General ---
            { index: true, element: <Suspense fallback={<PageSkeleton />}><InfoPage /></Suspense> },
            { path: "contact", element: <Suspense fallback={<PageSkeleton />}><ContactPage /></Suspense> },
            { path: "plans", element: <Suspense fallback={<PageSkeleton />}><PlansPage /></Suspense> },

            // --- Ruta de Reset Password (permite usuarios autenticados con token de recovery) ---
            { path: "reset-password", element: <Suspense fallback={<AuthPageSkeleton />}><ResetPasswordPage /></Suspense> },

            // --- Rutas solo para Invitados (no logueados) ---
            {
                element: <GuestRoute />,
                children: [
                    { path: "login", element: <Suspense fallback={<AuthPageSkeleton />}><LoginPage /></Suspense> },
                    { path: "register", element: <Suspense fallback={<AuthPageSkeleton />}><RegisterPage /></Suspense> },
                    { path: "forgot-password", element: <Suspense fallback={<AuthPageSkeleton />}><ForgotPasswordPage /></Suspense> },
                ]
            },

            // --- Rutas Protegidas para Usuarios Autenticados ---
            {
                element: <ProtectedRoute />,
                children: [
                    {
                        path: "dashboard",
                        element: (
                            <ErrorBoundary level="feature" featureName="Dashboard">
                                <Suspense fallback={<DashboardSkeleton />}>
                                    <DashboardPage />
                                </Suspense>
                            </ErrorBoundary>
                        )
                    },
                    {
                        path: "asset/:symbol",
                        element: (
                            <ErrorBoundary level="feature" featureName="Asset Detail">
                                <Suspense fallback={<AssetDetailSkeleton />}>
                                    <AssetDetailPage />
                                </Suspense>
                            </ErrorBoundary>
                        )
                    },
                    {
                        path: "portfolio",
                        element: (
                            <ErrorBoundary level="feature" featureName="Portfolio">
                                <Suspense fallback={<PortfolioSkeleton />}>
                                    <PortfolioPage />
                                </Suspense>
                            </ErrorBoundary>
                        )
                    },
                    {
                        path: "bonos",
                        element: (
                            <ErrorBoundary level="feature" featureName="Bonds">
                                <Suspense fallback={<SuspenseFallback type="page" message="Cargando calculador de bonos..." />}>
                                    <BondsPage />
                                </Suspense>
                            </ErrorBoundary>
                        )
                    },
                    {
                        path: "watchlist",
                        element: (
                            <ErrorBoundary level="feature" featureName="Watchlist">
                                <Suspense fallback={<SuspenseFallback type="page" message="Cargando watchlist..." />}>
                                    <WatchlistPage />
                                </Suspense>
                            </ErrorBoundary>
                        )
                    },
                    {
                        path: "news",
                        element: (
                            <ErrorBoundary level="feature" featureName="News">
                                <Suspense fallback={<SuspenseFallback type="page" message="Cargando noticias..." />}>
                                    <NewsPage />
                                </Suspense>
                            </ErrorBoundary>
                        )
                    },
                    {
                        path: "market-movers",
                        element: (
                            <ErrorBoundary level="feature" featureName="Market Movers">
                                <Suspense fallback={<SuspenseFallback type="page" message="Cargando movimientos del mercado..." />}>
                                    <MarketMoversPage />
                                </Suspense>
                            </ErrorBoundary>
                        )
                    },

                    {
                        path: "insights",
                        element: (
                            <ErrorBoundary level="feature" featureName="Insights">
                                <Suspense fallback={<SuspenseFallback type="page" message="Cargando insights..." />}>
                                    <InsightsPage />
                                </Suspense>
                            </ErrorBoundary>
                        )
                    },
                    {
                        path: "sectors-industries",
                        element: (
                            <ErrorBoundary level="feature" featureName="Sectors & Industries">
                                <Suspense fallback={<SuspenseFallback type="page" message="Cargando sectores e industrias..." />}>
                                    <SectorsIndustriesPage />
                                </Suspense>
                            </ErrorBoundary>
                        )
                    },
                    { path: "profile", element: <Suspense fallback={<PageSkeleton />}><ProfilePage /></Suspense> },
                    { path: "suggestions", element: <Suspense fallback={<PageSkeleton />}><SuggestionsPage /></Suspense> },
                    { path: "retirement-calculator", element: <Suspense fallback={<PageSkeleton />}><RetirementCalculatorPage /></Suspense> },

                    // --- Rutas del Blog ---
                    {
                        path: "blog",
                        element: (
                            <ErrorBoundary level="feature" featureName="Blog">
                                <Suspense fallback={<SuspenseFallback type="page" message="Cargando blog..." />}>
                                    <BlogListPage />
                                </Suspense>
                            </ErrorBoundary>
                        )
                    },
                    {
                        path: "blog/:slug",
                        element: (
                            <ErrorBoundary level="feature" featureName="Blog Post">
                                <Suspense fallback={<SuspenseFallback type="page" message="Cargando artículo..." />}>
                                    <BlogPostPage />
                                </Suspense>
                            </ErrorBoundary>
                        )
                    },
                    {
                        path: "blog/crear",
                        element: (
                            <ErrorBoundary level="feature" featureName="Create Blog">
                                <Suspense fallback={<SuspenseFallback type="page" message="Cargando editor..." />}>
                                    <CreateBlogPage />
                                </Suspense>
                            </ErrorBoundary>
                        )
                    },
                    {
                        path: "blog/editar/:slug",
                        element: (
                            <ErrorBoundary level="feature" featureName="Edit Blog">
                                <Suspense fallback={<SuspenseFallback type="page" message="Cargando editor..." />}>
                                    <EditBlogPage />
                                </Suspense>
                            </ErrorBoundary>
                        )
                    },
                    {
                        path: "mis-blogs",
                        element: (
                            <ErrorBoundary level="feature" featureName="My Blogs">
                                <Suspense fallback={<SuspenseFallback type="page" message="Cargando tus artículos..." />}>
                                    <MyBlogsPage />
                                </Suspense>
                            </ErrorBoundary>
                        )
                    },
                    {
                        path: "guardados",
                        element: (
                            <ErrorBoundary level="feature" featureName="Bookmarked Blogs">
                                <Suspense fallback={<SuspenseFallback type="page" message="Cargando artículos guardados..." />}>
                                    <BookmarkedBlogsPage />
                                </Suspense>
                            </ErrorBoundary>
                        )
                    },

                    // --- Rutas Protegidas solo para Administradores (anidadas) ---
                    {
                        element: <AdminRoute />,
                        children: [
                            { path: "admin", element: <Suspense fallback={<PageSkeleton />}><AdminPage /></Suspense> },
                        ]
                    }
                ]
            },

            // --- Ruta de Not Found (al final) ---
            { path: '*', element: <Suspense fallback={<PageSkeleton />}><NotFoundPage /></Suspense> },
        ],
    },
]);

// Inicializar monitoreo de performance
initPerformanceMonitoring();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <ConfigProvider>
                    <DashboardProvider>
                        <PortfolioProvider>
                            <RouterProvider router={router} />
                        </PortfolioProvider>
                    </DashboardProvider>
                </ConfigProvider>
            </AuthProvider>
        </QueryClientProvider>
    </StrictMode>,
);