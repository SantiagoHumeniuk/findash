// src/features/alerts/components/unread-alerts-badge.tsx

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useNotifications } from '../hooks/use-alerts';

/** Unread count in the menu; also announces notifications that arrive during the visit. */
export function UnreadAlertsBadge() {
  const { data: notifications } = useNotifications();
  const seenIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!notifications) return;
    if (seenIds.current) {
      for (const item of notifications) {
        if (!seenIds.current.has(item.id) && !item.read_at) toast.info(item.title, { description: item.body });
      }
    }
    seenIds.current = new Set(notifications.map((item) => item.id));
  }, [notifications]);

  const unread = notifications?.filter((item) => !item.read_at).length ?? 0;
  if (unread === 0) return null;
  return (
    <span
      aria-label={`${unread} notificaciones sin leer`}
      className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground"
    >
      {unread > 9 ? '9+' : unread}
    </span>
  );
}
