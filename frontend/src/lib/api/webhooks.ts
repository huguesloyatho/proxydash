import { api } from './index';

// Types
export interface Webhook {
  id: number;
  name: string;
  token: string;
  url: string;  // Full webhook URL from backend
  description: string | null;
  event_types: string[];
  create_alert: boolean;
  alert_severity: 'info' | 'warning' | 'error' | 'success';
  forward_to_channels: number[];
  title_template: string | null;
  message_template: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface WebhookWithSecret extends Webhook {
  secret: string | null;
  url: string;  // Full webhook URL from backend
}

export interface WebhookEvent {
  id: number;
  webhook_id: number;
  event_type: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
  processed: boolean;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface WebhookTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  event_types: string[];
  title_template: string;
  message_template: string;
}

export interface WebhookStats {
  total_webhooks: number;
  active_webhooks: number;
  total_events_received: number;
  events_last_24h: number;
  events_last_7d: number;
  top_webhooks: Array<{ webhook_id: number; name: string; count: number }>;
}

export interface WebhookCreateData {
  name: string;
  description?: string;
  event_types?: string[];
  create_alert?: boolean;
  alert_severity?: 'info' | 'warning' | 'error' | 'success';
  forward_to_channels?: number[];
  title_template?: string;
  message_template?: string;
  is_enabled?: boolean;
}

export interface WebhookUpdateData {
  name?: string;
  description?: string;
  event_types?: string[];
  create_alert?: boolean;
  alert_severity?: 'info' | 'warning' | 'error' | 'success';
  forward_to_channels?: number[];
  title_template?: string;
  message_template?: string;
  is_enabled?: boolean;
}

// API
export const webhooksApi = {
  // List all webhooks
  async list(): Promise<Webhook[]> {
    const response = await api.get('/webhooks');
    return response.data;
  },

  // Get a specific webhook
  async get(id: number): Promise<WebhookWithSecret> {
    const response = await api.get(`/webhooks/${id}`);
    return response.data;
  },

  // Create a new webhook
  async create(data: WebhookCreateData): Promise<WebhookWithSecret> {
    const response = await api.post('/webhooks', data);
    return response.data;
  },

  // Update a webhook
  async update(id: number, data: WebhookUpdateData): Promise<Webhook> {
    const response = await api.patch(`/webhooks/${id}`, data);
    return response.data;
  },

  // Delete a webhook
  async delete(id: number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/webhooks/${id}`);
    return response.data;
  },

  // Regenerate webhook token
  async regenerateToken(id: number): Promise<{ token: string; message: string }> {
    const response = await api.post(`/webhooks/${id}/regenerate-token`);
    return response.data;
  },

  // Regenerate webhook secret
  async regenerateSecret(id: number): Promise<{ secret: string; message: string }> {
    const response = await api.post(`/webhooks/${id}/regenerate-secret`);
    return response.data;
  },

  // Get webhook events
  async getEvents(id: number, params?: {
    limit?: number;
    offset?: number;
  }): Promise<{ events: WebhookEvent[]; total: number }> {
    const response = await api.get(`/webhooks/${id}/events`, { params });
    return response.data;
  },

  // Get available templates
  async getTemplates(): Promise<WebhookTemplate[]> {
    const response = await api.get('/webhooks/templates');
    return response.data;
  },

  // Get statistics (admin only)
  async getStats(): Promise<WebhookStats> {
    const response = await api.get('/webhooks/stats');
    return response.data;
  },

  // Test webhook with sample payload
  async test(id: number, payload?: Record<string, unknown>): Promise<{
    success: boolean;
    message: string;
    generated_title: string | null;
    generated_message: string | null;
  }> {
    const response = await api.post(`/webhooks/${id}/test`, { payload });
    return response.data;
  },
};
