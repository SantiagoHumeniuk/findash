// src/features/auth/components/index.ts

// Forms
export { LoginForm } from './forms/login-form';
export { RegisterForm } from './forms/register-form';
export { ForgotPasswordForm } from './forms/forgot-password-form';
export { ResetPasswordForm } from './forms/reset-password-form';

// Shared components
export { AuthCard } from './shared/auth-card';
export { FormInput } from './shared/form-input';
export { FormFooter } from './shared/form-footer';
export { AuthButton } from './shared/auth-button';
export { GoogleAuthButton, GoogleIcon } from './shared/google-auth-button';

// Route guards
export { ProtectedRoute } from './protected-route';
export { GuestRoute } from './guest-route';
export { AdminRoute } from './admin-route';
