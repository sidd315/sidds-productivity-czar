// src/api/bootstrap.ts
import { supabase } from "../lib/supabase";

export async function ensureBoard(): Promise<{ boardId: string; columns: Record<string, string> }> {
  // 1) Get current user id (required for RLS)
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userRes?.user;
  if (!user) throw new Error("Not authenticated");

  // 2) Find existing board for this user
  const { data: boards, error: be } = await supabase
    .from("boards")
    .select("id")
    .eq("user_id", user.id)   // ✅ filter by owner
    .limit(1);
  if (be) throw be;

  let boardId = boards?.[0]?.id as string | undefined;

  // 3) Create board with user_id if none exists (RLS requires it)
  if (!boardId) {
    const { data: b, error: ce } = await supabase
      .from("boards")
      .insert({ user_id: user.id })   // ✅ set owner so RLS passes
      .select("id")
      .single();
    if (ce) throw ce;
    boardId = b.id;

    // 4) Seed the 4 columns for this board
    const { error: se } = await supabase.from("columns").insert([
      { board_id: boardId, key: "pending" },
      { board_id: boardId, key: "inprogress" },
      { board_id: boardId, key: "action" },
      { board_id: boardId, key: "done" },
    ]);
    if (se) throw se;
  }

  // 5) Load columns for this board
  const { data: cols, error: le } = await supabase
    .from("columns")
    .select("id,key")
    .eq("board_id", boardId);
  if (le) throw le;

  const map: Record<string, string> = {};
  (cols ?? []).forEach((c) => (map[c.key] = c.id));

  return { boardId: boardId!, columns: map };
}
