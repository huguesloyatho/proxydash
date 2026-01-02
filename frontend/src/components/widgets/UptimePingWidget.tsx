'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Text,
  Stack,
  Group,
  Loader,
  Center,
  Badge,
  Box,
  Tooltip,
  ScrollArea,
  ThemeIcon,
  Modal,
  Paper,
  Divider,
  SimpleGrid,
  ActionIcon,
  CloseButton,
  SegmentedControl,
  Overlay,
} from '@mantine/core';
import { PingWidgetSkeleton } from './WidgetSkeleton';
import {
  IconActivityHeartbeat,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconClock,
  IconWifi,
  IconWifiOff,
  IconMaximize,
  IconChartLine,
  IconArrowDown,
  IconArrowUp,
  IconMinus,
} from '@tabler/icons-react';
import { widgetsApi, pingApi } from '@/lib/api';

interface PingTarget {
  target: string;
  name: string;
  is_reachable: boolean;
  latency_min: number | null;
  latency_avg: number | null;
  latency_max: number | null;
  jitter: number | null;
  packet_loss_percent: number;
  status: 'ok' | 'warning' | 'critical';
  error_message: string | null;
  timestamp: string;
}

interface HistoryPoint {
  timestamp: string;
  latency_min: number | null;
  latency_avg: number | null;
  latency_max: number | null;
  jitter: number | null;
  packet_loss_percent: number;
  is_reachable: boolean;
}

interface TargetData {
  target: string;
  name: string;
  current: PingTarget;
  history: HistoryPoint[];
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

interface PingWidgetData {
  targets: PingTarget[] | TargetData[];
  config: {
    latency_warning: number;
    latency_critical: number;
    loss_warning: number;
    loss_critical: number;
    show_jitter: boolean;
    show_packet_loss: boolean;
    show_statistics: boolean;
    graph_height: number;
  };
  fetched_at: string;
  error?: string;
}

interface UptimePingWidgetProps {
  widgetId?: number;
  config?: {
    targets?: string;
    target_names?: string;
    ping_count?: number;
    ping_interval?: number;
    ping_timeout?: number;
    history_hours?: number;
    graph_height?: number;
    show_jitter?: boolean;
    show_packet_loss?: boolean;
    show_statistics?: boolean;
    latency_warning?: number;
    latency_critical?: number;
    loss_warning?: number;
    loss_critical?: number;
  };
  size?: 'small' | 'medium' | 'large';
  rowSpan?: number;
  colSpan?: number;
  onDataReady?: (data: PingWidgetData) => void;
}

// SmokePing-style graph component
function SmokePingGraph({
  history,
  height = 100,
  showJitter = true,
  latencyWarning = 100,
  latencyCritical = 500,
}: {
  history: HistoryPoint[];
  height?: number;
  showJitter?: boolean;
  latencyWarning?: number;
  latencyCritical?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const chartHeight = rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, chartHeight);

    // Find max latency for scaling
    const validLatencies = history
      .filter(p => p.is_reachable && p.latency_max !== null)
      .map(p => p.latency_max as number);

    if (validLatencies.length === 0) {
      // No valid data - draw "no data" message
      ctx.fillStyle = '#666';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Pas de données', width / 2, chartHeight / 2);
      return;
    }

    const maxLatency = Math.max(...validLatencies, latencyWarning);
    const minLatency = 0;
    const latencyRange = maxLatency - minLatency;

    // Calculate point positions
    const pointWidth = width / Math.max(history.length - 1, 1);
    const padding = 2;

    // Draw threshold lines
    const warningY = chartHeight - ((latencyWarning - minLatency) / latencyRange) * (chartHeight - padding * 2) - padding;
    const criticalY = chartHeight - ((latencyCritical - minLatency) / latencyRange) * (chartHeight - padding * 2) - padding;

    // Warning line (dashed)
    ctx.strokeStyle = 'rgba(255, 193, 7, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, warningY);
    ctx.lineTo(width, warningY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Critical line (dashed)
    if (criticalY > 0) {
      ctx.strokeStyle = 'rgba(244, 67, 54, 0.3)';
      ctx.beginPath();
      ctx.moveTo(0, criticalY);
      ctx.lineTo(width, criticalY);
      ctx.stroke();
    }

    // Draw SmokePing-style bands (jitter visualization)
    if (showJitter) {
      for (let i = 0; i < history.length; i++) {
        const point = history[i];
        const x = i * pointWidth;

        if (!point.is_reachable) {
          // Draw red bar for unreachable
          ctx.fillStyle = 'rgba(244, 67, 54, 0.7)';
          ctx.fillRect(x, 0, Math.max(pointWidth - 1, 2), chartHeight);
          continue;
        }

        if (point.latency_min === null || point.latency_max === null) continue;

        // Draw jitter band (min to max)
        const yMin = chartHeight - ((point.latency_max - minLatency) / latencyRange) * (chartHeight - padding * 2) - padding;
        const yMax = chartHeight - ((point.latency_min - minLatency) / latencyRange) * (chartHeight - padding * 2) - padding;

        // Color based on latency
        let bandColor = 'rgba(76, 175, 80, 0.4)'; // Green
        if (point.latency_avg && point.latency_avg >= latencyCritical) {
          bandColor = 'rgba(244, 67, 54, 0.4)'; // Red
        } else if (point.latency_avg && point.latency_avg >= latencyWarning) {
          bandColor = 'rgba(255, 193, 7, 0.4)'; // Yellow
        }

        ctx.fillStyle = bandColor;
        ctx.fillRect(x, yMin, Math.max(pointWidth - 1, 2), yMax - yMin);
      }
    }

    // Draw average line
    ctx.strokeStyle = '#2196f3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;

    for (let i = 0; i < history.length; i++) {
      const point = history[i];
      const x = i * pointWidth + pointWidth / 2;

      if (!point.is_reachable || point.latency_avg === null) {
        started = false;
        continue;
      }

      const y = chartHeight - ((point.latency_avg - minLatency) / latencyRange) * (chartHeight - padding * 2) - padding;

      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw dots for packet loss
    for (let i = 0; i < history.length; i++) {
      const point = history[i];
      const x = i * pointWidth + pointWidth / 2;

      if (point.is_reachable && point.latency_avg !== null && point.packet_loss_percent > 0) {
        const y = chartHeight - ((point.latency_avg - minLatency) / latencyRange) * (chartHeight - padding * 2) - padding;

        // Draw loss indicator (orange dot)
        ctx.fillStyle = `rgba(255, 152, 0, ${Math.min(point.packet_loss_percent / 50, 1)})`;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [history, showJitter, latencyWarning, latencyCritical]);

  useEffect(() => {
    drawGraph();
    window.addEventListener('resize', drawGraph);
    return () => window.removeEventListener('resize', drawGraph);
  }, [drawGraph]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: height,
        display: 'block',
        borderRadius: 4,
        backgroundColor: 'rgba(0,0,0,0.2)',
      }}
    />
  );
}

// Time period options for the graph
const TIME_PERIODS = [
  { value: '1', label: '1 heure', hours: 1 },
  { value: '6', label: '6 heures', hours: 6 },
  { value: '24', label: '24 heures', hours: 24 },
  { value: '168', label: '7 jours', hours: 168 },
  { value: '720', label: '30 jours', hours: 720 },
  { value: '2160', label: '90 jours', hours: 2160 },
  { value: '8760', label: '1 an', hours: 8760 },
] as const;

// Detailed SmokePing graph with legend and axes
function DetailedSmokePingGraph({
  history: initialHistory,
  targetName,
  targetHost,
  widgetId,
  statistics: initialStatistics,
  latencyWarning = 100,
  latencyCritical = 500,
}: {
  history: HistoryPoint[];
  targetName: string;
  targetHost: string;
  widgetId?: number;
  statistics?: TargetData['statistics'];
  latencyWarning?: number;
  latencyCritical?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    point: HistoryPoint;
    index: number;
  } | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('24');
  const [history, setHistory] = useState<HistoryPoint[]>(initialHistory);
  const [statistics, setStatistics] = useState<TargetData['statistics'] | undefined>(initialStatistics);
  const [loading, setLoading] = useState(false);

  // Load history when period changes
  useEffect(() => {
    const loadHistory = async () => {
      if (!widgetId || selectedPeriod === '24') {
        // Use initial data for 24h (already loaded)
        setHistory(initialHistory);
        setStatistics(initialStatistics);
        return;
      }

      setLoading(true);
      try {
        const hours = parseInt(selectedPeriod);
        const [historyData, statsData] = await Promise.all([
          pingApi.getHistory(targetHost, hours, widgetId),
          pingApi.getStatistics(targetHost, hours, widgetId),
        ]);
        setHistory(historyData.data || []);
        setStatistics(statsData.statistics);
      } catch (error) {
        console.error('Failed to load history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [selectedPeriod, widgetId, targetHost, initialHistory, initialStatistics]);

  // Format time label based on actual data span (not selected period)
  const formatTimeLabel = useCallback((date: Date, dataSpanHours: number) => {
    if (dataSpanHours <= 1) {
      // Less than 1 hour: show HH:MM:SS
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } else if (dataSpanHours <= 24) {
      // Less than 24 hours: show HH:MM
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else if (dataSpanHours <= 168) {
      // Less than 7 days: show weekday + hour
      return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit' });
    } else if (dataSpanHours <= 720) {
      // Less than 30 days: show day + month
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    } else {
      // More than 30 days: show month + year
      return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    }
  }, []);

  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const chartHeight = rect.height;
    const leftPadding = 60;
    const rightPadding = 20;
    const topPadding = 20;
    const bottomPadding = 40;
    const graphWidth = width - leftPadding - rightPadding;
    const graphHeight = chartHeight - topPadding - bottomPadding;

    // Clear canvas
    ctx.clearRect(0, 0, width, chartHeight);

    // Calculate the time window based on selected period
    // Window starts from oldest data point and extends for the selected period duration
    const periodHours = parseInt(selectedPeriod);
    const periodDuration = periodHours * 60 * 60 * 1000;

    // Find the oldest data point to anchor the window
    let windowStart: Date;
    if (history.length > 0) {
      // Start from the oldest data point
      windowStart = new Date(history[0].timestamp);
    } else {
      // No data - start from now minus period
      windowStart = new Date(Date.now() - periodDuration);
    }
    const windowEnd = new Date(windowStart.getTime() + periodDuration);
    const windowDuration = periodDuration;

    // Find max latency for scaling (use defaults if no data)
    const validLatencies = history
      .filter(p => p.is_reachable && p.latency_max !== null)
      .map(p => p.latency_max as number);

    const maxLatency = validLatencies.length > 0
      ? Math.max(...validLatencies, latencyWarning, latencyCritical) * 1.1
      : Math.max(latencyWarning, latencyCritical) * 1.1;
    const minLatency = 0;
    const latencyRange = maxLatency - minLatency;

    // Draw background grid
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = topPadding + (graphHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(leftPadding, y);
      ctx.lineTo(width - rightPadding, y);
      ctx.stroke();
    }

    // Draw Y-axis labels
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= gridLines; i++) {
      const y = topPadding + (graphHeight / gridLines) * i;
      const value = maxLatency - (maxLatency / gridLines) * i;
      ctx.fillText(`${value.toFixed(0)} ms`, leftPadding - 8, y + 4);
    }

    // Draw X-axis time labels based on the SELECTED period (not actual data span)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#888';
    const timeLabels = periodHours > 720 ? 8 : periodHours > 168 ? 7 : 6;
    for (let i = 0; i < timeLabels; i++) {
      const ratio = i / (timeLabels - 1);
      const x = leftPadding + graphWidth * ratio;
      const labelTime = new Date(windowStart.getTime() + windowDuration * ratio);
      ctx.fillText(
        formatTimeLabel(labelTime, periodHours),
        x,
        chartHeight - 10
      );
    }

    // If no data, show message and return (but axes are already drawn)
    if (history.length === 0) {
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Pas de données pour cette période', width / 2, chartHeight / 2);
      return;
    }

    // Helper function to convert timestamp to X position
    const timestampToX = (timestamp: string) => {
      const time = new Date(timestamp).getTime();
      const ratio = (time - windowStart.getTime()) / windowDuration;
      return leftPadding + graphWidth * ratio;
    };

    // Calculate point width based on time density
    // Use a reasonable width based on how much data we have relative to the period
    const avgPointWidth = Math.max(2, Math.min(graphWidth / history.length, 20));

    // Draw threshold lines with labels
    const warningY = topPadding + graphHeight - ((latencyWarning - minLatency) / latencyRange) * graphHeight;
    const criticalY = topPadding + graphHeight - ((latencyCritical - minLatency) / latencyRange) * graphHeight;

    // Warning line
    ctx.strokeStyle = 'rgba(255, 193, 7, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(leftPadding, warningY);
    ctx.lineTo(width - rightPadding, warningY);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 193, 7, 0.8)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Warning', leftPadding + 4, warningY - 4);
    ctx.setLineDash([]);

    // Critical line
    if (criticalY > topPadding) {
      ctx.strokeStyle = 'rgba(244, 67, 54, 0.6)';
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(leftPadding, criticalY);
      ctx.lineTo(width - rightPadding, criticalY);
      ctx.stroke();
      ctx.fillStyle = 'rgba(244, 67, 54, 0.8)';
      ctx.fillText('Critique', leftPadding + 4, criticalY - 4);
      ctx.setLineDash([]);
    }

    // Draw jitter bands (SmokePing style) - positioned by timestamp
    for (let i = 0; i < history.length; i++) {
      const point = history[i];
      const x = timestampToX(point.timestamp);

      // Skip points outside the visible window
      if (x < leftPadding || x > width - rightPadding) continue;

      if (!point.is_reachable) {
        // Draw red bar for unreachable
        ctx.fillStyle = 'rgba(244, 67, 54, 0.7)';
        ctx.fillRect(x - avgPointWidth / 2, topPadding, avgPointWidth, graphHeight);
        continue;
      }

      if (point.latency_min === null || point.latency_max === null) continue;

      const yMin = topPadding + graphHeight - ((point.latency_max - minLatency) / latencyRange) * graphHeight;
      const yMax = topPadding + graphHeight - ((point.latency_min - minLatency) / latencyRange) * graphHeight;

      // Color based on latency
      let bandColor = 'rgba(76, 175, 80, 0.35)'; // Green
      if (point.latency_avg && point.latency_avg >= latencyCritical) {
        bandColor = 'rgba(244, 67, 54, 0.35)'; // Red
      } else if (point.latency_avg && point.latency_avg >= latencyWarning) {
        bandColor = 'rgba(255, 193, 7, 0.35)'; // Yellow
      }

      ctx.fillStyle = bandColor;
      ctx.fillRect(x - avgPointWidth / 2, yMin, avgPointWidth, Math.max(yMax - yMin, 2));
    }

    // Draw average line - positioned by timestamp
    ctx.strokeStyle = '#2196f3';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let started = false;

    for (let i = 0; i < history.length; i++) {
      const point = history[i];
      const x = timestampToX(point.timestamp);

      // Skip points outside the visible window
      if (x < leftPadding || x > width - rightPadding) {
        started = false;
        continue;
      }

      if (!point.is_reachable || point.latency_avg === null) {
        started = false;
        continue;
      }

      const y = topPadding + graphHeight - ((point.latency_avg - minLatency) / latencyRange) * graphHeight;

      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw min line (lighter)
    ctx.strokeStyle = 'rgba(33, 150, 243, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    started = false;

    for (let i = 0; i < history.length; i++) {
      const point = history[i];
      const x = timestampToX(point.timestamp);

      if (x < leftPadding || x > width - rightPadding) {
        started = false;
        continue;
      }

      if (!point.is_reachable || point.latency_min === null) {
        started = false;
        continue;
      }

      const y = topPadding + graphHeight - ((point.latency_min - minLatency) / latencyRange) * graphHeight;

      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw max line (lighter)
    ctx.strokeStyle = 'rgba(33, 150, 243, 0.4)';
    ctx.beginPath();
    started = false;

    for (let i = 0; i < history.length; i++) {
      const point = history[i];
      const x = timestampToX(point.timestamp);

      if (x < leftPadding || x > width - rightPadding) {
        started = false;
        continue;
      }

      if (!point.is_reachable || point.latency_max === null) {
        started = false;
        continue;
      }

      const y = topPadding + graphHeight - ((point.latency_max - minLatency) / latencyRange) * graphHeight;

      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw packet loss dots
    for (let i = 0; i < history.length; i++) {
      const point = history[i];
      const x = timestampToX(point.timestamp);

      if (x < leftPadding || x > width - rightPadding) continue;

      if (point.is_reachable && point.latency_avg !== null && point.packet_loss_percent > 0) {
        const y = topPadding + graphHeight - ((point.latency_avg - minLatency) / latencyRange) * graphHeight;

        ctx.fillStyle = `rgba(255, 152, 0, ${Math.min(0.4 + point.packet_loss_percent / 100, 1)})`;
        ctx.beginPath();
        ctx.arc(x, y, 4 + point.packet_loss_percent / 20, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw axes
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftPadding, topPadding);
    ctx.lineTo(leftPadding, chartHeight - bottomPadding);
    ctx.lineTo(width - rightPadding, chartHeight - bottomPadding);
    ctx.stroke();

  }, [history, latencyWarning, latencyCritical, selectedPeriod, formatTimeLabel]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || history.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const leftPadding = 60;
    const rightPadding = 20;
    const graphWidth = rect.width - leftPadding - rightPadding;

    // Calculate the time window (same logic as drawGraph)
    const periodHours = parseInt(selectedPeriod);
    const periodDuration = periodHours * 60 * 60 * 1000;
    const windowStart = history.length > 0
      ? new Date(history[0].timestamp)
      : new Date(Date.now() - periodDuration);
    const windowDuration = periodDuration;

    // Convert mouse X to timestamp
    const mouseRatio = (mouseX - leftPadding) / graphWidth;
    const mouseTime = windowStart.getTime() + windowDuration * mouseRatio;

    // Find the closest point in history
    let closestIndex = -1;
    let closestDistance = Infinity;

    for (let i = 0; i < history.length; i++) {
      const pointTime = new Date(history[i].timestamp).getTime();
      const distance = Math.abs(pointTime - mouseTime);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }

    // Only show tooltip if mouse is close enough to a data point
    // (within 5% of the window duration or 50px, whichever is smaller)
    const maxDistanceMs = Math.min(windowDuration * 0.05, 50 * windowDuration / graphWidth);

    if (closestIndex >= 0 && closestDistance < maxDistanceMs) {
      const point = history[closestIndex];
      setHoveredPoint({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        point,
        index: closestIndex,
      });
    } else {
      setHoveredPoint(null);
    }
  }, [history, selectedPeriod]);

  const handleMouseLeave = useCallback(() => {
    setHoveredPoint(null);
  }, []);

  useEffect(() => {
    drawGraph();
    window.addEventListener('resize', drawGraph);
    return () => window.removeEventListener('resize', drawGraph);
  }, [drawGraph]);

  const formatLatency = (ms: number | null) => {
    if (ms === null) return '-';
    return ms < 1 ? '<1' : ms.toFixed(1);
  };

  const currentPeriod = TIME_PERIODS.find(p => p.value === selectedPeriod);

  return (
    <Box style={{ position: 'relative' }}>
      {/* Header */}
      <Group justify="space-between" mb="md" wrap="wrap">
        <Group gap="sm">
          <ThemeIcon size="lg" radius="xl" color="blue" variant="light">
            <IconChartLine size={20} />
          </ThemeIcon>
          <Box>
            <Text fw={600} size="lg">{targetName}</Text>
            <Text size="sm" c="dimmed">{targetHost}</Text>
          </Box>
        </Group>
        <Group gap="md">
          {statistics && (
            <Badge
              size="lg"
              variant="light"
              color={statistics.uptime_percent >= 99 ? 'green' : statistics.uptime_percent >= 95 ? 'yellow' : 'red'}
            >
              {statistics.uptime_percent.toFixed(2)}% Uptime
            </Badge>
          )}
        </Group>
      </Group>

      {/* Period selector */}
      <Group justify="center" mb="md">
        <SegmentedControl
          value={selectedPeriod}
          onChange={setSelectedPeriod}
          data={TIME_PERIODS.map(p => ({ value: p.value, label: p.label }))}
          size="xs"
        />
      </Group>

      {/* Canvas */}
      <Box style={{ position: 'relative' }}>
        {loading && (
          <Overlay blur={2} center>
            <Loader size="lg" />
          </Overlay>
        )}
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            width: '100%',
            height: 350,
            display: 'block',
            borderRadius: 8,
            backgroundColor: 'rgba(0,0,0,0.3)',
            cursor: 'crosshair',
          }}
        />

        {/* Hover tooltip */}
        {hoveredPoint && hoveredPoint.point && (
          <Paper
            shadow="md"
            p="xs"
            style={{
              position: 'absolute',
              left: Math.min(hoveredPoint.x + 10, (canvasRef.current?.getBoundingClientRect().width || 500) - 180),
              top: Math.max(hoveredPoint.y - 80, 10),
              pointerEvents: 'none',
              zIndex: 100,
              backgroundColor: 'rgba(30, 30, 30, 0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <Text size="xs" c="dimmed" mb={4}>
              {new Date(hoveredPoint.point.timestamp).toLocaleString('fr-FR')}
            </Text>
            {hoveredPoint.point.is_reachable ? (
              <Stack gap={2}>
                <Group gap="xs">
                  <IconMinus size={12} className="text-blue-400" />
                  <Text size="xs">Avg: <strong>{formatLatency(hoveredPoint.point.latency_avg)} ms</strong></Text>
                </Group>
                <Group gap="xs">
                  <IconArrowDown size={12} className="text-green-400" />
                  <Text size="xs">Min: {formatLatency(hoveredPoint.point.latency_min)} ms</Text>
                </Group>
                <Group gap="xs">
                  <IconArrowUp size={12} className="text-red-400" />
                  <Text size="xs">Max: {formatLatency(hoveredPoint.point.latency_max)} ms</Text>
                </Group>
                {hoveredPoint.point.jitter !== null && (
                  <Text size="xs" c="dimmed">Jitter: ±{formatLatency(hoveredPoint.point.jitter)} ms</Text>
                )}
                {hoveredPoint.point.packet_loss_percent > 0 && (
                  <Text size="xs" c="orange">Perte: {hoveredPoint.point.packet_loss_percent.toFixed(1)}%</Text>
                )}
              </Stack>
            ) : (
              <Text size="xs" c="red" fw={500}>Hors ligne</Text>
            )}
          </Paper>
        )}
      </Box>

      {/* Legend */}
      <Group mt="md" gap="xl" justify="center">
        <Group gap="xs">
          <Box w={20} h={3} style={{ backgroundColor: '#2196f3', borderRadius: 2 }} />
          <Text size="xs">Latence moyenne</Text>
        </Group>
        <Group gap="xs">
          <Box w={20} h={10} style={{ backgroundColor: 'rgba(76, 175, 80, 0.4)', borderRadius: 2 }} />
          <Text size="xs">Jitter (min-max)</Text>
        </Group>
        <Group gap="xs">
          <Box w={20} h={3} style={{ backgroundColor: 'rgba(255, 193, 7, 0.6)', borderRadius: 2 }} />
          <Text size="xs">Seuil warning</Text>
        </Group>
        <Group gap="xs">
          <Box w={20} h={3} style={{ backgroundColor: 'rgba(244, 67, 54, 0.6)', borderRadius: 2 }} />
          <Text size="xs">Seuil critique</Text>
        </Group>
        <Group gap="xs">
          <Box w={10} h={10} style={{ backgroundColor: 'rgba(255, 152, 0, 0.8)', borderRadius: '50%' }} />
          <Text size="xs">Perte de paquets</Text>
        </Group>
      </Group>

      {/* Statistics */}
      {statistics && (
        <>
          <Divider my="md" />
          <SimpleGrid cols={4} spacing="md">
            <Paper p="sm" withBorder style={{ textAlign: 'center' }}>
              <Text size="xs" c="dimmed">Latence Min</Text>
              <Text size="lg" fw={600} c="green">{formatLatency(statistics.min_latency)} ms</Text>
            </Paper>
            <Paper p="sm" withBorder style={{ textAlign: 'center' }}>
              <Text size="xs" c="dimmed">Latence Moyenne</Text>
              <Text size="lg" fw={600} c="blue">{formatLatency(statistics.avg_latency)} ms</Text>
            </Paper>
            <Paper p="sm" withBorder style={{ textAlign: 'center' }}>
              <Text size="xs" c="dimmed">Latence Max</Text>
              <Text size="lg" fw={600} c="orange">{formatLatency(statistics.max_latency)} ms</Text>
            </Paper>
            <Paper p="sm" withBorder style={{ textAlign: 'center' }}>
              <Text size="xs" c="dimmed">Jitter Moyen</Text>
              <Text size="lg" fw={600}>±{formatLatency(statistics.avg_jitter)} ms</Text>
            </Paper>
            <Paper p="sm" withBorder style={{ textAlign: 'center' }}>
              <Text size="xs" c="dimmed">Perte Moyenne</Text>
              <Text size="lg" fw={600} c={statistics.avg_packet_loss > 5 ? 'red' : 'green'}>
                {statistics.avg_packet_loss.toFixed(2)}%
              </Text>
            </Paper>
            <Paper p="sm" withBorder style={{ textAlign: 'center' }}>
              <Text size="xs" c="dimmed">Mesures</Text>
              <Text size="lg" fw={600}>{statistics.total_measurements}</Text>
            </Paper>
            <Paper p="sm" withBorder style={{ textAlign: 'center' }}>
              <Text size="xs" c="dimmed">Pannes</Text>
              <Text size="lg" fw={600} c={statistics.outages > 0 ? 'red' : 'green'}>{statistics.outages}</Text>
            </Paper>
            <Paper p="sm" withBorder style={{ textAlign: 'center' }}>
              <Text size="xs" c="dimmed">Uptime</Text>
              <Text size="lg" fw={600} c={statistics.uptime_percent >= 99 ? 'green' : statistics.uptime_percent >= 95 ? 'yellow' : 'red'}>
                {statistics.uptime_percent.toFixed(2)}%
              </Text>
            </Paper>
          </SimpleGrid>
        </>
      )}
    </Box>
  );
}

// Status badge component
function StatusBadge({ status }: { status: 'ok' | 'warning' | 'critical' }) {
  const colors = {
    ok: 'green',
    warning: 'yellow',
    critical: 'red',
  };

  const icons = {
    ok: <IconCheck size={12} />,
    warning: <IconAlertTriangle size={12} />,
    critical: <IconX size={12} />,
  };

  const labels = {
    ok: 'OK',
    warning: 'Avertissement',
    critical: 'Critique',
  };

  return (
    <Badge size="xs" color={colors[status]} leftSection={icons[status]}>
      {labels[status]}
    </Badge>
  );
}

// Single target display
function TargetCard({
  target,
  showGraph = false,
  history = [],
  statistics,
  config,
  compact = false,
  onZoom,
}: {
  target: PingTarget;
  showGraph?: boolean;
  history?: HistoryPoint[];
  statistics?: TargetData['statistics'];
  config: PingWidgetData['config'];
  compact?: boolean;
  onZoom?: () => void;
}) {
  const formatLatency = (ms: number | null) => {
    if (ms === null) return '-';
    return ms < 1 ? '<1' : ms.toFixed(1);
  };

  if (compact) {
    // Compact mode for small widgets
    return (
      <Group gap="xs" wrap="nowrap">
        <ThemeIcon
          size="xs"
          radius="xl"
          color={target.is_reachable ? (target.status === 'ok' ? 'green' : target.status === 'warning' ? 'yellow' : 'red') : 'red'}
        >
          {target.is_reachable ? <IconWifi size={10} /> : <IconWifiOff size={10} />}
        </ThemeIcon>
        <Text size="xs" fw={500} lineClamp={1} style={{ flex: 1 }}>
          {target.name}
        </Text>
        <Text size="xs" c="dimmed">
          {target.is_reachable ? `${formatLatency(target.latency_avg)}ms` : 'DOWN'}
        </Text>
      </Group>
    );
  }

  return (
    <Box
      p="xs"
      style={{
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.1)',
      }}
    >
      {/* Header */}
      <Group justify="space-between" mb={showGraph ? 'xs' : 0}>
        <Group gap="xs">
          <ThemeIcon
            size="sm"
            radius="xl"
            color={target.is_reachable ? 'green' : 'red'}
          >
            {target.is_reachable ? <IconWifi size={14} /> : <IconWifiOff size={14} />}
          </ThemeIcon>
          <Box>
            <Text size="sm" fw={600} lineClamp={1}>
              {target.name}
            </Text>
            <Text size="xs" c="dimmed">
              {target.target}
            </Text>
          </Box>
        </Group>
        <Group gap="xs">
          <StatusBadge status={target.status} />
          {showGraph && history.length > 0 && onZoom && (
            <Tooltip label="Agrandir le graphique">
              <ActionIcon size="sm" variant="subtle" onClick={onZoom}>
                <IconMaximize size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      {/* Stats */}
      {target.is_reachable && (
        <Group gap="md" mt="xs">
          <Tooltip label="Latence moyenne">
            <Group gap={4}>
              <IconClock size={12} className="text-blue-400" />
              <Text size="xs" fw={500}>
                {formatLatency(target.latency_avg)} ms
              </Text>
            </Group>
          </Tooltip>

          {config.show_jitter && target.jitter !== null && (
            <Tooltip label="Jitter (variation)">
              <Text size="xs" c="dimmed">
                ±{formatLatency(target.jitter)} ms
              </Text>
            </Tooltip>
          )}

          {config.show_packet_loss && target.packet_loss_percent > 0 && (
            <Tooltip label="Perte de paquets">
              <Badge size="xs" color="orange" variant="light">
                {target.packet_loss_percent.toFixed(1)}% perte
              </Badge>
            </Tooltip>
          )}
        </Group>
      )}

      {!target.is_reachable && target.error_message && (
        <Text size="xs" c="red" mt="xs">
          {target.error_message}
        </Text>
      )}

      {/* Graph - clickable to zoom */}
      {showGraph && history.length > 0 && (
        <Box
          mt="sm"
          onClick={onZoom}
          style={{ cursor: onZoom ? 'pointer' : 'default' }}
        >
          <SmokePingGraph
            history={history}
            height={config.graph_height}
            showJitter={config.show_jitter}
            latencyWarning={config.latency_warning}
            latencyCritical={config.latency_critical}
          />
        </Box>
      )}

      {/* Statistics */}
      {config.show_statistics && statistics && statistics.total_measurements > 0 && (
        <Group gap="md" mt="xs" wrap="wrap">
          <Tooltip label="Uptime">
            <Badge
              size="xs"
              variant="light"
              color={statistics.uptime_percent >= 99 ? 'green' : statistics.uptime_percent >= 95 ? 'yellow' : 'red'}
            >
              {statistics.uptime_percent.toFixed(1)}% uptime
            </Badge>
          </Tooltip>
          <Text size="xs" c="dimmed">
            Min: {formatLatency(statistics.min_latency)} ms
          </Text>
          <Text size="xs" c="dimmed">
            Max: {formatLatency(statistics.max_latency)} ms
          </Text>
          {statistics.outages > 0 && (
            <Badge size="xs" color="red" variant="light">
              {statistics.outages} pannes
            </Badge>
          )}
        </Group>
      )}
    </Box>
  );
}

export function UptimePingWidget({
  widgetId,
  config = {},
  size = 'medium',
  rowSpan = 1,
  colSpan = 1,
  onDataReady,
}: UptimePingWidgetProps) {
  const [data, setData] = useState<PingWidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomedTarget, setZoomedTarget] = useState<{
    target: PingTarget;
    history: HistoryPoint[];
    statistics?: TargetData['statistics'];
  } | null>(null);

  const hasValidWidgetId = widgetId && widgetId > 0 && Number.isFinite(widgetId);
  const refreshInterval = (config.ping_interval || 60) * 1000;

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!data) setLoading(true);

        if (!hasValidWidgetId) {
          setError('Widget ID manquant - veuillez reconfigurer le widget');
          setLoading(false);
          return;
        }

        try {
          // Use the dedicated ping API endpoint with history (for SmokePing graphs)
          const responseData = await pingApi.getWidgetData(widgetId!);
          if (responseData?.error) {
            setError(responseData.error);
          } else {
            setData(responseData);
            setError(null);
            // Notify parent about data for export
            onDataReady?.(responseData);
          }
        } catch {
          // Fallback to basic widget data endpoint
          const response = await widgetsApi.getData(widgetId!);
          if (response.data?.error) {
            setError(response.data.error);
          } else {
            setData(response.data);
            setError(null);
            // Notify parent about data for export
            onDataReady?.(response.data);
          }
        }
      } catch {
        setError('Impossible de récupérer les données ping');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetId, hasValidWidgetId, refreshInterval]);

  if (loading && !data) {
    return <PingWidgetSkeleton />;
  }

  if (error && !data) {
    return (
      <Center h="100%">
        <Stack align="center" gap="xs">
          <IconActivityHeartbeat size={24} className="text-gray-400" />
          <Text size="sm" c="dimmed" ta="center">
            {error}
          </Text>
        </Stack>
      </Center>
    );
  }

  if (!data || !data.targets || data.targets.length === 0) {
    return (
      <Center h="100%">
        <Stack align="center" gap="xs">
          <IconActivityHeartbeat size={24} className="text-gray-400" />
          <Text size="sm" c="dimmed">
            Configurez les cibles à surveiller
          </Text>
        </Stack>
      </Center>
    );
  }

  const targets = data.targets;
  const widgetConfig = data.config;
  // Always show graphs - SmokePing style is the main feature
  const showGraphs = true;
  // Compact mode only for very small widgets
  const isCompact = size === 'small' && targets.length > 3;

  // Check if targets have history (full data from backend) or just current data
  const hasBackendHistory = targets.length > 0 && 'history' in targets[0];

  // Count statuses
  const statusCounts = {
    ok: targets.filter(t => ('current' in t ? t.current.status : (t as PingTarget).status) === 'ok').length,
    warning: targets.filter(t => ('current' in t ? t.current.status : (t as PingTarget).status) === 'warning').length,
    critical: targets.filter(t => ('current' in t ? t.current.status : (t as PingTarget).status) === 'critical').length,
  };

  return (
    <Stack gap="xs" h="100%">
      {/* Header */}
      <Group justify="space-between">
        <Group gap="xs">
          <IconActivityHeartbeat size={18} className="text-blue-400" />
          <Text size="sm" fw={600}>
            Monitoring
          </Text>
        </Group>
        <Group gap={4}>
          {statusCounts.ok > 0 && (
            <Badge size="xs" color="green" variant="filled">
              {statusCounts.ok}
            </Badge>
          )}
          {statusCounts.warning > 0 && (
            <Badge size="xs" color="yellow" variant="filled">
              {statusCounts.warning}
            </Badge>
          )}
          {statusCounts.critical > 0 && (
            <Badge size="xs" color="red" variant="filled">
              {statusCounts.critical}
            </Badge>
          )}
        </Group>
      </Group>

      {/* Targets */}
      <ScrollArea style={{ flex: 1 }} scrollbarSize={4}>
        <Stack gap="sm">
          {targets.map((targetOrData, index) => {
            // Handle both simple PingTarget and full TargetData with history
            if (hasBackendHistory) {
              const targetData = targetOrData as TargetData;
              return (
                <TargetCard
                  key={targetData.target || index}
                  target={targetData.current}
                  showGraph={showGraphs}
                  history={targetData.history}
                  statistics={targetData.statistics}
                  config={widgetConfig}
                  compact={isCompact}
                  onZoom={() => setZoomedTarget({
                    target: targetData.current,
                    history: targetData.history,
                    statistics: targetData.statistics,
                  })}
                />
              );
            } else {
              // Basic data without history - still display the target
              const target = targetOrData as PingTarget;
              return (
                <TargetCard
                  key={target.target || index}
                  target={target}
                  showGraph={false}
                  history={[]}
                  config={widgetConfig}
                  compact={isCompact}
                />
              );
            }
          })}
        </Stack>
      </ScrollArea>

      {/* Footer with history info */}
      <Group justify="space-between">
        {hasBackendHistory && (
          <Text size="xs" c="dimmed">
            {Math.max(...(targets as TargetData[]).map(t => t.history?.length || 0))} points
          </Text>
        )}
        {data.fetched_at && (
          <Text size="xs" c="dimmed">
            Mis à jour: {new Date(data.fetched_at).toLocaleTimeString('fr-FR')}
          </Text>
        )}
      </Group>

      {/* Zoom Modal */}
      <Modal
        opened={zoomedTarget !== null}
        onClose={() => setZoomedTarget(null)}
        title={null}
        size="xl"
        fullScreen={false}
        centered
        padding="lg"
        styles={{
          body: { padding: '1rem' },
          header: { display: 'none' },
        }}
      >
        {zoomedTarget && (
          <Box>
            <Group justify="flex-end" mb="xs">
              <CloseButton onClick={() => setZoomedTarget(null)} />
            </Group>
            <DetailedSmokePingGraph
              history={zoomedTarget.history}
              targetName={zoomedTarget.target.name}
              targetHost={zoomedTarget.target.target}
              widgetId={widgetId}
              statistics={zoomedTarget.statistics}
              latencyWarning={widgetConfig.latency_warning}
              latencyCritical={widgetConfig.latency_critical}
            />
          </Box>
        )}
      </Modal>
    </Stack>
  );
}
