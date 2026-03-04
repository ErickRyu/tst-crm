export type ViewMode = "kanban" | "list" | "calendar";
export type Scope = "all" | "mine";

export const statusOptions = [
  "신규인입",
  "1차부재",
  "2차부재",
  "3차부재",
  "노쇼",
  "응대중",
  "통화완료",
  "예약완료",
] as const;

export type CrmStatus = (typeof statusOptions)[number];

export interface User {
  id: number;
  name: string;
}

export interface Lead {
  id: number;
  name: string;
  phone: string;
  category: string;
  crmStatus: CrmStatus;
  assigneeId: number | null;
  followUpAt: string | null;
  appointmentAt: string | null;
  lastCallAt: string | null;
  createdAt: string;
  isSenior65Plus: boolean;
  monthsUntil65: number | null;
  careTag: string;
  priorityRank: number;
  version: number;
  updatedAt: string;
  contactFailCount?: number;
  age: number | null;
  gender: string | null;
  media: string;
  memoBody: string | null;
}

export interface CalendarEvent {
  id: string;
  leadId: number;
  patientName: string;
  phone: string;
  type: "follow_up" | "appointment";
  at: string;
}

export interface LeadMemo {
  id: number;
  leadId: number;
  authorName: string;
  body: string;
  version?: number;
  updatedAt?: string;
  createdAt: string;
}

export interface SmsTemplate {
  key: string;
  label: string;
  icon: string;
  body: string;
  msgType: "SMS" | "LMS";
  statuses?: string[];
}

export interface PaginationProps {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export interface ViewProps {
  leads: Lead[];
  users: User[];
  onSelect: (id: number) => void;
  selectedId: number | null;
  onStatus: (id: number, s: CrmStatus) => Promise<void>;
  onAssignee: (id: number, userId: number | null) => Promise<void>;
  onSchedule: (id: number, field: string, val: string) => Promise<void>;
  loading?: boolean;
  pagination?: PaginationProps;
}

export interface KanbanProps {
  grouped: Record<CrmStatus, Lead[]>;
  users: User[];
  onSelect: (id: number) => void;
  selectedId: number | null;
  onStatus: (id: number, s: CrmStatus) => Promise<void>;
  onSaveMemo: (leadId: number, body: string) => Promise<void>;
  draggingId: number | null;
  setDraggingId: (id: number | null) => void;
  dragOverStatus: CrmStatus | null;
  setDragOverStatus: (s: CrmStatus | null) => void;
  doneTotalCounts: Record<CrmStatus, number>;
  kanbanDoneDays: 7 | 30 | null;
  onKanbanDoneDaysChange: (v: 7 | 30 | null) => void;
}

export function toIsoLocal(datetime: string | null) {
  if (!datetime) return "";
  const d = new Date(datetime);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function fmtCreatedAt(dt: string) {
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const statusStyles: Record<CrmStatus, { tone: string; badge: string; border: string; dot: string }> = {
  신규인입: { tone: "bg-white", badge: "bg-red-50 text-red-600", border: "border-l-4 border-l-red-500", dot: "bg-red-500" },
  "1차부재": { tone: "bg-white", badge: "bg-amber-50 text-amber-700", border: "border border-slate-200", dot: "bg-amber-400" },
  "2차부재": { tone: "bg-white", badge: "bg-amber-100 text-amber-800", border: "border border-slate-200", dot: "bg-amber-500" },
  "3차부재": { tone: "bg-white", badge: "bg-amber-200 text-amber-900", border: "border border-slate-200", dot: "bg-amber-600" },
  노쇼: { tone: "bg-slate-50", badge: "bg-slate-200 text-slate-800", border: "border border-slate-300", dot: "bg-slate-400" },
  응대중: { tone: "bg-white", badge: "bg-blue-50 text-blue-700", border: "border-2 border-primary ring-2 ring-primary/10", dot: "bg-primary" },
  통화완료: { tone: "bg-slate-50", badge: "bg-emerald-50 text-emerald-700", border: "border border-emerald-100", dot: "bg-emerald-500" },
  예약완료: { tone: "bg-slate-50", badge: "bg-emerald-100 text-emerald-800", border: "border border-emerald-200", dot: "bg-emerald-600" },
};
