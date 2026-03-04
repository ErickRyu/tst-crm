"use client";

import { useState, useRef, memo } from "react";
import type { Lead, User } from "../types";
import { statusStyles, fmtCreatedAt } from "../types";
import { PhoneLink } from "./phone-link";
import { TagChip } from "./tag-chip";
import { Button } from "@/components/ui/button";

export const KanbanCard = memo(function KanbanCard({ lead: l, users, selectedId, draggingId, onSelect, onSaveMemo, setDraggingId }: {
  lead: Lead; users: User[]; selectedId: number | null; draggingId: number | null;
  onSelect: (id: number) => void; onSaveMemo: (leadId: number, body: string) => Promise<void>;
  setDraggingId: (id: number | null) => void;
}) {
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoText, setMemoText] = useState("");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const openEditor = () => {
    setMemoText(l.memoBody || "");
    setMemoOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSave = async () => {
    if (!memoText.trim()) return;
    try {
      setSaving(true);
      await onSaveMemo(l.id, memoText.trim());
      setMemoOpen(false);
    } catch { /* toast handled upstream */ }
    finally { setSaving(false); }
  };

  return (
    <div draggable onDragStart={() => setDraggingId(l.id)} onDragEnd={() => setDraggingId(null)} onClick={() => onSelect(l.id)}
      className={`p-3 md:p-4 rounded-xl shadow-sm border bg-white cursor-grab transition-all hover:shadow-md ${statusStyles[l.crmStatus].border} ${selectedId === l.id ? "ring-2 ring-primary" : ""} ${draggingId === l.id ? "opacity-40" : ""}`}
    >
      <div className="flex justify-between items-start mb-2">
        <div><div className="font-bold text-sm">{l.name}</div><PhoneLink phone={l.phone} className="text-xs md:text-[10px] text-slate-500" /></div>
        <div className="text-[10px] text-slate-400 whitespace-nowrap">{fmtCreatedAt(l.createdAt)}</div>
      </div>
      <div className="flex flex-wrap gap-1 mb-2 md:mb-3">
        {l.age != null && <TagChip label={`${l.age}세`} tone="blue" />}
        {l.gender && <TagChip label={l.gender === "남" ? "남" : "여"} tone={l.gender === "남" ? "blue" : "pink"} />}
        {l.media && <TagChip label={l.media} tone="purple" />}
        <TagChip label={l.careTag} tone={l.careTag.includes("임플란트") ? "indigo" : "slate"} />
        {l.appointmentAt && <TagChip label={`${new Date(l.appointmentAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })} 예약`} tone="green" />}
      </div>
      {/* Inline memo */}
      <div className="mt-2 pt-2 border-t border-slate-50" onClick={e => e.stopPropagation()}>
        {!memoOpen ? (
          l.memoBody ? (
            <button onClick={openEditor}
              className="group flex items-start gap-1 text-left text-[11px] text-slate-600 leading-relaxed w-full hover:text-primary transition-colors">
              <span className="material-icons text-[12px] mt-0.5 shrink-0 text-slate-300 group-hover:text-primary transition-colors">edit_note</span>
              <span className="line-clamp-2">{l.memoBody}</span>
            </button>
          ) : (
            <button onClick={openEditor}
              className="flex items-center gap-1 text-xs py-1 md:text-[10px] md:py-0 text-slate-400 hover:text-primary transition-colors w-full">
              <span className="material-icons text-[12px]">edit_note</span> 메모 입력...
            </button>
          )
        ) : (
          <div className="space-y-1.5">
            <textarea ref={textareaRef} value={memoText} onChange={e => setMemoText(e.target.value)}
              rows={3} maxLength={2000} placeholder="메모를 입력하세요..."
              className="w-full text-[11px] border border-slate-200 rounded-lg p-2 resize-none focus:ring-1 focus:ring-primary/30 focus:outline-none"
              onKeyDown={e => { if (e.ctrlKey && e.key === "Enter") { e.preventDefault(); handleSave(); } if (e.key === "Escape") { setMemoOpen(false); setMemoText(""); } }}
            />
            <div className="flex items-center justify-end gap-1">
              <Button variant="secondary" size="xs" onClick={() => { setMemoOpen(false); setMemoText(""); }}>취소</Button>
              <Button size="xs" onClick={handleSave} disabled={saving || !memoText.trim()}>
                {saving ? "저장..." : "저장"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.lead.id === next.lead.id
    && prev.lead.crmStatus === next.lead.crmStatus
    && prev.lead.memoBody === next.lead.memoBody
    && prev.lead.name === next.lead.name
    && prev.lead.phone === next.lead.phone
    && prev.lead.appointmentAt === next.lead.appointmentAt
    && prev.lead.createdAt === next.lead.createdAt
    && prev.lead.age === next.lead.age
    && prev.lead.gender === next.lead.gender
    && prev.lead.media === next.lead.media
    && prev.lead.careTag === next.lead.careTag
    && prev.selectedId === next.selectedId
    && prev.draggingId === next.draggingId;
});
