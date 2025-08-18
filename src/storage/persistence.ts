import type { BoardState } from "../types";

export function opfsSupported() {
  return typeof navigator !== "undefined" && !!(navigator.storage && (navigator.storage as any).getDirectory);
}

export async function opfsLoad(): Promise<BoardState | null> {
  if (!opfsSupported()) return null;
  try {
    const root: any = await (navigator.storage as any).getDirectory();
    const fileHandle = await root.getFileHandle("tasks.json", { create: true });
    const file = await fileHandle.getFile();
    if (!file || file.size === 0) return null;
    const text = await file.text();
    return JSON.parse(text) as BoardState;
  } catch {
    return null;
  }
}

export async function opfsSave(state: BoardState) {
  if (!opfsSupported()) return;
  try {
    const root: any = await (navigator.storage as any).getDirectory();
    const fileHandle = await root.getFileHandle("tasks.json", { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(state, null, 2));
    await writable.close();
  } catch {}
}

export async function writeToExternalFile(handle: any, state: BoardState) {
  try {
    const writable = await handle.createWritable();
    await writable.write(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
    await writable.close();
  } catch {}
}