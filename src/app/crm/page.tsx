"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ViewMode = "kanban" | "list";

const statusOptions = [
  "신규인입",
  "1차부재",
  "2차부재",
  "3차부재",
  "노쇼",
  "응대중",
  "통화완료",
  "예약완료",
] as const;

type CrmStatus = (typeof statusOptions)[number];
type Scope = "all" | "mine";

type User = {
  id: number;
  name: string;
};

type Lead = {
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
};

function toIsoLocal(datetime: string | null) {
  if (!datetime) return "";
  const d = new Date(datetime);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

const statusStyles: Record<CrmStatus, { tone: string; badge: string; border: string }> = {
  신규인입: {
    tone: "bg-white",
    badge: "bg-red-50 text-red-600",
    border: "border-l-4 border-l-red-500",
  },
  "1차부재": {
    tone: "bg-white",
    badge: "bg-amber-50 text-amber-700",
    border: "border border-slate-100",
  },
  "2차부재": {
    tone: "bg-white",
    badge: "bg-amber-100 text-amber-800",
    border: "border border-slate-100",
  },
  "3차부재": {
    tone: "bg-white",
    badge: "bg-amber-200 text-amber-900",
    border: "border border-slate-100",
  },
  노쇼: {
    tone: "bg-slate-50",
    badge: "bg-slate-200 text-slate-800",
    border: "border border-slate-200",
  },
  응대중: {
    tone: "bg-white",
    badge: "bg-blue-50 text-blue-700",
    border: "border-2 border-[var(--primary)] ring-2 ring-[var(--primary)]/10",
  },
  통화완료: {
    tone: "bg-slate-50",
    badge: "bg-emerald-50 text-emerald-700",
    border: "border border-emerald-100",
  },
  예약완료: {
    tone: "bg-slate-50",
    badge: "bg-emerald-100 text-emerald-800",
    border: "border border-emerald-200",
  },
};

export default function CrmPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [scope, setScope] = useState<Scope>("all");
  const [includeDone, setIncludeDone] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [newUserName, setNewUserName] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/crm/users", { cache: "no-store" });
    const json = await res.json();
    const data = (json.data || []) as User[];
    setUsers(data);
    if (data.length > 0 && !selectedUserId) {
      setSelectedUserId(data[0].id);
    }
  }, [selectedUserId]);

  async function fetchLeads() {
    const qs = new URLSearchParams({
      scope,
      includeDone: String(includeDone),
      limit: "100",
    });
    if (selectedUserId) qs.set("assigneeId", String(selectedUserId));

    const res = await fetch(`/api/crm/leads?${qs.toString()}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "리드 조회 실패");
    setLeads((json.data || []) as Lead[]);
  }

  async function refreshAll() {
    try {
      setLoading(true);
      setError(null);
      await fetchLeads();
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers().catch(() => setError("상담원 목록 조회 실패"));
  }, [fetchUsers]);

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, includeDone, selectedUserId]);

  async function updateStatus(leadId: number, crmStatus: CrmStatus) {
    const previous = leads;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, crmStatus } : l)));

    try {
      const res = await fetch(`/api/crm/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crmStatus }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "상태 변경 실패");
      await refreshAll();
    } catch (e) {
      setLeads(previous);
      setError(e instanceof Error ? e.message : "상태 변경 실패");
    }
  }

  async function updateAssignee(leadId: number, assigneeId: number | null) {
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "상담원 할당 실패");
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "상담원 할당 실패");
    }
  }

  async function updateSchedule(
    leadId: number,
    field: "followUpAt" | "appointmentAt",
    value: string
  ) {
    try {
      const payload = { [field]: value ? new Date(value).toISOString() : null };
      const res = await fetch(`/api/crm/leads/${leadId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "일정 저장 실패");
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "일정 저장 실패");
    }
  }

  async function createUser() {
    const name = newUserName.trim();
    if (!name) return;

    try {
      const res = await fetch("/api/crm/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "상담원 생성 실패");
      setNewUserName("");
      await fetchUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "상담원 생성 실패");
    }
  }

  const leadByStatus = useMemo(() => {
    const grouped: Record<CrmStatus, Lead[]> = {
      "신규인입": [],
      "1차부재": [],
      "2차부재": [],
      "3차부재": [],
      노쇼: [],
      응대중: [],
      통화완료: [],
      예약완료: [],
    };

    leads.forEach((l) => {
      grouped[l.crmStatus].push(l);
    });

    return grouped;
  }, [leads]);

  const totalFollowUpsToday = useMemo(() => {
    const today = new Date();
    return leads.filter((l) => {
      if (!l.followUpAt) return false;
      const d = new Date(l.followUpAt);
      return d.toDateString() === today.toDateString();
    }).length;
  }, [leads]);

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) || null,
    [leads, selectedLeadId]
  );

  return (
    <div className="min-h-screen bg-[var(--background)] text-slate-900">
      <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-500">세이브 마케팅</div>
              <h1 className="text-2xl font-bold text-slate-900">CRM 대시보드</h1>
              <p className="text-sm text-slate-500">우선순위 기반 아웃바운드 상담 현황</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("kanban")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition-all ${
                  viewMode === "kanban"
                    ? "bg-[var(--primary)] text-white shadow-md"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                칸반 보드
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition-all ${
                  viewMode === "list"
                    ? "bg-[var(--primary)] text-white shadow-md"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                리스트 보기
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-5">
            <select
              value={selectedUserId ?? ""}
              onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : null)}
              className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="">상담원 선택</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>

            <div className="flex rounded-xl border border-[var(--border)] bg-white p-1 text-sm shadow-sm">
              <button
                onClick={() => setScope("all")}
                className={`flex-1 rounded-lg px-3 py-1 font-medium ${
                  scope === "all" ? "bg-[var(--primary)] text-white" : "text-slate-600"
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setScope("mine")}
                className={`flex-1 rounded-lg px-3 py-1 font-medium ${
                  scope === "mine" ? "bg-[var(--primary)] text-white" : "text-slate-600"
                }`}
              >
                내 할당
              </button>
            </div>

            <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm shadow-sm">
              <input
                type="checkbox"
                checked={includeDone}
                onChange={(e) => setIncludeDone(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              완료/응대중 포함
            </label>

            <div className="flex gap-2 md:col-span-2">
              <input
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="상담원 추가"
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm shadow-sm"
              />
              <button
                onClick={createUser}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                추가
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <StatCard label="전체 리드" value={leads.length} hint="limit 100" />
            <StatCard label="오늘 팔로업" value={totalFollowUpsToday} hint="followUpAt=오늘" />
            <StatCard label="할당된 상담원" value={users.length} hint="활성 상담원" />
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 shadow-sm">
              {error}
            </div>
          )}

          <div className="mt-5">
            {viewMode === "kanban" ? (
              <KanbanBoard
                grouped={leadByStatus}
                users={users}
                onStatusChange={updateStatus}
                onAssigneeChange={updateAssignee}
                onScheduleChange={updateSchedule}
                onSelectLead={setSelectedLeadId}
                selectedLeadId={selectedLeadId}
              />
            ) : (
              <LeadTable
                leads={leads}
                users={users}
                onStatusChange={updateStatus}
                onAssigneeChange={updateAssignee}
                onScheduleChange={updateSchedule}
                loading={loading}
                onSelectLead={setSelectedLeadId}
              />
            )}
          </div>
        </div>
      </div>

      <LeadDrawer
        lead={selectedLead}
        onClose={() => setSelectedLeadId(null)}
        users={users}
        onStatusChange={updateStatus}
        onAssigneeChange={updateAssignee}
        onScheduleChange={updateSchedule}
      />
    </div>
  );
}

type StatCardProps = { label: string; value: number | string; hint?: string };

function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow)]">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

type KanbanBoardProps = {
  grouped: Record<CrmStatus, Lead[]>;
  users: User[];
  onStatusChange: (id: number, s: CrmStatus) => void;
  onAssigneeChange: (id: number, assigneeId: number | null) => void;
  onScheduleChange: (id: number, field: "followUpAt" | "appointmentAt", value: string) => void;
  onSelectLead: (id: number | null) => void;
  selectedLeadId: number | null;
};

function KanbanBoard({ grouped, users, onStatusChange, onAssigneeChange, onScheduleChange, onSelectLead, selectedLeadId }: KanbanBoardProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {statusOptions.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          leads={grouped[status] || []}
          users={users}
          onStatusChange={onStatusChange}
          onAssigneeChange={onAssigneeChange}
          onScheduleChange={onScheduleChange}
          onSelectLead={onSelectLead}
          selectedLeadId={selectedLeadId}
        />
      ))}
    </div>
  );
}

type KanbanColumnProps = {
  status: CrmStatus;
  leads: Lead[];
  users: User[];
  onStatusChange: (id: number, s: CrmStatus) => void;
  onAssigneeChange: (id: number, assigneeId: number | null) => void;
  onScheduleChange: (id: number, field: "followUpAt" | "appointmentAt", value: string) => void;
  onSelectLead: (id: number | null) => void;
  selectedLeadId: number | null;
};

function KanbanColumn({ status, leads, users, onStatusChange, onAssigneeChange, onScheduleChange, onSelectLead, selectedLeadId }: KanbanColumnProps) {
  const headerColors: Record<CrmStatus, string> = {
    신규인입: "bg-red-500",
    "1차부재": "bg-amber-400",
    "2차부재": "bg-amber-500",
    "3차부재": "bg-amber-600",
    노쇼: "bg-slate-400",
    응대중: "bg-[var(--primary)]",
    통화완료: "bg-emerald-500",
    예약완료: "bg-emerald-600",
  };

  return (
    <div className="w-80 flex-shrink-0 rounded-2xl border border-[var(--border)] bg-slate-50/70 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${headerColors[status]}`} />
          <h3 className="text-sm font-semibold text-slate-800">{status}</h3>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 shadow-sm">
            {leads.length}
          </span>
        </div>
      </div>
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
        {leads.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-3 py-6 text-center text-xs text-slate-400">
            항목 없음
          </div>
        )}
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            users={users}
            onStatusChange={onStatusChange}
            onAssigneeChange={onAssigneeChange}
            onScheduleChange={onScheduleChange}
            onSelect={() => onSelectLead(lead.id)}
            selected={selectedLeadId === lead.id}
          />
        ))}
      </div>
    </div>
  );
}

type LeadCardProps = {
  lead: Lead;
  users: User[];
  onStatusChange: (id: number, s: CrmStatus) => void;
  onAssigneeChange: (id: number, assigneeId: number | null) => void;
  onScheduleChange: (id: number, field: "followUpAt" | "appointmentAt", value: string) => void;
  onSelect: () => void;
  selected: boolean;
};

function LeadCard({ lead, users, onStatusChange, onAssigneeChange, onScheduleChange, onSelect, selected }: LeadCardProps) {
  const style = statusStyles[lead.crmStatus];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect();
      }}
      className={`group cursor-pointer rounded-xl p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${style.tone} ${style.border} ${
        selected ? "ring-2 ring-[var(--primary)]/40" : ""
      }`}
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">P{lead.priorityRank}</span>
          <div>
            <div className="font-semibold text-slate-900">{lead.name}</div>
            <div className="text-xs text-slate-500">{lead.phone}</div>
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}>{lead.crmStatus}</span>
      </div>

      <div className="mb-2 flex flex-wrap gap-1 text-[11px] font-medium">
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">{lead.careTag}</span>
        {lead.isSenior65Plus ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">만 65세 이상</span>
        ) : lead.monthsUntil65 !== null ? (
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">65세까지 {lead.monthsUntil65}개월</span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">생년월일 없음</span>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between text-[11px] text-slate-500">
        <span>최근콜 {lead.lastCallAt ? formatDateTime(lead.lastCallAt) : "-"}</span>
        {lead.followUpAt && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
            팔로업 {formatTime(lead.followUpAt)}
          </span>
        )}
        {lead.appointmentAt && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            예약 {formatTime(lead.appointmentAt)}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 text-xs">
        <select
          value={lead.crmStatus}
          onChange={(e) => onStatusChange(lead.id, e.target.value as CrmStatus)}
          className="w-full rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={lead.assigneeId ?? ""}
          onChange={(e) => onAssigneeChange(lead.id, e.target.value ? Number(e.target.value) : null)}
          className="w-full rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs"
        >
          <option value="">미할당</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="datetime-local"
            defaultValue={toIsoLocal(lead.followUpAt)}
            onBlur={(e) => onScheduleChange(lead.id, "followUpAt", e.target.value)}
            className="w-1/2 rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs"
            aria-label="팔로업 예약"
          />
          <input
            type="datetime-local"
            defaultValue={toIsoLocal(lead.appointmentAt)}
            onBlur={(e) => onScheduleChange(lead.id, "appointmentAt", e.target.value)}
            className="w-1/2 rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs"
            aria-label="예약 시간"
          />
        </div>
      </div>
    </div>
  );
}

type LeadTableProps = {
  leads: Lead[];
  users: User[];
  onStatusChange: (id: number, s: CrmStatus) => void;
  onAssigneeChange: (id: number, assigneeId: number | null) => void;
  onScheduleChange: (id: number, field: "followUpAt" | "appointmentAt", value: string) => void;
  loading: boolean;
  onSelectLead: (id: number | null) => void;
};

function LeadTable({ leads, users, onStatusChange, onAssigneeChange, onScheduleChange, loading, onSelectLead }: LeadTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2">우선</th>
            <th className="px-3 py-2">환자</th>
            <th className="px-3 py-2">태그</th>
            <th className="px-3 py-2">상태</th>
            <th className="px-3 py-2">할당</th>
            <th className="px-3 py-2">팔로업</th>
            <th className="px-3 py-2">예약</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.id}
              className="border-t border-[var(--border)] align-top hover:bg-slate-50"
              onClick={() => onSelectLead(lead.id)}
            >
              <td className="px-3 py-3 font-semibold text-slate-800">P{lead.priorityRank}</td>
              <td className="px-3 py-3">
                <div className="font-semibold text-slate-900">{lead.name}</div>
                <div className="text-xs text-slate-500">{lead.phone}</div>
                <div className="text-xs text-slate-400">최근콜 {lead.lastCallAt ? formatDateTime(lead.lastCallAt) : "-"}</div>
              </td>
              <td className="px-3 py-3">
                <div className="mb-1 flex flex-wrap gap-1 text-[11px] font-medium">
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">{lead.careTag}</span>
                  {lead.isSenior65Plus ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">만 65세 이상</span>
                  ) : lead.monthsUntil65 !== null ? (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">65세까지 {lead.monthsUntil65}개월</span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">생년월일 없음</span>
                  )}
                </div>
                <div className="text-xs text-slate-500">카테고리: {lead.category}</div>
              </td>
              <td className="px-3 py-3">
                <select
                  value={lead.crmStatus}
                  onChange={(e) => onStatusChange(lead.id, e.target.value as CrmStatus)}
                  className="rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs"
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-3">
                <select
                  value={lead.assigneeId ?? ""}
                  onChange={(e) => onAssigneeChange(lead.id, e.target.value ? Number(e.target.value) : null)}
                  className="rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs"
                >
                  <option value="">미할당</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-3">
                <input
                  type="datetime-local"
                  defaultValue={toIsoLocal(lead.followUpAt)}
                  onBlur={(e) => onScheduleChange(lead.id, "followUpAt", e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs"
                />
              </td>
              <td className="px-3 py-3">
                <input
                  type="datetime-local"
                  defaultValue={toIsoLocal(lead.appointmentAt)}
                  onBlur={(e) => onScheduleChange(lead.id, "appointmentAt", e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs"
                />
              </td>
            </tr>
          ))}
          {leads.length === 0 && !loading && (
            <tr>
              <td colSpan={7} className="px-3 py-10 text-center text-sm text-slate-500">
                표시할 리드가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

type LeadDrawerProps = {
  lead: Lead | null;
  onClose: () => void;
  users: User[];
  onStatusChange: (id: number, s: CrmStatus) => void;
  onAssigneeChange: (id: number, assigneeId: number | null) => void;
  onScheduleChange: (id: number, field: "followUpAt" | "appointmentAt", value: string) => void;
};

function LeadDrawer({ lead, onClose, users, onStatusChange, onAssigneeChange, onScheduleChange }: LeadDrawerProps) {
  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20 backdrop-blur-sm">
      <div className="h-full w-full max-w-[420px] translate-x-0 transform bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[var(--border)] p-5">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-500">리드 상세</div>
            <div className="text-lg font-bold text-slate-900">{lead.name}</div>
            <div className="text-sm text-slate-500">{lead.phone}</div>
            <div className="flex gap-2 text-xs text-slate-500">
              <span>등록 {formatDateTime(lead.createdAt)}</span>
              <span className="text-slate-300">•</span>
              <span>상태 {lead.crmStatus}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
          <div className="space-y-2">
            <div className="font-semibold text-slate-700">상태</div>
            <select
              value={lead.crmStatus}
              onChange={(e) => onStatusChange(lead.id, e.target.value as CrmStatus)}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-slate-700">상담원</div>
            <select
              value={lead.assigneeId ?? ""}
              onChange={(e) => onAssigneeChange(lead.id, e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2"
            >
              <option value="">미할당</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-700">팔로업</div>
              <input
                type="datetime-local"
                defaultValue={toIsoLocal(lead.followUpAt)}
                onBlur={(e) => onScheduleChange(lead.id, "followUpAt", e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2"
              />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-700">예약</div>
              <input
                type="datetime-local"
                defaultValue={toIsoLocal(lead.appointmentAt)}
                onBlur={(e) => onScheduleChange(lead.id, "appointmentAt", e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2"
              />
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-500">
            <div>카테고리: {lead.category}</div>
            <div>케어태그: {lead.careTag}</div>
            <div>최근콜: {lead.lastCallAt ? formatDateTime(lead.lastCallAt) : "-"}</div>
          </div>
        </div>

        <div className="border-t border-[var(--border)] p-4 text-right">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}
