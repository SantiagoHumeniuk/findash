// src/features/auth/components/guest-route.tsx

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../../hooks/use-auth';
import { LoadingScreen } from '../../../components/ui/loading-screen';

export const GuestRoute: React.FC = () => {
  const { user, isLoaded } = useAuth();

  // Mientras se verifica la sesión, muestra una pantalla de carga.
  if (!isLoaded) {
    return <LoadingScreen message="Verificando sesión..." />;
  }

  // Si el usuario ya está logueado, lo redirigimos al dashboard.
  if (user) {
    return <Navigate to="/hoy" replace />;
  }

  // Si no hay usuario, permitimos el acceso a la ruta (login/register).
  return <Outlet />;
};