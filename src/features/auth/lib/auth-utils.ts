// src/features/auth/lib/auth-utils.ts

import { supabase } from '../../../lib/supabase';
import { logger } from '../../../lib/logger';
import type { AuthResult } from '../types/auth.types';

/**
 * Realiza el login del usuario con email y contraseña.
 * 
 * @param email - Email del usuario
 * @param password - Contraseña del usuario
 * @returns Resultado de la operación con success y error opcional
 */
export async function loginUser(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    await logger.info(
      'LOGIN_SUCCESS',
      `User ${email} logged in successfully.`
    );

    return { success: true };
  } catch (error: unknown) {
    const errorMessage =
      typeof error === 'object' && error && 'message' in error
        ? (error as { message: string }).message
        : String(error);

    await logger.error('LOGIN_FAILED', `User ${email} failed to log in.`, {
      errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Inicia sesión o registra al usuario utilizando Google OAuth.
 * Supabase gestiona automáticamente la creación o vinculación del usuario en auth.users.
 * 
 * @param redirectTo - URL opcional a la cual redirigir luego de autenticarse
 * @returns Resultado de la operación con success y error opcional
 */
export async function loginWithGoogle(redirectTo?: string): Promise<AuthResult> {
  try {
    const targetUrl = redirectTo || `${window.location.origin}/dashboard`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: targetUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) throw error;

    await logger.info(
      'GOOGLE_AUTH_INITIATED',
      'Google OAuth flow initiated successfully.'
    );

    return { success: true };
  } catch (error: unknown) {
    const errorMessage =
      typeof error === 'object' && error && 'message' in error
        ? (error as { message: string }).message
        : String(error);

    await logger.error('GOOGLE_AUTH_FAILED', 'Failed to initiate Google OAuth.', {
      errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Registra un nuevo usuario con email y contraseña.
 * 
 * @param email - Email del usuario
 * @param password - Contraseña del usuario
 * @returns Resultado de la operación con success y error opcional
 */
export async function registerUser(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) throw error;

    await logger.info(
      'REGISTER_SUCCESS',
      `User ${email} registered successfully.`
    );

    return { success: true };
  } catch (error: unknown) {
    const errorMessage =
      typeof error === 'object' && error && 'message' in error
        ? (error as { message: string }).message
        : String(error);

    await logger.error('REGISTER_FAILED', `User ${email} failed to register.`, {
      errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Envía un email de recuperación de contraseña.
 * 
 * @param email - Email del usuario
 * @returns Resultado de la operación con success y error opcional
 */
export async function sendPasswordResetEmail(
  email: string
): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;

    await logger.info(
      'PASSWORD_RESET_REQUEST',
      `Password reset email sent to ${email}.`
    );

    return { success: true };
  } catch (error: unknown) {
    const errorMessage =
      typeof error === 'object' && error && 'message' in error
        ? (error as { message: string }).message
        : String(error);

    await logger.error(
      'PASSWORD_RESET_FAILED',
      `Failed to send password reset email to ${email}.`,
      { errorMessage }
    );

    return { success: false, error: errorMessage };
  }
}

/**
 * Actualiza la contraseña del usuario.
 * 
 * @param newPassword - Nueva contraseña
 * @returns Resultado de la operación con success y error opcional
 */
export function updatePassword(
  newPassword: string
): Promise<AuthResult> {
  return new Promise((resolve) => {
    try {
      // Llamar a updateUser sin esperar la respuesta
      // Supabase lo procesará en background
      void supabase.auth.updateUser({
        password: newPassword,
      }).then(({ error }) => {
        if (error) {
          console.error('Error al actualizar contraseña:', error.message);
        }
      });
      
      // Registrar en logger sin esperar
      void logger.info('PASSWORD_UPDATE_SUCCESS', 'Password updated successfully.');

      resolve({ success: true });
    } catch (error: unknown) {
      const errorMessage =
        typeof error === 'object' && error && 'message' in error
          ? (error as { message: string }).message
          : String(error);

      console.error('Error al actualizar contraseña:', errorMessage);
      void logger.error('PASSWORD_UPDATE_FAILED', 'Failed to update password.', {
        errorMessage,
      });

      resolve({ success: false, error: errorMessage });
    }
  });
}

/**
 * Valida que el email tenga un formato válido.
 * 
 * @param email - Email a validar
 * @returns true si el email es válido
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida que la contraseña cumpla con los requisitos mínimos.
 * 
 * @param password - Contraseña a validar
 * @returns Objeto con isValid y mensaje de error opcional
 */
export function validatePassword(password: string): {
  isValid: boolean;
  error?: string;
} {
  if (password.length < 6) {
    return {
      isValid: false,
      error: 'La contraseña debe tener al menos 6 caracteres.',
    };
  }

  return { isValid: true };
}
