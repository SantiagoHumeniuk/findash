// src/features/asset-detail/components/rating/rating-stars.tsx

import { Star } from 'lucide-react';

/**
 * Props para el componente RatingStars.
 * @property score - Puntuación de 0 a 5
 */
interface RatingStarsProps {
  score: number | null;
}

/**
 * Componente que renderiza una visualización de estrellas para una puntuación.
 * Muestra 5 estrellas, llenando las correspondientes según el score.
 * 
 * @example
 * ```tsx
 * <RatingStars score={3} />  // 3 estrellas amarillas, 2 grises
 * <RatingStars score={4.5} /> // 4 estrellas amarillas, 1 gris
 * ```
 */
export function RatingStars({ score }: RatingStarsProps) {
  if (score === null || !Number.isFinite(score) || score <= 0) return null;

  const starCount = Math.min(5, Math.max(1, Math.round(score)));

  return (
    <div className="flex" role="img" aria-label={`${starCount} de 5 estrellas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${
            i < starCount
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-gray-300 dark:text-gray-600'
          }`}
        />
      ))}
    </div>
  );
}
