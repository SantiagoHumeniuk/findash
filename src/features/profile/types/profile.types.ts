// src/features/profile/types/profile.types.ts

/**
 * Perfil de onboarding del usuario
 */
export interface OnboardingProfile {
  investorProfile?: string;
  experience?: string;
  interests?: Record<string, boolean>;
  avatarIndex?: number;
  avatarImage?: string | null;
}

/**
 * Perfil completo del usuario
 */
export interface UserProfile {
  first_name?: string;
  last_name?: string;
  onboarding_profile?: OnboardingProfile | null;
}

/**
 * Opción de interés para checkboxes
 */
export interface InterestOption {
  id: string;
  label: string;
}

/**
 * Props para PersonalInfoForm
 */
export interface PersonalInfoFormProps {
  firstName: string;
  lastName: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
}

/**
 * Props para InvestmentPreferencesForm
 */
export interface InvestmentPreferencesFormProps {
  investorProfile: string;
  experience: string;
  interests: Record<string, boolean>;
  onInvestorProfileChange: (value: string) => void;
  onExperienceChange: (value: string) => void;
  onInterestChange: (interestId: string) => void;
}

/**
 * Estado del formulario de perfil
 */
export interface ProfileFormState {
  firstName: string;
  lastName: string;
  investorProfile: string;
  experience: string;
  interests: Record<string, boolean>;
}
