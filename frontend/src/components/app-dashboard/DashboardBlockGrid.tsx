'use client';

import { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Center, Loader, Box } from '@mantine/core';
import { DashboardBlock } from '@/types';
import { CounterBlock, TableBlock, LogsBlock, ActionsBlock, ChartBlock } from './blocks';

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}

interface DashboardBlockGridProps {
  blocks: DashboardBlock[];
  serverId: number;
  variables: Record<string, string>;
  editable?: boolean;
  onLayoutChange?: (layout: LayoutItem[]) => void;
  onRefreshAll?: () => void;
}

// Inner component that actually uses react-grid-layout
function DashboardBlockGridInner({
  blocks,
  serverId,
  variables,
  editable = false,
  onLayoutChange,
  onRefreshAll,
}: DashboardBlockGridProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [GridLayout, setGridLayout] = useState<any>(null);

  // Load react-grid-layout dynamically on client side only
  useEffect(() => {
    import('react-grid-layout').then((mod) => {
      // react-grid-layout exports default as the main component
      setGridLayout(() => mod.default);
    });
  }, []);

  // Measure container width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        if (width > 0) {
          setContainerWidth(width);
        }
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);

    // Also observe container size changes
    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateWidth);
      resizeObserver.disconnect();
    };
  }, []);

  // Convert blocks to grid layout
  const layout: LayoutItem[] = useMemo(() => blocks.map((block) => ({
    i: block.id,
    x: block.position.x,
    y: block.position.y,
    w: block.position.w,
    h: block.position.h,
    minW: block.type === 'counter' ? 2 : 3,
    minH: block.type === 'counter' ? 2 : 3,
    maxW: 12,
    static: !editable,
  })), [blocks, editable]);

  const handleLayoutChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (currentLayout: any[]) => {
      if (editable && onLayoutChange) {
        onLayoutChange(currentLayout as LayoutItem[]);
      }
    },
    [editable, onLayoutChange]
  );

  const handleRefreshAll = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
    onRefreshAll?.();
  }, [onRefreshAll]);

  const renderBlock = (block: DashboardBlock) => {
    const commonProps = {
      block,
      serverId,
      variables,
    };
    const blockKey = `${block.id}-${refreshKey}`;

    switch (block.type) {
      case 'counter':
        return <CounterBlock key={blockKey} {...commonProps} />;
      case 'table':
        return <TableBlock key={blockKey} {...commonProps} />;
      case 'logs':
        return <LogsBlock key={blockKey} {...commonProps} />;
      case 'actions':
        return <ActionsBlock key={blockKey} {...commonProps} onRefreshAll={handleRefreshAll} />;
      case 'chart':
        return <ChartBlock key={blockKey} {...commonProps} />;
      default:
        return (
          <div
            key={blockKey}
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--mantine-color-dark-6)',
              borderRadius: 'var(--mantine-radius-md)',
              border: '1px solid var(--mantine-color-dark-4)',
            }}
          >
            Type inconnu: {block.type}
          </div>
        );
    }
  };

  if (blocks.length === 0) {
    return (
      <Center h="300px">
        <Loader size="lg" />
      </Center>
    );
  }

  if (!GridLayout) {
    return (
      <Center h="300px">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Box ref={containerRef} style={{ width: '100%' }}>
      <GridLayout
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={60}
        width={containerWidth}
        onLayoutChange={handleLayoutChange}
        isDraggable={editable}
        isResizable={editable}
        resizeHandles={['se', 'e', 's']}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        compactType="vertical"
        preventCollision={false}
        useCSSTransforms={true}
      >
        {blocks.map((block) => (
          <div
            key={block.id}
            style={{
              height: '100%',
              overflow: 'hidden',
            }}
          >
            {renderBlock(block)}
          </div>
        ))}
      </GridLayout>
    </Box>
  );
}

// Export with dynamic import to prevent SSR issues
export const DashboardBlockGrid = dynamic(
  () => Promise.resolve(DashboardBlockGridInner),
  {
    ssr: false,
    loading: () => <Center h="300px"><Loader size="lg" /></Center>
  }
);
