"use client";

import { useState, useMemo } from "react";
import type { CalendarEvent } from "../types";

export function CalendarView({ events }: { events: CalendarEvent[] }) {
  const [cur, setCur] = useState(new Date());
  const days = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
  const start = new Date(cur.getFullYear(), cur.getMonth(), 1).getDay();
  const fmtTime = (iso: string) => { const d = new Date(iso); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const grouped = useMemo(() => {
    const r: Record<number, CalendarEvent[]> = {};
    events.forEach(e => { const d = new Date(e.at); if(d.getMonth() === cur.getMonth() && d.getFullYear() === cur.getFullYear()) { const dd = d.getDate(); r[dd] = [...(r[dd] || []), e].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()); } });
    return r;
  }, [events, cur]);
  return (
    <div className="h-full flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="p-3 md:p-4 bg-slate-50 border-b border-border flex justify-between items-center"><h3 className="font-bold">{cur.getFullYear()}년 {cur.getMonth()+1}월 일정</h3><div className="flex gap-1"><button onClick={() => setCur(new Date(cur.getFullYear(), cur.getMonth()-1))} className="p-2 md:p-1 border border-border rounded hover:bg-white"><span className="material-icons">chevron_left</span></button><button onClick={() => setCur(new Date())} className="px-3 py-1 border border-border rounded hover:bg-white text-xs">오늘</button><button onClick={() => setCur(new Date(cur.getFullYear(), cur.getMonth()+1))} className="p-2 md:p-1 border border-border rounded hover:bg-white"><span className="material-icons">chevron_right</span></button></div></div>
      <div className="flex-1 overflow-auto p-4"><div className="grid grid-cols-7 bg-slate-200 border border-slate-200 gap-px">
        {["일","월","화","수","목","금","토"].map(d => <div key={d} className="bg-slate-50 py-1 text-center text-[9px] md:py-2 md:text-[10px] font-bold text-slate-400">{d}</div>)}
        {Array.from({length: start}).map((_, i) => <div key={i} className="bg-slate-50/50 min-h-[60px] md:min-h-[100px]"></div>)}
        {Array.from({length: days}).map((_, i) => { const d = i+1; return <div key={d} className="bg-white min-h-[60px] md:min-h-[100px] p-1 md:p-2 space-y-1"><div className="text-[10px] text-slate-400 font-bold">{d}</div>{grouped[d]?.map(e => <div key={e.id} className={`text-[9px] p-1 rounded border truncate ${e.type==='appointment'?'bg-emerald-50 border-emerald-100 text-emerald-700':'bg-blue-50 border-blue-100 text-blue-700'}`}>{fmtTime(e.at)} {e.patientName}</div>)}</div> })}
      </div></div>
    </div>
  );
}
