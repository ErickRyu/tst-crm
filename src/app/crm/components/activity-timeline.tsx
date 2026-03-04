"use client";

import { useState } from "react";
import type { ActivityItem } from "../types";

const ACTION_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  status_change: { icon: "swap_horiz", color: "text-blue-600", bg: "bg-blue-100" },
  assign: { icon: "person", color: "text-violet-600", bg: "bg-violet-100" },
  schedule_appointment: { icon: "event", color: "text-emerald-600", bg: "bg-emerald-100" },
  schedule_follow_up: { icon: "phone_callback", color: "text-amber-600", bg: "bg-amber-100" },
  memo_save: { icon: "edit_note", color: "text-slate-600", bg: "bg-slate-100" },
  sms_sent: { icon: "sms", color: "text-pink-600", bg: "bg-pink-100" },
};

function getConfig(type: string) {
  return ACTION_CONFIG[type] || { icon: "info", color: "text-slate-500", bg: "bg-slate-100" };
}

function relativeTime(dateStr: string) {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  const date = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

function ActivityEntry({ item }: { item: ActivityItem }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = getConfig(item.type);
  const expandable = !!item.fullDetail && item.fullDetail !== item.detail;

  return (
    <div key={item.id} className="relative flex items-start gap-3 py-2">
      {/* Icon dot */}
      <div
        className={`absolute -left-6 w-[22px] h-[22px] rounded-full flex items-center justify-center ${cfg.bg} shrink-0 z-10`}
      >
        <span className={`material-icons ${cfg.color}`} style={{ fontSize: "13px" }}>
          {cfg.icon}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div
          className={`text-xs text-slate-700 leading-relaxed ${expandable ? "cursor-pointer" : ""}`}
          onClick={expandable ? () => setExpanded(!expanded) : undefined}
        >
          <span className={expanded ? "whitespace-pre-wrap" : ""}>
            {expanded ? item.fullDetail : (item.detail || item.type)}
          </span>
          {expandable && (
            <button
              type="button"
              className="ml-1 text-[10px] text-blue-500 hover:text-blue-700 font-medium inline-flex items-center gap-0.5"
            >
              {expanded ? "접기" : "더보기"}
              <span className="material-icons" style={{ fontSize: "11px" }}>
                {expanded ? "expand_less" : "expand_more"}
              </span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-slate-400">{item.actorName}</span>
          <span className="text-[10px] text-slate-300">·</span>
          <span className="text-[10px] text-slate-400">{relativeTime(item.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

interface ActivityTimelineProps {
  activities: ActivityItem[];
  loading?: boolean;
}

export function ActivityTimeline({ activities, loading }: ActivityTimelineProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="p-4 md:px-8 md:py-3 border-t border-slate-200 bg-white">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full text-left mb-2"
      >
        <span className="material-icons text-slate-400 text-sm">
          {collapsed ? "expand_more" : "expand_less"}
        </span>
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">활동 이력</h4>
        {activities.length > 0 && (
          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">
            {activities.length}
          </span>
        )}
      </button>

      {!collapsed && (
        <>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-3">
              <span className="material-icons animate-spin text-sm">refresh</span>
              불러오는 중...
            </div>
          )}

          {!loading && activities.length === 0 && (
            <div className="text-sm text-slate-400 py-3">활동 이력이 없습니다.</div>
          )}

          {!loading && activities.length > 0 && (
            <div className="relative pl-6 space-y-0">
              {/* Vertical timeline line */}
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-slate-200" />

              {activities.map((item) => (
                <ActivityEntry key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
