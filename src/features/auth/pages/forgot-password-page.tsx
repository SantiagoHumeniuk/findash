// src/features/auth/pages/forgot-password-page.tsx

import { motion } from 'framer-motion';
import { ForgotPasswordForm } from '../components/forms/forgot-password-form';
import { AnimatedAuthBackground } from '../../../components/ui/animated-background';

/**
 * Página de recuperación de contraseña.
 * Permite al usuario solicitar un email para resetear su contraseña.
 * 
 * @example
 * ```tsx
 * <Route path="/forgot-password" element={<ForgotPasswordPage />} />
 * ```
 */
export default function ForgotPasswordPage() {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center bg-background overflow-hidden">
      <AnimatedAuthBackground />
      <motion.div
        className="relative z-10 w-full max-w-sm"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.7,
          ease: [0.22, 1, 0.36, 1],
          delay: 0.2,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <ForgotPasswordForm />
        </motion.div>
      </motion.div>
    </div>
  );
}
