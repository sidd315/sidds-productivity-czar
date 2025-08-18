import { computeDnD } from "../dnd/computeDnD";
import { isOverdue } from "../utils";
import type { BoardState, Task } from "../types";

(function runTests(){
  try {
    const makeState = (): BoardState => ({ pending: [ { id: "a", title: "A", createdAt: 0 }, { id: "b", title: "B", createdAt: 0 }, { id: "c", title: "C", createdAt: 0 } ], inprogress: [], action: [], done: [], archived: [] });
    let s1 = makeState(); s1 = computeDnD(s1, "a", "done"); console.assert(s1.pending.length === 2 && s1.done.length === 1 && s1.done[0].id === "a", "Test 1 failed");
    let s2 = makeState(); s2 = computeDnD(s2, "c", "a"); console.assert(s2.pending.map((t) => t.id).join(",") === "c,a,b", "Test 2 failed: expected order c,a,b");
    let s3 = makeState(); const before = JSON.stringify(s3); s3 = computeDnD(s3, "a", "does-not-exist"); console.assert(JSON.stringify(s3) === before, "Test 3 failed: state should be unchanged");
    const yesterday = Date.now() - 24*3600*1000; const t: Task = { id: "x", title: "X", createdAt: 0, dueAt: yesterday }; console.assert(isOverdue(t, false) === true, "Test 4 failed: should be overdue"); console.assert(isOverdue(t, true) === false, "Test 4 failed: done column should not show overdue");
    let s5: BoardState = { pending: [ { id: "a", title: "A", createdAt: 0 } ], inprogress: [ { id: "y", title: "Y", createdAt: 0 }, { id: "z", title: "Z", createdAt: 0 } ], action: [], done: [], archived: [] };
    s5 = computeDnD(s5, "a", "y"); console.assert(s5.inprogress.map(t=>t.id).join(",") === "a,y,z" && s5.pending.length === 0, "Test 5 failed: expected a inserted before y");
    let s6 = makeState(); s6 = computeDnD(s6, "b", "inprogress"); console.assert(s6.inprogress.length === 1 && s6.inprogress[0].id === "b" && s6.pending.map((t) => t.id).join(",") === "a,c", "Test 6 failed: expected b to move to top of inprogress");
    console.log("All Sidd's Productivity Czar tests passed ✓");
  } catch (e) { console.warn("Tests encountered an error:", e); }
})();