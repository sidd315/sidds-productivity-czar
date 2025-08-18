import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, Clock, Pencil, Trash2, Archive, Tag as TagIcon, ListChecks } from "lucide-react";
import type { ColumnId, Task } from "../types";
import { isOverdue, formatDate, priorityBg } from "../utils";

export default function SortableTaskCard({ task, columnId, onDelete, onEdit, onArchive, onOpenSubtasks }:{ task: Task; columnId: ColumnId; onDelete: (id: string)=>void; onEdit: (id: string)=>void; onArchive?: (id: string)=>void; onOpenSubtasks: (id: string)=>void; }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition } as React.CSSProperties;
  const overdue = isOverdue(task, columnId === "done");

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={`group rounded-2xl border ${overdue ? "border-red-300" : "border-neutral-300"} bg-white shadow-sm hover:shadow-md transition-shadow p-3 cursor-grab active:cursor-grabbing select-none`}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full border border-neutral-300" style={{ background: isDragging ? "#0866FF" : "#fff" }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-medium text-neutral-900 truncate">{task.title}</div>
            {task.priority && <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${priorityBg(task.priority)}`}>{task.priority}</span>}
            {(task.tags ?? []).length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600">
                <TagIcon className="h-3 w-3" /> {(task.tags ?? []).slice(0,3).join(", ")}{(task.tags??[]).length>3?"…":""}
              </span>
            )}
            {overdue && <span className="inline-flex items-center gap-1 rounded-full bg-red-600/10 px-2 py-0.5 text-[11px] text-red-700">Overdue</span>}
          </div>
          {task.note && <div className="mt-1 text-sm text-neutral-600 break-words">{task.note}</div>}
          <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
            <div className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /><span>Created {new Date(task.createdAt).toLocaleDateString()}</span></div>
            <div className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /><span>Due: {formatDate(task.dueAt)}</span></div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onOpenSubtasks(task.id)} className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-700 transition" title="Subtasks"><ListChecks className="h-4 w-4" /></button>
          {columnId === "done" && onArchive && <button onClick={() => onArchive(task.id)} className="opacity-100 text-neutral-400 hover:text-neutral-700 transition" title="Archive"><Archive className="h-4 w-4" /></button>}
          <button onClick={() => onEdit(task.id)} className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-700 transition" title="Edit"><Pencil className="h-4 w-4" /></button>
          <button onClick={() => onDelete(task.id)} className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 transition" title="Delete"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}