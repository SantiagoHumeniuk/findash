// src/services/api/apiLimiter.ts

import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
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

/**
 * Incrementa el contador de llamadas API DESPUÉS de un fetch exitoso.
 * Esta función debe llamarse solo cuando la llamada a la API fue exitosa.
 * 
 * @param userId - El ID del usuario.
 * @returns {Promise<void>}
 */
export const incrementApiCallCounter = async (userId: string): Promise<void> => {
  const today = new Date().toISOString().split('T')[0];
  
  // Obtener el contador actual
  const { data: current } = await supabase
    .from('profiles')
    .select('api_calls_made, last_api_call_date')
    .eq('id', userId)
    .single();

  // Type guard para asegurar que current tiene los campos correctos
  const typedCurrent = current as DbProfileData | null;

  // Si es del mismo día, incrementar; si es nuevo día, empezar en 1
  const calls = (typedCurrent?.last_api_call_date === today) 
    ? (typedCurrent.api_calls_made ?? 0) + 1 
    : 1;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      api_calls_made: calls,
      last_api_call_date: today
    })
    .eq('id', userId);

  if (updateError) {
    void logger.error('API_COUNTER_UPDATE_ERROR', 'No se pudo actualizar el contador de API', { 
      error: JSON.stringify(updateError),
      userId 
    });
  }
};

/**
 * @deprecated Usar hasApiCallsAvailable() + incrementApiCallCounter() en su lugar.
 * Esta función consume el API call ANTES de intentar el fetch, lo cual puede desperdiciar llamadas.
 * 
 * Verifica si el usuario actual puede realizar una llamada a la API y actualiza su contador.
 * @param user - El objeto de usuario de Supabase.
 * @param profile - El perfil del usuario.
 * @param config - La configuración de la aplicación.
 * @returns {Promise<boolean>} - `true` si la llamada está permitida, `false` en caso contrario.
 */
export const checkApiLimit = async (
  user: User | null,
  profile: Profile | null,
  config: Config
): Promise<boolean> => {
  // Si no hay usuario o perfil, no se permite la llamada
  if (!user || !profile) return false;

  const today = new Date().toISOString().split('T')[0];

  // Obtenemos los datos más recientes del perfil para evitar inconsistencias
  const { data: dbProfile, error: profileError } = await supabase
    .from('profiles')
    .select('api_calls_made, last_api_call_date, role')
    .eq('id', user.id)
    .single();

  if (profileError || !dbProfile) {
    toast.error('No se pudo verificar el límite de uso de la API.');
    void logger.error('API_LIMIT_CHECK_ERROR', 'No se pudo verificar el límite de uso de la API', { error: JSON.stringify(profileError) });
    return false;
  }

  // Garantizar que dbProfile tenga el tipo correcto
  const typedDbProfile = dbProfile as DbProfileData;
  
  const role = typedDbProfile.role ?? profile.role;
  const limit = config.plans.roleLimits[role as keyof RoleLimits] ?? config.plans.roleLimits.basico;

  let calls = typedDbProfile.api_calls_made ?? 0;
  
  // Si la última llamada fue en un día anterior, reiniciamos el contador
  if (typedDbProfile.last_api_call_date !== today) {
    calls = 0;
  }

  // Verificamos si se ha alcanzado el límite
  if (calls >= limit) {
    toast.info('Has alcanzado el límite diario de uso de la API.', {
      description: 'Actualizá tu plan para obtener más acceso.',
    });
    return false;
  }

  // Si todo está en orden, incrementamos el contador en la base de datos
  const updateData: Partial<DbProfileData> = {
    api_calls_made: calls + 1,
    last_api_call_date: today
  };
  
  const { error: updateError } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user.id);

  if (updateError) {
    toast.error('No se pudo actualizar el uso de la API.');
    void logger.error('API_LIMIT_UPDATE_ERROR', 'No se pudo actualizar el uso de la API', { error: JSON.stringify(updateError) });
    return false;
  }

  return true;
};