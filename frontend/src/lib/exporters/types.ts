/**
 * Types et interfaces pour le système d'export universel des widgets
 */

// Options générales d'export
export interface ExportOptions {
  filename?: string;
  title?: string;
  includeTimestamp?: boolean;
  includeMetadata?: boolean;
}

// Section d'un PDF
export interface PDFSection {
  title?: string;
  content: string | string[];
  type: 'text' | 'list' | 'stats';
}

// Table dans un PDF
export interface PDFTable {
  title?: string;
  headers: string[];
  rows: string[][];
}

// Contenu complet d'un PDF
export interface PDFContent {
  title: string;
  subtitle?: string;
  generatedAt: string;
  sections?: PDFSection[];
  tables?: PDFTable[];
  footer?: string;
  imageData?: string; // Base64 image for graphs
}

// Métadonnées d'export JSON
export interface ExportMetadata {
  exportedAt: string;
  source: string;
  widgetType: string;
  widgetTitle: string;
  version: string;
}

// Interface de l'adaptateur d'export par widget
export interface IWidgetExportAdapter<T = unknown> {
  widgetType: string;
  displayName: string;

  // Transforme les données pour CSV
  toCSVRows(data: T): string[][];
  getCSVHeaders(): string[];

  // Transforme pour JSON (avec metadata optionnelle)
  toJSON(data: T, metadata?: Partial<ExportMetadata>): object;

  // Génère le contenu PDF
  toPDFContent(data: T, title?: string): PDFContent;

  // Support de l'export image
  supportsImageExport: boolean;

  // Support de l'export graphique séparé (pour UptimePing)
  supportsGraphExport?: boolean;
}

// Types de données spécifiques par widget

// Docker
export interface DockerContainerData {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports: string[];
  created: string;
  cpu_percent?: number;
  memory_usage?: number;
  memory_limit?: number;
  memory_percent?: number;
}

export interface DockerWidgetData {
  containers: DockerContainerData[];
  summary: {
    total: number;
    running: number;
    stopped: number;
    paused: number;
  };
  host: string;
  fetched_at: string;
}

// UptimePing
export interface PingHistoryPoint {
  timestamp: string;
  latency_min: number | null;
  latency_avg: number | null;
  latency_max: number | null;
  jitter: number | null;
  packet_loss_percent: number;
  is_reachable: boolean;
}

export interface PingTargetData {
  target: string;
  name: string;
  current: {
    is_reachable: boolean;
    latency_min: number | null;
    latency_avg: number | null;
    latency_max: number | null;
    jitter: number | null;
    packet_loss_percent: number;
    status: 'ok' | 'warning' | 'critical';
    timestamp: string;
  };
  history: PingHistoryPoint[];
  statistics: {
    total_measurements: number;
    avg_latency: number | null;
    min_latency: number | null;
    max_latency: number | null;
    avg_jitter: number | null;
    avg_packet_loss: number;
    uptime_percent: number;
    outages: number;
  };
}

export interface PingWidgetData {
  targets: PingTargetData[];
  fetched_at: string;
}

// Vikunja
export interface VikunjaTask {
  id: number;
  title: string;
  done: boolean;
  priority: number;
  due_date: string | null;
  project_id: number;
  labels?: Array<{ id: number; title: string; hex_color: string }>;
  assignees?: Array<{ id: number; username: string }>;
}

export interface VikunjaWidgetData {
  tasks: VikunjaTask[];
  total: number;
  completed_count: number;
  incomplete_count: number;
}

// CrowdSec
export interface CrowdSecDecision {
  id: number;
  origin: string;
  scope: string;
  value: string;
  type: string;
  duration: string;
  scenario: string;
}

export interface CrowdSecAlert {
  id: number;
  scenario: string;
  message: string;
  ip: string;
  country: string;
  as_name: string;
  created_at: string;
  events_count: number;
}

export interface CrowdSecWidgetData {
  decisions: CrowdSecDecision[];
  decisions_count: number;
  alerts: CrowdSecAlert[];
  alerts_count: number;
  metrics: {
    total_decisions: number;
    total_alerts: number;
    by_origin: Record<string, number>;
    by_action: Record<string, number>;
    by_country: Record<string, number>;
    by_scenario: Record<string, number>;
  };
  fetched_at: string;
}

// Logs
export interface LogEntry {
  raw: string;
  message: string;
  timestamp?: string;
  level: 'error' | 'warning' | 'info' | 'debug' | 'default';
}

export interface LogsWidgetData {
  container: string;
  host: string;
  logs: LogEntry[];
  line_count: number;
  fetched_at: string;
}

// RSS
export interface RssArticle {
  id: number;
  feed_url: string;
  article_url: string | null;
  title: string;
  summary: string | null;
  author: string | null;
  image_url: string | null;
  published_at: string | null;
  fetched_at: string;
  is_read: boolean;
  is_archived: boolean;
}

export interface RssWidgetData {
  articles: RssArticle[];
  counts: {
    unread: number;
    archived: number;
    total: number;
  };
  feed_urls: string[];
}

// VMStatus
export interface VMStatusWidgetData {
  name: string;
  host: string;
  description?: string;
  is_online: boolean;
  cpu_percent?: number;
  memory?: {
    total: number;
    used: number;
    percent: number;
  };
  disk?: {
    total: number;
    used: number;
    percent: number;
  };
  containers?: Array<{
    id: string;
    name: string;
    state: string;
    status: string;
    ports: string[];
  }>;
  ports?: Record<string, boolean>;
  ssh_enabled?: boolean;
  ssh_error?: string;
  checked_at: string;
}

// Calendar
export interface CalendarEvent {
  summary: string;
  start: string;
  end: string | null;
  all_day: boolean;
}

export interface VikunjaTaskForCalendar {
  id: number;
  title: string;
  done: boolean;
  priority: number;
  due_date: string;
  project_id: number;
  labels: { id: number; title: string; hex_color: string }[];
}

export interface CalendarWidgetData {
  events: CalendarEvent[];
  vikunjaTasksMap: Record<string, VikunjaTaskForCalendar[]>;
  upcomingTasks: VikunjaTaskForCalendar[];
  currentMonth: string;
  timezone: string;
}

// Notes
export interface NoteData {
  id: number | string;
  title: string;
  content: string;
  color: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  category?: string;
  favorite?: boolean;
}

export interface NotesWidgetData {
  notes: NoteData[];
  source: 'local' | 'nextcloud';
  counts: {
    total: number;
    pinned: number;
    archived: number;
  };
}

// Type union pour toutes les données de widgets
export type WidgetData =
  | DockerWidgetData
  | PingWidgetData
  | VikunjaWidgetData
  | CrowdSecWidgetData
  | LogsWidgetData
  | RssWidgetData
  | VMStatusWidgetData
  | CalendarWidgetData
  | NotesWidgetData;

// Format d'export supporté
export type ExportFormat = 'csv' | 'json' | 'pdf' | 'png' | 'png-graph';

// Configuration d'export disponible par widget
export interface WidgetExportConfig {
  widgetType: string;
  supportedFormats: ExportFormat[];
  hasGraphExport: boolean;
}
