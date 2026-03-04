"use client";

import type { RefObject } from "react";
import type { ViewMode } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface PrimaryBarProps {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  loading: boolean;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  filtersOpen: boolean;
  setFiltersOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  activeFilterCount: number;
  excelMenuOpen: boolean;
  setExcelMenuOpen: (v: boolean) => void;
  excelDownloading: boolean;
  downloadExcel: (allWithDone: boolean) => void;
}

export function PrimaryBar({
  viewMode,
  setViewMode,
  loading,
  searchTerm,
  setSearchTerm,
  searchInputRef,
  filtersOpen,
  setFiltersOpen,
  activeFilterCount,
  excelMenuOpen,
  setExcelMenuOpen,
  excelDownloading,
  downloadExcel,
}: PrimaryBarProps) {
  return (
    <header className="flex flex-wrap items-center gap-2 px-3 py-2 md:px-6 bg-card border-b border-border shrink-0">
      <h1 className="text-base md:text-xl font-bold shrink-0">접수 현황</h1>
      <ToggleGroup
        type="single"
        value={viewMode}
        onValueChange={(v) => { if (v) setViewMode(v as ViewMode); }}
        disabled={loading}
        className="bg-slate-100 p-1 rounded-lg shrink-0"
      >
        <ToggleGroupItem value="kanban" className="px-2 py-1 text-[10px] md:px-3 md:py-1.5 md:text-xs h-auto data-[state=on]:bg-white data-[state=on]:text-slate-900 data-[state=on]:shadow-sm">
          <span className="material-icons text-sm">view_kanban</span><span className="hidden sm:inline"> 칸반</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="list" className="px-2 py-1 text-[10px] md:px-3 md:py-1.5 md:text-xs h-auto data-[state=on]:bg-white data-[state=on]:text-slate-900 data-[state=on]:shadow-sm">
          <span className="material-icons text-sm">view_list</span><span className="hidden sm:inline"> 리스트</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="calendar" className="px-2 py-1 text-[10px] md:px-3 md:py-1.5 md:text-xs h-auto data-[state=on]:bg-white data-[state=on]:text-slate-900 data-[state=on]:shadow-sm">
          <span className="material-icons text-sm">calendar_today</span><span className="hidden sm:inline"> 캘린더</span>
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="flex-1" />
      <div className="relative w-full md:w-auto md:flex-1 min-w-0 md:max-w-xs order-last md:order-none">
        <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">search</span>
        <Input ref={searchInputRef} type="text" placeholder="환자명, 전화번호..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-slate-100 border-none pl-9 pr-4" />
      </div>
      <Button
        variant={filtersOpen ? "default" : "secondary"}
        size="sm"
        onClick={() => setFiltersOpen((v: boolean) => !v)}
        className="relative shrink-0"
      >
        <span className="material-icons text-sm">tune</span>
        <span className="hidden sm:inline">필터</span>
        {activeFilterCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{activeFilterCount}</span>
        )}
      </Button>
      {/* 엑셀 다운로드 */}
      <DropdownMenu open={excelMenuOpen} onOpenChange={setExcelMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="green"
            size="sm"
            disabled={excelDownloading}
          >
            <span className="material-icons text-sm">{excelDownloading ? "hourglass_empty" : "download"}</span>
            <span className="hidden sm:inline">{excelDownloading ? "다운로드 중..." : "엑셀"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[180px]">
          <DropdownMenuItem onClick={() => downloadExcel(false)}>
            <span className="material-icons text-sm text-emerald-600">filter_alt</span>
            현재 필터 다운로드
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => downloadExcel(true)}>
            <span className="material-icons text-sm text-blue-600">select_all</span>
            전체 리스트 (Archive 포함)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
