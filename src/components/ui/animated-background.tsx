// src/components/ui/animated-background.tsx

import React from 'react';

export interface AnimatedBackgroundProps {
  children: React.ReactNode;
  variant?: 'hero' | 'subtle';
  className?: string;
}

interface ParticleConfig {
  size: number;
  top: number;
  left: number;
  colorClass: string;
  glowClass: string;
  animation: string;
  duration: string;
  delay: string;
}

const backgroundParticles: ParticleConfig[] = [
  { size: 3.5, top: 8, left: 7, colorClass: 'bg-cyan-400/60 dark:bg-cyan-400/50', glowClass: 'shadow-[0_0_6px_rgba(34,211,238,0.4)]', animation: 'particle-rise-fall-1', duration: '11s', delay: '0s' },
  { size: 4.5, top: 18, left: 22, colorClass: 'bg-blue-400/55 dark:bg-blue-400/45', glowClass: 'shadow-[0_0_6px_rgba(96,165,250,0.35)]', animation: 'particle-rise-fall-2', duration: '14s', delay: '-2s' },
  { size: 3, top: 28, left: 38, colorClass: 'bg-indigo-400/50 dark:bg-indigo-400/40', glowClass: 'shadow-[0_0_5px_rgba(129,140,248,0.35)]', animation: 'particle-rise-fall-3', duration: '10s', delay: '-4s' },
  { size: 5, top: 12, left: 55, colorClass: 'bg-cyan-300/60 dark:bg-cyan-300/45', glowClass: 'shadow-[0_0_7px_rgba(103,232,249,0.4)]', animation: 'particle-rise-fall-4', duration: '13s', delay: '-1s' },
  { size: 3.5, top: 22, left: 72, colorClass: 'bg-emerald-400/55 dark:bg-emerald-400/40', glowClass: 'shadow-[0_0_5px_rgba(52,211,153,0.35)]', animation: 'particle-rise-fall-1', duration: '12s', delay: '-5s' },
  { size: 4, top: 15, left: 88, colorClass: 'bg-indigo-400/55 dark:bg-indigo-400/45', glowClass: 'shadow-[0_0_6px_rgba(129,140,248,0.4)]', animation: 'particle-rise-fall-2', duration: '15s', delay: '-3s' },
  
  { size: 4, top: 42, left: 12, colorClass: 'bg-blue-400/55 dark:bg-blue-400/45', glowClass: 'shadow-[0_0_6px_rgba(96,165,250,0.4)]', animation: 'particle-rise-fall-3', duration: '13s', delay: '-6s' },
  { size: 3, top: 52, left: 28, colorClass: 'bg-cyan-400/50 dark:bg-cyan-400/40', glowClass: 'shadow-[0_0_5px_rgba(34,211,238,0.35)]', animation: 'particle-rise-fall-4', duration: '11s', delay: '-2.5s' },
  { size: 5, top: 45, left: 48, colorClass: 'bg-indigo-400/60 dark:bg-indigo-400/45', glowClass: 'shadow-[0_0_7px_rgba(129,140,248,0.4)]', animation: 'particle-rise-fall-1', duration: '16s', delay: '-7s' },
  { size: 3.5, top: 58, left: 65, colorClass: 'bg-cyan-300/55 dark:bg-cyan-300/40', glowClass: 'shadow-[0_0_5px_rgba(103,232,249,0.35)]', animation: 'particle-rise-fall-2', duration: '12s', delay: '-4.5s' },
  { size: 4.5, top: 48, left: 82, colorClass: 'bg-emerald-400/55 dark:bg-emerald-400/40', glowClass: 'shadow-[0_0_6px_rgba(52,211,153,0.4)]', animation: 'particle-rise-fall-3', duration: '14s', delay: '-1.5s' },
  { size: 3, top: 38, left: 94, colorClass: 'bg-blue-400/50 dark:bg-blue-400/40', glowClass: 'shadow-[0_0_5px_rgba(96,165,250,0.35)]', animation: 'particle-rise-fall-4', duration: '10s', delay: '-5.5s' },

  { size: 4.5, top: 72, left: 8, colorClass: 'bg-cyan-400/60 dark:bg-cyan-400/45', glowClass: 'shadow-[0_0_6px_rgba(34,211,238,0.4)]', animation: 'particle-rise-fall-1', duration: '14s', delay: '-3.5s' },
  { size: 3.5, top: 82, left: 24, colorClass: 'bg-indigo-400/50 dark:bg-indigo-400/40', glowClass: 'shadow-[0_0_5px_rgba(129,140,248,0.35)]', animation: 'particle-rise-fall-2', duration: '11s', delay: '-6.5s' },
  { size: 4, top: 68, left: 42, colorClass: 'bg-emerald-400/55 dark:bg-emerald-400/40', glowClass: 'shadow-[0_0_6px_rgba(52,211,153,0.35)]', animation: 'particle-rise-fall-3', duration: '13s', delay: '-2s' },
  { size: 5, top: 85, left: 58, colorClass: 'bg-blue-400/60 dark:bg-blue-400/45', glowClass: 'shadow-[0_0_7px_rgba(96,165,250,0.4)]', animation: 'particle-rise-fall-4', duration: '15s', delay: '-4s' },
  { size: 3, top: 75, left: 75, colorClass: 'bg-cyan-300/50 dark:bg-cyan-300/40', glowClass: 'shadow-[0_0_5px_rgba(103,232,249,0.35)]', animation: 'particle-rise-fall-1', duration: '9.5s', delay: '-1s' },
  { size: 4, top: 88, left: 90, colorClass: 'bg-indigo-400/55 dark:bg-indigo-400/45', glowClass: 'shadow-[0_0_6px_rgba(129,140,248,0.4)]', animation: 'particle-rise-fall-2', duration: '12.5s', delay: '-5s' },
];

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ 
  children, 
  className = ''
}) => {
  return (
    <div className={`relative ${className}`}>
      {/* Fondo sutil y minimalista con pelotitas luminosas que suben y bajan suavemente */}
      <div 
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden transform-gpu will-change-transform" 
        style={{ contain: 'strict' }}
        aria-hidden="true"
      >
        {/* Gradientes y auras de ambiente difuminadas con brillo elegante */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(56,189,248,0.22),rgba(99,102,241,0.14),transparent_70%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_0%_40%,rgba(6,182,212,0.18),rgba(59,130,246,0.08),transparent_65%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_100%_60%,rgba(139,92,246,0.18),rgba(99,102,241,0.08),transparent_65%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_110%,rgba(59,130,246,0.15),rgba(147,51,234,0.10),transparent_70%)] pointer-events-none" />

        {/* Pelotitas luminosas flotantes (suben y bajan con fluidez 120 FPS sin lag) */}
        {backgroundParticles.map((particle, index) => (
          <div
            key={index}
            className={`absolute rounded-full ${particle.colorClass} ${particle.glowClass} pointer-events-none`}
            style={{
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              top: `${particle.top}%`,
              left: `${particle.left}%`,
              animation: `${particle.animation} ${particle.duration} ease-in-out infinite`,
              animationDelay: particle.delay,
              transform: 'translate3d(0, 0, 0)',
              willChange: 'transform, opacity',
            }}
          />
        ))}

        {/* Capa de textura microscópica sutil */}
        <div
          className="absolute inset-0 opacity-[0.012] dark:opacity-[0.02]"
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
    {/* Orbe sutil 1: Cian / Azul arriba a la izquierda */}
    <div
      className="absolute -top-[10%] -left-[5%] w-[450px] h-[450px] rounded-full bg-cyan-500/[0.08] dark:bg-cyan-400/[0.08] blur-[90px]"
    />

    {/* Orbe sutil 2: Índigo / Violeta arriba a la derecha */}
    <div
      className="absolute top-[10%] -right-[8%] w-[450px] h-[450px] rounded-full bg-indigo-500/[0.08] dark:bg-indigo-500/[0.08] blur-[90px]"
    />

    {/* Patrón de cuadrícula tecnológica punteada de fondo */}
    <div
      className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
        backgroundSize: '32px 32px',
      }}
    />

    {/* Suave viñeta central */}
    <div className="absolute inset-0 bg-radial-gradient from-transparent via-background/20 to-background/60 pointer-events-none" />
  </div>
);
