import React from "react";
import { motion } from "framer-motion";
import type { Task } from "../types";

export default function OverlayCard({ task }: { task: Task | null }) {
  if (!task) return null;
  return (
    <motion.div initial={{ scale: 0.98, opacity: 0.9 }} animate={{ scale: 1, opacity: 1 }} className="rounded-2xl border border-neutral-300 bg-white p-3 shadow-xl">
      <div className="font-medium text-neutral-900">{task.title}</div>
      <div className="mt-1 text-xs text-neutral-500">Dragging…</div>
    </motion.div>
  );
}