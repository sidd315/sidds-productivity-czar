import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { createPortal } from "react-dom";
import type { Priority, Recurrence, RecurrenceFreq, Task } from "../types";
import { META_BLUE, SUGGESTED_TAGS } from "../types";
import { dateInputToEpochLocal, epochToDateInputLocal } from "../utils";

export default function TaskModal({ open, initial, onClose, onSubmit }:{ open: boolean; initial?: Partial<Task>; onClose: ()=>void; onSubmit: (v:{ title:string; note?:string; priority:Priority; dueAt:number|null; tags:string[]; recurrence?: Recurrence|undefined; })=>void; }){
  const [title, setTitle] = useState(initial?.title ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [priority, setPriority] = useState<Priority>((initial?.priority as Priority) ?? "Important");
  const [due, setDue] = useState<string>(initial?.dueAt ? epochToDateInputLocal(initial.dueAt) : "");
  const [selectedTags, setSelectedTags] = useState<string[]>(initial?.tags ?? []);
  const [recurring, setRecurring] = useState<boolean>(!!initial?.recurrence);
  const [freq, setFreq] = useState<RecurrenceFreq>((initial?.recurrence?.freq as RecurrenceFreq) ?? "weekly");
  const [customTag, setCustomTag] = useState("");

  const dragControls = useDragControls();
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(()=>{
    setTitle(initial?.title ?? "");
    setNote(initial?.note ?? "");
    setPriority((initial?.priority as Priority) ?? "Important");
    setDue(initial?.dueAt ? epochToDateInputLocal(initial.dueAt) : "");
    setSelectedTags(initial?.tags ?? []);
    setRecurring(!!initial?.recurrence);
    setFreq((initial?.recurrence?.freq as RecurrenceFreq) ?? "weekly");
  }, [initial, open]);

  function toggleTag(tag: string) { setSelectedTags(prev => prev.includes(tag) ? prev.filter(t=>t!==tag) : [...prev, tag]); }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div ref={overlayRef} className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/20" onClick={onClose} />

          <div className="grid h-full w-full place-items-center pointer-events-none">
            <motion.div
              className="relative w-[min(620px,92vw)] pointer-events-auto rounded-2xl bg-white p-0 shadow-2xl"
              style={{ resize: "both", overflow: "auto", maxHeight: "80vh" }}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              drag
              dragControls={dragControls}
              dragListener={false}
              dragMomentum={false}
              dragConstraints={overlayRef}
            >
              <div className="flex items-center justify-between rounded-t-2xl border-b border-neutral-200 bg-neutral-50 px-4 py-2 cursor-move" onPointerDown={(e)=>dragControls.start(e)}>
                <div className="text-sm font-semibold text-neutral-800">{initial?.id ? "Edit task" : "Add a new task"}</div>
                <button onClick={onClose} className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50">Close</button>
              </div>

              <div className="p-5 space-y-3">
                <label className="block">
                  <span className="text-sm text-neutral-600">Title</span>
                  <input value={title} onChange={(e)=>setTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:border-[--ring] focus:outline-none" style={{ ['--ring' as any]: META_BLUE }} placeholder="What needs to be done?" />
                </label>

                <label className="block">
                  <span className="text-sm text-neutral-600">Notes (optional)</span>
                  <textarea value={note} onChange={(e)=>setNote(e.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:border-[--ring] focus:outline-none" rows={3} placeholder="Details, links, acceptance criteria…" style={{ ['--ring' as any]: META_BLUE }} />
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm text-neutral-600">Priority</span>
                    <select value={priority} onChange={(e)=>setPriority(e.target.value as Priority)} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:border-[--ring] focus:outline-none" style={{ ['--ring' as any]: META_BLUE }}>
                      <option>Urgent</option><option>Important</option><option>Inevitably important</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm text-neutral-600">Due date</span>
                    <input type="date" value={due} onChange={(e)=>setDue(e.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:border-[--ring] focus:outline-none" style={{ ['--ring' as any]: META_BLUE }} />
                  </label>
                </div>

                <div className="rounded-xl border border-neutral-200 p-3">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4" checked={recurring} onChange={(e)=>setRecurring(e.target.checked)} />
                    <span>Create a recurring task</span>
                  </label>
                  {recurring && (
                    <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-sm text-neutral-600">Frequency</span>
                        <select value={freq} onChange={(e)=>setFreq(e.target.value as RecurrenceFreq)} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:border-[--ring] focus:outline-none" style={{ ['--ring' as any]: META_BLUE }}>
                          <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
                        </select>
                      </label>
                      <div className="text-xs text-neutral-500 self-end">New copies will appear automatically at the start of each period.</div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-sm text-neutral-600 mb-1">Tags</div>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_TAGS.map((t) => (
                      <button key={t} type="button" onClick={() => toggleTag(t)} className={`rounded-full border px-2 py-1 text-xs ${selectedTags.includes(t) ? "border-neutral-600 bg-neutral-100 text-neutral-800" : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"}`}>{t}</button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input value={customTag} onChange={(e)=>setCustomTag(e.target.value)} placeholder="Add custom tag" className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:border-[--ring] focus:outline-none" style={{ ['--ring' as any]: META_BLUE }} />
                    <button onClick={()=>{ const t=customTag.trim(); if(!t) return; setSelectedTags(prev=>prev.includes(t)?prev:[...prev,t]); setCustomTag(""); }} type="button" className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">Add</button>
                  </div>
                  {selectedTags.length>0 && <div className="mt-2 text-xs text-neutral-500">Selected: {selectedTags.join(", ")}</div>}
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={onClose} className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">Cancel</button>
                  <button disabled={!title.trim()} onClick={() => onSubmit({ title: title.trim(), note: note.trim() || undefined, priority, dueAt: due ? dateInputToEpochLocal(due) : null, tags: selectedTags, recurrence: recurring ? { freq } : undefined })} className={`rounded-xl px-3 py-2 text-sm font-medium text-white shadow-sm ${!title.trim() ? "bg-neutral-300 cursor-not-allowed" : "bg-[var(--btn)] hover:opacity-95"}`} style={{ ['--btn' as any]: META_BLUE }}>{initial?.id ? "Save changes" : "Add task"}</button>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}