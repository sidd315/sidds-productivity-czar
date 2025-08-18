import { arrayMove } from "@dnd-kit/sortable";
import type { BoardState, ColumnId } from "../types";
import { COLUMN_DEFS } from "../types";
import { findColumnIdByTask } from "../utils";

export function computeDnD(
  prev: BoardState,
  activeId: string,
  overId: string,
  onMoveBetween?: (fromCol: ColumnId, toCol: ColumnId) => void
): BoardState {
  const fromCol = findColumnIdByTask(prev, activeId);
  if (!fromCol) return prev;

  let toCol: ColumnId | null = (COLUMN_DEFS.map((c) => c.id) as ColumnId[]).includes(overId as ColumnId)
    ? (overId as ColumnId)
    : findColumnIdByTask(prev, overId);
  if (!toCol) return prev;

  if (fromCol === toCol) {
    const oldIndex = prev[fromCol].findIndex((t) => t.id === activeId);
    const newIndex = prev[toCol].findIndex((t) => t.id === overId);
    if (oldIndex === -1 || newIndex === -1) return prev;
    const reordered = arrayMove(prev[fromCol], oldIndex, newIndex);
    return { ...prev, [fromCol]: reordered } as BoardState;
  } else {
    const moving = prev[fromCol].find((t) => t.id === activeId);
    if (!moving) return prev;
    const without = prev[fromCol].filter((t) => t.id !== activeId);
    const insertIndex = prev[toCol].findIndex((t) => t.id === overId);
    const targetArr = [...prev[toCol]];
    if (insertIndex === -1) targetArr.unshift(moving);
    else targetArr.splice(insertIndex, 0, moving);

    onMoveBetween?.(fromCol, toCol);
    return { ...prev, [fromCol]: without, [toCol]: targetArr } as BoardState;
  }
}