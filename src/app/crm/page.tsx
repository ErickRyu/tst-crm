"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ViewMode = "kanban" | "list" | "calendar";
type Scope = "all" | "mine";

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

interface User {
  id: number;
  name: string;
}

interface Lead {
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
}

interface CalendarEvent {
  id: string;
  leadId: number;
  patientName: string;
  phone: string;
  type: "follow_up" | "appointment";
  at: string;
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

const statusStyles: Record<CrmStatus, { tone: string; badge: string; border: string; dot: string }> = {
  신규인입: { tone: "bg-white", badge: "bg-red-50 text-red-600", border: "border-l-4 border-l-red-500", dot: "bg-red-500" },
  "1차부재": { tone: "bg-white", badge: "bg-amber-50 text-amber-700", border: "border border-slate-200", dot: "bg-amber-400" },
  "2차부재": { tone: "bg-white", badge: "bg-amber-100 text-amber-800", border: "border border-slate-200", dot: "bg-amber-500" },
  "3차부재": { tone: "bg-white", badge: "bg-amber-200 text-amber-900", border: "border border-slate-200", dot: "bg-amber-600" },
  노쇼: { tone: "bg-slate-50", badge: "bg-slate-200 text-slate-800", border: "border border-slate-300", dot: "bg-slate-400" },
  응대중: { tone: "bg-white", badge: "bg-blue-50 text-blue-700", border: "border-2 border-primary ring-2 ring-primary/10", dot: "bg-primary" },
  통화완료: { tone: "bg-slate-50", badge: "bg-emerald-50 text-emerald-700", border: "border border-emerald-100", dot: "bg-emerald-500" },
  예약완료: { tone: "bg-slate-50", badge: "bg-emerald-100 text-emerald-800", border: "border border-emerald-200", dot: "bg-emerald-600" },
};

export default function CrmPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [scope, setScope] = useState<Scope>("all"); // 전체보기가 기본
  const [includeDone, setIncludeDone] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null); // null이면 전체 상담원
  const [leads, setLeads] = useState<Lead[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<CrmStatus | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/users");
      const json = await res.json();
      setUsers((json.data || []) as User[]);
    } catch { setError("상담원 목록 조회 실패"); }
  }, []);

  const fetchLeads = useCallback(async () => {
    const qs = new URLSearchParams({ scope, includeDone: String(includeDone), limit: "150" });
    if (selectedUserId) {
      qs.set("assigneeId", String(selectedUserId));
      qs.set("scope", "mine"); // 특정 상담원 선택 시 자동으로 scope를 mine으로 조정하여 백엔드 필터링 유도
    }
    
    const res = await fetch(`/api/crm/leads?${qs.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "리드 조회 실패");
    setLeads((json.data || []) as Lead[]);
  }, [scope, includeDone, selectedUserId]);

  const fetchCalendar = useCallback(async () => {
    // 캘린더는 전체보기 시에도 현재 선택된 상담원 혹은 전체 일정을 가져올 수 있도록 구성
    const qs = new URLSearchParams();
    if (selectedUserId) qs.set("assigneeId", String(selectedUserId));
    
    const res = await fetch(`/api/crm/calendar?${qs.toString()}`);
    const json = await res.json();
    if (res.ok) setCalendarEvents((json.data || []) as CalendarEvent[]);
  }, [selectedUserId]);

  const refreshAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([fetchLeads(), fetchCalendar()]);
    } catch (e) { setError(e instanceof Error ? e.message : "조회 중 오류"); }
    finally { setLoading(false); }
  }, [fetchLeads, fetchCalendar]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { refreshAll(); }, [refreshAll]);

  const updateStatus = async (id: number, status: CrmStatus) => {
    try {
      const res = await fetch(`/api/crm/leads/${id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ crmStatus: status }),
      });
      if (res.ok) await refreshAll();
      else setError("상태 변경 실패");
    } catch { setError("서버 통신 오류"); }
  };

  const updateAssignee = async (id: number, assigneeId: number | null) => {
    try {
      const res = await fetch(`/api/crm/leads/${id}/assign`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assigneeId }),
      });
      if (res.ok) await refreshAll();
    } catch { setError("할당 변경 실패"); }
  };

  const updateSchedule = async (id: number, field: string, value: string) => {
    try {
      const res = await fetch(`/api/crm/leads/${id}/schedule`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value ? new Date(value).toISOString() : null }),
      });
      if (res.ok) await refreshAll();
    } catch { setError("일정 변경 실패"); }
  };

  const filteredLeads = useMemo(() => {
    if (!searchTerm) return leads;
    const t = searchTerm.toLowerCase();
    return leads.filter(l => l.name.toLowerCase().includes(t) || l.phone.includes(t));
  }, [leads, searchTerm]);

  const groupedLeads = useMemo(() => {
    const g: Record<CrmStatus, Lead[]> = { "신규인입": [], "1차부재": [], "2차부재": [], "3차부재": [], "노쇼": [], "응대중": [], "통화완료": [], "예약완료": [] };
    filteredLeads.forEach(l => g[l.crmStatus].push(l));
    return g;
  }, [filteredLeads]);

  const selectedLead = useMemo(() => leads.find(l => l.id === selectedLeadId) || null, [leads, selectedLeadId]);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-slate-900 font-[family-name:var(--font-sans)]">
      {/* Sidebar */}
      <aside className="w-16 flex flex-col items-center py-6 bg-card border-r border-border shrink-0">
        <div className="mb-8 w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/30">D</div>
        <nav className="flex-1 flex flex-col gap-6 items-center w-full">
          <button className="p-3 bg-primary/10 text-primary rounded-xl"><span className="material-icons">dashboard</span></button>
          <button className="p-3 text-slate-400 hover:text-primary"><span className="material-icons">people</span></button>
          <button className="p-3 text-slate-400 hover:text-primary"><span className="material-icons">chat</span></button>
        </nav>
        <div className="mt-auto flex flex-col gap-4">
          <button className="p-3 text-slate-400"><span className="material-icons">settings</span></button>
          <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white overflow-hidden"><img src="https://lh3.googleusercontent.com/a/default-user" alt="User" /></div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 bg-card border-b border-border shrink-0">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold">접수 현황</h1>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setViewMode("kanban")} className={`px-3 py-1.5 text-xs font-medium rounded flex items-center gap-1.5 transition-all ${viewMode === "kanban" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}><span className="material-icons text-sm">view_kanban</span> 칸반</button>
              <button onClick={() => setViewMode("list")} className={`px-3 py-1.5 text-xs font-medium rounded flex items-center gap-1.5 transition-all ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}><span className="material-icons text-sm">view_list</span> 리스트</button>
              <button onClick={() => setViewMode("calendar")} className={`px-3 py-1.5 text-xs font-medium rounded flex items-center gap-1.5 transition-all ${viewMode === "calendar" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}><span className="material-icons text-sm">calendar_today</span> 캘린더</button>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button onClick={() => { setScope("all"); setSelectedUserId(null); }} className={`px-3 py-1.5 text-[11px] font-bold rounded transition-all ${scope === "all" ? "bg-primary text-white" : "text-slate-500"}`}>전체보기</button>
              <button onClick={() => { setScope("mine"); if (users.length > 0) setSelectedUserId(users[0].id); }} className={`px-3 py-1.5 text-[11px] font-bold rounded transition-all ${scope === "mine" ? "bg-primary text-white" : "text-slate-500"}`}>내 할당</button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative"><span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">search</span><input type="text" placeholder="환자명, 전화번호 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-64 bg-slate-100 border-none rounded-lg py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/20" /></div>
            <select value={selectedUserId || ""} onChange={(e) => { const val = e.target.value ? Number(e.target.value) : null; setSelectedUserId(val); setScope(val ? "mine" : "all"); }} className="bg-card border border-border rounded-lg px-3 py-2 text-sm font-medium">
              <option value="">전체 상담원</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-6 relative">
          {viewMode === "kanban" && <KanbanView grouped={groupedLeads} users={users} onSelect={setSelectedLeadId} selectedId={selectedLeadId} onStatus={updateStatus} onAssignee={updateAssignee} onSchedule={updateSchedule} draggingId={draggingId} setDraggingId={setDraggingId} dragOverStatus={dragOverStatus} setDragOverStatus={setDragOverStatus} />}
          {viewMode === "list" && <ListView leads={filteredLeads} users={users} onSelect={setSelectedLeadId} onStatus={updateStatus} onAssignee={updateAssignee} onSchedule={updateSchedule} loading={loading} />}
          {viewMode === "calendar" && <CalendarView events={calendarEvents} />}
        </div>
      </main>

      <LeadDrawer lead={selectedLead} onClose={() => setSelectedLeadId(null)} users={users} onStatus={updateStatus} onAssignee={updateAssignee} onSchedule={updateSchedule} />
      
      {error && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-2 rounded-full shadow-2xl z-50 flex items-center gap-2"><span className="material-icons">warning</span> {error} <button onClick={() => setError(null)}>✕</button></div>}
    </div>
  );
}

function KanbanView({ grouped, users, onSelect, selectedId, onStatus, onAssignee, onSchedule, draggingId, setDraggingId, dragOverStatus, setDragOverStatus }: any) {
  return (
    <div className="flex gap-4 h-full overflow-x-auto pb-4 items-start">
      {statusOptions.map(status => (
        <div key={status} onDragOver={(e) => { e.preventDefault(); setDragOverStatus(status); }} onDragLeave={() => setDragOverStatus(null)} onDrop={() => { if (!draggingId) return; setDragOverStatus(null); onStatus(draggingId, status); setDraggingId(null); }}
          className={`w-80 shrink-0 flex flex-col max-h-full rounded-xl border border-border bg-slate-100/40 transition-colors ${dragOverStatus === status ? "bg-primary/5 border-primary/40" : ""}`}
        >
          <div className="p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${statusStyles[status].dot}`}></span><span className="font-bold text-sm text-slate-700">{status}</span><span className="bg-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm">{grouped[status].length}</span></div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 space-y-3 pb-4">
            {grouped[status].map((l: Lead) => (
              <div key={l.id} draggable onDragStart={() => setDraggingId(l.id)} onDragEnd={() => setDraggingId(null)} onClick={() => onSelect(l.id)}
                className={`p-4 rounded-xl shadow-sm border bg-white cursor-grab transition-all hover:shadow-md ${statusStyles[l.crmStatus].border} ${selectedId === l.id ? "ring-2 ring-primary" : ""} ${draggingId === l.id ? "opacity-40" : ""}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div><div className="font-bold text-sm">{l.name}</div><div className="text-[10px] text-slate-500">{l.phone}</div></div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusStyles[l.crmStatus].badge}`}>{l.crmStatus}</span>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${l.careTag.includes("임플란트") ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>{l.careTag}</span>
                  {l.isSenior65Plus && <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-[10px] font-bold">만 65세+</span>}
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50" onClick={e => e.stopPropagation()}>
                   <div className="flex items-center gap-1 text-[10px] text-slate-400">
                     <span className="material-icons text-[12px]">person</span>
                     {users.find((u:any) => u.id === l.assigneeId)?.name || "미할당"}
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListView({ leads, users, onSelect, onStatus, onAssignee, onSchedule, loading }: any) {
  return (
    <div className="h-full flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="sticky top-0 bg-slate-50 border-b border-border z-10">
            <tr><th className="px-6 py-3 font-semibold text-slate-500 uppercase text-[10px]">환자 정보</th><th className="px-6 py-3 font-semibold text-slate-500 uppercase text-[10px]">태그 및 뱃지</th><th className="px-6 py-3 font-semibold text-slate-500 uppercase text-[10px]">상태</th><th className="px-6 py-3 font-semibold text-slate-500 uppercase text-[10px]">담당 상담원</th><th className="px-6 py-3 font-semibold text-slate-500 uppercase text-[10px]">최근 업데이트</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((l: Lead) => (
              <tr key={l.id} onClick={() => onSelect(l.id)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                <td className="px-6 py-3"><div><div className="font-bold text-slate-900">{l.name}</div><div className="text-[10px] text-slate-500">{l.phone}</div></div></td>
                <td className="px-6 py-3"><div className="flex gap-1">{l.isSenior65Plus && <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-[10px] font-bold">만 65세+</span>}<span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{l.careTag}</span></div></td>
                <td className="px-6 py-3" onClick={e => e.stopPropagation()}><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${statusStyles[l.crmStatus].badge}`}>{l.crmStatus}</span></td>
                <td className="px-6 py-3" onClick={e => e.stopPropagation()}><div className="text-xs font-medium text-slate-600">{users.find((u:any) => u.id === l.assigneeId)?.name || "미할당"}</div></td>
                <td className="px-6 py-3 text-slate-400 text-[11px]">{l.lastCallAt ? new Date(l.lastCallAt).toLocaleDateString() : new Date(l.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CalendarView({ events }: { events: CalendarEvent[] }) {
  const [cur, setCur] = useState(new Date());
  const days = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
  const start = new Date(cur.getFullYear(), cur.getMonth(), 1).getDay();
  const grouped = useMemo(() => {
    const r: Record<number, CalendarEvent[]> = {};
    events.forEach(e => { const d = new Date(e.at); if(d.getMonth() === cur.getMonth() && d.getFullYear() === cur.getFullYear()) { const dd = d.getDate(); r[dd] = [...(r[dd] || []), e]; } });
    return r;
  }, [events, cur]);
  return (
    <div className="h-full flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-border flex justify-between items-center"><h3 className="font-bold">{cur.getFullYear()}년 {cur.getMonth()+1}월 일정</h3><div className="flex gap-1"><button onClick={() => setCur(new Date(cur.getFullYear(), cur.getMonth()-1))} className="p-1 border border-border rounded hover:bg-white"><span className="material-icons">chevron_left</span></button><button onClick={() => setCur(new Date())} className="px-3 py-1 border border-border rounded hover:bg-white text-xs">오늘</button><button onClick={() => setCur(new Date(cur.getFullYear(), cur.getMonth()+1))} className="p-1 border border-border rounded hover:bg-white"><span className="material-icons">chevron_right</span></button></div></div>
      <div className="flex-1 overflow-auto p-4"><div className="grid grid-cols-7 bg-slate-200 border border-slate-200 gap-px">
        {["일","월","화","수","목","금","토"].map(d => <div key={d} className="bg-slate-50 py-2 text-center text-[10px] font-bold text-slate-400">{d}</div>)}
        {Array.from({length: start}).map((_, i) => <div key={i} className="bg-slate-50/50 min-h-[100px]"></div>)}
        {Array.from({length: days}).map((_, i) => { const d = i+1; return <div key={d} className="bg-white min-h-[100px] p-2 space-y-1"><div className="text-[10px] text-slate-400 font-bold">{d}</div>{grouped[d]?.map(e => <div key={e.id} className={`text-[9px] p-1 rounded border truncate ${e.type==='appointment'?'bg-emerald-50 border-emerald-100 text-emerald-700':'bg-blue-50 border-blue-100 text-blue-700'}`}>{e.patientName}</div>)}</div> })}
      </div></div>
    </div>
  );
}

function LeadDrawer({ lead, onClose, users, onStatus, onAssignee, onSchedule }: any) {
  if (!lead) return null;
  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm" onClick={onClose}></div>
      <aside className="fixed top-0 right-0 z-40 h-full w-[420px] bg-white shadow-2xl flex flex-col translate-x-0 transition-transform">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-primary font-bold text-xl">{lead.name[0]}</div><div><h2 className="font-bold text-lg">{lead.name}</h2><div className="text-sm text-slate-500">{lead.phone}</div></div></div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><span className="material-icons">close</span></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <section><h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3">상태 업데이트</h4><div className="grid grid-cols-2 gap-2">{statusOptions.map(s => <button key={s} onClick={() => onStatus(lead.id, s)} className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${lead.crmStatus === s ? 'bg-primary/5 border-primary text-primary shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{s}</button>)}</div></section>
          <section><h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">담당 상담원</h4><select value={lead.assigneeId || ""} onChange={e => onAssignee(lead.id, Number(e.target.value) || null)} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm">{users.map((u:any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></section>
          <section className="grid grid-cols-2 gap-4"><div><h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">팔로업 일정</h4><input type="datetime-local" defaultValue={toIsoLocal(lead.followUpAt)} onBlur={e => onSchedule(lead.id, "followUpAt", e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-xs" /></div><div><h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">예약 확정</h4><input type="datetime-local" defaultValue={toIsoLocal(lead.appointmentAt)} onBlur={e => onSchedule(lead.id, "appointmentAt", e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-xs" /></div></section>
        </div>
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3 shrink-0"><button className="flex-1 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600">부재중 전송</button><button className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium shadow-lg shadow-primary/20">예약 하기</button></div>
      </aside>
    </>
  );
}
