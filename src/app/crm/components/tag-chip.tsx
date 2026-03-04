"use client";

import { Badge } from "@/components/ui/badge";

const toneClasses = {
  indigo: "bg-indigo-50 text-indigo-700 border-transparent",
  slate: "bg-slate-100 text-slate-700 border-transparent",
  amber: "bg-amber-50 text-amber-700 border-transparent",
  blue: "bg-blue-50 text-blue-700 border-transparent",
  pink: "bg-pink-50 text-pink-700 border-transparent",
  purple: "bg-purple-50 text-purple-700 border-transparent",
  gray: "bg-slate-50 text-slate-500 border-transparent",
  green: "bg-emerald-50 text-emerald-700 border-transparent",
} as const;

export type TagTone = keyof typeof toneClasses;

export function TagChip({ label, tone }: { label: string; tone: TagTone }) {
  if (!label) return null;
  return (
    <Badge
      variant="secondary"
      className={`px-2 py-1 text-[11px] md:px-1.5 md:py-0.5 md:text-[10px] rounded font-bold ${toneClasses[tone]}`}
      title={label}
      aria-label={label}
    >
      {label}
    </Badge>
  );
}
