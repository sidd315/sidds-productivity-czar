import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SubTask } from "../types";
import { META_BLUE } from "../types";

export default function SubtasksModal({ open, title, initial, onClose, onSave }:{ open:boolean; title:string; initial:SubTask[]; onClose:()=>void; onSave:(subs:SubTask[])=>void; }){
  const [subs, setSubs] = useState<SubTask[]>(initial);
  const [text, setText] = useState("");

  useEffect(()=>{ setSubs(initial); }, [initial, open]);

  function toggle(id:string){ setSubs(prev => prev.map(s => s.id===id? {...s, done: !s.done} : s)); }
  function remove(id:string){ setSubs(prev => prev.filter(s => s.id!==id)); }
  function add(){ const t = text.trim(); if(!t) return; setSubs(prev => [...prev, { id: Math.random().toString(36).slice(2,8), title: t, done: false }]); setText(""); }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
          <div className="absolute inset-0 bg-black/20" onClick={onClose} />
          <motion.div className="absolute left-1/2 top-1/2 w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-2xl" initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.98,opacity:0}}>
            <div className="mb-3 text-lg font-semibold text-neutral-900">Subtasks · {title}</div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {subs.length===0 && <div className="text-sm text-neutral-500">No subtasks yet.</div>}
              {subs.map(s => (
                <label key={s.id} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <input type="checkbox" checked={s.done} onChange={()=>toggle(s.id)} />
                  <span className={`text-sm ${s.done? 'line-through text-neutral-400':'text-neutral-800'}`}>{s.title}</span>
                  <button onClick={()=>remove(s.id)} className="ml-auto text-xs text-neutral-500 hover:text-neutral-800">Remove</button>
                </label>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input value={text} onChange={(e)=>setText(e.target.value)} placeholder="New subtask" className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:border-[--ring] focus:outline-none" style={{ ['--ring' as any]: META_BLUE }} />
              <button onClick={add} className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">Add</button>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">Close</button>
              <button onClick={()=>{ onSave(subs); onClose(); }} className="rounded-xl bg-[var(--btn)] px-3 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95" style={{ ['--btn' as any]: META_BLUE }}>Save</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}