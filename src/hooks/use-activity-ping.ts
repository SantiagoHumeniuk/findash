// src/hooks/use-activity-ping.ts

import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './use-auth';

/** Records once per day that the signed-in user was active, for retention metrics. */
export function useActivityPing(): void {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `findash:last-activity:${userId}`;
    try {
      if (localStorage.getItem(key) === today) return;
      localStorage.setItem(key, today);
    } catch {
      // Without storage the insert below still ignores repeats.
    }
    void supabase
      .from('user_activity')
      .upsert({ user_id: userId, day: today }, { onConflict: 'user_id,day', ignoreDuplicates: true })
      .then(({ error }) => {
        if (error) console.warn('Could not record activity:', error.message);
      });
  }, [userId]);
}
