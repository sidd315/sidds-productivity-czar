import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, Clock, Pencil, Trash2, ListChecks } from "lucide-react";
import type { ColumnId, Priority, Task } from "../types";

// Local helpers (duplicated here to keep this file standalone)
function formatDate(epoch?: number | null) {
  if (!epoch) return "No due date";
  try { return new Date(epoch).toLocaleDateString(); } catch { return "No due date"; }
}
function isOverdue(task: Task, inDoneColumn: boolean): boolean {
  if (!task.dueAt || inDoneColumn) return false;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return task.dueAt < endOfToday.getTime();
}
function priorityBg(p?: Priority) {
  if (p === "Urgent") return "bg-red-50 text-red-700 border-red-200";
  if (p === "Important") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-blue-50 text-blue-700 border-blue-200"; // Inevitably important / default
}

// ----------------------
// Sortable Task Card
// ----------------------
function SortableTaskCard({
  task,
  columnId,
  onDelete,
  onEdit,
  onOpenSubtasks,
}: {
  task: Task;
  columnId: ColumnId;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onOpenSubtasks?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition } as React.CSSProperties;
  const overdue = isOverdue(task, columnId === "done");

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group rounded-2xl border ${overdue ? "border-red-300" : "border-neutral-300"} bg-white shadow-sm hover:shadow-md transition-shadow p-3 cursor-grab active:cursor-grabbing select-none`}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full border border-neutral-300" style={{ background: isDragging ? "#0866FF" : "#fff" }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-medium text-neutral-900 truncate">{task.title}</div>
            {task.priority && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${priorityBg(task.priority)}`}>
                {task.priority}
              </span>
            )}
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-600/10 px-2 py-0.5 text-[11px] text-red-700">Overdue</span>
            )}
          </div>
          {task.note && <div className="mt-1 text-sm text-neutral-600 break-words">{task.note}</div>}

          {/* Tags */}
          {Array.isArray((task as any).tags) && (task as any).tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {(task as any).tags.map((tg: string) => (
                <span key={tg} className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-700">{tg}</span>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
            <div className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>Created {new Date(task.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>Due: {formatDate(task.dueAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onOpenSubtasks && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenSubtasks(task.id); }}
              className="opacity-80 text-neutral-500 hover:text-neutral-800 transition"
              title="Checklist / Subtasks"
            >
              <ListChecks className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => onEdit(task.id)} className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-700 transition" title="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => onDelete(task.id)} className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 transition" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------
// Column (scrollable + droppable)
// ----------------------
export default function Column({
  id,
  title,
  accent,
  tasks,
  onDeleteTask,
  onEditTask,
  onOpenSubtasks,
}: {
  id: ColumnId;
  title: string;
  accent: string;
  tasks: Task[];
  onDeleteTask: (id: string) => void;
  onEditTask: (id: string) => void;
  onOpenSubtasks?: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div className="flex h-full min-h-0 flex-col rounded-3xl border border-neutral-300 bg-neutral-50">
      <div className="sticky top-0 z-10 rounded-t-3xl border-b border-neutral-200/80 bg-white/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
            <h3 className="text-sm font-semibold tracking-wide text-neutral-800">{title}</h3>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">{tasks.length}</span>
          </div>
        </div>
      </div>

      <div ref={setNodeRef} className="flex-1 min-h-0 overflow-y-auto space-y-3 p-3">
        <SortableContext id={id} items={tasks.map((t) => t.id)} strategy={rectSortingStrategy}>
          {tasks.length === 0 && (
            <div className="rounded-xl border border-dashed border-neutral-300/70 bg-white p-4 text-center text-sm text-neutral-400">Drop tasks here</div>
          )}
          {tasks.map((t) => (
            <SortableTaskCard
              key={t.id}
              task={t}
              columnId={id}
              onDelete={onDeleteTask}
              onEdit={onEditTask}
              onOpenSubtasks={onOpenSubtasks}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
