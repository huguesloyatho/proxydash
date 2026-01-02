'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AppCard } from './AppCard';
import { Application } from '@/types';
import { URLStatus } from '@/lib/api';

interface SortableAppCardProps {
  app: Application;
  isAdmin?: boolean;
  urlStatus?: URLStatus;
}

export function SortableAppCard({ app, isAdmin = false, urlStatus }: SortableAppCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: app.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isAdmin ? 'grab' : 'pointer',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <AppCard app={app} isAdmin={isAdmin} urlStatus={urlStatus} />
    </div>
  );
}
