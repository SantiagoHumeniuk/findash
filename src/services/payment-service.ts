// src/services/payment-service.ts

import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export interface SubscriptionRequest {
  id: string;
  user_id: string;
  user_email: string;
  plan: 'plus' | 'premium';
  amount: number;
  sender_name: string;
  receipt_reference?: string | null;
  receipt_image?: string | null;
  notes?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
  user_first_name?: string | null;
  user_last_name?: string | null;
}

export interface CreateSubscriptionRequestPayload {
  plan: 'plus' | 'premium';
  amount: number;
  senderName: string;
  receiptReference?: string;
  receiptImage?: string; // Base64 data URL
  notes?: string;
}

class PaymentService {
  /**
   * Envía una nueva solicitud de suscripción por transferencia
   */
  async createSubscriptionRequest(
    payload: CreateSubscriptionRequestPayload
  ): Promise<{ success: boolean; data?: SubscriptionRequest; error?: string }> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return {
          success: false,
          error: 'Debes iniciar sesión para realizar una suscripción.',
        };
      }

      if (!payload.senderName.trim()) {
        return {
          success: false,
          error: 'Por favor indica el nombre del titular que realizó la transferencia.',
        };
      }

      const { data, error } = await supabase
        .from('subscription_requests')
        .insert({
          user_id: user.id,
          user_email: user.email ?? '',
          plan: payload.plan,
          amount: payload.amount,
          sender_name: payload.senderName.trim(),
          receipt_reference: payload.receiptReference?.trim() || null,
          receipt_image: payload.receiptImage || null,
          notes: payload.notes?.trim() || null,
          status: 'pending',
        })
        .select('*')
        .single();

      if (error) {
        void logger.error('PAYMENT_REQUEST_CREATE_FAILED', error.message);
        return {
          success: false,
          error: error.message || 'Error al enviar la solicitud de suscripción.',
        };
      }

      return {
        success: true,
        data: data as SubscriptionRequest,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      void logger.error('PAYMENT_REQUEST_EXCEPTION', msg);
      return {
        success: false,
        error: msg,
      };
    }
  }

  /**
   * Obtiene las solicitudes del usuario actual
   */
  async getUserRequests(): Promise<SubscriptionRequest[]> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return [];

      const { data, error } = await supabase
        .from('subscription_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        void logger.error('PAYMENT_USER_REQUESTS_FAILED', error.message);
        return [];
      }

      return (data as SubscriptionRequest[]) ?? [];
    } catch (err) {
      void logger.error('PAYMENT_USER_REQUESTS_ERR', String(err));
      return [];
    }
  }

  /**
   * Obtiene todas las solicitudes (solo para Administradores)
   */
  async getAllRequests(filters?: {
    status?: string;
  }): Promise<SubscriptionRequest[]> {
    try {
      let query = supabase
        .from('subscription_requests')
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) {
        void logger.error('PAYMENT_GET_ALL_REQUESTS_FAILED', error.message);
        return [];
      }

      return ((data as Array<Record<string, unknown>>) || []).map((item) => {
        const profile = item.profiles as { first_name?: string; last_name?: string } | null;
        return {
          ...item,
          user_first_name: profile?.first_name ?? null,
          user_last_name: profile?.last_name ?? null,
        } as unknown as SubscriptionRequest;
      });
    } catch (err) {
      void logger.error('PAYMENT_GET_ALL_EXCEPTION', String(err));
      return [];
    }
  }

  /**
   * Aprueba una solicitud de suscripción y actualiza el rol del usuario
   */
  async approveRequest(
    requestId: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Intentar mediante la función RPC segura
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'approve_subscription_request',
        {
          request_id: requestId,
          notes: notes || null,
        }
      );

      if (!rpcError && rpcData) {
        return { success: true };
      }

      // 2. Fallback directo si el RPC no estuviese instalado todavía
      const { data: reqData, error: reqErr } = await supabase
        .from('subscription_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (reqErr || !reqData) {
        throw new Error(reqErr?.message || 'Solicitud no encontrada');
      }

      const { data: authUser } = await supabase.auth.getUser();

      // Actualizar estado de la solicitud
      const { error: updateReqErr } = await supabase
        .from('subscription_requests')
        .update({
          status: 'approved',
          admin_notes: notes || reqData.admin_notes || null,
          reviewed_by: authUser?.user?.id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateReqErr) throw updateReqErr;

      // Actualizar perfil del usuario
      const { error: updateProfileErr } = await supabase
        .from('profiles')
        .update({
          role: reqData.plan,
        })
        .eq('id', reqData.user_id);

      if (updateProfileErr) throw updateProfileErr;

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al aprobar solicitud';
      void logger.error('PAYMENT_APPROVE_FAILED', msg);
      return { success: false, error: msg };
    }
  }

  /**
   * Rechaza una solicitud de suscripción
   */
  async rejectRequest(
    requestId: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Intentar mediante RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'reject_subscription_request',
        {
          request_id: requestId,
          notes: notes || null,
        }
      );

      if (!rpcError && rpcData) {
        return { success: true };
      }

      // 2. Fallback
      const { data: authUser } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('subscription_requests')
        .update({
          status: 'rejected',
          admin_notes: notes || null,
          reviewed_by: authUser?.user?.id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al rechazar solicitud';
      void logger.error('PAYMENT_REJECT_FAILED', msg);
      return { success: false, error: msg };
    }
  }

  /**
   * Elimina una solicitud de suscripción
   */
  async deleteRequest(requestId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('subscription_requests')
        .delete()
        .eq('id', requestId);

      return !error;
    } catch {
      return false;
    }
  }
}

export const paymentService = new PaymentService();
