// src/components/NicknameModal.tsx
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { upsertMyNickname } from "../api/profile";

export default function NicknameModal({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (nickname: string) => void;
  initial?: string;
}) {
  const [nickname, setNickname] = useState(initial ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setNickname(initial ?? "");
      setError(null);
      // focus on open
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, initial]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") void handleSave();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, nickname]);

  if (!open) return null;

  async function handleSave() {
    if (!nickname.trim()) {
      setError("Nickname cannot be empty.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in.");
      // IMPORTANT: use user.id (UUID) for profiles.id
      await upsertMyNickname(user.id, nickname.trim());
      onSaved(nickname.trim());
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to save nickname.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70]">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* modal */}
      <div
        className="absolute left-1/2 top-1/2 w-[min(420px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-semibold text-neutral-900">Choose a nickname</div>
        <p className="mt-1 text-sm text-neutral-600">We’ll show it in your app title.</p>

        <input
          ref={inputRef}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="e.g., Sidd"
          className="mt-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />

        {error && (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-lg border px-3 py-2 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !nickname.trim()}
            className={`rounded-lg px-3 py-2 text-sm text-white ${
              loading || !nickname.trim() ? "bg-neutral-300" : "bg-neutral-900 hover:opacity-95"
            }`}
          >
            {loading ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
