"use client";

import type { ViewMode } from "../types";

export function SkeletonOverlay({ viewMode }: { viewMode: ViewMode }) {
  return (
    <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-slate-500">
        <span className="material-icons animate-spin">refresh</span>
        <span className="text-xs font-medium">{viewMode === "kanban" ? "칸반 데이터를 불러오는 중" : viewMode === "list" ? "리스트 데이터를 불러오는 중" : "캘린더를 불러오는 중"}</span>
      </div>
    </div>
  );
}
