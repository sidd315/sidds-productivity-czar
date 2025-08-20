// src/components/HabitTracker.tsx (reverted to stable version + confirm delete + tip line)
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, Flame, CheckCircle2, CalendarDays, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabase"; // use relative path unless you've set up @ alias

/**
 * DB tables expected:
 *  - habits:      { id uuid pk, board_id uuid, title text, created_at timestamptz default now(), completed boolean default false, completed_at timestamptz null }
 *  - habit_logs:  { id uuid pk, habit_id uuid, day date, created_at timestamptz default now(), unique (habit_id, day) }
 *
 * RLS: user can select/insert/update/delete rows where habits.board_id (or habit_logs -> habits.board_id) belongs to a board owned by auth.uid().
 */

type HabitRow = {
  id: string;
  board_id: string;
  title: string;
  created_at: string;
  completed: boolean;
  completed_at: string | null;
};

type HabitLogRow = {
  id: string;
  habit_id: string;
  day: string; // YYYY-MM-DD UTC
};

export default function HabitTracker({
  boardId,
  open,
  onClose,
}: {
  boardId?: string; // optional so first render (before bootstrap) doesn't crash
  open: boolean;
  onClose: () => void;
}) {
  // Tabs / data
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [logs, setLogs] = useState<HabitLogRow[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null); // double-confirm delete
  const [now, setNow] = useState(Date.now());

  // Draggable popup state
  const popupRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ dx: number; dy: number; sx: number; sy: number; dragging: boolean }>({
    dx: 0,
    dy: 0,
    sx: 0,
    sy: 0,
    dragging: false,
  });

  // Load data when opened
  useEffect(() => {
    if (!open || !boardId) return;
    void refresh();
  }, [open, boardId]);

  useEffect(() => {
  if (!open) return;
  const id = setInterval(() => setNow(Date.now()), 1000);
  return () => clearInterval(id);
  }, [open]);

  function timeLeftToday(): string {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    let ms = end.getTime() - now;
    if (ms < 0) ms = 0;
    const hh = Math.floor(ms / 3600000);
    ms %= 3600000;
    const mm = Math.floor(ms / 60000);
    ms %= 60000;
    const ss = Math.floor(ms / 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  }


  async function refresh() {
    if (!boardId) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const { data: h, error: eh } = await supabase
        .from("habits")
        .select("*")
        .eq("board_id", boardId)
        .order("created_at", { ascending: true });
      if (eh) throw eh;
      setHabits(h ?? []);

      const habitIds = (h ?? []).map((x) => x.id);
      if (habitIds.length) {
        const { data: l, error: el } = await supabase.from("habit_logs").select("*").in("habit_id", habitIds);
        if (el) throw el;
        setLogs(l ?? []);
      } else {
        setLogs([]);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to load habits");
    } finally {
      setLoading(false);
    }
  }

  // --- Streak helpers ---
    // NEW: local YYYY-MM-DD (no timezone shifting)
    function ymdLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
    }
    const todayLocal = () => ymdLocal(new Date());


  const logMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of logs) {
      if (!m.has(l.habit_id)) m.set(l.habit_id, new Set());
      m.get(l.habit_id)!.add(l.day);
    }
    return m;
  }, [logs]);

    function currentStreak(habitId: string): number {
    const days = logMap.get(habitId) ?? new Set<string>();
    if (!days.size) return 0;

    let streak = 0;
    let cursor = new Date(); // local now
    // zero time to local midnight for today and count back
    cursor.setHours(0, 0, 0, 0);

    while (true) {
        const key = ymdLocal(cursor);
        if (days.has(key)) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1); // go to previous local day
        } else {
        break;
        }
    }
    return streak;
    }


  async function toggleToday(h: HabitRow) {
    if (!boardId) return;
    setErrorMsg("");
    const t = todayLocal()
    const set = logMap.get(h.id) ?? new Set<string>();
    try {
      if (set.has(t)) {
        // unmark
        const { data } = await supabase.from("habit_logs").select("id").eq("habit_id", h.id).eq("day", t).maybeSingle();
        if (data?.id) await supabase.from("habit_logs").delete().eq("id", data.id);
      } else {
        // mark
        const { error } = await supabase.from("habit_logs").insert({ habit_id: h.id, day: t });
        if (error) throw error;
      }
      await refresh();
      const s = currentStreak(h.id);
      if (!h.completed && s >= 21) {
        const { error } = await supabase
          .from("habits")
          .update({ completed: true, completed_at: new Date().toISOString() })
          .eq("id", h.id);
        if (error) throw error;
        await refresh();
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to update habit");
    }
  }

  async function addHabit() {
    const title = newTitle.trim();
    if (!title) return;
    if (!boardId) {
      setErrorMsg("Board not ready yet—try again in a moment.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      const { data, error } = await supabase
        .from("habits")
        .insert({ board_id: boardId, title })
        .select("*")
        .single();
      if (error) throw error;
      if (data) setHabits((prev) => [...prev, data]); // optimistic
      setNewTitle("");
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to add habit. Check RLS & tables.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteHabit(id: string) {
    setErrorMsg("");
    try {
      const { error } = await supabase.from("habits").delete().eq("id", id);
      if (error) throw error;
      setHabits((prev) => prev.filter((h) => h.id !== id));
      setLogs((prev) => prev.filter((l) => l.habit_id !== id));
      setConfirmingId(null);
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to delete habit");
    }
  }

  // --- Draggable behavior ---
  function onMouseDownHeader(e: React.MouseEvent) {
    dragState.current.dragging = true;
    dragState.current.sx = e.clientX - dragState.current.dx;
    dragState.current.sy = e.clientY - dragState.current.dy;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }
  function onMouseMove(e: MouseEvent) {
    if (!dragState.current.dragging) return;
    dragState.current.dx = e.clientX - dragState.current.sx;
    dragState.current.dy = e.clientY - dragState.current.sy;
    if (popupRef.current) popupRef.current.style.transform = `translate(${dragState.current.dx}px, ${dragState.current.dy}px)`;
  }
  function onMouseUp() {
    dragState.current.dragging = false;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }

  // Don’t mount until board is ready (prevents disabled UI confusion)
  if (!open || !boardId) return null;

  const activeHabits = habits.filter((h) => !h.completed);
  const completedHabits = habits.filter((h) => h.completed);

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        ref={popupRef}
        className="absolute left-1/2 top-1/2 w-[min(720px,95vw)] max-h-[80vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl"
        style={{ willChange: "transform" }}
      >
        {/* Header (drag handle) */}
        <div
          className="flex items-center justify-between border-b border-neutral-200 bg-white/90 px-4 py-3 cursor-move"
          onMouseDown={onMouseDownHeader}
        >
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-neutral-700" />
            <div className="text-base font-semibold text-neutral-900">Habit Tracker</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error banner */}
        {errorMsg && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <div className="flex-1 truncate">{errorMsg}</div>
            <button onClick={() => setErrorMsg("")} className="text-amber-700 underline">
              dismiss
            </button>
          </div>
        )}

        {/* Tabs + Add */}
        <div className="mt-2 flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("active")}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                activeTab === "active" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                activeTab === "completed" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
              }`}
            >
              Completed
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addHabit();
              }}
              placeholder="New habit (e.g., 'Read 10 pages')"
              className="w-[260px] rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <button
              onClick={addHabit}
              disabled={loading || !newTitle.trim()}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white ${
                loading || !newTitle.trim() ? "bg-neutral-300 cursor-not-allowed" : "bg-neutral-900 hover:opacity-95"
              }`}
              title="Add habit"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>

        {/* Tip line */}
        <div className="px-4 py-2 text-xs text-neutral-500">Complete a 21-day streak to complete a habit.</div>

        {/* Content */}
        <div className="max-h-[calc(80vh-160px)] overflow-y-auto p-4">
          {loading && <div className="text-sm text-neutral-500">Loading…</div>}

          {activeTab === "active" && (
            <div className="space-y-3">
              {activeHabits.length === 0 && !loading && (
                <div className="text-sm text-neutral-500">No active habits yet.</div>
              )}
              {activeHabits.map((h) => {
                const streak = currentStreak(h.id);
                const doneToday = (logMap.get(h.id) ?? new Set()).has(todayLocal());
                const isConfirm = confirmingId === h.id;
                return (
                  <div key={h.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-[15px] font-medium text-neutral-900">{h.title}</div>
                          {streak > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
                              <Flame className="h-3.5 w-3.5" /> {streak} day{streak === 1 ? "" : "s"}
                            </span>
                          )}
                          {streak >= 21 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Ready to complete
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">Created {new Date(h.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500">
                            Time left today: {timeLeftToday()}
                        </span>
                        <button
                          onClick={() => toggleToday(h)}
                          className={`rounded-lg px-3 py-1.5 text-sm ${
                            doneToday ? "bg-emerald-600 text-white" : "bg-neutral-100 text-neutral-800"
                          }`}
                          title={doneToday ? "Unmark today" : "Mark today"}
                        >
                          {doneToday ? "Done today" : "Mark today"}
                        </button>

                        {/* Guarded delete (double-confirm) */}
                        {!isConfirm && (
                          <button
                            onClick={() => setConfirmingId(h.id)}
                            className="rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                          >
                            Delete
                          </button>
                        )}
                        {isConfirm && (
                          <>
                            <button
                              onClick={() => deleteHabit(h.id)}
                              className="rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700"
                              title="This will delete the habit and all streak data"
                            >
                              Confirm delete — all streak data will be lost
                            </button>
                            <button
                              onClick={() => setConfirmingId(null)}
                              className="rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "completed" && (
            <div className="space-y-3">
              {completedHabits.length === 0 && !loading && (
                <div className="text-sm text-neutral-500">No completed habits yet.</div>
              )}
              {completedHabits.map((h) => (
                <div key={h.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-medium text-neutral-900">{h.title}</div>
                      <div className="mt-1 text-xs text-neutral-500">
                        Completed {h.completed_at ? new Date(h.completed_at).toLocaleDateString() : "—"}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Thin custom scrollbars for the modal content */}
      <style>{`.overflow-y-auto{scrollbar-width:thin}.overflow-y-auto::-webkit-scrollbar{width:8px}.overflow-y-auto::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.15);border-radius:8px}.overflow-y-auto::-webkit-scrollbar-track{background:transparent}`}</style>
    </div>
  );
}
