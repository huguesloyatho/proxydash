'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WidgetCard, Widget } from './WidgetCard';

interface SortableWidgetCardProps {
  widget: Widget;
  isAdmin?: boolean;
  onEdit?: (widget: Widget) => void;
  onDelete?: (widget: Widget) => void;
  onToggleVisibility?: (widget: Widget) => void;
  onTogglePublic?: (widget: Widget) => void;
}

export function SortableWidgetCard({
  widget,
  isAdmin = false,
  onEdit,
  onDelete,
  onToggleVisibility,
  onTogglePublic,
}: SortableWidgetCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${widget.col_span || 1}`,
    gridRow: `span ${widget.row_span || 1}`,
  };

  // Pass drag listeners to WidgetCard so only the drag handle activates drag
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <WidgetCard
        widget={widget}
        isAdmin={isAdmin}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleVisibility={onToggleVisibility}
        onTogglePublic={onTogglePublic}
        isDragging={isDragging}
        dragHandleProps={listeners}
      />
    </div>
  );
}
