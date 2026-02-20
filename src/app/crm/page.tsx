"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
type ViewMode = "list" | "calendar";

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

type CalendarEvent = {
  id: string;
  leadId: number;
  patientName: string;
  phone: string;
  type: "follow_up" | "appointment";
  at: string;
};

function getWeekRange(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const mondayDiff = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + mondayDiff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function toIsoLocal(datetime: string | null) {
  if (!datetime) return "";
  const d = new Date(datetime);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function CrmPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [scope, setScope] = useState<Scope>("all");
  const [includeDone, setIncludeDone] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [newUserName, setNewUserName] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const week = useMemo(() => getWeekRange(new Date()), []);

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

  async function fetchCalendar() {
    if (!selectedUserId) {
      setEvents([]);
      return;
    }

    const qs = new URLSearchParams({
      assigneeId: String(selectedUserId),
      from: week.start.toISOString(),
      to: week.end.toISOString(),
    });

    const res = await fetch(`/api/crm/calendar?${qs.toString()}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "캘린더 조회 실패");
    setEvents((json.data || []) as CalendarEvent[]);
  }

  async function refreshAll() {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([fetchLeads(), fetchCalendar()]);
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

  const dayColumns = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(week.start);
      d.setDate(week.start.getDate() + i);
      return d;
    });
  }, [week.start]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-semibold">세이브 마케팅 CRM</h1>
              <p className="text-sm text-slate-500">우선순위 리스트 기반 아웃바운드 대시보드</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-lg px-3 py-2 text-sm ${
                  viewMode === "list" ? "bg-slate-900 text-white" : "bg-slate-100"
                }`}
              >
                List View
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`rounded-lg px-3 py-2 text-sm ${
                  viewMode === "calendar" ? "bg-slate-900 text-white" : "bg-slate-100"
                }`}
              >
                Calendar View
              </button>
            </div>
          </div>

          <div className="mb-4 grid gap-2 md:grid-cols-5">
            <select
              value={selectedUserId ?? ""}
              onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : null)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">상담원 선택</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>

            <div className="flex rounded-lg border border-slate-300 bg-white p-1 text-sm">
              <button
                onClick={() => setScope("all")}
                className={`flex-1 rounded-md px-2 py-1 ${scope === "all" ? "bg-slate-900 text-white" : ""}`}
              >
                전체
              </button>
              <button
                onClick={() => setScope("mine")}
                className={`flex-1 rounded-md px-2 py-1 ${scope === "mine" ? "bg-slate-900 text-white" : ""}`}
              >
                내 할당
              </button>
            </div>

            <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={includeDone}
                onChange={(e) => setIncludeDone(e.target.checked)}
              />
              완료/응대중 포함
            </label>

            <div className="flex gap-2 md:col-span-2">
              <input
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="상담원 추가"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <button
                onClick={createUser}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
              >
                추가
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          {viewMode === "list" ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">우선</th>
                    <th className="px-3 py-2">환자</th>
                    <th className="px-3 py-2">타겟</th>
                    <th className="px-3 py-2">상태</th>
                    <th className="px-3 py-2">할당</th>
                    <th className="px-3 py-2">팔로업</th>
                    <th className="px-3 py-2">예약</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-2 font-semibold text-slate-700">P{lead.priorityRank}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{lead.name}</div>
                        <div className="text-xs text-slate-500">{lead.phone}</div>
                        <div className="text-xs text-slate-400">
                          최근콜: {lead.lastCallAt ? new Date(lead.lastCallAt).toLocaleString() : "-"}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="mb-1">
                          {lead.isSenior65Plus ? (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                              만 65세 이상
                            </span>
                          ) : lead.monthsUntil65 === null ? (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                              생년월일 없음
                            </span>
                          ) : (
                            <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-800">
                              65세까지 {lead.monthsUntil65}개월
                            </span>
                          )}
                        </div>
                        <span className="rounded-md bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700">
                          {lead.careTag}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={lead.crmStatus}
                          onChange={(e) => updateStatus(lead.id, e.target.value as CrmStatus)}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1"
                        >
                          {statusOptions.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={lead.assigneeId ?? ""}
                          onChange={(e) =>
                            updateAssignee(lead.id, e.target.value ? Number(e.target.value) : null)
                          }
                          className="rounded-md border border-slate-300 bg-white px-2 py-1"
                        >
                          <option value="">미할당</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="datetime-local"
                          defaultValue={toIsoLocal(lead.followUpAt)}
                          onBlur={(e) => updateSchedule(lead.id, "followUpAt", e.target.value)}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="datetime-local"
                          defaultValue={toIsoLocal(lead.appointmentAt)}
                          onBlur={(e) => updateSchedule(lead.id, "appointmentAt", e.target.value)}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1"
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
          ) : (
            <div className="grid gap-2 md:grid-cols-7">
              {dayColumns.map((day) => {
                const key = day.toDateString();
                const list = events.filter((ev) => new Date(ev.at).toDateString() === key);

                return (
                  <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="mb-2 text-xs font-semibold text-slate-600">
                      {day.toLocaleDateString("ko-KR", {
                        month: "numeric",
                        day: "numeric",
                        weekday: "short",
                      })}
                    </div>
                    <div className="space-y-2">
                      {list.map((ev) => (
                        <div
                          key={ev.id}
                          className={`rounded-md px-2 py-1 text-xs ${
                            ev.type === "appointment"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          <div className="font-semibold">
                            {ev.type === "appointment" ? "예약" : "팔로업"}
                          </div>
                          <div>{new Date(ev.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</div>
                          <div>{ev.patientName}</div>
                        </div>
                      ))}
                      {list.length === 0 && <div className="text-xs text-slate-400">일정 없음</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
