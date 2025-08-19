// src/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Plus, ListTodo, SlidersHorizontal, Archive, User, CalendarDays } from "lucide-react";
import confetti from "canvas-confetti";

// Domain types & theme
import type { BoardState, ColumnId, Priority, Task as LocalTask } from "./types";
import { COLUMN_DEFS, META_BLUE, BG_SURFACE, SUGGESTED_TAGS } from "./types";

// Helpers & components
import { findColumnIdByTask, getTask } from "./utils";
import Column from "./components/Column";
import OverlayCard from "./components/OverlayCard";
import TaskModal from "./components/TaskModal";
import HabitTracker from "./components/HabitTracker";
import NicknameModal from "./components/NicknameModal";

// Supabase glue
import { supabase } from "./lib/supabase";
import { ensureBoard } from "./api/bootstrap";
import { listTasks, createTask, updateTask, moveTask, computeNewPosition } from "./api/tasks";
import { getMyProfile } from "./api/profile";

// UI task type adds optional ordering position (from DB)
type UITask = LocalTask & { position?: number };

export default function App() {
  // ---------- App State ----------
  const [state, setState] = useState<BoardState>(() => ({
    pending: [],
    inprogress: [],
    action: [],
    done: [],
    archived: [],
    schedules: [],
  }));

  // Supabase ids
  const [boardId, setBoardId] = useState<string>("");
  const [colIds, setColIds] = useState<Record<string, string>>({}); // key -> column_id
  const ready = !!boardId && !!colIds["pending"];

  // Current user (for profile menu)
  const [userEmail, setUserEmail] = useState<string>("");
  const [profileOpen, setProfileOpen] = useState(false);

  // Nickname UX
  const [nickname, setNickname] = useState<string>("");
  const [nickModalOpen, setNickModalOpen] = useState(false);

  // UI state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Extras panel + filters
  const [showExtras, setShowExtras] = useState(false);
  const [tagFilter, setTagFilter] = useState<string[]>([]); // AND filter
  const [priorityFilter, setPriorityFilter] = useState<"All" | Priority>("All");
  const [dueFilter, setDueFilter] = useState<"all" | "today" | "week" | "overdue">("all");

  // Archived drawer
  const [showArchived, setShowArchived] = useState(false);
  const [archivedRows, setArchivedRows] = useState<any[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);

  // Subtasks modal
  const [subtasksOpen, setSubtasksOpen] = useState(false);
  const [subtasksTaskId, setSubtasksTaskId] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<Array<{ id: string; title: string; done: boolean }>>([]);

  // Habit tracker popup
  const [habitOpen, setHabitOpen] = useState(false);

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // ---------- Bootstrap ----------
  useEffect(() => {
    (async () => {
      const ures = await supabase.auth.getUser();
      if (ures?.data?.user?.email) setUserEmail(ures.data.user.email);

      // Load or prompt nickname
      const prof = await getMyProfile(ures.data.user.id).catch(() => null);
      if (prof?.nickname) {
        setNickname(prof.nickname);
        document.title = `${prof.nickname}'s Productivity czar 🔨`;
      } else {
        setNickModalOpen(true); // first time: ask for nickname
        document.title = "Productivity czar 🔨";
      }

      const { boardId: bid, columns } = await ensureBoard();
      setBoardId(bid);
      setColIds(columns);
      await refresh(bid, columns);
    })();
  }, []);

  useEffect(() => {
    if (nickname) document.title = `${nickname}'s Productivity czar 🔨`;
  }, [nickname]);

  async function refresh(bid = boardId, columns = colIds) {
    if (!bid) return;
    const rows = await listTasks(bid);
    setState(rowsToBoardState(rows, columns));
  }

  // Map DB rows → UI state by column key + sort by due date
  function rowsToBoardState(rows: any[], columns: Record<string, string>): BoardState {
    const byKey: Record<string, UITask[]> = { pending: [], inprogress: [], action: [], done: [] };
    for (const r of rows) {
      const key = Object.keys(columns).find((k) => columns[k] === r.column_id);
      if (!key) continue;
      const t: UITask = {
        id: r.id,
        title: r.title,
        note: r.note ?? undefined,
        createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
        dueAt: r.due_at ? new Date(r.due_at).getTime() : null,
        priority: r.priority ?? undefined,
        tags: r.tags ?? [],
        subtasks: [], // loaded separately by modal
        position: typeof r.position === "number" ? r.position : undefined,
      };
      byKey[key].push(t);
    }
    const sortByDue = (a: UITask, b: UITask) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity);
    (Object.keys(byKey) as (keyof typeof byKey)[]).forEach((k) => byKey[k].sort(sortByDue));

    return {
      pending: byKey.pending,
      inprogress: byKey.inprogress,
      action: byKey.action,
      done: byKey.done,
      archived: [],
      schedules: [],
    };
  }

  const activeTask = useMemo(() => (activeId ? (getTask(state, activeId) as UITask) ?? null : null), [activeId, state]);
  const editingTask = useMemo(() => (editingId ? getTask(state, editingId) ?? undefined : undefined), [editingId, state]);

  // All tags available = suggested + discovered from tasks
  const allTags = useMemo(() => {
    const set = new Set<string>(SUGGESTED_TAGS);
    for (const col of ["pending", "inprogress", "action", "done"] as const) {
      for (const t of (state as any)[col] as UITask[]) {
        (t.tags ?? []).forEach((x) => set.add(String(x)));
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [state]);

  function toggleTag(tag: string) {
    setTagFilter((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  // ---------- CRUD ----------
  async function onAddTaskGlobal(values: {
    title: string;
    note?: string;
    priority: Priority;
    dueAt: number | null;
    tags?: string[];
  }) {
    if (!ready) {
      const res = await ensureBoard();
      setBoardId(res.boardId);
      setColIds(res.columns);
    }
    await createTask({
      board_id: boardId,
      column_id: colIds["pending"],
      title: values.title,
      note: values.note,
      priority: values.priority,
      due_at: values.dueAt ? new Date(values.dueAt).toISOString() : null,
      tags: values.tags ?? [],
    });
    setModalOpen(false);
    await refresh();
  }

  function onEditTask(id: string) {
    setEditingId(id);
    setModalOpen(true);
  }

  async function onSaveEdit(values: {
    title: string;
    note?: string;
    priority: Priority;
    dueAt: number | null;
    tags?: string[];
  }) {
    if (!editingId) return;
    await updateTask(editingId, {
      title: values.title,
      note: values.note ?? null,
      priority: values.priority,
      due_at: values.dueAt ? new Date(values.dueAt).toISOString() : null,
      tags: values.tags ?? [],
    });
    setEditingId(null);
    setModalOpen(false);
    await refresh();
  }

  async function onDeleteTask(id: string) {
    await updateTask(id, { archived: true });
    await refresh();
  }

  // ---------- Subtasks (CRUD) ----------
  async function openSubtasks(taskId: string) {
    setSubtasksTaskId(taskId);
    const { data, error } = await supabase
      .from("subtasks")
      .select("id,title,done")
      .eq("task_id", taskId)
      .order("position", { ascending: true });
    if (!error) setSubtasks((data ?? []).map((s) => ({ id: s.id, title: s.title, done: !!s.done })));
    setSubtasksOpen(true);
  }

  async function addSubtask(title: string) {
    if (!subtasksTaskId || !title.trim()) return;
    const nextPos = (subtasks.length ? subtasks.length : 0) + 1;
    const { data, error } = await supabase
      .from("subtasks")
      .insert({ task_id: subtasksTaskId, title: title.trim(), done: false, position: nextPos })
      .select("id,title,done")
      .single();
    if (!error && data) setSubtasks((prev) => [...prev, { id: data.id, title: data.title, done: !!data.done }]);
  }

  async function toggleSubtask(id: string, done: boolean) {
    await supabase.from("subtasks").update({ done }).eq("id", id);
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, done } : s)));
  }

  async function removeSubtask(id: string) {
    await supabase.from("subtasks").delete().eq("id", id);
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  }

  // ---------- Filters ----------
  function applyFilters(tasks: UITask[]): UITask[] {
    let out = [...tasks];
    if (priorityFilter !== "All") out = out.filter((t) => t.priority === priorityFilter);
    if (tagFilter.length) {
      out = out.filter((t) => {
        const set = new Set((t.tags ?? []).map((x) => String(x).toLowerCase()));
        return tagFilter.every((sel) => set.has(sel.toLowerCase()));
      });
    }
    if (dueFilter !== "all") {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const endToday = new Date(now);
      endToday.setHours(23, 59, 59, 999);
      const endWeek = new Date(now);
      endWeek.setDate(endWeek.getDate() + (7 - endWeek.getDay()));
      endWeek.setHours(23, 59, 59, 999);
      out = out.filter((t) => {
        if (!t.dueAt) return false;
        if (dueFilter === "today") return t.dueAt >= now.getTime() && t.dueAt <= endToday.getTime();
        if (dueFilter === "week") return t.dueAt >= now.getTime() && t.dueAt <= endWeek.getTime();
        if (dueFilter === "overdue") return t.dueAt < now.getTime();
        return true;
      });
    }
    return out;
  }

  const filteredState: BoardState = useMemo(() => {
    const mapCol = (arr: UITask[]) => applyFilters(arr);
    return {
      pending: mapCol(state.pending as UITask[]),
      inprogress: mapCol(state.inprogress as UITask[]),
      action: mapCol(state.action as UITask[]),
      done: mapCol(state.done as UITask[]),
      archived: state.archived,
      schedules: state.schedules,
    };
  }, [state, tagFilter, priorityFilter, dueFilter]);

  // ---------- DnD ----------
  function handleDragStart(event: any) {
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: any) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    // Optimistic local update
    const nextState = computeDnDLocal(state, active.id as string, over.id as string, (fromCol, toCol) => {
      if (toCol === "done" && fromCol !== "done") {
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.2 } });
        setTimeout(() => confetti({ particleCount: 80, spread: 60, origin: { y: 0.2, x: 0.8 } }), 150);
      }
    });
    setState(nextState);

    // Persist move with fractional positioning
    const destKey: ColumnId = (COLUMN_DEFS.map((c) => c.id) as ColumnId[]).includes(over.id as ColumnId)
      ? (over.id as ColumnId)
      : (findColumnIdByTask(nextState, over.id as string) as ColumnId);

    const destTasks = (nextState as any)[destKey] as UITask[];
    const idx = destTasks.findIndex((t) => t.id === active.id);
    const prevPos = idx > 0 ? destTasks[idx - 1]?.position : undefined;
    const nextPos = idx >= 0 && idx < destTasks.length - 1 ? destTasks[idx + 1]?.position : undefined;
    const newPos = computeNewPosition(prevPos, nextPos);

    try {
      await moveTask(active.id as string, { column_id: colIds[destKey], position: newPos });
      await refresh();
    } catch {
      await refresh();
    }
  }

  function computeDnDLocal(
    prev: BoardState,
    activeId: string,
    overId: string,
    onMoveBetween?: (fromCol: ColumnId, toCol: ColumnId) => void
  ): BoardState {
    const fromCol = findColumnIdByTask(prev, activeId);
    if (!fromCol) return prev;

    const columnIds = ["pending", "inprogress", "action", "done"] as ColumnId[];
    let toCol: ColumnId | null = columnIds.includes(overId as ColumnId) ? (overId as ColumnId) : findColumnIdByTask(prev, overId);
    if (!toCol) return prev;

    if (fromCol === toCol) {
      const oldIndex = (prev as any)[fromCol].findIndex((t: UITask) => t.id === activeId);
      const newIndex = (prev as any)[toCol].findIndex((t: UITask) => t.id === overId);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const reordered = arrayMove((prev as any)[fromCol], oldIndex, newIndex);
      return { ...prev, [fromCol]: reordered } as BoardState;
    } else {
      const moving = (prev as any)[fromCol].find((t: UITask) => t.id === activeId);
      if (!moving) return prev;
      const without = (prev as any)[fromCol].filter((t: UITask) => t.id !== activeId);
      const insertIndex = (prev as any)[toCol].findIndex((t: UITask) => t.id === overId);
      const targetArr = [...(prev as any)[toCol]];
      if (insertIndex === -1) targetArr.unshift(moving);
      else targetArr.splice(insertIndex, 0, moving);
      onMoveBetween?.(fromCol, toCol);
      return { ...prev, [fromCol]: without, [toCol]: targetArr } as BoardState;
    }
  }

  // ---------- Archived ----------
  async function openArchived() {
    setShowArchived(true);
    setArchivedLoading(true);
    try {
      let bid = boardId;
      if (!bid) {
        const res = await ensureBoard();
        bid = res.boardId;
        setBoardId(res.boardId);
        setColIds(res.columns);
      }
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("board_id", bid!)
        .eq("archived", true)
        .order("created_at", { ascending: false });
      setArchivedRows(data ?? []);
    } finally {
      setArchivedLoading(false);
    }
  }

  async function restoreTask(id: string) {
    await updateTask(id, { archived: false });
    await openArchived();
    await refresh();
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  // ---------- Render ----------
  return (
    <div className="min-h-screen w-full" style={{ background: BG_SURFACE }}>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-neutral-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ListTodo className="h-7 w-7 text-neutral-700" />
              <h1 className="text-xl font-bold tracking-tight text-neutral-900">
                {nickname ? `${nickname}'s Productivity czar` : "Productivity czar"}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Add Task */}
              <button
                onClick={() => setModalOpen(true)}
                disabled={!ready}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white shadow-sm ${
                  ready ? "bg-[var(--btn)] hover:opacity-95" : "bg-neutral-300 cursor-not-allowed"
                }`}
                style={{ ["--btn" as any]: META_BLUE }}
                title={ready ? "Add task" : "Initializing..."}
              >
                <Plus className="h-4 w-4" /> Add task
              </button>

              {/* Habit Tracker */}
              <button
                onClick={() => ready && setHabitOpen(true)}
                disabled={!ready}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                  ready ? "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50" : "border-neutral-200 bg-white text-neutral-400 cursor-not-allowed"
                }`}
                title="Habit Tracker"
              >
                <CalendarDays className="h-4 w-4" /> Habits
              </button>

              {/* Extras toggle */}
              <button
                onClick={() => setShowExtras((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                title="Extras"
              >
                <SlidersHorizontal className="h-4 w-4" /> Extras
              </button>

              {/* Profile menu */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                  title="Profile"
                >
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{userEmail || "Profile"}</span>
                </button>
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl border border-neutral-200 bg-white shadow-lg">
                    <button
                      onClick={() => {
                        setNickModalOpen(true);
                        setProfileOpen(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
                    >
                      Edit nickname
                    </button>
                    <button onClick={logout} className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50">
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Extras panel */}
        {showExtras && (
          <div className="border-t border-neutral-200/70 bg-white/95">
            <div className="mx-auto max-w-7xl px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Tag filters as chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-neutral-600">Tags:</span>
                  {allTags.map((t) => (
                    <button
                      key={t}
                      onClick={() => toggleTag(t)}
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        tagFilter.includes(t) ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-neutral-200 text-neutral-700"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* Priority filter */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-neutral-600">Priority</label>
                  <select
                    className="rounded-lg border border-neutral-200 px-2 py-1 text-sm"
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value as any)}
                  >
                    <option>All</option>
                    <option>Urgent</option>
                    <option>Important</option>
                    <option>Inevitably important</option>
                  </select>
                </div>

                {/* Due filter */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-neutral-600">Due</label>
                  <select
                    className="rounded-lg border border-neutral-200 px-2 py-1 text-sm"
                    value={dueFilter}
                    onChange={(e) => setDueFilter(e.target.value as any)}
                  >
                    <option value="all">All</option>
                    <option value="today">Today</option>
                    <option value="week">This week</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>

                {/* Clear filters */}
                <button
                  onClick={() => {
                    setTagFilter([]);
                    setPriorityFilter("All");
                    setDueFilter("all");
                  }}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  Clear filters
                </button>

                <div className="flex-1" />

                {/* Archived */}
                <button
                  onClick={openArchived}
                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                  title="Archived tasks"
                >
                  <Archive className="h-4 w-4" /> Archived Tasks
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Board */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {COLUMN_DEFS.map((col) => (
              <div key={col.id} className="min-h-0 h-[85vh]">
                <Column
                  id={col.id as ColumnId}
                  title={col.title}
                  accent={col.accent}
                  tasks={(filteredState as any)[col.id] as UITask[]}
                  onDeleteTask={onDeleteTask}
                  onEditTask={onEditTask}
                  onOpenSubtasks={openSubtasks}
                />
              </div>
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 180 }}>
            <OverlayCard task={(activeTask as any) ?? null} />
          </DragOverlay>
        </DndContext>
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-center text-xs text-neutral-500">
        Connected to Supabase · Per-user boards · Extras for filters/archived · Click avatar to log out
      </footer>

      {/* Task Modal */}
      <TaskModal
        open={modalOpen}
        initial={editingTask}
        onClose={() => {
          setModalOpen(false);
          setEditingId(null);
        }}
        onSubmit={(vals: any) => (editingTask ? onSaveEdit(vals) : onAddTaskGlobal(vals))}
      />

      {/* Subtasks Modal */}
      {subtasksOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSubtasksOpen(false)} />
          <div className="absolute left-1/2 top-1/2 w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-semibold text-neutral-900">Subtasks</div>
              <button className="rounded-lg border px-2 py-1 text-sm" onClick={() => setSubtasksOpen(false)}>
                Close
              </button>
            </div>
            <SubtasksEditor items={subtasks} onToggle={toggleSubtask} onRemove={removeSubtask} onAdd={addSubtask} />
          </div>
        </div>
      )}

      {/* Archived Drawer */}
      {showArchived && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowArchived(false)} />
          <div className="absolute right-0 top-0 h-full w-[min(520px,92vw)] bg-white shadow-2xl p-5 overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-semibold text-neutral-900">Archived Tasks</div>
              <button className="rounded-lg border px-2 py-1 text-sm" onClick={() => setShowArchived(false)}>
                Close
              </button>
            </div>
            <div className="space-y-3">
              {archivedLoading && <div className="text-sm text-neutral-500">Loading…</div>}
              {!archivedLoading && archivedRows.length === 0 && (
                <div className="text-sm text-neutral-500">No archived tasks.</div>
              )}
              {!archivedLoading &&
                archivedRows.map((r) => (
                  <div key={r.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{r.title}</div>
                        {r.note && <div className="text-sm text-neutral-600">{r.note}</div>}
                      </div>
                      <button
                        className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm hover:bg-neutral-50"
                        onClick={() => restoreTask(r.id)}
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Habit Tracker (opens above everything) */}
      {habitOpen && boardId && (
        <HabitTracker boardId={boardId} open={habitOpen} onClose={() => setHabitOpen(false)} />
      )}

      {/* Nickname Modal */}
      <NicknameModal
        open={nickModalOpen}
        onClose={() => setNickModalOpen(false)}
        onSaved={(nick) => setNickname(nick)}
        initial={nickname}
      />

      {/* Global styles */}
      <style>{`html, body, #root { height: 100%; }`}</style>
      <style>{`.overflow-y-auto{scrollbar-width:thin}.overflow-y-auto::-webkit-scrollbar{width:8px}.overflow-y-auto::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.15);border-radius:8px}.overflow-y-auto::-webkit-scrollbar-track{background:transparent}`}</style>
    </div>
  );
}

// ----------------------
// Subtasks Editor (inline component)
// ----------------------
function SubtasksEditor({
  items,
  onToggle,
  onRemove,
  onAdd,
}: {
  items: Array<{ id: string; title: string; done: boolean }>;
  onToggle: (id: string, done: boolean) => void;
  onRemove: (id: string) => void;
  onAdd: (title: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <div>
      <div className="space-y-2 max-h-[48vh] overflow-y-auto pr-1">
        {items.map((s) => (
          <label key={s.id} className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-2">
            <input
              type="checkbox"
              checked={s.done}
              onChange={(e) => onToggle(s.id, e.target.checked)}
              className="h-4 w-4"
            />
            <span className={`flex-1 text-sm ${s.done ? "line-through text-neutral-400" : "text-neutral-800"}`}>{s.title}</span>
            <button
              className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
              onClick={() => onRemove(s.id)}
            >
              Delete
            </button>
          </label>
        ))}
        {items.length === 0 && <div className="text-sm text-neutral-500">No subtasks yet.</div>}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a subtask and press Enter"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onAdd(text);
              setText("");
            }
          }}
          className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        />
        <button
          className="rounded-lg bg-[var(--btn)] px-3 py-2 text-sm text-white"
          style={{ ["--btn" as any]: META_BLUE }}
          onClick={() => {
            onAdd(text);
            setText("");
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
