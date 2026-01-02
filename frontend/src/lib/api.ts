import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (email: string, password: string, totpCode?: string) => {
    const response = await api.post('/auth/login', {
      email,
      password,
      totp_code: totpCode,
    });
    return response.data;
  },

  register: async (email: string, username: string, password: string) => {
    const response = await api.post('/auth/register', {
      email,
      username,
      password,
    });
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  setup2FA: async () => {
    const response = await api.post('/auth/2fa/setup');
    return response.data;
  },

  verify2FA: async (code: string) => {
    const response = await api.post('/auth/2fa/verify', { code });
    return response.data;
  },

  disable2FA: async (code: string) => {
    const response = await api.post('/auth/2fa/disable', { code });
    return response.data;
  },

  regenerateRecoveryCodes: async (code: string) => {
    const response = await api.post('/auth/2fa/regenerate-recovery', { code });
    return response.data;
  },

  updateProfile: async (data: { email?: string; username?: string }) => {
    const response = await api.patch('/auth/profile', data);
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },
};

// Applications API
export const applicationsApi = {
  list: async (category?: string, visibleOnly = true) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    params.append('visible_only', String(visibleOnly));
    const response = await api.get(`/applications?${params}`);
    return response.data;
  },

  get: async (id: number) => {
    const response = await api.get(`/applications/${id}`);
    return response.data;
  },

  create: async (data: {
    name: string;
    url: string;
    icon?: string;
    description?: string;
    category_id?: number;
    is_visible?: boolean;
  }) => {
    const response = await api.post('/applications', data);
    return response.data;
  },

  update: async (id: number, data: {
    name?: string;
    url?: string;
    icon?: string;
    description?: string;
    category_id?: number;
    is_visible?: boolean;
    is_public?: boolean;
    is_authelia_protected?: boolean;
    display_order?: number;
  }) => {
    const response = await api.patch(`/applications/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/applications/${id}`);
    return response.data;
  },

  reset: async (id: number) => {
    const response = await api.post(`/applications/${id}/reset`);
    return response.data;
  },

  sync: async () => {
    const response = await api.post('/applications/sync');
    return response.data;
  },

  reorder: async (appIds: number[]) => {
    const response = await api.post('/applications/reorder', { app_ids: appIds });
    return response.data;
  },
};

// Categories API
export const categoriesApi = {
  list: async () => {
    const response = await api.get('/categories');
    return response.data;
  },

  get: async (id: number) => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  },

  create: async (data: {
    slug: string;
    name: string;
    icon: string;
    order?: number;
  }) => {
    const response = await api.post('/categories', data);
    return response.data;
  },

  update: async (id: number, data: {
    name?: string;
    icon?: string;
    order?: number;
    is_public?: boolean;
  }) => {
    const response = await api.patch(`/categories/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  },
};

// Users API (admin only)
export const usersApi = {
  list: async () => {
    const response = await api.get('/users');
    return response.data;
  },

  get: async (id: number) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  create: async (data: {
    email: string;
    username: string;
    password: string;
    is_admin?: boolean;
  }) => {
    const response = await api.post('/users', data);
    return response.data;
  },

  update: async (id: number, data: {
    email?: string;
    username?: string;
    password?: string;
    is_active?: boolean;
    is_admin?: boolean;
    is_approved?: boolean;
  }) => {
    const response = await api.patch(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },
};

// NPM Instances API (admin only)
export const npmInstancesApi = {
  list: async () => {
    const response = await api.get('/npm-instances');
    return response.data;
  },

  get: async (id: number) => {
    const response = await api.get(`/npm-instances/${id}`);
    return response.data;
  },

  create: async (data: {
    name: string;
    connection_mode: 'database' | 'api';
    // Database fields
    db_host?: string;
    db_port?: number;
    db_name?: string;
    db_user?: string;
    db_password?: string;
    // API fields
    api_url?: string;
    api_email?: string;
    api_password?: string;
    // Common
    priority?: number;
    is_active?: boolean;
  }) => {
    const response = await api.post('/npm-instances', data);
    return response.data;
  },

  update: async (id: number, data: {
    name?: string;
    connection_mode?: 'database' | 'api';
    db_host?: string;
    db_port?: number;
    db_name?: string;
    db_user?: string;
    db_password?: string;
    api_url?: string;
    api_email?: string;
    api_password?: string;
    priority?: number;
    is_active?: boolean;
  }) => {
    const response = await api.patch(`/npm-instances/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/npm-instances/${id}`);
    return response.data;
  },

  testConnection: async (id: number) => {
    const response = await api.post(`/npm-instances/${id}/test`);
    return response.data;
  },
};

// Widgets API
export const widgetsApi = {
  list: async () => {
    const response = await api.get('/widgets');
    return response.data;
  },

  listAll: async () => {
    const response = await api.get('/widgets/all');
    return response.data;
  },

  listPublic: async () => {
    const response = await api.get('/widgets?public_only=true');
    return response.data;
  },

  get: async (id: number) => {
    const response = await api.get(`/widgets/${id}`);
    return response.data;
  },

  create: async (data: {
    widget_type: string;
    title?: string;
    position?: number;
    column?: number;
    size?: 'small' | 'medium' | 'large';
    col_span?: number;
    row_span?: number;
    config?: Record<string, unknown>;
    is_visible?: boolean;
    is_public?: boolean;
  }) => {
    const response = await api.post('/widgets', data);
    return response.data;
  },

  update: async (id: number, data: {
    title?: string;
    position?: number;
    column?: number;
    size?: 'small' | 'medium' | 'large';
    col_span?: number;
    row_span?: number;
    config?: Record<string, unknown>;
    is_visible?: boolean;
    is_public?: boolean;
  }) => {
    const response = await api.patch(`/widgets/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/widgets/${id}`);
    return response.data;
  },

  getData: async (id: number) => {
    const response = await api.post(`/widgets/${id}/data`);
    return response.data;
  },

  // Fetch widget data using direct configuration (for custom tab widgets)
  fetchData: async (widgetType: string, config: Record<string, unknown>) => {
    const response = await api.post('/widgets/fetch-data', {
      widget_type: widgetType,
      config,
    });
    return response.data;
  },

  reorder: async (widgetIds: number[]) => {
    const response = await api.post('/widgets/reorder', { widget_ids: widgetIds });
    return response.data;
  },

  bulkUpdate: async (updates: { id: number; position?: number; col_span?: number; row_span?: number }[]) => {
    const response = await api.post('/widgets/bulk-update', { updates });
    return response.data;
  },

  getTypes: async () => {
    const response = await api.get('/widgets/types');
    return response.data;
  },
};

// Vikunja API (task management)
export const vikunjaApi = {
  // Users (from teams)
  getUsers: async () => {
    const response = await api.get('/vikunja/users');
    return response.data;
  },

  // Projects
  getProjects: async () => {
    const response = await api.get('/vikunja/projects');
    return response.data;
  },

  // Labels
  getLabels: async () => {
    const response = await api.get('/vikunja/labels');
    return response.data;
  },

  // Tasks CRUD
  getTask: async (taskId: number) => {
    const response = await api.get(`/vikunja/tasks/${taskId}`);
    return response.data;
  },

  createTask: async (data: {
    title: string;
    description?: string;
    project_id: number;
    priority?: number;
    due_date?: string;
    labels?: number[];
    assignees?: number[];
  }) => {
    const response = await api.post('/vikunja/tasks', data);
    return response.data;
  },

  updateTask: async (taskId: number, data: {
    title?: string;
    description?: string;
    project_id?: number;
    priority?: number;
    due_date?: string | null;
    done?: boolean;
    labels?: number[];
    assignees?: number[];
  }) => {
    const response = await api.put(`/vikunja/tasks/${taskId}`, data);
    return response.data;
  },

  deleteTask: async (taskId: number) => {
    const response = await api.delete(`/vikunja/tasks/${taskId}`);
    return response.data;
  },

  toggleDone: async (taskId: number) => {
    const response = await api.post(`/vikunja/tasks/${taskId}/done`);
    return response.data;
  },

  // Tasks by date
  getTasksByDate: async (date: string) => {
    const response = await api.get(`/vikunja/tasks/by-date/${date}`);
    return response.data;
  },

  // Upcoming tasks (not done, due today or later)
  getUpcomingTasks: async (limit = 10) => {
    const response = await api.get(`/vikunja/tasks/upcoming?limit=${limit}`);
    return response.data;
  },

  // Attachments
  addAttachment: async (taskId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/vikunja/tasks/${taskId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteAttachment: async (taskId: number, attachmentId: number) => {
    const response = await api.delete(`/vikunja/tasks/${taskId}/attachments/${attachmentId}`);
    return response.data;
  },

  getAttachmentUrl: async (taskId: number, attachmentId: number) => {
    const response = await api.get(`/vikunja/tasks/${taskId}/attachments/${attachmentId}/download`);
    return response.data;
  },
};

// Tabs API
export const tabsApi = {
  list: async () => {
    const response = await api.get('/tabs');
    return response.data;
  },

  listAll: async () => {
    const response = await api.get('/tabs/all');
    return response.data;
  },

  // List shared tabs available for subscription
  listShared: async () => {
    const response = await api.get('/tabs/shared');
    return response.data;
  },

  // List tabs user is subscribed to
  listSubscriptions: async () => {
    const response = await api.get('/tabs/subscriptions');
    return response.data;
  },

  get: async (id: number) => {
    const response = await api.get(`/tabs/${id}`);
    return response.data;
  },

  getBySlug: async (slug: string) => {
    const response = await api.get(`/tabs/slug/${slug}`);
    return response.data;
  },

  create: async (data: {
    name: string;
    slug?: string;
    icon?: string;
    position?: number;
    tab_type?: string;
    content?: Record<string, unknown>;
    is_visible?: boolean;
    is_public?: boolean;
  }) => {
    const response = await api.post('/tabs', data);
    return response.data;
  },

  update: async (id: number, data: {
    name?: string;
    slug?: string;
    icon?: string;
    position?: number;
    content?: Record<string, unknown>;
    is_visible?: boolean;
    is_public?: boolean;
  }) => {
    const response = await api.patch(`/tabs/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/tabs/${id}`);
    return response.data;
  },

  reorder: async (tabIds: number[]) => {
    const response = await api.post('/tabs/reorder', { tab_ids: tabIds });
    return response.data;
  },

  togglePublic: async (id: number) => {
    const response = await api.patch(`/tabs/${id}/toggle-public`);
    return response.data;
  },

  // Subscribe to a shared tab
  subscribe: async (id: number) => {
    const response = await api.post(`/tabs/${id}/subscribe`);
    return response.data;
  },

  // Unsubscribe from a shared tab
  unsubscribe: async (id: number) => {
    const response = await api.delete(`/tabs/${id}/subscribe`);
    return response.data;
  },
};

// Public API (no auth required)
export const publicApi = {
  getDashboard: async () => {
    const response = await api.get('/public/dashboard');
    return response.data;
  },

  getApplications: async (category?: string) => {
    const params = category ? `?category=${category}` : '';
    const response = await api.get(`/public/applications${params}`);
    return response.data;
  },

  getCategories: async () => {
    const response = await api.get('/public/categories');
    return response.data;
  },
};

// Health Check API (URL status checking)
export interface URLStatus {
  url: string;
  is_up: boolean;
  status_code: number | null;
  response_time_ms: number | null;
  error: string | null;
}

export interface URLCheckResponse {
  results: Record<string, URLStatus>;
  checked_at: string;
}

export const healthCheckApi = {
  checkUrls: async (urls: string[], timeout = 5): Promise<URLCheckResponse> => {
    const response = await api.post('/health-check/check', { urls, timeout });
    return response.data;
  },

  checkSingleUrl: async (url: string, timeout = 5): Promise<URLStatus & { checked_at: string }> => {
    const response = await api.get(`/health-check/check-single?url=${encodeURIComponent(url)}&timeout=${timeout}`);
    return response.data;
  },
};

// Docker API (container management)
export const dockerApi = {
  // Get widget data (list containers)
  getWidgetData: async (widgetId: number) => {
    const response = await api.get(`/docker/widget/${widgetId}/data`);
    return response.data;
  },

  // Container actions
  startContainer: async (widgetId: number, containerName: string) => {
    const response = await api.post(`/docker/widget/${widgetId}/start`, { container_name: containerName });
    return response.data;
  },

  stopContainer: async (widgetId: number, containerName: string) => {
    const response = await api.post(`/docker/widget/${widgetId}/stop`, { container_name: containerName });
    return response.data;
  },

  restartContainer: async (widgetId: number, containerName: string) => {
    const response = await api.post(`/docker/widget/${widgetId}/restart`, { container_name: containerName });
    return response.data;
  },

  // Get container logs
  getLogs: async (widgetId: number, containerName: string, lines = 50) => {
    const response = await api.post(`/docker/widget/${widgetId}/logs`, { container_name: containerName, lines });
    return response.data;
  },
};

// Ping API (uptime monitoring with SmokePing-style data)
export const pingApi = {
  // Get widget data with history (for SmokePing graphs)
  getWidgetData: async (widgetId: number) => {
    const response = await api.get(`/ping/widget/${widgetId}/data`);
    return response.data;
  },

  // Single ping (no history storage)
  pingSingle: async (target: string, count = 5, timeout = 5) => {
    const response = await api.post('/ping/single', { target, count, timeout });
    return response.data;
  },

  // Multiple pings (no history storage)
  pingMultiple: async (targets: string[], count = 5, timeout = 5) => {
    const response = await api.post('/ping/multiple', { targets, count, timeout });
    return response.data;
  },

  // Get history for a target
  getHistory: async (target: string, hours = 24, widgetId?: number) => {
    const params = new URLSearchParams({ hours: String(hours) });
    if (widgetId) params.append('widget_id', String(widgetId));
    const response = await api.get(`/ping/history/${encodeURIComponent(target)}?${params}`);
    return response.data;
  },

  // Get statistics for a target
  getStatistics: async (target: string, hours = 24, widgetId?: number) => {
    const params = new URLSearchParams({ hours: String(hours) });
    if (widgetId) params.append('widget_id', String(widgetId));
    const response = await api.get(`/ping/statistics/${encodeURIComponent(target)}?${params}`);
    return response.data;
  },
};

// Servers API (SSH connections management)
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

export const serversApi = {
  list: async (): Promise<Server[]> => {
    const response = await api.get('/servers');
    return response.data;
  },

  get: async (id: number): Promise<Server> => {
    const response = await api.get(`/servers/${id}`);
    return response.data;
  },

  create: async (data: {
    name: string;
    description?: string;
    icon?: string;
    host: string;
    ssh_port?: number;
    ssh_user?: string;
    ssh_key?: string;
    ssh_password?: string;
    has_docker?: boolean;
    has_proxmox?: boolean;
  }): Promise<Server> => {
    const response = await api.post('/servers', data);
    return response.data;
  },

  update: async (id: number, data: {
    name?: string;
    description?: string;
    icon?: string;
    host?: string;
    ssh_port?: number;
    ssh_user?: string;
    ssh_key?: string;
    ssh_password?: string;
    has_docker?: boolean;
    has_proxmox?: boolean;
  }): Promise<Server> => {
    const response = await api.patch(`/servers/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/servers/${id}`);
  },

  test: async (id: number): Promise<ServerTestResult> => {
    const response = await api.post(`/servers/${id}/test`);
    return response.data;
  },

  getContainers: async (id: number) => {
    const response = await api.get(`/servers/${id}/containers`);
    return response.data;
  },
};

// RSS API (RSS feed aggregator)
export const rssApi = {
  // Test a feed URL
  testFeed: async (feedUrl: string) => {
    const response = await api.post('/rss/test-feed', { feed_url: feedUrl });
    return response.data;
  },

  // Get widget data (fetch + return unread articles)
  getWidgetData: async (widgetId: number) => {
    const response = await api.get(`/rss/widget/${widgetId}/data`);
    return response.data;
  },

  // Fetch new articles for a widget
  fetchArticles: async (widgetId: number) => {
    const response = await api.post(`/rss/widget/${widgetId}/fetch`);
    return response.data;
  },

  // Get articles (unread or archived)
  getArticles: async (widgetId: number, includeArchived = false, limit = 50, offset = 0) => {
    const params = new URLSearchParams({
      include_archived: String(includeArchived),
      limit: String(limit),
      offset: String(offset),
    });
    const response = await api.get(`/rss/widget/${widgetId}/articles?${params}`);
    return response.data;
  },

  // Get article counts
  getArticleCount: async (widgetId: number) => {
    const response = await api.get(`/rss/widget/${widgetId}/count`);
    return response.data;
  },

  // Mark article as read
  markAsRead: async (articleId: number) => {
    const response = await api.post(`/rss/articles/${articleId}/read`);
    return response.data;
  },

  // Mark all articles as read
  markAllAsRead: async (widgetId: number) => {
    const response = await api.post(`/rss/widget/${widgetId}/mark-all-read`);
    return response.data;
  },

  // Cleanup old archives (admin only)
  cleanupArchives: async (widgetId: number, months = 6) => {
    const response = await api.delete(`/rss/widget/${widgetId}/cleanup?months=${months}`);
    return response.data;
  },
};

// Notes API (local or Nextcloud notes)
export const notesApi = {
  // Get widget data (unified endpoint for both local and Nextcloud)
  getWidgetData: async (widgetId: number) => {
    const response = await api.get(`/notes/widget/${widgetId}/data`);
    return response.data;
  },

  // Local notes CRUD
  getNotes: async (widgetId: number, includeArchived = false) => {
    const params = includeArchived ? '?include_archived=true' : '';
    const response = await api.get(`/notes/widget/${widgetId}${params}`);
    return response.data;
  },

  createNote: async (widgetId: number, data: {
    title?: string;
    content?: string;
    color?: string | null;
    is_pinned?: boolean;
  }) => {
    const response = await api.post(`/notes/widget/${widgetId}`, data);
    return response.data;
  },

  updateNote: async (noteId: number, data: {
    title?: string;
    content?: string;
    color?: string | null;
    is_pinned?: boolean;
    is_archived?: boolean;
    position?: number;
  }) => {
    const response = await api.patch(`/notes/${noteId}`, data);
    return response.data;
  },

  deleteNote: async (noteId: number) => {
    const response = await api.delete(`/notes/${noteId}`);
    return response.data;
  },

  reorderNotes: async (widgetId: number, noteIds: number[]) => {
    const response = await api.post(`/notes/widget/${widgetId}/reorder`, { note_ids: noteIds });
    return response.data;
  },

  // Nextcloud notes operations
  testNextcloudConnection: async (nextcloudUrl: string, username: string, password: string) => {
    const response = await api.post('/notes/nextcloud/test', {
      nextcloud_url: nextcloudUrl,
      username,
      password,
    });
    return response.data;
  },

  getNextcloudNotes: async (widgetId: number) => {
    const response = await api.get(`/notes/nextcloud/widget/${widgetId}`);
    return response.data;
  },

  createNextcloudNote: async (widgetId: number, data: {
    title: string;
    content?: string;
    category?: string;
  }) => {
    const response = await api.post(`/notes/nextcloud/widget/${widgetId}`, data);
    return response.data;
  },

  updateNextcloudNote: async (widgetId: number, noteId: string, data: {
    title?: string;
    content?: string;
    category?: string;
  }) => {
    const response = await api.put(`/notes/nextcloud/widget/${widgetId}/${noteId}`, data);
    return response.data;
  },

  deleteNextcloudNote: async (widgetId: number, noteId: string) => {
    const response = await api.delete(`/notes/nextcloud/widget/${widgetId}/${noteId}`);
    return response.data;
  },
};

// Logs API (Docker container logs)
export const logsApi = {
  // Get widget logs data (with optional container override)
  getWidgetData: async (widgetId: number, containerName?: string) => {
    const params = containerName ? `?container=${encodeURIComponent(containerName)}` : '';
    const response = await api.get(`/logs/widget/${widgetId}/data${params}`);
    return response.data;
  },

  // Refresh logs with optional overrides
  refreshLogs: async (widgetId: number, maxLines?: number, filterPattern?: string) => {
    const params = new URLSearchParams();
    if (maxLines) params.append('max_lines', String(maxLines));
    if (filterPattern) params.append('filter_pattern', filterPattern);
    const response = await api.post(`/logs/widget/${widgetId}/refresh?${params}`);
    return response.data;
  },

  // List available containers for a widget's host
  getContainers: async (widgetId: number) => {
    const response = await api.get(`/logs/widget/${widgetId}/containers`);
    return response.data;
  },

  // List containers from a specific host (for configuration)
  listContainersFromHost: async (host: string, sshPort: number, sshUser: string, sshKey: string, sshPassword: string) => {
    const response = await api.post('/logs/containers', {
      host,
      ssh_port: sshPort,
      ssh_user: sshUser,
      ssh_key: sshKey,
      ssh_password: sshPassword,
    });
    return response.data;
  },
};

// Infrastructure API (schema visualization)
export interface Backend {
  id: number;
  hostname: string;
  display_name: string | null;
  ip_address: string | null;
  icon: string | null;
  color: string | null;
  description: string | null;
  position_x: number | null;
  position_y: number | null;
  is_online: boolean;
  last_check: string | null;
  extra_info: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
}

export interface ApplicationInSchema {
  id: number;
  name: string;
  url: string;
  icon: string | null;
  is_visible: boolean;
  forward_host: string | null;
  forward_port: number | null;
  position_x: number | null;
  position_y: number | null;
}

export interface BackendWithApps extends Backend {
  applications: ApplicationInSchema[];
  ports: number[];
}

export interface NpmInstanceInSchema {
  id: number;
  name: string;
  is_active: boolean;
  connection_mode: string;
  position_x: number | null;
  position_y: number | null;
}

export interface NodePosition {
  node_type: 'npm' | 'backend' | 'app';
  node_id: number;
  position_x: number;
  position_y: number;
}

export interface SaveLayoutResponse {
  saved_count: number;
  message: string;
}

export interface InfrastructureSchema {
  npm_instances: NpmInstanceInSchema[];
  backends: BackendWithApps[];
  links: Record<number, string[]>;
  stats: {
    npm_instances_count: number;
    backends_count: number;
    applications_count: number;
    unique_ports: number;
  };
  last_updated: string;
}

export const infrastructureApi = {
  getSchema: async (): Promise<InfrastructureSchema> => {
    const response = await api.get('/infrastructure/schema');
    return response.data;
  },

  getBackends: async (): Promise<Backend[]> => {
    const response = await api.get('/infrastructure/backends');
    return response.data;
  },

  updateBackend: async (id: number, data: {
    display_name?: string;
    icon?: string;
    color?: string;
    description?: string;
    position_x?: number;
    position_y?: number;
  }): Promise<Backend> => {
    const response = await api.patch(`/infrastructure/backends/${id}`, data);
    return response.data;
  },

  refresh: async (): Promise<{ message: string; sync_stats: Record<string, number>; backends_detected: number }> => {
    const response = await api.post('/infrastructure/refresh');
    return response.data;
  },

  saveLayout: async (positions: NodePosition[]): Promise<SaveLayoutResponse> => {
    const response = await api.post('/infrastructure/layout', { positions });
    return response.data;
  },

  resetLayout: async (): Promise<{ message: string; deleted_count: number }> => {
    const response = await api.delete('/infrastructure/layout');
    return response.data;
  },
};

// Chat API (Ollama-powered assistant)
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface ChatResponse {
  response: string;
  model: string;
  context_apps_count: number;
  web_search_results?: WebSearchResult[];
}

export interface OllamaStatus {
  available: boolean;
  model: string;
  models: Array<{ name: string; size: number; modified_at: string }>;
}

export interface QuickPrompt {
  category: string;
  items: string[];
}

export const chatApi = {
  // Get Ollama status
  getStatus: async (): Promise<OllamaStatus> => {
    const response = await api.get('/chat/status');
    return response.data;
  },

  // Send a chat message
  sendMessage: async (
    messages: ChatMessage[],
    options?: {
      includeContext?: boolean;
      temperature?: number;
      maxTokens?: number;
      webSearch?: boolean;
    }
  ): Promise<ChatResponse> => {
    const response = await api.post('/chat/message', {
      messages,
      include_context: options?.includeContext ?? true,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
      web_search: options?.webSearch ?? false,
    });
    return response.data;
  },

  // Stream a chat message
  streamMessage: async (
    messages: ChatMessage[],
    options?: {
      includeContext?: boolean;
      temperature?: number;
      maxTokens?: number;
      webSearch?: boolean;
      signal?: AbortSignal;
    }
  ): Promise<Response> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        messages,
        include_context: options?.includeContext ?? true,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
        stream: true,
        web_search: options?.webSearch ?? false,
      }),
      signal: options?.signal,
    });
    return response;
  },

  // Get app suggestions
  suggestApps: async (need: string): Promise<{ need: string; suggestions: string; model: string }> => {
    const response = await api.post('/chat/suggest', { need });
    return response.data;
  },

  // Get quick prompts
  getQuickPrompts: async (): Promise<{ prompts: QuickPrompt[] }> => {
    const response = await api.get('/chat/quick-prompts');
    return response.data;
  },
};

// Auto-Update API (detection database management)
export interface UpdateLogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  source: string | null;
}

export interface UpdateHistoryEntry {
  date: string;
  apps_added: string[];
  count: number;
}

export interface UpdateResult {
  started_at: string;
  completed_at: string;
  duration_ms: number;
  mode: 'dry_run' | 'update';
  feeds_checked: Array<{
    source: string;
    new_apps: number;
    apps: string[];
    error: string | null;
  }>;
  total_new_apps: number;
  apps_added_to_database: number;
  errors: string[];
}

export interface UpdateStatus {
  last_selfhst_check: string | null;
  last_awesome_check: string | null;
  known_apps_count: number;
  recent_history: UpdateHistoryEntry[];
  last_execution_logs: UpdateLogEntry[];
  last_execution_result: UpdateResult | null;
}

export interface DetectionStats {
  local_database: {
    patterns: number;
    app_types: number;
  };
  online_database: {
    available: boolean;
    app_count?: number;
    last_fetch?: string;
    source?: string;
    error?: string;
  };
  detection_methods: string[];
}

export const autoUpdateApi = {
  // Get update status with logs
  getStatus: async (): Promise<{
    auto_update: {
      enabled: boolean;
      schedule: string;
      sources: Array<{ name: string; url: string }>;
    };
    status: UpdateStatus;
  }> => {
    const response = await api.get('/applications/detection/update-status');
    return response.data;
  },

  // Get detection stats
  getStats: async (): Promise<DetectionStats> => {
    const response = await api.get('/applications/detection/stats');
    return response.data;
  },

  // Check for updates (dry run by default)
  checkUpdates: async (dryRun = true): Promise<{
    dry_run: boolean;
    result: UpdateResult;
  }> => {
    const response = await api.post('/applications/detection/check-updates', { dry_run: dryRun });
    return response.data;
  },

  // Run manual update
  runUpdate: async (): Promise<{
    message: string;
    result: UpdateResult;
  }> => {
    const response = await api.post('/applications/detection/run-update');
    return response.data;
  },

  // Refresh online database
  refreshOnlineDb: async (): Promise<{
    message: string;
    stats: Record<string, unknown>;
  }> => {
    const response = await api.post('/applications/detection/refresh');
    return response.data;
  },

  // Search apps online
  searchApps: async (query: string, limit = 10): Promise<{
    query: string;
    count: number;
    results: Array<{
      name: string;
      description: string;
      icon: string | null;
      icon_url: string | null;
      category: string | null;
      source_url: string | null;
      github_url: string | null;
      license: string | null;
    }>;
  }> => {
    const response = await api.post('/applications/detection/search', { query, limit });
    return response.data;
  },
};

// Speech API (local Whisper transcription)
export const speechApi = {
  // Get speech config
  getConfig: async (): Promise<{
    available: boolean;
    model_size: string;
    supported_formats: string[];
  }> => {
    const response = await api.get('/speech/config');
    return response.data;
  },

  // Transcribe audio file/blob
  transcribe: async (
    audioBlob: Blob,
    language = 'fr'
  ): Promise<{
    text: string;
    language?: string;
    duration?: number;
  }> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('language', language);

    const response = await api.post('/speech/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// App Dashboard API (app-specific dashboards with command execution)
import type {
  AppTemplate,
  AppTemplateListItem,
  DashboardBlock,
  CommandResult,
  BlockData,
  AppDashboardContent,
  ActionButton,
} from '@/types';

export const appDashboardApi = {
  // Templates
  listTemplates: async (): Promise<AppTemplateListItem[]> => {
    const response = await api.get('/app-dashboard/templates');
    return response.data;
  },

  getTemplate: async (id: number): Promise<AppTemplate> => {
    const response = await api.get(`/app-dashboard/templates/${id}`);
    return response.data;
  },

  getTemplateBySlug: async (slug: string): Promise<AppTemplate> => {
    const response = await api.get(`/app-dashboard/templates/by-slug/${slug}`);
    return response.data;
  },

  createTemplate: async (data: {
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    version?: string;
    author?: string;
    config_schema?: Record<string, unknown>;
    blocks?: DashboardBlock[];
    is_public?: boolean;
  }): Promise<AppTemplate> => {
    const response = await api.post('/app-dashboard/templates', data);
    return response.data;
  },

  updateTemplate: async (
    id: number,
    data: {
      name?: string;
      description?: string;
      icon?: string;
      version?: string;
      config_schema?: Record<string, unknown>;
      blocks?: DashboardBlock[];
      is_public?: boolean;
    }
  ): Promise<AppTemplate> => {
    const response = await api.put(`/app-dashboard/templates/${id}`, data);
    return response.data;
  },

  deleteTemplate: async (id: number): Promise<void> => {
    await api.delete(`/app-dashboard/templates/${id}`);
  },

  // Command Execution
  executeCommand: async (
    serverId: number,
    command: string,
    variables: Record<string, string> = {},
    parser: string = 'raw',
    row?: Record<string, unknown>
  ): Promise<CommandResult> => {
    const response = await api.post('/app-dashboard/execute', {
      server_id: serverId,
      command,
      variables,
      parser,
      row,
    });
    return response.data;
  },

  executeAction: async (
    serverId: number,
    action: ActionButton,
    variables: Record<string, string> = {},
    inputs: Record<string, string> = {}
  ): Promise<CommandResult> => {
    const response = await api.post('/app-dashboard/execute-action', {
      server_id: serverId,
      action,
      variables,
      inputs,
    });
    return response.data;
  },

  // Block Data
  fetchBlockData: async (
    block: DashboardBlock,
    serverId: number,
    variables: Record<string, string> = {}
  ): Promise<BlockData> => {
    const response = await api.post('/app-dashboard/block-data', {
      block,
      server_id: serverId,
      variables,
    });
    return response.data;
  },

  // Dashboard Tabs
  createDashboardTab: async (data: {
    name: string;
    icon?: string;
    template_id?: number;
    template_slug?: string;
    server_id: number;
    variables?: Record<string, string>;
  }): Promise<{ id: number; name: string; slug: string; message: string }> => {
    const response = await api.post('/app-dashboard/tabs', data);
    return response.data;
  },

  updateDashboardTab: async (
    tabId: number,
    data: {
      name?: string;
      icon?: string;
      server_id?: number;
      variables?: Record<string, string>;
      blocks?: DashboardBlock[];
      layout?: Array<{ i: string; x: number; y: number; w: number; h: number }>;
    }
  ): Promise<{ id: number; name: string; message: string }> => {
    const response = await api.put(`/app-dashboard/tabs/${tabId}`, data);
    return response.data;
  },

  getDashboardConfig: async (tabId: number): Promise<AppDashboardContent> => {
    const response = await api.get(`/app-dashboard/tabs/${tabId}/config`);
    return response.data;
  },
};

export default api;
