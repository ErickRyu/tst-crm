"use client";

import type { Scope, User } from "../types";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface FilterPanelProps {
  filtersOpen: boolean;
  scope: Scope;
  setScope: (v: Scope) => void;
  users: User[];
  selectedUserId: number | null;
  setSelectedUserId: (v: number | null) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  sortOrder: "asc" | "desc";
  setSortOrder: (v: "asc" | "desc" | ((prev: "asc" | "desc") => "asc" | "desc")) => void;
  activeFilterCount: number;
  resetFilters: () => void;
}

export function FilterPanel({
  filtersOpen,
  scope,
  setScope,
  users,
  selectedUserId,
  setSelectedUserId,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  sortOrder,
  setSortOrder,
  activeFilterCount,
  resetFilters,
}: FilterPanelProps) {
  return (
    <div className={`overflow-hidden transition-all duration-200 ease-in-out bg-card border-b border-border ${filtersOpen ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0 border-b-0"}`}>
      <div className="flex flex-col gap-3 px-3 py-3 md:flex-row md:items-start md:gap-6 md:px-6">
        {/* 범위 */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400 font-medium">범위</span>
          <ToggleGroup
            type="single"
            value={scope}
            onValueChange={(v) => {
              if (!v) return;
              if (v === "all") { setScope("all"); setSelectedUserId(null); }
              else { setScope("mine"); if (users.length > 0 && !selectedUserId) setSelectedUserId(users[0].id); }
            }}
            className="bg-slate-100 p-1 rounded-lg"
          >
            <ToggleGroupItem value="all" className="px-3 py-1.5 text-[11px] font-bold h-auto data-[state=on]:bg-primary data-[state=on]:text-white">전체보기</ToggleGroupItem>
            <ToggleGroupItem value="mine" className="px-3 py-1.5 text-[11px] font-bold h-auto data-[state=on]:bg-primary data-[state=on]:text-white">내 할당</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="hidden md:block w-px h-12 bg-slate-200 self-center" />

        {/* 기간 */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400 font-medium">기간</span>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {([
                ["전체", "", ""],
                ["오늘", 0, 0],
                ["7일", 7, 0],
                ["30일", 30, 0],
              ] as [string, number | "", number | ""][]).map(([label, daysBack]) => {
                const isActive = daysBack === ""
                  ? !dateFrom && !dateTo
                  : (() => {
                      const d = new Date();
                      d.setDate(d.getDate() - (daysBack as number));
                      const pad = (n: number) => String(n).padStart(2, "0");
                      const expected = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                      const today = new Date();
                      const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
                      return dateFrom === expected && dateTo === todayStr;
                    })();
                return (
                  <button
                    key={label}
                    onClick={() => {
                      if (daysBack === "") {
                        setDateFrom("");
                        setDateTo("");
                      } else {
                        const d = new Date();
                        const pad = (n: number) => String(n).padStart(2, "0");
                        const todayStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                        d.setDate(d.getDate() - (daysBack as number));
                        const fromStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                        setDateFrom(fromStr);
                        setDateTo(todayStr);
                      }
                    }}
                    className={`px-2 py-1 text-[10px] md:px-3 md:py-1.5 md:text-xs font-medium rounded transition-all ${isActive ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1">
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-7 bg-slate-100 border-none px-2 text-[11px] md:text-xs w-auto" />
              <span className="text-slate-400 text-xs">~</span>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-7 bg-slate-100 border-none px-2 text-[11px] md:text-xs w-auto" />
            </div>
          </div>
        </div>

        <div className="hidden md:block w-px h-12 bg-slate-200 self-center" />

        {/* 정렬/옵션 */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400 font-medium">정렬 / 옵션</span>
          <div className="flex items-center gap-3">
            <button onClick={() => setSortOrder((s: "asc" | "desc") => s === "desc" ? "asc" : "desc")} className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
              <span className="material-icons text-sm">swap_vert</span>
              <span>{sortOrder === "desc" ? "최신순" : "오래된순"}</span>
            </button>
          </div>
        </div>

        {/* 초기화 */}
        {activeFilterCount > 0 && (
          <>
            <div className="hidden md:block w-px h-12 bg-slate-200 self-center" />
            <div className="flex flex-col gap-1 md:self-center">
              <button onClick={resetFilters} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold text-red-500 hover:bg-red-50 transition-colors md:mt-4">
                <span className="material-icons text-sm">restart_alt</span>
                초기화
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
