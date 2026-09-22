// src/components/ui/tech-loader.tsx

import { motion } from 'framer-motion';

/**
 * FinDash Branded Loader
 * Animación de carga con identidad visual de FinDash.
 * Muestra el logo con un pulso de línea de mercado estilizado.
 */

const linePoints = [0, 12, 6, 18, 10, 22, 8, 28, 16, 14, 24, 20, 30, 18, 26];

export function TechLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-5">
      {/* Logo marca */}
      <motion.div
        className="relative"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.h2
          className="text-2xl font-extrabold tracking-tight"
          style={{
            background: 'linear-gradient(135deg, hsl(217, 91%, 60%), hsl(192, 91%, 58%), hsl(258, 70%, 58%))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundSize: '200% 200%',
          }}
          animate={{
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          FinDash
        </motion.h2>
      </motion.div>

      {/* Línea de mercado animada */}
      <div className="relative w-40 h-10 overflow-hidden">
        <svg
          viewBox="0 0 160 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="findash-line-grad" x1="0" y1="0" x2="160" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="hsl(217, 91%, 60%)" />
              <stop offset="50%" stopColor="hsl(192, 91%, 58%)" />
              <stop offset="100%" stopColor="hsl(258, 70%, 58%)" />
            </linearGradient>
            <linearGradient id="findash-glow" x1="0" y1="0" x2="160" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity="0.3" />
              <stop offset="50%" stopColor="hsl(192, 91%, 58%)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="hsl(258, 70%, 58%)" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          {/* Area fill underneath */}
          <motion.path
            d={`M${linePoints.map((y, i) => `${(i / (linePoints.length - 1)) * 160},${40 - y}`).join(' L')} L160,40 L0,40 Z`}
            fill="url(#findash-glow)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Main line */}
          <motion.path
            d={`M${linePoints.map((y, i) => `${(i / (linePoints.length - 1)) * 160},${40 - y}`).join(' L')}`}
            stroke="url(#findash-line-grad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{
              pathLength: { duration: 1.5, repeat: Infinity, ease: 'easeInOut', repeatType: 'loop' },
              opacity: { duration: 0.3 },
            }}
          />
          {/* Moving dot at the tip */}
          <motion.circle
            r="3"
            fill="hsl(192, 91%, 58%)"
            filter="drop-shadow(0 0 6px hsl(192, 91%, 58%))"
            initial={{ offsetDistance: '0%' }}
            animate={{ offsetDistance: '100%' }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              offsetPath: `path("M${linePoints.map((y, i) => `${(i / (linePoints.length - 1)) * 160},${40 - y}`).join(' L')}")`
            }}
          />
        </svg>
      </div>

      {/* Loading dots */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: 'hsl(217, 91%, 60%)' }}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 1,
              delay: i * 0.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      <motion.p
        className="text-xs text-muted-foreground font-medium"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Analizando datos del mercado...
      </motion.p>
    </div>
  );
}
