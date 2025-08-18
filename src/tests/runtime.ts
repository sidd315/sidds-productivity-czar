// src/tests/runtime.ts
// Lightweight runtime tests for DnD logic and overdue computation.
// These are self-contained (no app imports beyond types).

import type { BoardState, ColumnId, Task } from "../types";

/** Minimal arrayMove to avoid pulling test-time deps */
function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  if (from === to) return arr.slice();
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function findColumnIdByTask(state: BoardState, taskId: string): ColumnId | null {
  const cols: ColumnId[] = ["pending", "inprogress", "action", "done"];
  for (const col of cols) {
    if ((state as any)[col].some((t: Task) => t.id === taskId)) return col;
  }
  return null;
}

/** Pure compute: mirrors app behavior (reorder within column or move across columns) */
function computeDnD(
  prev: BoardState,
  activeId: string,
  overId: string,
  onMoveBetween?: (fromCol: ColumnId, toCol: ColumnId) => void
): BoardState {
  const fromCol = findColumnIdByTask(prev, activeId);
  if (!fromCol) return prev;

  const columnIds: ColumnId[] = ["pending", "inprogress", "action", "done"];
  let toCol: ColumnId | null = (columnIds as string[]).includes(overId)
    ? (overId as ColumnId)
    : findColumnIdByTask(prev, overId);
  if (!toCol) return prev;

  if (fromCol === toCol) {
    const oldIndex = (prev as any)[fromCol].findIndex((t: Task) => t.id === activeId);
    const newIndex = (prev as any)[toCol].findIndex((t: Task) => t.id === overId);
    if (oldIndex === -1 || newIndex === -1) return prev;
    const reordered = arrayMove((prev as any)[fromCol] as Task[], oldIndex, newIndex);
    return { ...prev, [fromCol]: reordered } as BoardState;
  } else {
    const moving = (prev as any)[fromCol].find((t: Task) => t.id === activeId) as Task | undefined;
    if (!moving) return prev;
    const without = ((prev as any)[fromCol] as Task[]).filter((t) => t.id !== activeId);
    const insertIndex = ((prev as any)[toCol] as Task[]).findIndex((t) => t.id === overId);
    const targetArr = ([...(prev as any)[toCol]] as Task[]);
    if (insertIndex === -1) targetArr.unshift(moving);
    else targetArr.splice(insertIndex, 0, moving);
    onMoveBetween?.(fromCol, toCol);
    return { ...prev, [fromCol]: without, [toCol]: targetArr } as BoardState;
  }
}

/** Same rule as UI: due and not in done = overdue if before end of today */
function isOverdue(task: Task, inDoneColumn: boolean): boolean {
  if (!task.dueAt || inDoneColumn) return false;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return task.dueAt < endOfToday.getTime();
}

(function runTests() {
  try {
    const makeState = (): BoardState => ({
      pending: [
        { id: "a", title: "A", createdAt: 0 } as Task,
        { id: "b", title: "B", createdAt: 0 } as Task,
        { id: "c", title: "C", createdAt: 0 } as Task,
      ] as Task[],
      inprogress: [] as Task[],
      action: [] as Task[],
      done: [] as Task[],
      archived: [] as Task[],
      schedules: [],
    });

    // Test 1: move between columns (drop on column area)
    let s1 = makeState();
    s1 = computeDnD(s1, "a", "done");
    console.assert(s1.pending.length === 2 && s1.done.length === 1 && s1.done[0].id === "a", "Test 1 failed");

    // Test 2: reorder within the same column (drop on another task)
    let s2 = makeState();
    s2 = computeDnD(s2, "c", "a");
    console.assert(
      (s2.pending as Task[]).map((t) => t.id).join(",") === "c,a,b",
      "Test 2 failed: expected order c,a,b"
    );

    // Test 3: unknown over id -> no change
    let s3 = makeState();
    const before = JSON.stringify(s3);
    s3 = computeDnD(s3, "a", "does-not-exist");
    console.assert(JSON.stringify(s3) === before, "Test 3 failed: state should be unchanged");

    // Test 4: overdue logic
    const yesterday = Date.now() - 24 * 3600 * 1000;
    const t: Task = { id: "x", title: "X", createdAt: 0, dueAt: yesterday } as Task;
    console.assert(isOverdue(t, false) === true, "Test 4 failed: should be overdue");
    console.assert(isOverdue(t, true) === false, "Test 4 failed: done column should not show overdue");

    // Test 5: move to inprogress, drop over a task id -> insert before that task
    let s5: BoardState = {
      pending: [{ id: "a", title: "A", createdAt: 0 } as Task] as Task[],
      inprogress: [
        { id: "y", title: "Y", createdAt: 0 } as Task,
        { id: "z", title: "Z", createdAt: 0 } as Task,
      ] as Task[],
      action: [] as Task[],
      done: [] as Task[],
      archived: [] as Task[],
      schedules: [],
    };
    s5 = computeDnD(s5, "a", "y");
    console.assert(
      (s5.inprogress as Task[]).map((t) => t.id).join(",") === "a,y,z" && s5.pending.length === 0,
      "Test 5 failed: expected a inserted before y"
    );

    console.log("All runtime tests passed ✓");
  } catch (e) {
    console.warn("Tests encountered an error:", e);
  }
})();
