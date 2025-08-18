import type { BoardState, ColumnId, Priority, Recurrence, RecurrenceFreq, Task } from "./types";

export function uid() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

export function defaultState(): BoardState {
  return {
    pending: [{ id: uid(), title: "Add your first task (click + at top)", createdAt: Date.now(), priority: "Important", tags: ["personal"] }],
    inprogress: [],
    action: [],
    done: [],
    archived: [],
    schedules: [],
  };
}

export function normalize(state: any): BoardState {
  const base = defaultState();
  const s: BoardState = {
    pending: Array.isArray(state?.pending) ? state.pending : base.pending,
    inprogress: Array.isArray(state?.inprogress) ? state.inprogress : base.inprogress,
    action: Array.isArray(state?.action) ? state.action : base.action,
    done: Array.isArray(state?.done) ? state.done : base.done,
    archived: Array.isArray(state?.archived) ? state.archived : [],
    schedules: Array.isArray(state?.schedules) ? state.schedules : [],
  };
  (["pending","inprogress","action","done","archived"] as const).forEach((col)=>{
    // @ts-ignore
    s[col] = s[col].map((t: Task) => ({ ...t, tags: t.tags ?? [], subtasks: t.subtasks ?? [] }));
  });
  return s;
}

export function findColumnIdByTask(state: BoardState, taskId: string): ColumnId | null {
  const cols: ColumnId[] = ["pending", "inprogress", "action", "done"];
  for (const colId of cols) {
    if (state[colId].some((t) => t.id === taskId)) return colId;
  }
  return null;
}

export function getTask(state: BoardState, id: string): Task | undefined {
  const colId = findColumnIdByTask(state, id);
  return colId ? state[colId].find((t) => t.id === id) : undefined;
}

export function isOverdue(task: Task, inDoneColumn: boolean): boolean {
  if (!task.dueAt || inDoneColumn) return false;
  const endOfToday = new Date(); endOfToday.setHours(23,59,59,999);
  return task.dueAt < endOfToday.getTime();
}

export function formatDate(epoch?: number | null) {
  if (!epoch) return "No due date";
  const d = new Date(epoch);
  return d.toLocaleDateString();
}

export function dateInputToEpochLocal(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0).getTime();
}

export function epochToDateInputLocal(epoch: number): string {
  const dt = new Date(epoch);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function priorityBg(p?: Priority) {
  if (p === "Urgent") return "bg-red-50 text-red-700 border-red-200";
  if (p === "Important") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

// Period boundary helpers for recurrence
export function startOfNextDay(from: number = Date.now()): number {
  const d = new Date(from); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1); return d.getTime();
}
export function startOfNextWeek(from: number = Date.now()): number {
  const d = new Date(from); d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // Sunday=0
  const add = (7 - day) % 7 || 7; // days until next Sunday
  d.setDate(d.getDate() + add); return d.getTime();
}
export function startOfNextMonth(from: number = Date.now()): number {
  const d = new Date(from); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() + 1, 1); return d.getTime();
}
export function computeNextAt(freq: RecurrenceFreq, from: number = Date.now()): number {
  if (freq === "daily") return startOfNextDay(from);
  if (freq === "weekly") return startOfNextWeek(from);
  return startOfNextMonth(from);
}

export function matchesTags(selected: string[], task: Task): boolean {
  if (selected.length === 0) return true;
  const set = new Set((task.tags ?? []).map((t) => t.toLowerCase()));
  return selected.every((t) => set.has(t.toLowerCase()));
}

export function compareByDue(a: Task, b: Task) {
  const da = a.dueAt ?? Infinity;
  const db = b.dueAt ?? Infinity;
  if (da === db) return 0;
  return da < db ? -1 : 1;
}

export function insertTaskSorted(arr: Task[], task: Task) {
  const copy = [...arr, task]; copy.sort(compareByDue); return copy;
}
