// src/features/alerts/pages/unsubscribe-page.tsx

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { supabase } from '../../../lib/supabase';

type Status = 'idle' | 'sending' | 'done' | 'error';

/**
 * Public page behind the email's unsubscribe link. It asks for a click because
 * email security scanners open links, which would unsubscribe people by accident.
 */
export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<Status>('idle');

  const unsubscribe = async () => {
    setStatus('sending');
    const { error } = await supabase.functions.invoke('market-alerts', { body: { unsubscribe: token } });
    setStatus(error ? 'error' : 'done');
  };

  return (
    <div className="container-wide flex justify-center py-16">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Correos de FinDash</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token ? (
            <p className="text-sm text-muted-foreground">Este enlace no es válido. Podés cambiar tus avisos desde Alertas en tu cuenta.</p>
          ) : status === 'done' ? (
            <p className="text-sm">Listo, ya no vas a recibir alertas ni resúmenes por email. Podés reactivarlos desde Alertas en tu cuenta.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">¿Querés dejar de recibir las alertas y el resumen diario por email?</p>
              <Button onClick={() => void unsubscribe()} disabled={status === 'sending'}>
                {status === 'sending' ? 'Procesando…' : 'Dejar de recibirlos'}
              </Button>
              {status === 'error' && (
                <p role="alert" className="text-sm text-destructive">
                  No pudimos procesarlo. Probá de nuevo o cambiá tus avisos desde Alertas en tu cuenta.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
