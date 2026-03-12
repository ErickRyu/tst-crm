"use client";

import type { CrmStatus, KanbanProps } from "../types";
import { kanbanStatusOptions, statusStyles } from "../types";
import { KanbanCard } from "./kanban-card";
import { Checkbox } from "@/components/ui/checkbox";

export function KanbanView({ grouped, users, onSelect, selectedId, onStatus, onSaveMemo, draggingId, setDraggingId, dragOverStatus, setDragOverStatus, doneTotalCounts, kanbanDoneDays, onKanbanDoneDaysChange, bulk }: KanbanProps) {
  const doneSet = new Set<CrmStatus>(["응대중", "통화완료", "예약완료"]);
  return (
    <div className="flex gap-2 h-full overflow-x-auto pb-4 items-start snap-x snap-mandatory md:gap-4 md:snap-none">
      {kanbanStatusOptions.map(status => {
        const isDone = doneSet.has(status);
        const columnIds = grouped[status].map(l => l.id);
        const allColumnSelected = bulk && columnIds.length > 0 && columnIds.every(id => bulk.selectedLeadIds.has(id));
        return (
        <div key={status} onDragOver={(e) => { e.preventDefault(); setDragOverStatus(status); }} onDragLeave={() => setDragOverStatus(null)} onDrop={() => { if (!draggingId) return; setDragOverStatus(null); onStatus(draggingId, status); setDraggingId(null); }}
          className={`w-72 shrink-0 snap-center md:w-80 flex flex-col max-h-full rounded-xl border border-border bg-slate-100/40 transition-colors ${dragOverStatus === status ? "bg-primary/5 border-primary/40" : ""}`}
        >
          <div className="p-3 md:p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              {bulk && columnIds.length > 0 && (
                <Checkbox
                  checked={allColumnSelected ?? false}
                  onCheckedChange={() => {
                    if (allColumnSelected) {
                      for (const id of columnIds) {
                        if (bulk.selectedLeadIds.has(id)) bulk.onToggleSelect(id);
                      }
                    } else {
                      bulk.onSelectAll(columnIds);
                    }
                  }}
                />
              )}
              <span className={`w-2 h-2 rounded-full ${statusStyles[status].dot}`}></span>
              <span className="font-bold text-sm text-slate-700">{status}</span>
              <span className="bg-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm">
                {isDone && kanbanDoneDays != null
                  ? `${grouped[status].length}/${doneTotalCounts[status]}`
                  : grouped[status].length}
              </span>
            </div>
            {isDone && (
              <select
                value={kanbanDoneDays ?? "all"}
                onChange={e => {
                  const v = e.target.value;
                  onKanbanDoneDaysChange(v === "all" ? null : Number(v) as 7 | 30);
                }}
                className="text-[10px] border-slate-200 rounded px-1 py-0.5 bg-white"
                onClick={e => e.stopPropagation()}
              >
                <option value="7">7일</option>
                <option value="30">30일</option>
                <option value="all">전체</option>
              </select>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-2 space-y-2 pb-3 md:px-3 md:space-y-3 md:pb-4">
            {grouped[status].map((l) => (
              <KanbanCard key={l.id} lead={l} users={users} selectedId={selectedId} draggingId={draggingId} onSelect={onSelect} onSaveMemo={onSaveMemo} setDraggingId={setDraggingId} onToggleSelect={bulk?.onToggleSelect} isSelected={bulk ? bulk.selectedLeadIds.has(l.id) : false} />
            ))}
          </div>
        </div>
        );
      })}
    </div>
  );
}
