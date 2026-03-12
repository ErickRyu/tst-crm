"use client";

import { useMemo } from "react";
import type { ViewProps, CrmStatus } from "../types";
import { statusOptions, statusStyles, fmtCreatedAt, toIsoLocal } from "../types";
import { PhoneLink } from "./phone-link";
import { TagChip } from "./tag-chip";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

export function ListView({ leads, users, onSelect, selectedId, onStatus, onAssignee, onSchedule, loading, pagination, bulk }: ViewProps) {
  const stop = (e: React.MouseEvent | React.ChangeEvent) => e.stopPropagation();
  const allSelected = bulk && leads.length > 0 && leads.every(l => bulk.selectedLeadIds.has(l.id));
  const p = pagination;
  const rowNum = (idx: number) => p ? p.currentPage * p.pageSize + idx + 1 : idx + 1;

  const pageNumbers = useMemo(() => {
    if (!p || p.totalPages <= 1) return [];
    const pages: (number | "...")[] = [];
    const tp = p.totalPages;
    const cur = p.currentPage;
    const start = Math.max(0, cur - 2);
    const end = Math.min(tp - 1, cur + 2);
    if (start > 0) { pages.push(0); if (start > 1) pages.push("..."); }
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < tp - 1) { if (end < tp - 2) pages.push("..."); pages.push(tp - 1); }
    return pages;
  }, [p]);

  return (
    <div className="h-full flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Mobile card list */}
      <div className="flex-1 overflow-auto md:hidden">
        {loading && <div className="flex items-center justify-center py-10"><span className="material-icons text-slate-400 animate-pulse">hourglass_empty</span></div>}
        {!loading && leads.length === 0 && <div className="py-20 text-center text-slate-400">조회된 데이터가 없습니다.</div>}
        {!loading && <div className="divide-y divide-slate-100">
          {leads.map((l, idx) => (
            <div key={l.id} onClick={() => onSelect(l.id)} className={`p-3 cursor-pointer transition-colors ${bulk?.selectedLeadIds.has(l.id) ? "bg-primary/5" : selectedId === l.id ? "bg-blue-50/50" : ""}`}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-start gap-2">
                  {bulk && (
                    <div className="mt-0.5 shrink-0" onClick={stop}>
                      <Checkbox checked={bulk.selectedLeadIds.has(l.id)} onCheckedChange={() => bulk.onToggleSelect(l.id)} />
                    </div>
                  )}
                  <span className="text-[11px] font-semibold text-slate-400 mt-0.5 min-w-[1.2rem]">{rowNum(idx)}</span><div><div className="font-bold text-sm text-slate-900">{l.name}</div><PhoneLink phone={l.phone} className="text-xs text-slate-500" /></div></div>
                <div className="text-[10px] text-slate-400 whitespace-nowrap">유입 {fmtCreatedAt(l.createdAt)}</div>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {l.age != null && <TagChip label={`${l.age}세`} tone="blue" />}
                {l.gender && <TagChip label={l.gender === "남" ? "남" : "여"} tone={l.gender === "남" ? "blue" : "pink"} />}
                {l.media && <TagChip label={l.media} tone="purple" />}
                <TagChip label={l.careTag} tone={l.careTag.includes("임플란트") ? "indigo" : "slate"} />
              </div>
              <div className="flex items-center gap-2" onClick={stop}>
                <select value={l.crmStatus} onChange={e => onStatus(l.id, e.target.value as CrmStatus)} className={`text-[11px] font-bold border-slate-200 rounded px-2 py-1.5 bg-white focus:ring-1 focus:ring-primary flex-1 ${statusStyles[l.crmStatus].badge}`}>
                  {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={l.assigneeId || ""} onChange={e => onAssignee(l.id, e.target.value ? Number(e.target.value) : null)} className="text-[11px] border-slate-200 rounded px-2 py-1.5 bg-white flex-1">
                  <option value="">미할당</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>}
      </div>
      {/* Desktop table */}
      <div className="flex-1 overflow-auto relative hidden md:block">
        {loading && <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10 flex items-center justify-center"><span className="material-icons text-slate-400 animate-pulse">hourglass_empty</span></div>}
        <Table>
          <TableHeader className="sticky top-0 bg-slate-50 z-10">
            <TableRow>
              {bulk && (
                <TableHead className="w-10 text-center">
                  <Checkbox
                    checked={allSelected ?? false}
                    onCheckedChange={() => {
                      if (allSelected) bulk.onDeselectAll();
                      else bulk.onSelectAll(leads.map(l => l.id));
                    }}
                  />
                </TableHead>
              )}
              <TableHead className="w-10 text-center uppercase text-[10px]">No.</TableHead>
              <TableHead className="uppercase text-[10px]">환자 정보</TableHead>
              <TableHead className="uppercase text-[10px]">유입일</TableHead>
              <TableHead className="uppercase text-[10px]">태그 및 뱃지</TableHead>
              <TableHead className="uppercase text-[10px]">상태 (인라인)</TableHead>
              <TableHead className="uppercase text-[10px]">담당자 (인라인)</TableHead>
              <TableHead className="uppercase text-[10px]">예약 일정</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((l, idx) => (
              <TableRow key={l.id} onClick={() => onSelect(l.id)} className={`cursor-pointer ${bulk?.selectedLeadIds.has(l.id) ? "bg-primary/5" : selectedId === l.id ? "bg-blue-50/50" : ""}`}>
                {bulk && (
                  <TableCell className="text-center" onClick={stop}>
                    <Checkbox checked={bulk.selectedLeadIds.has(l.id)} onCheckedChange={() => bulk.onToggleSelect(l.id)} />
                  </TableCell>
                )}
                <TableCell className="text-center text-xs text-slate-400 font-semibold">{rowNum(idx)}</TableCell>
                <TableCell><div className="flex items-center gap-2"><div><div className="font-bold text-slate-900">{l.name}</div><PhoneLink phone={l.phone} className="text-[10px] text-slate-500" /></div></div></TableCell>
                <TableCell className="text-xs text-slate-500">{fmtCreatedAt(l.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {l.age != null && <TagChip label={`${l.age}세`} tone="blue" />}
                    {l.gender && <TagChip label={l.gender === "남" ? "남" : "여"} tone={l.gender === "남" ? "blue" : "pink"} />}
                    {l.media && <TagChip label={l.media} tone="purple" />}
                    <TagChip label={l.careTag} tone={l.careTag.includes("임플란트") ? "indigo" : "slate"} />
                  </div>
                </TableCell>
                <TableCell onClick={stop}>
                  <select value={l.crmStatus} onChange={e => onStatus(l.id, e.target.value as CrmStatus)} className="text-[11px] font-bold border-slate-200 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-primary">
                    {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </TableCell>
                <TableCell onClick={stop}>
                  <select value={l.assigneeId || ""} onChange={e => onAssignee(l.id, e.target.value ? Number(e.target.value) : null)} className="text-[11px] border-slate-200 rounded px-2 py-1 bg-white">
                    <option value="">미할당</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </TableCell>
                <TableCell onClick={stop}>
                    <input type="datetime-local" defaultValue={toIsoLocal(l.appointmentAt)} onBlur={e => onSchedule(l.id, "appointmentAt", e.target.value)} className="text-[10px] border-slate-200 rounded px-1 py-0.5" />
                </TableCell>
              </TableRow>
            ))}
            {leads.length === 0 && !loading && (
              <TableRow><TableCell colSpan={bulk ? 8 : 7} className="py-20 text-center text-slate-400">조회된 데이터가 없습니다.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {/* Pagination bar */}
      {p && p.totalPages > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-slate-50 shrink-0 text-xs">
          <span className="text-slate-500 font-medium">총 {p.totalCount.toLocaleString()}건</span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-xs"
              disabled={p.currentPage === 0}
              onClick={() => p.onPageChange(p.currentPage - 1)}
            >
              <span className="material-icons text-sm">chevron_left</span>
            </Button>
            {pageNumbers.map((n, i) =>
              n === "..." ? (
                <span key={`dots-${i}`} className="px-1 text-slate-400">...</span>
              ) : (
                <Button
                  key={n}
                  variant={p.currentPage === n ? "default" : "outline"}
                  size="xs"
                  onClick={() => p.onPageChange(n as number)}
                  className="min-w-[28px]"
                >
                  {(n as number) + 1}
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="icon-xs"
              disabled={p.currentPage >= p.totalPages - 1}
              onClick={() => p.onPageChange(p.currentPage + 1)}
            >
              <span className="material-icons text-sm">chevron_right</span>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={p.pageSize}
              onChange={e => p.onPageSizeChange(Number(e.target.value))}
              className="border-slate-200 rounded px-2 py-1 bg-white text-xs"
            >
              <option value={20}>20건</option>
              <option value={50}>50건</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
