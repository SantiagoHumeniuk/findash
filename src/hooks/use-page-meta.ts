// src/hooks/use-page-meta.ts

import { useEffect } from 'react';

const DEFAULT_TITLE = 'FinDash - Análisis Financiero Inteligente';

function setMeta(name: string, content: string): string | null {
  const element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  const previous = element?.content ?? null;
  if (element) element.content = content;
  return previous;
}

/** Title, description and canonical link of a public page, for search engines and browser tabs. */
export function usePageMeta(title: string, description: string): void {
  useEffect(() => {
    document.title = `${title} | FinDash`;
    const previousDescription = setMeta('description', description);
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = `${window.location.origin}${window.location.pathname}`;
    document.head.appendChild(canonical);
    return () => {
      document.title = DEFAULT_TITLE;
      if (previousDescription !== null) setMeta('description', previousDescription);
      canonical.remove();
    };
  }, [title, description]);
}
