"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { FeedbackProvider, useToast, useLoading } from "./ui/feedback";

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
  version: number;
  updatedAt: string;
  contactFailCount?: number;
}

interface CalendarEvent {
  id: string;
  leadId: number;
  patientName: string;
  phone: string;
  type: "follow_up" | "appointment";
  at: string;
}

interface LeadMemo {
  id: number;
  leadId: number;
  authorName: string;
  body: string;
  createdAt: string;
}

// Props Interfaces
interface ViewProps {
  leads: Lead[];
  users: User[];
  onSelect: (id: number) => void;
  selectedId: number | null;
  onStatus: (id: number, s: CrmStatus) => Promise<void>;
  onAssignee: (id: number, userId: number | null) => Promise<void>;
  onSchedule: (id: number, field: string, val: string) => Promise<void>;
  loading?: boolean;
}

interface KanbanProps extends ViewProps {
  draggingId: number | null;
  setDraggingId: (id: number | null) => void;
  dragOverStatus: CrmStatus | null;
  setDragOverStatus: (s: CrmStatus | null) => void;
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

const DAY_MS = 24 * 60 * 60 * 1000;

function isOverdue(lead: Lead) {
  if (lead.crmStatus === "노쇼") return { flag: true, label: "노쇼" };
  const created = new Date(lead.createdAt).getTime();
  if (Number.isNaN(created)) return { flag: false, label: "" };
  const over24 = Date.now() - created >= DAY_MS;
  return { flag: over24, label: over24 ? "24h+" : "" };
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
  return (
    <FeedbackProvider>
      <CrmShell />
    </FeedbackProvider>
  );
}

function CrmShell() {
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [scope, setScope] = useState<Scope>("all");
  const [includeDone, setIncludeDone] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [memos, setMemos] = useState<LeadMemo[]>([]);
  const [memoInput, setMemoInput] = useState("");
  const [memoSaving, setMemoSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<CrmStatus | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const { pushToast } = useToast();
  const { start: startLoading, stop: stopLoading } = useLoading();
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/users");
      const json = await res.json();
      setUsers((json.data || []) as User[]);
    } catch {
      setError("상담원 목록 조회 실패");
      pushToast("상담원 목록 조회 실패", "error");
    }
  }, [pushToast]);

  const fetchLeads = useCallback(async () => {
    const qs = new URLSearchParams({ 
      scope, 
      includeDone: String(includeDone), 
      limit: "100" 
    });
    if (selectedUserId) {
      qs.set("assigneeId", String(selectedUserId));
      if (scope !== "mine") setScope("mine");
    }
    
    const res = await fetch(`/api/crm/leads?${qs.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "리드 조회 실패");
    setLeads((json.data || []) as Lead[]);
  }, [scope, includeDone, selectedUserId]);

  const fetchCalendar = useCallback(async () => {
    const qs = new URLSearchParams();
    if (selectedUserId) qs.set("assigneeId", String(selectedUserId));
    const res = await fetch(`/api/crm/calendar?${qs.toString()}`);
    const json = await res.json();
    if (res.ok) setCalendarEvents((json.data || []) as CalendarEvent[]);
  }, [selectedUserId]);

  const refreshAll = useCallback(async () => {
    const loadingId = startLoading("데이터를 불러오는 중");
    try {
      setLoading(true);
      setError(null);
      await Promise.all([fetchLeads(), fetchCalendar()]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "조회 중 오류";
      setError(msg);
      pushToast(msg, "error", refreshAll);
    }
    finally {
      setLoading(false);
      stopLoading(loadingId);
    }
  }, [fetchLeads, fetchCalendar, pushToast, startLoading, stopLoading]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { refreshAll(); }, [refreshAll]);

  // 상세 패널 데이터 최신화
  useEffect(() => {
    const fetchDetail = async (id: number) => {
      try {
        setDetailLoading(true);
        setDetailError(null);
        const res = await fetch(`/api/leads/${id}`, {
          headers: apiKey ? { "x-api-key": apiKey } : undefined,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "상세 조회 실패");
        const base = leads.find((l) => l.id === id);
        setDetailLead({ ...(base || {} as Lead), ...(json.data || {}) });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "상세 조회 실패";
        setDetailError(msg);
        pushToast(msg, "error");
      } finally {
        setDetailLoading(false);
      }
    };
    if (selectedLeadId) {
      void fetchDetail(selectedLeadId);
    } else {
      setDetailLead(null);
      setDetailError(null);
    }
  }, [selectedLeadId, leads, pushToast, apiKey]);

  useEffect(() => {
    const fetchMemos = async (id: number) => {
      try {
        const res = await fetch(`/api/crm/leads/${id}/memos`, {
          headers: apiKey ? { "x-api-key": apiKey } : undefined,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "메모 조회 실패");
        setMemos(json.data || []);
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "메모 조회 실패", "error");
      }
    };
    if (selectedLeadId) {
      void fetchMemos(selectedLeadId);
    } else {
      setMemos([]);
    }
  }, [selectedLeadId, pushToast, apiKey]);

  const updateStatus = async (id: number, status: CrmStatus) => {
    try {
      const version = leads.find(l => l.id === id)?.version;
      const res = await fetch(`/api/crm/leads/${id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ crmStatus: status, version }),
      });
      if (res.ok) {
        pushToast("상태가 변경되었습니다.", "success");
        await refreshAll();
      } else if (res.status === 409) {
        setError("다른 상담원이 먼저 변경했습니다. 새로고침 후 다시 시도하세요.");
        pushToast("다른 상담원이 먼저 변경했습니다.", "error");
      } else setError("상태 변경 실패");
    } catch {
      setError("서버 통신 오류");
      pushToast("서버 통신 오류", "error");
    }
  };

  const updateAssignee = async (id: number, assigneeId: number | null) => {
    try {
      const version = leads.find(l => l.id === id)?.version;
      const res = await fetch(`/api/crm/leads/${id}/assign`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assigneeId, version }),
      });
      if (res.ok) {
        pushToast("담당자가 변경되었습니다.", "success");
        await refreshAll();
      } else if (res.status === 409) {
        setError("다른 상담원이 먼저 변경했습니다. 새로고침 후 다시 시도하세요.");
        pushToast("다른 상담원이 먼저 변경했습니다.", "error");
      }
    } catch { setError("할당 변경 실패"); pushToast("할당 변경 실패", "error"); }
  };

  const updateSchedule = async (id: number, field: string, value: string) => {
    try {
      const version = leads.find(l => l.id === id)?.version;
      const res = await fetch(`/api/crm/leads/${id}/schedule`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value ? new Date(value).toISOString() : null, version }),
      });
      if (res.ok) {
        pushToast("일정이 변경되었습니다.", "success");
        await refreshAll();
      } else if (res.status === 409) {
        setError("다른 상담원이 먼저 변경했습니다. 새로고침 후 다시 시도하세요.");
        pushToast("다른 상담원이 먼저 변경했습니다.", "error");
      }
    } catch { setError("일정 변경 실패"); pushToast("일정 변경 실패", "error"); }
  };

  const saveMemo = async (leadId: number) => {
    if (!memoInput.trim()) {
      pushToast("메모를 입력하세요.", "error");
      return;
    }
    if (memoInput.length > 2000) {
      pushToast("메모는 2000자 이하로 작성해주세요.", "error");
      return;
    }
    try {
      setMemoSaving(true);
      const res = await fetch(`/api/crm/leads/${leadId}/memos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(apiKey ? { "x-api-key": apiKey } : {}) },
        body: JSON.stringify({ authorName: "상담원", body: memoInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "메모 저장 실패");
      setMemos(prev => [{ ...(json.data as LeadMemo) }, ...prev]);
      setMemoInput("");
      pushToast("메모가 저장되었습니다.", "success");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "메모 저장 실패", "error");
    } finally {
      setMemoSaving(false);
    }
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
  const viewContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      node.focus();
    }
  }, []);

  // View 전환 또는 데이터 로딩이 끝난 후 검색창에 포커스 이동 (접근성)
  useEffect(() => {
    if (!loading && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [viewMode, loading]);

  return (
    <FeedbackProvider>
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
          <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://lh3.googleusercontent.com/a/default-user" alt="User" />
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 bg-card border-b border-border shrink-0">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold">접수 현황</h1>
            <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
              <button aria-pressed={viewMode === "kanban"} onClick={() => setViewMode("kanban")} disabled={loading} className={`px-3 py-1.5 text-xs font-medium rounded flex items-center gap-1.5 transition-all ${viewMode === "kanban" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"} ${loading ? "opacity-60 cursor-not-allowed" : ""}`}><span className="material-icons text-sm">view_kanban</span> 칸반</button>
              <button aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")} disabled={loading} className={`px-3 py-1.5 text-xs font-medium rounded flex items-center gap-1.5 transition-all ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"} ${loading ? "opacity-60 cursor-not-allowed" : ""}`}><span className="material-icons text-sm">view_list</span> 리스트</button>
              <button aria-pressed={viewMode === "calendar"} onClick={() => setViewMode("calendar")} disabled={loading} className={`px-3 py-1.5 text-xs font-medium rounded flex items-center gap-1.5 transition-all ${viewMode === "calendar" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"} ${loading ? "opacity-60 cursor-not-allowed" : ""}`}><span className="material-icons text-sm">calendar_today</span> 캘린더</button>
            </div>
            
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg shrink-0 ml-2">
              <button onClick={() => { setScope("all"); setSelectedUserId(null); }} className={`px-3 py-1.5 text-[11px] font-bold rounded transition-all ${scope === "all" ? "bg-primary text-white" : "text-slate-500"}`}>전체보기</button>
              <button onClick={() => { setScope("mine"); if (users.length > 0 && !selectedUserId) setSelectedUserId(users[0].id); }} className={`px-3 py-1.5 text-[11px] font-bold rounded transition-all ${scope === "mine" ? "bg-primary text-white" : "text-slate-500"}`}>내 할당</button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer ml-4">
              <input type="checkbox" checked={includeDone} onChange={e => setIncludeDone(e.target.checked)} className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4" />
              <span className="text-[11px] font-bold text-slate-500">완료 항목 포함</span>
            </label>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative"><span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">search</span><input ref={searchInputRef} type="text" placeholder="환자명, 전화번호..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-64 bg-slate-100 border-none rounded-lg py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/20" /></div>
            <select value={selectedUserId || ""} onChange={(e) => { const v = e.target.value ? Number(e.target.value) : null; setSelectedUserId(v); if(v) setScope("mine"); }} className="bg-card border border-border rounded-lg px-3 py-2 text-sm font-medium">
              <option value="">전체 상담원</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-6 relative" tabIndex={-1} ref={viewContainerRef}>
          {loading && <SkeletonOverlay viewMode={viewMode} />}
          {!loading && viewMode === "kanban" && <KanbanView grouped={groupedLeads} users={users} onSelect={setSelectedLeadId} selectedId={selectedLeadId} onStatus={updateStatus} onAssignee={updateAssignee} onSchedule={updateSchedule} draggingId={draggingId} setDraggingId={setDraggingId} dragOverStatus={dragOverStatus} setDragOverStatus={setDragOverStatus} />}
          {!loading && viewMode === "list" && <ListView leads={filteredLeads} users={users} onSelect={setSelectedLeadId} selectedId={selectedLeadId} onStatus={updateStatus} onAssignee={updateAssignee} onSchedule={updateSchedule} loading={loading} />}
          {!loading && viewMode === "calendar" && <CalendarView events={calendarEvents} />}
        </div>
      </main>

      <LeadDrawer
        lead={detailLead || selectedLead}
        loading={detailLoading}
        error={detailError}
        onRetry={() => selectedLeadId && setSelectedLeadId(selectedLeadId)}
        onClose={() => setSelectedLeadId(null)}
        users={users}
        onStatus={updateStatus}
        onAssignee={updateAssignee}
        onSchedule={updateSchedule}
        memos={memos}
        memoInput={memoInput}
        memoSaving={memoSaving}
        onMemoInput={setMemoInput}
        onSaveMemo={() => selectedLeadId && saveMemo(selectedLeadId)}
      />
      
      {error && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-2 rounded-full shadow-2xl z-50 flex items-center gap-2"><span className="material-icons">warning</span> {error} <button onClick={() => setError(null)}>✕</button></div>}
      </div>
    </FeedbackProvider>
  );
}

function KanbanView({ grouped, users, onSelect, selectedId, onStatus, draggingId, setDraggingId, dragOverStatus, setDragOverStatus }: KanbanProps) {
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
            {grouped[status].map((l) => (
              <div key={l.id} draggable onDragStart={() => setDraggingId(l.id)} onDragEnd={() => setDraggingId(null)} onClick={() => onSelect(l.id)}
                className={`p-4 rounded-xl shadow-sm border bg-white cursor-grab transition-all hover:shadow-md ${statusStyles[l.crmStatus].border} ${selectedId === l.id ? "ring-2 ring-primary" : ""} ${draggingId === l.id ? "opacity-40" : ""}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div><div className="font-bold text-sm">{l.name}</div><div className="text-[10px] text-slate-500">{l.phone}</div></div>
                  <div className="flex gap-1">
                    {(() => { const { flag, label } = isOverdue(l); return flag ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">{label}</span> : null; })()}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusStyles[l.crmStatus].badge}`}>{l.crmStatus}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${l.careTag.includes("임플란트") ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>{l.careTag}</span>
                  {l.isSenior65Plus && <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-[10px] font-bold">만 65세+</span>}
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50" onClick={e => e.stopPropagation()}>
                   <div className="flex items-center gap-1 text-[10px] text-slate-400">
                     <span className="material-icons text-[12px]">person</span>
                     {users.find(u => u.id === l.assigneeId)?.name || "미할당"}
                   </div>
                   <div className="text-[10px] text-slate-400">{l.lastCallAt ? new Date(l.lastCallAt).toLocaleDateString() : ""}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListView({ leads, users, onSelect, selectedId, onStatus, onAssignee, onSchedule, loading }: ViewProps) {
  const stop = (e: React.MouseEvent | React.ChangeEvent) => e.stopPropagation();
  return (
    <div className="h-full flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="flex-1 overflow-auto relative">
        {loading && <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10 flex items-center justify-center"><span className="material-icons text-slate-400 animate-pulse">hourglass_empty</span></div>}
        <table className="w-full text-left text-sm border-collapse">
          <thead className="sticky top-0 bg-slate-50 border-b border-border z-10">
            <tr>
              <th className="px-6 py-3 font-semibold text-slate-500 uppercase text-[10px]">환자 정보</th>
              <th className="px-6 py-3 font-semibold text-slate-500 uppercase text-[10px]">태그 및 뱃지</th>
              <th className="px-6 py-3 font-semibold text-slate-500 uppercase text-[10px]">상태 (인라인)</th>
              <th className="px-6 py-3 font-semibold text-slate-500 uppercase text-[10px]">담당자 (인라인)</th>
              <th className="px-6 py-3 font-semibold text-slate-500 uppercase text-[10px]">일정</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((l) => (
              <tr key={l.id} onClick={() => onSelect(l.id)} className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedId === l.id ? "bg-blue-50/50" : ""}`}>
                <td className="px-6 py-3"><div className="flex items-center gap-2"><div><div className="font-bold text-slate-900">{l.name}</div><div className="text-[10px] text-slate-500">{l.phone}</div></div>{(() => { const { flag, label } = isOverdue(l); return flag ? <span className="bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">{label}</span> : null; })()}</div></td>
                <td className="px-6 py-3"><div className="flex gap-1">{l.isSenior65Plus && <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-[10px] font-bold">만 65세+</span>}<span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{l.careTag}</span></div></td>
                <td className="px-6 py-3" onClick={stop}>
                  <select value={l.crmStatus} onChange={e => onStatus(l.id, e.target.value as CrmStatus)} className="text-[11px] font-bold border-slate-200 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-primary">
                    {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-6 py-3" onClick={stop}>
                  <select value={l.assigneeId || ""} onChange={e => onAssignee(l.id, e.target.value ? Number(e.target.value) : null)} className="text-[11px] border-slate-200 rounded px-2 py-1 bg-white">
                    <option value="">미할당</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </td>
                <td className="px-6 py-3" onClick={stop}>
                  <div className="flex gap-1 items-center">
                    <input type="datetime-local" defaultValue={toIsoLocal(l.followUpAt)} onBlur={e => onSchedule(l.id, "followUpAt", e.target.value)} className="text-[10px] border-slate-200 rounded px-1.5 py-0.5" />
                    <span className="material-icons text-[14px] text-slate-300">calendar_today</span>
                  </div>
                </td>
              </tr>
            ))}
            {leads.length === 0 && !loading && (
              <tr><td colSpan={5} className="py-20 text-center text-slate-400">조회된 데이터가 없습니다.</td></tr>
            )}
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

function LeadDrawer({ lead, loading, error, onRetry, onClose, users, onStatus, onAssignee, onSchedule, memos, memoInput, onMemoInput, onSaveMemo, memoSaving }: { lead: Lead | null; loading?: boolean; error?: string | null; onRetry?: () => void; onClose: () => void; users: User[]; onStatus: (id: number, s: CrmStatus) => Promise<void>; onAssignee: (id: number, userId: number | null) => Promise<void>; onSchedule: (id: number, field: string, val: string) => Promise<void>; memos: LeadMemo[]; memoInput: string; onMemoInput: (v: string) => void; onSaveMemo: () => void; memoSaving: boolean; }) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (lead && closeBtnRef.current) {
      closeBtnRef.current.focus();
    }
  }, [lead]);

  if (!lead && !loading && !error) return null;
  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm" onClick={onClose}></div>
      <aside className="fixed top-0 right-0 z-40 h-full w-[420px] bg-white shadow-2xl flex flex-col translate-x-0 transition-transform">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-primary font-bold text-xl">{lead?.name?.[0] || "?"}</div>
            <div>
              <h2 className="font-bold text-lg">{lead?.name || (loading ? "불러오는 중..." : "데이터 없음")}</h2>
              <div className="text-sm text-slate-500">{lead?.phone || ""}</div>
            </div>
          </div>
          <button ref={closeBtnRef} onClick={onClose} className="text-slate-400 hover:text-slate-600"><span className="material-icons">close</span></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
              <span className="material-icons animate-spin">refresh</span>
              <span className="text-sm">상세 정보를 불러오는 중</span>
            </div>
          )}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
              <span className="material-icons text-red-500 text-3xl">error</span>
              <div className="text-sm font-semibold">{error}</div>
              <div className="flex gap-2">
                <button onClick={onRetry} className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm">재시도</button>
                <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-100 text-sm">닫기</button>
              </div>
            </div>
          )}
          {!loading && !error && lead && (
            <>
              <section><h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3">상태 변경</h4><div className="grid grid-cols-2 gap-2">{statusOptions.map(s => <button key={s} onClick={() => onStatus(lead.id, s)} className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${lead.crmStatus === s ? 'bg-primary/5 border-primary text-primary shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{s}</button>)}</div></section>
              <section><h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">담당 상담원</h4><select value={lead.assigneeId || ""} onChange={e => onAssignee(lead.id, Number(e.target.value) || null)} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm">{users.map((u: User) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></section>
              <section className="grid grid-cols-2 gap-4"><div><h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">팔로업 일정</h4><input type="datetime-local" defaultValue={toIsoLocal(lead.followUpAt)} onBlur={e => onSchedule(lead.id, "followUpAt", e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-xs" /></div><div><h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">예약 확정</h4><input type="datetime-local" defaultValue={toIsoLocal(lead.appointmentAt)} onBlur={e => onSchedule(lead.id, "appointmentAt", e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-xs" /></div></section>
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase">직원 메모</h4>
                  <span className="text-[10px] text-slate-400">{memoInput.length}/2000</span>
                </div>
                <textarea
                  value={memoInput}
                  onChange={(e) => onMemoInput(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg p-3 text-sm resize-none focus:ring-primary/30 focus:outline-none"
                  placeholder="통화 특이사항을 기록하세요."
                />
                <div className="flex justify-end">
                  <button
                    onClick={onSaveMemo}
                    disabled={memoSaving}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${memoSaving ? "bg-slate-200 text-slate-500" : "bg-primary text-white shadow-sm"}`}
                  >
                    {memoSaving ? "저장 중..." : "메모 저장"}
                  </button>
                </div>
                <div className="space-y-2">
                  {memos.map((m) => (
                    <div key={m.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                      <div className="text-[11px] text-slate-500 flex justify-between">
                        <span className="font-semibold text-slate-600">{m.authorName}</span>
                        <span>{new Date(m.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{m.body}</p>
                    </div>
                  ))}
                  {memos.length === 0 && <div className="text-sm text-slate-400">메모가 없습니다.</div>}
                </div>
              </section>
            </>
          )}
        </div>
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3 shrink-0">
          <button className="flex-1 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600" disabled>부재중 전송</button>
          <button className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium shadow-lg shadow-primary/20" disabled>예약 하기</button>
        </div>
      </aside>
    </>
  );
}

function SkeletonOverlay({ viewMode }: { viewMode: ViewMode }) {
  return (
    <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-slate-500">
        <span className="material-icons animate-spin">refresh</span>
        <span className="text-xs font-medium">{viewMode === "kanban" ? "칸반 데이터를 불러오는 중" : viewMode === "list" ? "리스트 데이터를 불러오는 중" : "캘린더를 불러오는 중"}</span>
      </div>
    </div>
  );
}
