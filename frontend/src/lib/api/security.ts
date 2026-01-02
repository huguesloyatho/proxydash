import { api } from './index';

// Types
export interface AuditLog {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  resource_type: string | null;
  resource_id: number | null;
  resource_name: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditStats {
  total_entries: number;
  entries_today: number;
  entries_this_week: number;
  top_actions: Array<{ action: string; count: number }>;
  top_users: Array<{ user_id: number; username: string; count: number }>;
}

export interface AuditAction {
  value: string;
  label: string;
}

export interface UserSession {
  id: number;
  device_info: string | null;
  ip_address: string | null;
  is_current: boolean;
  last_activity: string;
  expires_at: string;
  created_at: string;
}

export interface BackupConfig {
  include_applications: boolean;
  include_categories: boolean;
  include_widgets: boolean;
  include_tabs: boolean;
  include_servers: boolean;
  include_npm_instances: boolean;
  include_notification_channels: boolean;
  include_alert_rules: boolean;
  include_templates: boolean;
  include_user_settings: boolean;
}

export interface ImportResult {
  success: boolean;
  message: string;
  imported_counts: Record<string, number>;
  errors: string[];
  warnings: string[];
}

// API
export const securityApi = {
  // Audit Logs
  async listAuditLogs(params?: {
    user_id?: number;
    action?: string;
    resource_type?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    const response = await api.get('/security/audit-logs', { params });
    return response.data;
  },

  async getAuditStats(): Promise<AuditStats> {
    const response = await api.get('/security/audit-logs/stats');
    return response.data;
  },

  async getAuditActions(): Promise<AuditAction[]> {
    const response = await api.get('/security/audit-logs/actions');
    return response.data;
  },

  // Sessions
  async listSessions(): Promise<UserSession[]> {
    const response = await api.get('/security/sessions');
    return response.data;
  },

  async revokeSession(sessionId: number): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/security/sessions/revoke', { session_id: sessionId });
    return response.data;
  },

  async revokeAllSessions(keepCurrent: boolean = true): Promise<{ success: boolean; revoked_count: number; message: string }> {
    const response = await api.post('/security/sessions/revoke-all', { keep_current: keepCurrent });
    return response.data;
  },

  // Backup
  async exportConfig(config: BackupConfig): Promise<Blob> {
    const response = await api.post('/security/backup/export', config);
    // Convert JSON response to Blob
    const jsonString = JSON.stringify(response.data, null, 2);
    return new Blob([jsonString], { type: 'application/json' });
  },

  async importConfig(file: File): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/security/backup/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
