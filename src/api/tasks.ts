import { supabase } from "../lib/supabase";

export async function listTasks(boardId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("board_id", boardId)
    .eq("archived", false)
    .order("position", { ascending: true });
  if (error) throw error;
  return data!;
}

export async function createTask(input: {
  board_id: string; column_id: string;
  title: string; note?: string;
  priority?: "Urgent"|"Important"|"Inevitably important";
  due_at?: string|null; tags?: string[];
}) {
  const { data, error } = await supabase.from("tasks").insert({
    ...input, position: 1e9, archived: false
  }).select("*").single();
  if (error) throw error;
  return data!;
}

export async function updateTask(taskId: string, patch: Record<string, any>) {
  const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
  if (error) throw error;
}

export async function moveTask(taskId: string, dest: { column_id: string; position: number }) {
  const { error } = await supabase.from("tasks").update(dest).eq("id", taskId);
  if (error) throw error;
}

export function computeNewPosition(prev?: number, next?: number) {
  if (prev != null && next != null) return (prev + next) / 2;
  if (prev != null) return prev + 1;
  if (next != null) return next - 1;
  return 1e9;
}
