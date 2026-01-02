'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Text,
  Stack,
  Group,
  Loader,
  Center,
  Badge,
  ScrollArea,
  Box,
  Tooltip,
  ActionIcon,
  Image,
  Anchor,
  Menu,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconRss,
  IconExternalLink,
  IconCheck,
  IconCheckbox,
  IconRefresh,
  IconArchive,
  IconDotsVertical,
} from '@tabler/icons-react';
import { rssApi } from '@/lib/api';
import { RssWidgetSkeleton } from './WidgetSkeleton';

interface RssArticle {
  id: number;
  widget_id: number | null;
  feed_url: string;
  article_guid: string;
  article_url: string | null;
  title: string;
  summary: string | null;
  author: string | null;
  image_url: string | null;
  published_at: string | null;
  fetched_at: string;
  is_read: boolean;
  read_at: string | null;
  is_archived: boolean;
}

interface RssCounts {
  unread: number;
  archived: number;
  total: number;
}

interface RssWidgetData {
  articles: RssArticle[];
  counts: RssCounts;
  fetch_stats: {
    feeds_processed: number;
    feeds_failed: number;
    new_articles: number;
    existing_articles: number;
    errors: Array<{ feed_url?: string; error: string }>;
  } | null;
  feed_urls: string[];
}

interface RssWidgetProps {
  widgetId?: number;
  config?: {
    feed_urls?: string | string[];
    max_display?: number;
    show_images?: boolean;
    show_summary?: boolean;
    show_author?: boolean;
    show_date?: boolean;
    show_source?: boolean;
    open_in_new_tab?: boolean;
    refresh_interval?: number;
    compact_mode?: boolean;
  };
  size?: 'small' | 'medium' | 'large';
  rowSpan?: number;
  onDataReady?: (data: RssWidgetData) => void;
}

export function RssWidget({ widgetId, config = {}, size = 'medium', rowSpan = 1, onDataReady }: RssWidgetProps) {
  const [data, setData] = useState<RssWidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    show_images = true,
    show_summary = true,
    show_author = false,
    show_date = true,
    show_source = true,
    open_in_new_tab = true,
    refresh_interval = 300,
    compact_mode = false,
  } = config;

  const hasValidWidgetId = widgetId && widgetId > 0 && Number.isFinite(widgetId);

  const fetchData = useCallback(async (showRefreshing = false) => {
    try {
      if (!hasValidWidgetId) {
        setError('Widget ID manquant - veuillez reconfigurer le widget');
        setLoading(false);
        return;
      }

      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await rssApi.getWidgetData(widgetId!);

      if (response.data) {
        setData(response.data);
        setError(null);
        // Notify parent about data for export
        onDataReady?.(response.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Impossible de charger les flux RSS');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [widgetId, hasValidWidgetId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), refresh_interval * 1000);
    return () => clearInterval(interval);
  }, [fetchData, refresh_interval]);

  const handleMarkAsRead = async (articleId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await rssApi.markAsRead(articleId);
      // Optimistic update
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          articles: prev.articles.filter((a) => a.id !== articleId),
          counts: {
            ...prev.counts,
            unread: prev.counts.unread - 1,
            archived: prev.counts.archived + 1,
          },
        };
      });
    } catch (err: any) {
      notifications.show({
        title: 'Erreur',
        message: err.response?.data?.detail || 'Impossible de marquer comme lu',
        color: 'red',
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!hasValidWidgetId) return;

    try {
      const result = await rssApi.markAllAsRead(widgetId!);
      notifications.show({
        title: 'Articles archivés',
        message: `${result.marked_count} article(s) marqué(s) comme lu(s)`,
        color: 'green',
      });
      // Refresh data
      fetchData(true);
    } catch (err: any) {
      notifications.show({
        title: 'Erreur',
        message: err.response?.data?.detail || 'Impossible de tout marquer comme lu',
        color: 'red',
      });
    }
  };

  const handleArticleClick = async (article: RssArticle) => {
    // Mark as read when clicking
    if (!article.is_read) {
      try {
        await rssApi.markAsRead(article.id);
        // Update local state
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            articles: prev.articles.filter((a) => a.id !== article.id),
            counts: {
              ...prev.counts,
              unread: prev.counts.unread - 1,
              archived: prev.counts.archived + 1,
            },
          };
        });
      } catch {
        // Ignore - don't block navigation
      }
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `il y a ${diffMins}min`;
    if (diffHours < 24) return `il y a ${diffHours}h`;
    if (diffDays < 7) return `il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const extractDomain = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch {
      return url;
    }
  };

  if (loading && !data) {
    return <RssWidgetSkeleton />;
  }

  if (error) {
    return (
      <Center h="100%">
        <Stack align="center" gap="xs">
          <IconRss size={32} className="text-gray-400" />
          <Text size="sm" c="dimmed" ta="center">{error}</Text>
        </Stack>
      </Center>
    );
  }

  const articles = data?.articles || [];
  const counts = data?.counts || { unread: 0, archived: 0, total: 0 };

  if (articles.length === 0) {
    return (
      <Stack h="100%" justify="space-between">
        <Center style={{ flex: 1 }}>
          <Stack align="center" gap="xs">
            <IconRss size={32} className="text-green-500" />
            <Text size="sm" c="dimmed" ta="center">
              {counts.total === 0
                ? 'Aucun flux RSS configuré'
                : 'Aucun nouvel article'}
            </Text>
            {counts.archived > 0 && (
              <Text size="xs" c="dimmed">
                ({counts.archived} en archive)
              </Text>
            )}
          </Stack>
        </Center>
        <Group justify="center">
          <Tooltip label="Rafraîchir">
            <ActionIcon
              variant="light"
              color="blue"
              size="lg"
              loading={refreshing}
              onClick={() => fetchData(true)}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Stack>
    );
  }

  return (
    <Stack gap="xs" h="100%" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <Group justify="space-between" pr={80}>
        <Group gap="xs">
          <IconRss size={18} className="text-orange-500" />
          <Text fw={600} size="sm">Actualités</Text>
        </Group>
        <Group gap={4}>
          <Badge size="xs" variant="light" color="orange">
            {counts.unread} non lu{counts.unread > 1 ? 's' : ''}
          </Badge>

          <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" size="sm">
                <IconDotsVertical size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconRefresh size={14} />}
                onClick={() => fetchData(true)}
                disabled={refreshing}
              >
                Rafraîchir
              </Menu.Item>
              <Menu.Item
                leftSection={<IconCheckbox size={14} />}
                onClick={handleMarkAllAsRead}
                disabled={counts.unread === 0}
              >
                Tout marquer comme lu
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconArchive size={14} />}
                disabled
              >
                Voir les archives ({counts.archived})
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <ScrollArea style={{ flex: 1 }} scrollbarSize={6}>
        <Stack gap={compact_mode ? 4 : 8}>
          {articles.map((article) => (
            <Anchor
              key={article.id}
              href={article.article_url || '#'}
              target={open_in_new_tab ? '_blank' : undefined}
              rel={open_in_new_tab ? 'noopener noreferrer' : undefined}
              underline="never"
              onClick={() => handleArticleClick(article)}
            >
              <Box
                p="xs"
                className="rounded border cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
              >
                <Group gap="sm" wrap="nowrap" align="flex-start">
                  {/* Image */}
                  {show_images && !compact_mode && article.image_url && (
                    <Image
                      src={article.image_url}
                      alt=""
                      w={60}
                      h={60}
                      radius="sm"
                      fit="cover"
                      fallbackSrc="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%23ddd' width='100' height='100'/></svg>"
                    />
                  )}

                  {/* Content */}
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text size="xs" fw={500} lineClamp={compact_mode ? 1 : 2}>
                      {article.title}
                    </Text>

                    {show_summary && !compact_mode && article.summary && (
                      <Text size="xs" c="dimmed" lineClamp={2} mt={4}>
                        {article.summary}
                      </Text>
                    )}

                    <Group gap={4} mt={4}>
                      {show_source && (
                        <Badge size="xs" variant="light" color="gray">
                          {extractDomain(article.feed_url)}
                        </Badge>
                      )}

                      {show_author && article.author && (
                        <Text size="xs" c="dimmed">
                          {article.author}
                        </Text>
                      )}

                      {show_date && article.published_at && (
                        <Text size="xs" c="dimmed">
                          {formatDate(article.published_at)}
                        </Text>
                      )}
                    </Group>
                  </Box>

                  {/* Actions */}
                  <Group gap={4}>
                    <Tooltip label="Marquer comme lu">
                      <ActionIcon
                        variant="subtle"
                        color="green"
                        size="sm"
                        onClick={(e) => handleMarkAsRead(article.id, e)}
                      >
                        <IconCheck size={14} />
                      </ActionIcon>
                    </Tooltip>
                    {article.article_url && (
                      <Tooltip label="Ouvrir">
                        <ActionIcon variant="subtle" size="sm">
                          <IconExternalLink size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Group>
              </Box>
            </Anchor>
          ))}
        </Stack>
      </ScrollArea>

      {/* Refresh indicator */}
      {refreshing && (
        <Center>
          <Loader size="xs" />
        </Center>
      )}
    </Stack>
  );
}
