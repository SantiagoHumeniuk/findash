// src/App.tsx

import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeProvider } from "./components/ui/theme-provider";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "./components/ui/sidebar";
import { AppSidebar } from "./components/ui/app-sidebar";
import { Toaster } from "sonner";
import { ModeToggle } from "./components/ui/mode-toggle";
import GenericBreadcrumb from "./components/ui/breadcrumb-demo";
import ActivesBar from "./components/ui/actives-bar";
import { AnimatedBackground } from "./components/ui/animated-background";
import { CommandMenu } from "./components/search/command-menu";
import { ErrorBoundary } from "./components/error-boundary";
import { SuspenseFallback } from "./components/suspense";

export default function App() {
  const location = useLocation();
  const isHomePage = location.pathname === '/' || location.pathname === '/inicio';
  const headerClass = isHomePage 
    ? "flex h-16 shrink-0 items-center justify-between gap-2 border-b border-white/[0.02] bg-transparent px-4 relative z-20"
    : "flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/40 bg-background/80 backdrop-blur-xl px-4 relative z-20 transition-all duration-300";

  return (
    <ErrorBoundary level="root">
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <SidebarProvider>
          <Toaster position="top-right" richColors />
          <AppSidebar />
          
          <SidebarInset className="flex-1 overflow-y-auto relative bg-transparent">
            <AnimatedBackground variant="hero" className="absolute inset-0 min-h-full flex flex-col w-full">
              <ActivesBar />

              <main className="flex-1 flex flex-col relative z-10 overflow-x-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, y: 15, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -15, filter: "blur(4px)" }}
                    transition={{ type: "spring", stiffness: 260, damping: 20, mass: 0.5 }}
                    className="h-full"
                  >
                    <React.Suspense fallback={<SuspenseFallback type="page" message="Cargando página..." />}>
                      <Outlet />
                    </React.Suspense>
                  </motion.div>
                </AnimatePresence>
              </main>
            </AnimatedBackground>

            {/* Controles flotantes libres (sin header) */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
              <CommandMenu />
              <ModeToggle />
            </div>

            {/* Trigger flotante solo para móvil */}
            <div className="fixed bottom-6 left-6 z-50 md:hidden">
              <SidebarTrigger className="size-12 rounded-full bg-primary/20 backdrop-blur-md border border-primary/30 text-primary shadow-xl" />
            </div>
          </SidebarInset>
        </SidebarProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
