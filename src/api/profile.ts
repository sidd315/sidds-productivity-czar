// src/api/profile.ts
import { supabase } from "../lib/supabase";

export async function getMyProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nickname")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function upsertMyNickname(userId: string, nickname: string) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: userId, nickname })
    .select()
    .single();

  if (error) throw error;
  return data;
}
