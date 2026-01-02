import { api } from './index';
import type {
  NotificationChannel,
  NotificationChannelListItem,
  AlertRule,
  AlertRuleListItem,
  Alert,
  AlertListItem,
  NotificationLog,
  NotificationStats,
  RuleTypeInfo,
  SMTPConfig,
  TelegramConfig,
  ChannelType,
  AlertSeverity,
  AlertStatus,
} from '@/types';

// ============== Channels ==============

export const notificationsApi = {
  // Channels
  async listChannels(): Promise<NotificationChannelListItem[]> {
    const response = await api.get('/notifications/channels');
    return response.data;
  },

  async getChannel(id: number): Promise<NotificationChannel> {
    const response = await api.get(`/notifications/channels/${id}`);
    return response.data;
  },

  async createChannel(data: {
    name: string;
    channel_type: ChannelType;
    is_enabled?: boolean;
    is_default?: boolean;
    min_severity?: AlertSeverity;
    config: Record<string, unknown>;
  }): Promise<NotificationChannel> {
    const response = await api.post('/notifications/channels', data);
    return response.data;
  },

  async updateChannel(
    id: number,
    data: Partial<{
      name: string;
      is_enabled: boolean;
      is_default: boolean;
      min_severity: AlertSeverity;
      config: Record<string, unknown>;
    }>
  ): Promise<NotificationChannel> {
    const response = await api.put(`/notifications/channels/${id}`, data);
    return response.data;
  },

  async deleteChannel(id: number): Promise<void> {
    await api.delete(`/notifications/channels/${id}`);
  },

  async testChannel(channelId: number): Promise<{ success: boolean; error_message?: string }> {
    const response = await api.post('/notifications/channels/test', { channel_id: channelId });
    return response.data;
  },

  // Rules
  async listRules(): Promise<AlertRuleListItem[]> {
    const response = await api.get('/notifications/rules');
    return response.data;
  },

  async getRuleTypes(): Promise<RuleTypeInfo[]> {
    const response = await api.get('/notifications/rules/types');
    return response.data;
  },

  async getRule(id: number): Promise<AlertRule> {
    const response = await api.get(`/notifications/rules/${id}`);
    return response.data;
  },

  async createRule(data: {
    name: string;
    description?: string;
    is_enabled?: boolean;
    rule_type: string;
    server_id?: number;
    source_config?: Record<string, unknown>;
    severity?: AlertSeverity;
    cooldown_minutes?: number;
    channel_ids?: number[];
    title_template?: string;
    message_template?: string;
  }): Promise<AlertRule> {
    const response = await api.post('/notifications/rules', data);
    return response.data;
  },

  async updateRule(
    id: number,
    data: Partial<{
      name: string;
      description: string;
      is_enabled: boolean;
      server_id: number;
      source_config: Record<string, unknown>;
      severity: AlertSeverity;
      cooldown_minutes: number;
      channel_ids: number[];
      title_template: string;
      message_template: string;
    }>
  ): Promise<AlertRule> {
    const response = await api.put(`/notifications/rules/${id}`, data);
    return response.data;
  },

  async deleteRule(id: number): Promise<void> {
    await api.delete(`/notifications/rules/${id}`);
  },

  // Alerts
  async listAlerts(params?: {
    status?: AlertStatus;
    severity?: AlertSeverity;
    limit?: number;
    offset?: number;
  }): Promise<AlertListItem[]> {
    const response = await api.get('/notifications/alerts', { params });
    return response.data;
  },

  async getAlert(id: number): Promise<Alert> {
    const response = await api.get(`/notifications/alerts/${id}`);
    return response.data;
  },

  async acknowledgeAlert(id: number): Promise<Alert> {
    const response = await api.post(`/notifications/alerts/${id}/acknowledge`);
    return response.data;
  },

  async resolveAlert(id: number, resolutionNote?: string): Promise<Alert> {
    const response = await api.post(`/notifications/alerts/${id}/resolve`, {
      resolution_note: resolutionNote,
    });
    return response.data;
  },

  async deleteAlert(id: number): Promise<void> {
    await api.delete(`/notifications/alerts/${id}`);
  },

  // Logs
  async listLogs(params?: {
    channel_id?: number;
    success?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<NotificationLog[]> {
    const response = await api.get('/notifications/logs', { params });
    return response.data;
  },

  // Stats
  async getStats(): Promise<NotificationStats> {
    const response = await api.get('/notifications/stats');
    return response.data;
  },

  // Admin Config
  async getSMTPConfig(): Promise<SMTPConfig | null> {
    try {
      const response = await api.get('/notifications/config/smtp');
      return response.data;
    } catch {
      return null;
    }
  },

  async setSMTPConfig(config: SMTPConfig): Promise<void> {
    await api.put('/notifications/config/smtp', config);
  },

  async getTelegramConfig(): Promise<TelegramConfig | null> {
    try {
      const response = await api.get('/notifications/config/telegram');
      return response.data;
    } catch {
      return null;
    }
  },

  async setTelegramConfig(config: TelegramConfig): Promise<void> {
    await api.put('/notifications/config/telegram', config);
  },
};
