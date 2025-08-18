import { supabase } from "../lib/supabase";

export async function createSchedule(params: {
  board_id: string;
  template: { title: string; note?: string; priority?: string; tags?: string[]; recurrence: { freq: "daily"|"weekly"|"monthly" } };
  next_at_iso: string;
  timezone?: string;
}) {
  const { error } = await supabase.from("schedules").insert({
    board_id: params.board_id,
    template: params.template,
    next_at: params.next_at_iso,
    timezone: params.timezone ?? "America/Chicago"
  });
  if (error) throw error;
}
