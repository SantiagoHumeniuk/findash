// src/lib/supabase.ts

import { createClient } from '@supabase/supabase-js';

// 1. Obtenemos las variables de entorno.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// 2. Verificamos que las variables existan.
// Si no están definidas, es un error crítico de configuración y la app no puede funcionar.
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Error de configuración: Las variables de entorno de Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY) no están definidas. Revisá tu archivo .env");
}

/**
 * Instancia única del cliente de Supabase para toda la aplicación.
 * Se inicializa con las credenciales del proyecto.
 */
const supabase = createClient(supabaseUrl, supabaseKey);

export { supabase };