// src/components/ui/animated-background.tsx

import React from 'react';

export interface AnimatedBackgroundProps {
  children: React.ReactNode;
  variant?: 'hero' | 'subtle';
  className?: string;
}

interface OrbConfig {
  color: string;
  size: string;
  position: string;
  animation: string;
  duration: string;
  delay: string;
}

const heroOrbs: OrbConfig[] = [
  {
    color: 'bg-gradient-to-br from-blue-500/25 to-cyan-400/15 dark:from-blue-500/20 dark:to-cyan-400/10',
    size: 'w-[600px] h-[600px]',
    position: '-top-[10%] left-[5%]',
    animation: 'float-orb-1',
    duration: '18s',
    delay: '0s',
  },
  {
    color: 'bg-gradient-to-br from-indigo-500/20 to-purple-500/10 dark:from-indigo-500/15 dark:to-purple-500/5',
    size: 'w-[500px] h-[500px]',
    position: 'top-[10%] right-[-5%]',
    animation: 'float-orb-2',
    duration: '22s',
    delay: '-3s',
  },
  {
    color: 'bg-gradient-to-br from-cyan-400/20 to-blue-600/10 dark:from-cyan-400/15 dark:to-blue-600/5',
    size: 'w-[450px] h-[450px]',
    position: 'top-[35%] left-[-5%]',
    animation: 'float-orb-3',
    duration: '20s',
    delay: '-6s',
  },
  {
    color: 'bg-gradient-to-br from-violet-500/15 to-indigo-400/10 dark:from-violet-500/10 dark:to-indigo-400/5',
    size: 'w-[550px] h-[550px]',
    position: 'top-[50%] right-[0%]',
    animation: 'float-orb-4',
    duration: '24s',
    delay: '-5s',
  },
  {
    color: 'bg-gradient-to-br from-blue-400/10 to-sky-500/10 dark:from-blue-400/5 dark:to-sky-500/5',
    size: 'w-[400px] h-[400px]',
    position: 'top-[75%] left-[20%]',
    animation: 'float-orb-5',
    duration: '16s',
    delay: '-2s',
  },
];

const subtleOrbs: OrbConfig[] = [
  {
    color: 'bg-gradient-to-br from-blue-500/15 to-cyan-400/10 dark:from-blue-500/10 dark:to-cyan-400/5',
    size: 'w-[450px] h-[450px]',
    position: '-top-[10%] left-[5%]',
    animation: 'float-orb-1',
    duration: '25s',
    delay: '0s',
  },
  {
    color: 'bg-gradient-to-br from-indigo-500/15 to-purple-500/10 dark:from-indigo-500/10 dark:to-purple-500/5',
    size: 'w-[350px] h-[350px]',
    position: 'top-[20%] right-[0%]',
    animation: 'float-orb-2',
    duration: '30s',
    delay: '-5s',
  },
  {
    color: 'bg-gradient-to-br from-cyan-400/15 to-blue-600/10 dark:from-cyan-400/10 dark:to-blue-600/5',
    size: 'w-[400px] h-[400px]',
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
      {/* Capa de orbes animados (ahora absolute para que se distribuyan en todo el scroll) */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        {orbs.map((orb, index) => (
          <div
            key={index}
            className={`absolute rounded-full ${orb.color} ${orb.size} ${orb.position}`}
            style={{
              filter: variant === 'hero' ? 'blur(140px)' : 'blur(100px)',
              animation: `${orb.animation} ${orb.duration} ease-in-out infinite`,
              animationDelay: orb.delay,
              willChange: 'transform',
            }}
          />
        ))}

        {/* Capa de ruido/textura sutil para profundidad (muy leve) */}
        <div
          className="absolute inset-0 opacity-[0.01] dark:opacity-[0.02]"
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
