// src/services/contact-service.ts

import { supabase } from '../lib/supabase';

/**
 * Datos del formulario de contacto
 */
export interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

/**
 * Mensaje de contacto almacenado en la base de datos
 */
export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  status: 'pending' | 'read' | 'replied' | 'archived';
  user_id: string | null;
  created_at: string;
  updated_at: string;
  read_at: string | null;
  replied_at: string | null;
  user_agent: string | null;
  ip_address: string | null;
  admin_notes: string | null;
}

/**
 * Respuesta del servicio
 */
export interface ContactServiceResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Servicio para manejar mensajes de contacto
 */
class ContactService {
  /**
   * Envía un mensaje de contacto
   * Guarda el mensaje en la base de datos y envía notificación por email
   */
  async sendContactMessage(
    formData: ContactFormData
  ): Promise<ContactServiceResponse> {
    try {
      // Validar datos
      if (!formData.name || !formData.email || !formData.message) {
        return {
          success: false,
          error: 'Todos los campos son obligatorios',
        };
      }

      // Validar email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        return {
          success: false,
          error: 'Email inválido',
        };
      }

      // Validar longitud del mensaje
      if (formData.message.length < 10) {
        return {
          success: false,
          error: 'El mensaje debe tener al menos 10 caracteres',
        };
      }

      // Obtener usuario actual si está autenticado
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Obtener user agent
      const userAgent =
        typeof navigator !== 'undefined' ? navigator.userAgent : null;

      // Insertar mensaje en la base de datos
      const { data, error } = await supabase
        .from('contact_messages')
        .insert({
          name: formData.name.trim(),
          email: formData.email.toLowerCase().trim(),
          message: formData.message.trim(),
          user_id: user?.id ?? null,
          user_agent: userAgent,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error inserting contact message:', error);
        return {
          success: false,
          error: 'Error al guardar el mensaje',
        };
      }

      if (!data) {
        return {
          success: false,
          error: 'Error al guardar el mensaje',
        };
      }

      // TODO: Enviar email de notificación al equipo
      // Esto se puede implementar con Resend, SendGrid, o Supabase Edge Functions
      // Por ahora solo guardamos en la base de datos

      return {
        success: true,
        messageId: data.id as string,
      };
    } catch (error) {
      console.error('Error in sendContactMessage:', error);
      return {
        success: false,
        error: 'Error inesperado al enviar el mensaje',
      };
    }
  }

  /**
   * Obtiene los mensajes de contacto del usuario actual
   * Solo disponible para usuarios autenticados
   */
  async getUserMessages(): Promise<ContactMessage[]> {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) return [];

    const { data, error } = await supabase
      .from('contact_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data as ContactMessage[];
  }

  /**
   * Obtiene todos los mensajes de contacto
   * Solo disponible para administradores
   */
  async getAllMessages(
    filters?: {
      status?: ContactMessage['status'];
      limit?: number;
    }
  ): Promise<ContactMessage[]> {
    let query = supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data as ContactMessage[];
  }

  /**
   * Elimina un mensaje de contacto
   * Solo disponible para administradores según las políticas RLS
   */
  async deleteMessage(messageId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .delete()
        .eq('id', messageId);

      if (error) {
        console.error('Error deleting contact message:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteMessage:', error);
      return false;
    }
  }

  /**
   * Marca un mensaje como leído
   * Solo disponible para administradores
   */
  async markAsRead(messageId: string): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('mark_contact_message_as_read', {
        message_id: messageId,
      });

      if (error) {
        console.error('Error marking message as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markAsRead:', error);
      return false;
    }
  }

  /**
   * Marca un mensaje como respondido
   * Solo disponible para administradores
   */
  async markAsReplied(
    messageId: string,
    adminNotes?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('mark_contact_message_as_replied', {
        message_id: messageId,
        notes: adminNotes ?? null,
      });

      if (error) {
        console.error('Error marking message as replied:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markAsReplied:', error);
      return false;
    }
  }

  /**
   * Obtiene estadísticas de mensajes
   * Solo disponible para administradores
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    read: number;
    replied: number;
    archived: number;
  } | null> {
    try {
       
      const { data, error } = await supabase.rpc('get_contact_messages_stats');

      if (error) {
        console.error('Error fetching stats:', error);
        return null;
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        return {
          total: 0,
          pending: 0,
          read: 0,
          replied: 0,
          archived: 0,
        };
      }

      const stats = data[0] as Record<string, unknown>;

      return {
        total: Number(stats.total_messages ?? 0),
        pending: Number(stats.pending_messages ?? 0),
        read: Number(stats.read_messages ?? 0),
        replied: Number(stats.replied_messages ?? 0),
        archived: Number(stats.archived_messages ?? 0),
      };
    } catch (error) {
      console.error('Error in getStats:', error);
      return null;
    }
  }
}

// Exportar instancia única del servicio
export const contactService = new ContactService();
