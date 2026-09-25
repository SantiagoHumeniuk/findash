-- =============================================================================
-- TABLA DE SOLICITUDES DE SUSCRIPCIÓN Y PAGOS (TRANSFERENCIA / MERCADO PAGO)
-- =============================================================================
-- Esta migración crea la tabla para almacenar los pagos y transferencias
-- enviados por los usuarios para actualizar su suscripción (Plus o Premium).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CREAR TABLA: subscription_requests
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Usuario asociado
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  
  -- Plan y monto
  plan TEXT NOT NULL CHECK (plan IN ('plus', 'premium')),
  amount NUMERIC NOT NULL,
  
  -- Datos de la transferencia
  sender_name TEXT NOT NULL,
  receipt_reference TEXT,
  receipt_image TEXT, -- Base64 o URL del comprobante
  notes TEXT,
  
  -- Estado de la solicitud
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Gestión y auditoría por administradores
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  user_notified_at TIMESTAMPTZ,
  
  -- Fechas
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Si la tabla ya existe, agregar la columna user_notified_at si no está presente:
ALTER TABLE public.subscription_requests ADD COLUMN IF NOT EXISTS user_notified_at TIMESTAMPTZ;

-- -----------------------------------------------------------------------------
-- COMENTARIOS
-- -----------------------------------------------------------------------------
COMMENT ON TABLE public.subscription_requests IS 'Almacena las solicitudes de pago por transferencia para actualizar planes';
COMMENT ON COLUMN public.subscription_requests.id IS 'ID único de la solicitud';
COMMENT ON COLUMN public.subscription_requests.user_id IS 'ID del usuario solicitante';
COMMENT ON COLUMN public.subscription_requests.user_email IS 'Email del usuario';
COMMENT ON COLUMN public.subscription_requests.plan IS 'Plan solicitado: plus o premium';
COMMENT ON COLUMN public.subscription_requests.amount IS 'Monto transferido en ARS';
COMMENT ON COLUMN public.subscription_requests.sender_name IS 'Nombre del titular de la cuenta que realizó la transferencia';
COMMENT ON COLUMN public.subscription_requests.receipt_reference IS 'Número de operación o comprobante de Mercado Pago';
COMMENT ON COLUMN public.subscription_requests.receipt_image IS 'Imagen del comprobante adjunto';
COMMENT ON COLUMN public.subscription_requests.status IS 'Estado: pending (pendiente), approved (aprobada), rejected (rechazada)';
COMMENT ON COLUMN public.subscription_requests.admin_notes IS 'Notas internas del administrador';
COMMENT ON COLUMN public.subscription_requests.user_notified_at IS 'Fecha en que se le mostró el pop-up de confirmación al usuario';

-- -----------------------------------------------------------------------------
-- ÍNDICES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_subscription_requests_user_id ON public.subscription_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_requests_status ON public.subscription_requests(status);
CREATE INDEX IF NOT EXISTS idx_subscription_requests_created_at ON public.subscription_requests(created_at DESC);

-- -----------------------------------------------------------------------------
-- TRIGGER: Actualizar updated_at automáticamente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_subscription_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_subscription_requests_updated_at ON public.subscription_requests;
CREATE TRIGGER update_subscription_requests_updated_at
  BEFORE UPDATE ON public.subscription_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_subscription_requests_updated_at();

-- -----------------------------------------------------------------------------
-- POLÍTICAS RLS (Row Level Security)
-- -----------------------------------------------------------------------------
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

-- POLÍTICA 1: Los usuarios autenticados pueden insertar sus propias solicitudes
CREATE POLICY "Users can create their own subscription requests"
ON public.subscription_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- POLÍTICA 2: Los usuarios pueden consultar sus propias solicitudes
CREATE POLICY "Users can view their own subscription requests"
ON public.subscription_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- POLÍTICA 3: Los usuarios pueden actualizar el estado de notificación de sus solicitudes
CREATE POLICY "Users can mark their own requests as notified"
ON public.subscription_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- POLÍTICA 4: Los administradores pueden ver todas las solicitudes
CREATE POLICY "Admins can view all subscription requests"
ON public.subscription_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND (profiles.role = 'administrador' OR profiles.role = 'admin')
  )
);

-- POLÍTICA 4: Los administradores pueden actualizar cualquier solicitud
CREATE POLICY "Admins can update subscription requests"
ON public.subscription_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND (profiles.role = 'administrador' OR profiles.role = 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND (profiles.role = 'administrador' OR profiles.role = 'admin')
  )
);

-- POLÍTICA 5: Los administradores pueden eliminar solicitudes
CREATE POLICY "Admins can delete subscription requests"
ON public.subscription_requests
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND (profiles.role = 'administrador' OR profiles.role = 'admin')
  )
);

-- -----------------------------------------------------------------------------
-- FUNCIÓN RPC: Aprobar solicitud de suscripción y actualizar rol del usuario
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_subscription_request(
  request_id UUID,
  notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_request RECORD;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();

  -- Verificar si el usuario actual es administrador
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_admin_id AND (role = 'administrador' OR role = 'admin')
  ) THEN
    RAISE EXCEPTION 'No tienes permisos de administrador para realizar esta acción';
  END IF;

  -- Obtener la solicitud
  SELECT * INTO v_request
  FROM public.subscription_requests
  WHERE id = request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud de suscripción no encontrada';
  END IF;

  -- Actualizar estado de la solicitud
  UPDATE public.subscription_requests
  SET 
    status = 'approved',
    admin_notes = COALESCE(notes, admin_notes),
    reviewed_by = v_admin_id,
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = request_id;

  -- Actualizar el rol del usuario en profiles al plan solicitado ('plus' o 'premium')
  UPDATE public.profiles
  SET 
    role = v_request.plan,
    updated_at = NOW()
  WHERE id = v_request.user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Solicitud aprobada y plan de usuario actualizado exitosamente',
    'plan', v_request.plan,
    'user_id', v_request.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.approve_subscription_request IS 
'Aprueba una solicitud de pago por transferencia y actualiza automáticamente el rol del usuario en la tabla profiles';

-- -----------------------------------------------------------------------------
-- FUNCIÓN RPC: Rechazar solicitud de suscripción
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_subscription_request(
  request_id UUID,
  notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();

  -- Verificar si el usuario actual es administrador
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_admin_id AND (role = 'administrador' OR role = 'admin')
  ) THEN
    RAISE EXCEPTION 'No tienes permisos de administrador para realizar esta acción';
  END IF;

  -- Actualizar estado de la solicitud
  UPDATE public.subscription_requests
  SET 
    status = 'rejected',
    admin_notes = COALESCE(notes, admin_notes),
    reviewed_by = v_admin_id,
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = request_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Solicitud rechazada exitosamente'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.reject_subscription_request IS 
'Rechaza una solicitud de suscripción con notas explicativas';
