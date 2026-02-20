"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState, Dispatch, SetStateAction, SyntheticEvent } from "react";

type ViewMode = "kanban" | "list" | "calendar";

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

function toIsoLocal(datetime: string | null) {
  if (!datetime) return "";
  const d = new Date(datetime);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

const statusStyles: Record<CrmStatus, { tone: string; badge: string; border: string; header: string }> = {
  신규인입: {
    tone: "bg-white",
    badge: "bg-red-50 text-red-600",
    border: "border-l-4 border-l-red-500",
    header: "bg-red-500",
  },
  "1차부재": {
    tone: "bg-white",
    badge: "bg-amber-50 text-amber-700",
    border: "border border-slate-100",
    header: "bg-amber-400",
  },
  "2차부재": {
    tone: "bg-white",
    badge: "bg-amber-100 text-amber-800",
    border: "border border-slate-100",
    header: "bg-amber-500",
  },
  "3차부재": {
    tone: "bg-white",
    badge: "bg-amber-200 text-amber-900",
    border: "border border-slate-100",
    header: "bg-amber-600",
  },
  노쇼: {
    tone: "bg-slate-50",
    badge: "bg-slate-200 text-slate-800",
    border: "border border-slate-200",
    header: "bg-slate-400",
  },
  응대중: {
    tone: "bg-white",
    badge: "bg-blue-50 text-blue-700",
    border: "border-2 border-primary ring-2 ring-primary/10",
    header: "bg-primary",
  },
  통화완료: {
    tone: "bg-slate-50",
    badge: "bg-emerald-50 text-emerald-700",
    border: "border border-emerald-100",
    header: "bg-emerald-500",
  },
  예약완료: {
    tone: "bg-slate-50",
    badge: "bg-emerald-100 text-emerald-800",
    border: "border border-emerald-200",
    header: "bg-emerald-600",
  },
};

export default function CrmPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<CrmStatus | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/users", { cache: "no-store" });
      const json = await res.json();
      const data = (json.data || []) as User[];
      setUsers(data);
      if (data.length > 0 && !selectedUserId) {
        setSelectedUserId(data[0].id);
      }
    } catch {
      setError("상담원 목록 조회 실패");
    }
  }, [selectedUserId]);

  const fetchLeads = useCallback(async () => {
    const qs = new URLSearchParams({ limit: "100" });
    if (selectedUserId) qs.set("assigneeId", String(selectedUserId));

    const res = await fetch(`/api/crm/leads?${qs.toString()}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "리드 조회 실패");
    setLeads((json.data || []) as Lead[]);
  }, [selectedUserId]);

  const fetchCalendar = useCallback(async () => {
    if (!selectedUserId) return;
    const qs = new URLSearchParams({ assigneeId: String(selectedUserId) });
    const res = await fetch(`/api/crm/calendar?${qs.toString()}`, { cache: "no-store" });
    const json = await res.json();
    if (res.ok) setCalendarEvents((json.data || []) as CalendarEvent[]);
  }, [selectedUserId]);

  const refreshAll = useCallback(async () => {
    try {
      setError(null);
      await Promise.all([fetchLeads(), fetchCalendar()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 중 오류 발생");
    }
  }, [fetchLeads, fetchCalendar]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { refreshAll(); }, [refreshAll]);

  async function updateStatus(leadId: number, crmStatus: CrmStatus) {
    const previous = leads;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, crmStatus } : l)));
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crmStatus }),
      });
      if (!res.ok) throw new Error("상태 변경 실패");
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
      if (!res.ok) throw new Error("상담원 할당 실패");
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "상담원 할당 실패");
    }
  }

  async function updateSchedule(leadId: number, field: "followUpAt" | "appointmentAt", value: string) {
    try {
      const payload = { [field]: value ? new Date(value).toISOString() : null };
      const res = await fetch(`/api/crm/leads/${leadId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("일정 저장 실패");
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "일정 저장 실패");
    }
  }

  const filteredLeads = useMemo(() => {
    let list = leads;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter((l) => l.name.toLowerCase().includes(term) || l.phone.includes(term));
    }
    return list;
  }, [leads, searchTerm]);

  const leadByStatus = useMemo(() => {
    const grouped: Record<CrmStatus, Lead[]> = {
      신규인입: [], "1차부재": [], "2차부재": [], "3차부재": [],
      노쇼: [], 응대중: [], 통화완료: [], 예약완료: [],
    };
    filteredLeads.forEach((l) => grouped[l.crmStatus].push(l));
    return grouped;
  }, [filteredLeads]);

  const selectedLead = useMemo(() => leads.find((l) => l.id === selectedLeadId) || null, [leads, selectedLeadId]);

  return (
    <div className="flex h-screen w-full bg-background font-[family-name:var(--font-sans)]">
      {/* Sidebar */}
      <aside className="z-20 flex w-16 flex-col items-center border-r border-border bg-card py-6 shadow-sm">
        <div className="mb-8"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-xl font-bold text-white shadow-lg shadow-primary/30">D</div></div>
        <nav className="flex flex-1 flex-col items-center gap-6 w-full">
          <button className="rounded-xl bg-primary/10 p-3 text-primary"><span className="material-icons">dashboard</span></button>
          <button className="rounded-xl p-3 text-slate-400 hover:bg-slate-50 hover:text-primary"><span className="material-icons">people</span></button>
          <button className="rounded-xl p-3 text-slate-400 hover:bg-slate-50 hover:text-primary"><span className="material-icons">chat</span></button>
        </nav>
        <div className="mt-auto flex flex-col gap-4">
          <button className="p-3 text-slate-400 hover:text-primary"><span className="material-icons">settings</span></button>
          <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-white bg-slate-200"><img src="https://lh3.googleusercontent.com/a/default-user" alt="User" /></div>
        </div>
      </aside>

      <main className="relative flex flex-1 flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-slate-800">접수 현황</h1>
            <div className="flex rounded-lg bg-slate-100 p-1">
              <button onClick={() => setViewMode("kanban")} className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition-all ${viewMode === "kanban" ? "bg-card text-slate-800 shadow-sm" : "text-slate-500"}`}><span className="material-icons text-sm">view_kanban</span> 칸반</button>
              <button onClick={() => setViewMode("list")} className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition-all ${viewMode === "list" ? "bg-card text-slate-800 shadow-sm" : "text-slate-500"}`}><span className="material-icons text-sm">view_list</span> 리스트</button>
              <button onClick={() => setViewMode("calendar")} className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition-all ${viewMode === "calendar" ? "bg-card text-slate-800 shadow-sm" : "text-slate-500"}`}><span className="material-icons text-sm">calendar_today</span> 캘린더</button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative"><span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">search</span><input type="text" placeholder="검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-64 rounded-lg border-none bg-slate-100 py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/20" /></div>
            <select value={selectedUserId ?? ""} onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : null)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
              {users.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
            </select>
          </div>
        </header>

        {/* View Selection Content */}
        <div className="flex-1 overflow-hidden p-6">
          <div className="h-full">
            {viewMode === "kanban" ? (
              <KanbanBoard 
                grouped={leadByStatus} users={users} onStatusChange={updateStatus} onAssigneeChange={updateAssignee} onScheduleChange={updateSchedule} onSelectLead={setSelectedLeadId} selectedLeadId={selectedLeadId}
                draggingId={draggingId} setDraggingId={setDraggingId} dragOverStatus={dragOverStatus} setDragOverStatus={setDragOverStatus}
              />
            ) : viewMode === "list" ? (
              <LeadTable
                leads={filteredLeads}
                users={users}
                onStatusChange={updateStatus}
                onAssigneeChange={updateAssignee}
                onScheduleChange={updateSchedule}
                onSelectLead={setSelectedLeadId}
              />
            ) : (
              <CalendarView events={calendarEvents} />
            )}
          </div>
        </div>

        {error && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-2 rounded-full shadow-lg z-50 flex items-center gap-2 animate-bounce">
            <span className="material-icons">error</span> {error} <button onClick={() => setError(null)}>✕</button>
          </div>
        )}
      </main>

      <LeadDrawer lead={selectedLead} onClose={() => setSelectedLeadId(null)} users={users} onStatusChange={updateStatus} onAssigneeChange={updateAssignee} onScheduleChange={updateSchedule} />
    </div>
  );
}

type KanbanBoardProps = {
  grouped: Record<CrmStatus, Lead[]>;
  users: User[];
  onStatusChange: (id: number, status: CrmStatus) => void;
  onAssigneeChange: (id: number, assigneeId: number | null) => void;
  onScheduleChange: (id: number, field: "followUpAt" | "appointmentAt", value: string) => void;
  onSelectLead: (id: number) => void;
  selectedLeadId: number | null;
  draggingId: number | null;
  setDraggingId: Dispatch<SetStateAction<number | null>>;
  dragOverStatus: CrmStatus | null;
  setDragOverStatus: Dispatch<SetStateAction<CrmStatus | null>>;
};

function KanbanBoard({
  grouped,
  users,
  onStatusChange,
  onAssigneeChange,
  onScheduleChange,
  onSelectLead,
  selectedLeadId,
  draggingId,
  setDraggingId,
  dragOverStatus,
  setDragOverStatus,
}: KanbanBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto h-full pb-4">
      {statusOptions.map((status) => (
        <div key={status} onDragOver={(e) => { e.preventDefault(); setDragOverStatus(status); }} onDragLeave={() => setDragOverStatus(null)} onDrop={async () => { if (!draggingId) return; setDragOverStatus(null); await onStatusChange(draggingId, status); setDraggingId(null); }}
          className={`w-80 flex-shrink-0 flex flex-col rounded-xl border border-border bg-slate-100/50 transition-colors ${dragOverStatus === status ? "bg-primary/5 border-primary/40" : ""}`}
        >
          <div className="p-4 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${statusStyles[status].header}`}></span>
              <h3 className="font-semibold text-slate-700 text-sm">{status}</h3>
              <span className="bg-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm">{grouped[status].length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 space-y-3 pb-4">
            {grouped[status].map((lead: Lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                users={users}
                onAssigneeChange={onAssigneeChange}
                onScheduleChange={onScheduleChange}
                onSelect={() => onSelectLead(lead.id)}
                selected={selectedLeadId === lead.id}
                onDragStart={() => setDraggingId(lead.id)}
                onDragEnd={() => setDraggingId(null)}
                dragging={draggingId === lead.id}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type LeadCardProps = {
  lead: Lead;
  users: User[];
  onAssigneeChange: (id: number, assigneeId: number | null) => void;
  onScheduleChange: (id: number, field: "followUpAt" | "appointmentAt", value: string) => void;
  onSelect: () => void;
  selected: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  dragging: boolean;
};

function LeadCard({ lead, users, onAssigneeChange, onScheduleChange, onSelect, selected, onDragStart, onDragEnd, dragging }: LeadCardProps) {
  const style = statusStyles[lead.crmStatus];
  const stop = (e: SyntheticEvent) => e.stopPropagation();
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onSelect}
      className={`group cursor-grab rounded-xl p-4 shadow-sm border transition-all hover:shadow-md ${style.tone} ${style.border} ${selected ? "ring-2 ring-primary/40" : ""} ${dragging ? "opacity-50" : ""}`}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="font-bold text-slate-800 text-sm">{lead.name}</div>
          <div className="text-[10px] text-slate-500">{lead.phone}</div>
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style.badge}`}>{lead.crmStatus}</span>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${lead.careTag.includes("임플란트") ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>{lead.careTag}</span>
        {lead.isSenior65Plus ? <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-[10px] font-bold">만 65세+</span> : lead.monthsUntil65 !== null && lead.monthsUntil65 <= 12 ? <span className="bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded text-[10px] font-bold">65세 도달 {lead.monthsUntil65}개월 전</span> : null}
      </div>
      <div className="space-y-2 text-[11px]">
        <select value={lead.assigneeId ?? ""} onClick={stop} onChange={(e) => onAssigneeChange(lead.id, e.target.value ? Number(e.target.value) : null)} className="w-full bg-white border border-border rounded px-2 py-1">
          <option value="">미할당</option>
          {users.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
        </select>
        <div className="flex gap-1">
          <input type="datetime-local" defaultValue={toIsoLocal(lead.followUpAt)} onClick={stop} onBlur={(e) => onScheduleChange(lead.id, "followUpAt", e.target.value)} className="w-1/2 border border-border rounded px-1.5 py-1" />
          <input type="datetime-local" defaultValue={toIsoLocal(lead.appointmentAt)} onClick={stop} onBlur={(e) => onScheduleChange(lead.id, "appointmentAt", e.target.value)} className="w-1/2 border border-border rounded px-1.5 py-1" />
        </div>
      </div>
    </div>
  );
}

type LeadTableProps = {
  leads: Lead[];
  users: User[];
  onStatusChange: (id: number, status: CrmStatus) => void;
  onAssigneeChange: (id: number, assigneeId: number | null) => void;
  onScheduleChange: (id: number, field: "followUpAt" | "appointmentAt", value: string) => void;
  onSelectLead: (id: number) => void;
};

function LeadTable({ leads, users, onStatusChange, onAssigneeChange, onScheduleChange, onSelectLead }: LeadTableProps) {
  const stop = (e: SyntheticEvent) => e.stopPropagation();
  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 border-b border-border">
          <tr><th className="px-4 py-3">환자</th><th className="px-4 py-3">태그</th><th className="px-4 py-3">상태</th><th className="px-4 py-3">할당</th><th className="px-4 py-3">일정</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {leads.map((lead: Lead) => (
            <tr key={lead.id} onClick={() => onSelectLead(lead.id)} className="hover:bg-slate-50 transition-colors cursor-pointer">
              <td className="px-4 py-3"><div><div className="font-bold">{lead.name}</div><div className="text-[10px] text-slate-500">{lead.phone}</div></div></td>
              <td className="px-4 py-3"><div className="flex gap-1">{lead.isSenior65Plus && <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-[10px] font-bold">만 65세+</span>} <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{lead.careTag}</span></div></td>
              <td className="px-4 py-3"><select value={lead.crmStatus} onClick={stop} onChange={(e) => onStatusChange(lead.id, e.target.value as CrmStatus)} className="border border-border rounded px-2 py-1 text-xs">{statusOptions.map(s => <option key={s} value={s}>{s}</option>)}</select></td>
              <td className="px-4 py-3"><select value={lead.assigneeId ?? ""} onClick={stop} onChange={(e) => onAssigneeChange(lead.id, e.target.value ? Number(e.target.value) : null)} className="border border-border rounded px-2 py-1 text-xs"><option value="">미할당</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></td>
              <td className="px-4 py-3"><div className="flex gap-2"><input type="datetime-local" defaultValue={toIsoLocal(lead.followUpAt)} onClick={stop} onBlur={(e) => onScheduleChange(lead.id, "followUpAt", e.target.value)} className="border border-border rounded px-1.5 py-1 text-xs" /><input type="datetime-local" defaultValue={toIsoLocal(lead.appointmentAt)} onClick={stop} onBlur={(e) => onScheduleChange(lead.id, "appointmentAt", e.target.value)} className="border border-border rounded px-1.5 py-1 text-xs" /></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CalendarView({ events }: { events: CalendarEvent[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const eventsByDay = useMemo(() => {
    const grouped: Record<number, CalendarEvent[]> = {};
    events.forEach(ev => { const d = new Date(ev.at); if (d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear()) { const day = d.getDate(); if (!grouped[day]) grouped[day] = []; grouped[day].push(ev); } });
    return grouped;
  }, [events, currentDate]);
  return (
    <div className="bg-white border border-border rounded-xl h-full flex flex-col overflow-hidden shadow-sm">
      <div className="p-4 border-b border-border flex justify-between items-center bg-slate-50">
        <h3 className="font-bold text-slate-800">{currentDate.getFullYear()}년 {currentDate.getMonth()+1}월</h3>
        <div className="flex gap-1"><button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()-1))} className="p-1 border border-border rounded hover:bg-white"><span className="material-icons">chevron_left</span></button><button onClick={() => setCurrentDate(new Date())} className="px-3 border border-border rounded hover:bg-white text-xs">오늘</button><button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()+1))} className="p-1 border border-border rounded hover:bg-white"><span className="material-icons">chevron_right</span></button></div>
      </div>
      <div className="flex-1 overflow-auto p-4"><div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200">
        {["일","월","화","수","목","금","토"].map(d => <div key={d} className="bg-slate-50 py-2 text-center text-[10px] font-bold text-slate-400">{d}</div>)}
        {Array.from({length: firstDay}).map((_, i) => <div key={i} className="bg-slate-50/50 min-h-[120px]"></div>)}
        {Array.from({length: daysInMonth}).map((_, i) => { const day = i+1; return <div key={day} className="bg-white min-h-[120px] p-2 space-y-1"><span className="text-[10px] font-bold text-slate-300">{day}</span>{eventsByDay[day]?.map(ev => <div key={ev.id} className={`text-[9px] p-1 rounded border ${ev.type === 'appointment' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}><div className="font-bold truncate">{ev.patientName}</div><div className="opacity-70">{new Date(ev.at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div></div>)}</div> })}
      </div></div>
    </div>
  );
}

type LeadDrawerProps = {
  lead: Lead | null;
  onClose: () => void;
  users: User[];
  onStatusChange: (id: number, status: CrmStatus) => void;
  onAssigneeChange: (id: number, assigneeId: number | null) => void;
  onScheduleChange: (id: number, field: "followUpAt" | "appointmentAt", value: string) => void;
};

function LeadDrawer({ lead, onClose, users, onStatusChange, onAssigneeChange, onScheduleChange }: LeadDrawerProps) {
  if (!lead) return null;
  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm" onClick={onClose}></div>
      <aside className="fixed top-0 right-0 z-40 h-full w-[420px] bg-white shadow-2xl flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-primary font-bold text-xl">{lead.name.substring(0,1)}</div>
            <div><h2 className="text-lg font-bold">{lead.name}</h2><div className="text-sm text-slate-500">{lead.phone}</div></div>
          </div>
          <button onClick={onClose} className="text-slate-400"><span className="material-icons">close</span></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <div><h4 className="text-xs font-bold text-slate-400 uppercase mb-2">상태 변경</h4>
              <div className="grid grid-cols-2 gap-2">{statusOptions.map(s => <button key={s} onClick={() => onStatusChange(lead.id, s)} className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${lead.crmStatus === s ? 'bg-primary/5 border-primary text-primary shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{s}</button>)}</div>
            </div>
            <div><h4 className="text-xs font-bold text-slate-400 uppercase mb-2">담당 상담원</h4>
              <select value={lead.assigneeId ?? ""} onChange={(e) => onAssigneeChange(lead.id, e.target.value ? Number(e.target.value) : null)} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm">{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><h4 className="text-xs font-bold text-slate-400 uppercase mb-2">팔로업 예약</h4><input type="datetime-local" defaultValue={toIsoLocal(lead.followUpAt)} onBlur={(e) => onScheduleChange(lead.id, "followUpAt", e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-xs" /></div>
              <div><h4 className="text-xs font-bold text-slate-400 uppercase mb-2">예약 확정</h4><input type="datetime-local" defaultValue={toIsoLocal(lead.appointmentAt)} onBlur={(e) => onScheduleChange(lead.id, "appointmentAt", e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-xs" /></div>
            </div>
          </div>
          <div><h4 className="text-xs font-bold text-slate-400 uppercase mb-3">상담 히스토리</h4><div className="space-y-4 border-l-2 border-slate-100 pl-4">
            <div className="relative"><div className="absolute -left-[21px] top-0 h-4 w-4 rounded-full border-2 border-white bg-primary shadow-sm"></div><div className="text-[10px] font-bold text-slate-400">{new Date(lead.createdAt).toLocaleString()}</div><div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg mt-1 border border-slate-100">최초 유입: {lead.careTag}</div></div>
            {lead.lastCallAt && <div className="relative"><div className="absolute -left-[21px] top-0 h-4 w-4 rounded-full border-2 border-white bg-amber-400 shadow-sm"></div><div className="text-[10px] font-bold text-slate-400">{new Date(lead.lastCallAt).toLocaleString()}</div><div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg mt-1 border border-slate-100">최근 상담 기록: {lead.crmStatus}</div></div>}
          </div></div>
        </div>
        <div className="p-4 border-t border-slate-100 grid grid-cols-2 gap-3 bg-slate-50/50">
          <button className="flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"><span className="material-icons text-sm">schedule</span> 부재중 안내</button>
          <button className="flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-lg text-sm font-medium shadow-sm shadow-primary/20 hover:bg-blue-700"><span className="material-icons text-sm">event</span> 예약 하기</button>
        </div>
      </aside>
    </>
  );
}
