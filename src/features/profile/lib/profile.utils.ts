// src/features/profile/lib/profile.utils.ts

import { OnboardingProfile, InterestOption } from "../types/profile.types";

/**
 * Opciones de áreas de interés disponibles
 */
export const interestOptions: InterestOption[] = [
  { id: "fundamental_analysis", label: "Análisis Fundamental" },
  { id: "technical_analysis", label: "Análisis Técnico" },
  { id: "dividends", label: "Inversión por Dividendos" },
  { id: "growth_investing", label: "Acciones de Crecimiento" },
  { id: "value_investing", label: "Acciones de Valor" },
  { id: "etfs", label: "ETFs y Fondos Indexados" },
  { id: "market_news", label: "Noticias de Mercado" },
];

/**
 * Extrae y valida el perfil de onboarding desde datos raw
 */
export function extractOnboardingProfile(raw: unknown): OnboardingProfile {
  // Si raw es null o undefined, retornar valores por defecto
  if (!raw) {
    return { investorProfile: "", experience: "", interests: {} };
  }
  
  // Si es un objeto vacío {}, también retornar por defecto
  if (typeof raw === "object" && Object.keys(raw as Record<string, unknown>).length === 0) {
    return { investorProfile: "", experience: "", interests: {} };
  }
  
  if (typeof raw === "object") {
    const obj = raw as Partial<OnboardingProfile>;
    return {
      investorProfile:
        typeof obj.investorProfile === "string" && obj.investorProfile !== "" 
          ? obj.investorProfile 
          : "",
      experience: 
        typeof obj.experience === "string" && obj.experience !== "" 
          ? obj.experience 
          : "",
      avatarIndex:
        typeof obj.avatarIndex === "number" && obj.avatarIndex >= 1 && obj.avatarIndex <= 3
          ? obj.avatarIndex
          : undefined,
      avatarImage: typeof obj.avatarImage === "string" ? obj.avatarImage : undefined,
      interests:
        typeof obj.interests === "object" && obj.interests !== null
          ? obj.interests
          : {},
    };
  }
  
  return { investorProfile: "", experience: "", interests: {} };
}

/**
 * Formatea un error de Supabase a string legible
 */
export function formatSupabaseError(error: unknown): string {
  if (
    typeof error === "object" &&
    error &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return typeof error === "string" ? error : JSON.stringify(error);
}

/**
 * Valida si los campos obligatorios del perfil están completos
 */
export function validateProfileForm(
  firstName: string,
  lastName: string
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!firstName.trim()) {
    errors.push("El nombre es obligatorio");
  }

  if (!lastName.trim()) {
    errors.push("El apellido es obligatorio");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Traduce el perfil de inversor a texto legible
 */
export function translateInvestorProfile(profile: string): string {
  const translations: Record<string, string> = {
    conservative: "Conservador",
    moderate: "Moderado",
    aggressive: "Agresivo",
  };
  return translations[profile] || profile;
}

/**
 * Traduce el nivel de experiencia a texto legible
 */
export function translateExperience(experience: string): string {
  const translations: Record<string, string> = {
    beginner: "Principiante",
    intermediate: "Intermedio",
    advanced: "Avanzado",
  };
  return translations[experience] || experience;
}

/**
 * Cuenta el número de intereses seleccionados
 */
export function countSelectedInterests(
  interests: Record<string, boolean>
): number {
  return Object.values(interests).filter(Boolean).length;
}

/**
 * Obtiene los IDs de los intereses seleccionados
 */
export function getSelectedInterestIds(
  interests: Record<string, boolean>
): string[] {
  return Object.entries(interests)
    .filter(([, isSelected]) => isSelected)
    .map(([id]) => id);
}

/**
 * Convierte un array de IDs de intereses a un objeto Record
 */
export function interestIdsToRecord(ids: string[]): Record<string, boolean> {
  return ids.reduce((acc, id) => {
    acc[id] = true;
    return acc;
  }, {} as Record<string, boolean>);
}
