// src/App.tsx

import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ThemeProvider } from "./components/ui/theme-provider";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "./components/ui/sidebar";
import { AppSidebar } from "./components/ui/app-sidebar";
import { Toaster } from "sonner";
import ActivesBar from "./components/ui/actives-bar";
import { AnimatedBackground } from "./components/ui/animated-background";
import { ErrorBoundary } from "./components/error-boundary";
import { SuspenseFallback } from "./components/suspense";
import { SubscriptionStatusModal } from "./components/shared/subscription-status-modal";
import { useActivityPing } from "./hooks/use-activity-ping";

export default function App() {
  const location = useLocation();
  useActivityPing();

  return (
    <ErrorBoundary level="root">
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <SidebarProvider>
          <Toaster position="top-right" richColors />
          <AppSidebar />
          
          <SidebarInset className="relative flex h-svh min-h-svh flex-1 overflow-y-auto bg-transparent">
            <AnimatedBackground variant="hero" className="flex min-h-full w-full flex-col">
              <ActivesBar />
              <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/70 bg-background/85 px-4 py-2 backdrop-blur-xl md:hidden">
                <SidebarTrigger
                  aria-label="Abrir navegación"
                  className="size-11 rounded-xl border border-border/70 bg-background/70 text-foreground shadow-sm"
                />
                <Link to="/" className="flex min-w-0 items-center gap-2 rounded-md font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <img src="/logo-128.png" alt="" width="28" height="28" className="size-7 shrink-0 object-contain" />
                  <span className="truncate">FinDash</span>
                </Link>
              </div>

              <main className="page-transition relative z-10 flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
                <div key={location.pathname} className="page-enter h-full">
                    <React.Suspense fallback={<SuspenseFallback type="page" message="Cargando página..." />}>
                      <Outlet />
                    </React.Suspense>
                  </div>
              </main>
            </AnimatedBackground>

            {/* Modal de estado de suscripción y pago */}
            <SubscriptionStatusModal />
          </SidebarInset>
        </SidebarProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
