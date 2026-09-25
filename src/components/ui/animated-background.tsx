// src/components/ui/animated-background.tsx

import React from 'react';

export interface AnimatedBackgroundProps {
  children: React.ReactNode;
  variant?: 'hero' | 'subtle';
  className?: string;
}

interface OrbConfig {
  gradient: string;
  size: string;
  position: string;
  animation: string;
  duration: string;
  delay: string;
}

const heroOrbs: OrbConfig[] = [
  {
    // Orbe 1: Cian eléctrico y azul neón (recorre ampliamente de arriba a la derecha y centro)
    gradient: 'radial-gradient(circle at 35% 35%, rgba(6, 182, 212, 0.42) 0%, rgba(59, 130, 246, 0.28) 40%, rgba(99, 102, 241, 0.12) 65%, transparent 80%)',
    size: 'w-[520px] h-[520px] sm:w-[650px] sm:h-[650px]',
    position: 'top-[-8%] left-[2%]',
    animation: 'float-orb-1',
    duration: '22s',
    delay: '0s',
  },
  {
    // Orbe 2: Púrpura cósmico, fucsia y violeta (recorre diagonal y parte baja)
    gradient: 'radial-gradient(circle at 40% 40%, rgba(168, 85, 247, 0.38) 0%, rgba(217, 70, 239, 0.25) 35%, rgba(99, 102, 241, 0.1) 65%, transparent 80%)',
    size: 'w-[480px] h-[480px] sm:w-[600px] sm:h-[600px]',
    position: 'top-[5%] right-[-5%]',
    animation: 'float-orb-2',
    duration: '26s',
    delay: '-4s',
  },
  {
    // Orbe 3: Esmeralda luminoso y turquesa (recorre centro y laterales)
    gradient: 'radial-gradient(circle at 45% 45%, rgba(16, 185, 129, 0.35) 0%, rgba(6, 182, 212, 0.25) 40%, rgba(59, 130, 246, 0.1) 65%, transparent 80%)',
    size: 'w-[440px] h-[440px] sm:w-[540px] sm:h-[540px]',
    position: 'top-[35%] left-[-8%]',
    animation: 'float-orb-3',
    duration: '24s',
    delay: '-7s',
  },
  {
    // Orbe 4: Azul zafiro e índigo brillante (recorre cuadrante inferior derecho a superior)
    gradient: 'radial-gradient(circle at 35% 35%, rgba(59, 130, 246, 0.38) 0%, rgba(99, 102, 241, 0.26) 40%, rgba(147, 51, 234, 0.12) 65%, transparent 80%)',
    size: 'w-[500px] h-[500px] sm:w-[620px] sm:h-[620px]',
    position: 'top-[45%] right-[2%]',
    animation: 'float-orb-4',
    duration: '28s',
    delay: '-6s',
  },
  {
    // Orbe 5: Cian radiante y cielo brillante (recorre cuadrante inferior izquierdo a superior derecho)
    gradient: 'radial-gradient(circle at 40% 40%, rgba(14, 165, 233, 0.4) 0%, rgba(6, 182, 212, 0.25) 40%, rgba(99, 102, 241, 0.1) 65%, transparent 80%)',
    size: 'w-[460px] h-[460px] sm:w-[560px] sm:h-[560px]',
    position: 'top-[65%] left-[15%]',
    animation: 'float-orb-5',
    duration: '20s',
    delay: '-3s',
  },
  {
    // Orbe 6: Núcleo de energía solar / rosa violeta dinámico en el centro de la pantalla
    gradient: 'radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.25) 0%, rgba(236, 72, 153, 0.22) 35%, rgba(99, 102, 241, 0.1) 60%, transparent 80%)',
    size: 'w-[400px] h-[400px] sm:w-[500px] sm:h-[500px]',
    position: 'top-[25%] left-[30%]',
    animation: 'float-orb-6',
    duration: '19s',
    delay: '-5s',
  },
];

const subtleOrbs: OrbConfig[] = [
  {
    gradient: 'radial-gradient(circle at 35% 35%, rgba(6, 182, 212, 0.25) 0%, rgba(59, 130, 246, 0.15) 40%, transparent 75%)',
    size: 'w-[450px] h-[450px]',
    position: '-top-[10%] left-[5%]',
    animation: 'float-orb-1',
    duration: '25s',
    delay: '0s',
  },
  {
    gradient: 'radial-gradient(circle at 40% 40%, rgba(168, 85, 247, 0.22) 0%, rgba(99, 102, 241, 0.12) 40%, transparent 75%)',
    size: 'w-[400px] h-[400px]',
    position: 'top-[20%] right-[0%]',
    animation: 'float-orb-2',
    duration: '30s',
    delay: '-5s',
  },
  {
    gradient: 'radial-gradient(circle at 45% 45%, rgba(14, 165, 233, 0.22) 0%, rgba(6, 182, 212, 0.12) 40%, transparent 75%)',
    size: 'w-[420px] h-[420px]',
    position: 'top-[60%] left-[10%]',
    animation: 'float-orb-3',
    duration: '28s',
    delay: '-10s',
  },
];

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ 
  children, 
  variant = 'hero',
  className = ''
}) => {
  const orbs = variant === 'hero' ? heroOrbs : subtleOrbs;

  return (
    <div className={`relative ${className}`}>
      {/* Capa de orbes animados en viewport fijo con aceleración GPU para 120 FPS sin trabas */}
      <div 
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden transform-gpu will-change-transform" 
        style={{ contain: 'strict' }}
        aria-hidden="true"
      >
        {orbs.map((orb, index) => (
          <div
            key={index}
            className={`absolute rounded-full ${orb.size} ${orb.position} pointer-events-none`}
            style={{
              backgroundImage: orb.gradient,
              filter: 'blur(35px)',
              animation: `${orb.animation} ${orb.duration} ease-in-out infinite`,
              animationDelay: orb.delay,
              transform: 'translate3d(0, 0, 0)',
              willChange: 'transform',
            }}
          />
        ))}

        {/* Capa de ruido/textura sutil para profundidad */}
        <div
          className="absolute inset-0 opacity-[0.015] dark:opacity-[0.025]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Contenido real de la página */}
      {children}
    </div>
  );
};

export const AnimatedAuthBackground: React.FC = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden -z-0" aria-hidden="true">
    {/* Orbe 1: Cian / Azul brillante arriba a la izquierda */}
    <div
      className="absolute -top-[12%] -left-[6%] w-[550px] h-[550px] rounded-full bg-gradient-to-br from-cyan-400/25 via-blue-500/20 to-indigo-600/15 dark:from-cyan-400/20 dark:via-blue-500/15 dark:to-indigo-600/10 blur-[120px]"
      style={{
        animation: 'float-orb-1 22s ease-in-out infinite',
        willChange: 'transform',
      }}
    />

    {/* Orbe 2: Índigo / Violeta arriba a la derecha */}
    <div
      className="absolute top-[8%] -right-[12%] w-[520px] h-[520px] rounded-full bg-gradient-to-br from-indigo-500/25 via-purple-500/20 to-blue-600/15 dark:from-indigo-500/20 dark:via-purple-500/15 dark:to-blue-600/10 blur-[130px]"
      style={{
        animation: 'float-orb-2 26s ease-in-out infinite',
        animationDelay: '-4s',
        willChange: 'transform',
      }}
    />

    {/* Orbe 3: Azul eléctrico / Turquesa abajo al centro */}
    <div
      className="absolute -bottom-[15%] left-[20%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-blue-500/20 via-cyan-400/15 to-emerald-400/10 dark:from-blue-500/15 dark:via-cyan-400/10 dark:to-emerald-400/5 blur-[140px]"
      style={{
        animation: 'float-orb-3 24s ease-in-out infinite',
        animationDelay: '-8s',
        willChange: 'transform',
      }}
    />

    {/* Orbe 4: Violeta suave / Púrpura medio lateral izquierdo */}
    <div
      className="absolute top-[45%] -left-[10%] w-[450px] h-[450px] rounded-full bg-gradient-to-br from-violet-600/20 via-indigo-500/15 to-blue-500/10 dark:from-violet-600/15 dark:via-indigo-500/10 dark:to-blue-500/5 blur-[120px]"
      style={{
        animation: 'float-orb-4 28s ease-in-out infinite',
        animationDelay: '-6s',
        willChange: 'transform',
      }}
    />

    {/* Patrón de cuadrícula tecnológica punteada de fondo */}
    <div
      className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07]"
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
        backgroundSize: '32px 32px',
      }}
    />

    {/* Suave viñeta central */}
    <div className="absolute inset-0 bg-radial-gradient from-transparent via-background/20 to-background/60 pointer-events-none" />
  </div>
);
