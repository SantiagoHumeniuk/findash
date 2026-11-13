// src/services/api/apiLimiter.ts

import { supabase } from '../../lib/supabase';
import { User } from '@supabase/supabase-js';
import { Profile } from '../../types/auth';
import { Config, RoleLimits } from '../../types/config';
import { logger } from '../../lib/logger';

// Tipo específico para los datos que obtenemos de la base de datos
interface DbProfileData {
  api_calls_made: number | null;
  last_api_call_date: string | null;
  role: Profile['role'] | null;
}

/**
 * Verifica si el usuario tiene llamadas API disponibles SIN consumirlas.
 * Esta función solo valida, no modifica el contador.
 * 
 * @param user - El objeto de usuario de Supabase.
 * @param profile - El perfil del usuario.
 * @param config - La configuración de la aplicación.
 * @returns {Promise<boolean>} - `true` si tiene llamadas disponibles, `false` en caso contrario.
 */
export const hasApiCallsAvailable = async (
  user: User | null,
  profile: Profile | null,
  config: Config
): Promise<boolean> => {
  // Si no hay usuario o perfil, no se permite la llamada
  if (!user || !profile) return false;

  const today = new Date().toISOString().split('T')[0];

  // Obtenemos los datos más recientes del perfil
  const { data: dbProfile, error: profileError } = await supabase
    .from('profiles')
    .select('api_calls_made, last_api_call_date, role')
    .eq('id', user.id)
    .single();

  if (profileError || !dbProfile) {
    void logger.error('API_LIMIT_CHECK_ERROR', 'No se pudo verificar el límite de uso de la API', { error: JSON.stringify(profileError) });
    return false;
  }

  const typedDbProfile = dbProfile as DbProfileData;
  
  const role = typedDbProfile.role ?? profile.role;
  const limit = config.plans.roleLimits[role as keyof RoleLimits] ?? config.plans.roleLimits.basico;

  let calls = typedDbProfile.api_calls_made ?? 0;
  
  // Si la última llamada fue en un día anterior, el contador está en 0
  if (typedDbProfile.last_api_call_date !== today) {
    calls = 0;
  }

  // Retornar si tiene llamadas disponibles (sin mostrar toast todavía)
  return calls < limit;
};