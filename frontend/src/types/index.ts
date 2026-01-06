export interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  is_admin: boolean;
  is_approved: boolean;
  totp_enabled: boolean;
  created_at: string;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  icon: string;
  order: number;
  is_public: boolean;
}

export interface Application {
  id: number;
  npm_proxy_id: number | null;
  name: string;
  url: string;
  icon: string | null;
  description: string | null;
  detected_type: string | null;
  category_id: number | null;
  category: Category | null;
  is_visible: boolean;
  is_public: boolean;
  is_authelia_protected: boolean;
  is_manual: boolean;
  display_order: number;
  name_override: boolean;
  icon_override: boolean;
  description_override: boolean;
  category_override: boolean;
  created_at: string;
  updated_at: string | null;
  last_synced_at: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  requires_2fa: boolean;
  user: User;
}

export interface TOTPSetup {
  secret: string;
  qr_code: string;
  uri: string;
  recovery_codes: string[];
}

export interface RecoveryCodesResponse {
  recovery_codes: string[];
}

export interface SyncStats {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  errors: number;
  removed: number;
}

export interface Tab {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  position: number;
  tab_type: 'default' | 'custom' | 'infrastructure' | 'chat' | 'app_dashboard';
  content: Record<string, unknown> | null;
  is_visible: boolean;
  owner_id: number | null;
  is_public: boolean;
  created_at: string;
  updated_at: string | null;
}

// ============== App Dashboard Types ==============

export interface BlockPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ActionInput {
  id: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'password';
  required?: boolean;
  default?: string;
  placeholder?: string;
  options?: string[];
}

export interface RowAction {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  command: string;
  confirm?: boolean;
  confirm_message?: string;
  inputs?: ActionInput[];
  show_output?: boolean;
}

export interface ActionButton {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  command: string;
  inputs?: ActionInput[];
  confirm?: boolean;
  confirm_message?: string;
}

export interface TableColumn {
  key: string;
  label: string;
  width?: string;
  format?: 'datetime' | 'number' | 'boolean' | string;
}

export interface HighlightPattern {
  pattern: string;
  color: string;
  bold?: boolean;
}

export interface HeaderAction {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  command: string;
  inputs?: ActionInput[];
  confirm?: boolean;
  confirm_message?: string;
}

export interface DashboardBlock {
  id: string;
  type: 'counter' | 'table' | 'chart' | 'logs' | 'actions';
  title: string;
  position: BlockPosition;
  config: {
    command?: string;
    parser?: 'raw' | 'json' | 'number' | 'lines' | 'table';
    refresh_interval?: number;
    icon?: string;
    color?: string;
    suffix?: string;
    prefix?: string;
    columns?: TableColumn[];
    row_actions?: RowAction[];
    header_action?: HeaderAction;
    buttons?: ActionButton[];
    max_lines?: number;
    highlight_patterns?: HighlightPattern[];
    chart_type?: 'line' | 'bar' | 'pie' | 'doughnut' | 'area';
    x_key?: string;
    y_key?: string;
    [key: string]: unknown;
  };
}

export interface ConfigSchemaField {
  type: 'string' | 'number' | 'password' | 'select';
  label: string;
  required?: boolean;
  default?: string;
  description?: string;
  options?: string[];
}

export interface AppTemplate {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  version: string;
  author?: string;
  config_schema: Record<string, ConfigSchemaField>;
  blocks: DashboardBlock[];
  is_builtin: boolean;
  is_community: boolean;
  is_public: boolean;
  downloads: number;
  created_at: string;
  updated_at?: string;
}

export interface AppTemplateListItem {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  version: string;
  author?: string;
  is_builtin: boolean;
  is_community: boolean;
  downloads: number;
}

export interface AppDashboardContent {
  template_id?: number;
  template_slug?: string;
  server_id: number;
  variables: Record<string, string>;
  blocks?: DashboardBlock[];
  layout?: Array<{ i: string; x: number; y: number; w: number; h: number }>;
}

export interface CommandResult {
  success: boolean;
  output: unknown;
  error?: string;
  execution_time: number;
}

export interface BlockData {
  block_id: string;
  success: boolean;
  data: unknown;
  error?: string;
  fetched_at: string;
}

export interface Server {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  host: string;
  ssh_port: number;
  ssh_user: string;
  has_docker: boolean;
  has_proxmox: boolean;
  is_online: boolean;
  last_check: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ServerTestResult {
  success: boolean;
  message: string;
  has_docker?: boolean;
  docker_version?: string;
  containers_count?: number;
}

// ============== Notification Types ==============

export type ChannelType = 'email' | 'telegram' | 'push' | 'webhook';
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface NotificationChannel {
  id: number;
  name: string;
  channel_type: ChannelType;
  is_enabled: boolean;
  is_default: boolean;
  min_severity: AlertSeverity;
  config: Record<string, unknown>;
  last_used_at: string | null;
  success_count: number;
  failure_count: number;
  created_at: string;
  updated_at: string | null;
}

export interface NotificationChannelListItem {
  id: number;
  name: string;
  channel_type: ChannelType;
  is_enabled: boolean;
  is_default: boolean;
  min_severity: AlertSeverity;
  last_used_at: string | null;
  success_count: number;
  failure_count: number;
}

export interface AlertRule {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  is_enabled: boolean;
  rule_type: string;
  server_id: number | null;
  source_config: Record<string, unknown>;
  severity: AlertSeverity;
  cooldown_minutes: number;
  channel_ids: number[];
  title_template: string | null;
  message_template: string | null;
  last_triggered_at: string | null;
  trigger_count: number;
  created_at: string;
  updated_at: string | null;
}

export interface AlertRuleListItem {
  id: number;
  name: string;
  rule_type: string;
  severity: AlertSeverity;
  is_enabled: boolean;
  server_id: number | null;
  last_triggered_at: string | null;
  trigger_count: number;
}

export interface Alert {
  id: number;
  rule_id: number;
  user_id: number;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  context: Record<string, unknown>;
  notifications_sent: Array<{
    channel_id: number;
    sent_at: string;
    success: boolean;
  }>;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
}

export interface AlertListItem {
  id: number;
  title: string;
  severity: AlertSeverity;
  status: AlertStatus;
  rule_name: string | null;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

export interface NotificationLog {
  id: number;
  channel_id: number | null;
  alert_id: number | null;
  channel_type: ChannelType;
  recipient: string;
  title: string;
  message: string;
  success: boolean;
  error_message: string | null;
  sent_at: string;
}

export interface NotificationStats {
  total_channels: number;
  enabled_channels: number;
  total_rules: number;
  enabled_rules: number;
  active_alerts: number;
  alerts_today: number;
  notifications_sent_today: number;
  notifications_failed_today: number;
}

export interface RuleTypeInfo {
  key: string;
  name: string;
  description: string;
  config_fields: Array<{
    key: string;
    label: string;
    type: string;
    default?: string;
    required?: boolean;
    options?: string[];
  }>;
}

export interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  from_address?: string;
  use_tls: boolean;
  start_tls: boolean;
}

export interface TelegramConfig {
  token: string;
}
