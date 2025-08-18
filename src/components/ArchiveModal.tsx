import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Undo2, Trash } from "lucide-react";
import type { Task } from "../types";
import { formatDate } from "../utils";

export default function ArchiveModal({ open, tasks, onClose, onRestore, onDelete }:{ open:boolean; tasks:Task[]; onClose:()=>void; onRestore:(id:string)=>void; onDelete:(id:string)=>void; }){
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
          <div className="absolute inset-0 bg-black/20" onClick={onClose} />
          <motion.div className="absolute left-1/2 top-1/2 w-[min(720px,94vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-2xl" initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.98,opacity:0}}>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-semibold text-neutral-900">Archived Tasks</div>
              <button onClick={onClose} className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Close</button>
            </div>
            {tasks.length===0 ? <div className="text-neutral-500 text-sm">No archived tasks yet.</div> : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {tasks.map(t => (
                  <div key={t.id} className="flex items-start justify-between rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                    <div>
                      <div className="font-medium text-neutral-900">{t.title}</div>
                      <div className="mt-1 text-xs text-neutral-500">Due: {formatDate(t.dueAt)} · Tags: {(t.tags??[]).join(", ") || "–"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={()=>onRestore(t.id)} className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs hover:bg-neutral-50"><Undo2 className="h-3.5 w-3.5"/> Restore</button>
                      <button onClick={()=>onDelete(t.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50"><Trash className="h-3.5 w-3.5"/> Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}