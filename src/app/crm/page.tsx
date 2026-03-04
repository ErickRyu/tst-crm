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
  age: number | null;
  gender: string | null;
  media: string;
  memoBody: string | null;
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
  version?: number;
  updatedAt?: string;
  createdAt: string;
}

interface SmsTemplate {
  key: string;
  label: string;
  icon: string;
  body: string;
  msgType: "SMS" | "LMS";
  statuses?: string[];
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

interface KanbanProps {
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

function fmtCreatedAt(dt: string) {
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const [memoLoading, setMemoLoading] = useState(false);
  const [memoSaving, setMemoSaving] = useState(false);
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>([]);
  const [smsSending, setSmsSending] = useState(false);
  const [smsTestMode, setSmsTestMode] = useState(true);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<CrmStatus | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [counselorOpen, setCounselorOpen] = useState(false);
  const hasLoaded = useRef(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const { pushToast } = useToast();
  const { start: startLoading, stop: stopLoading } = useLoading();
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";
  const currentUser = process.env.NEXT_PUBLIC_USER_NAME || "상담원";
  const [pollTick, setPollTick] = useState(0);

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
    const isInitial = !hasLoaded.current;
    const loadingId = isInitial ? startLoading("데이터를 불러오는 중") : null;
    try {
      if (isInitial) setLoading(true);
      setError(null);
      await Promise.all([fetchLeads(), fetchCalendar()]);
      hasLoaded.current = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "조회 중 오류";
      setError(msg);
      pushToast(msg, "error", refreshAll);
    }
    finally {
      setLoading(false);
      if (loadingId) stopLoading(loadingId);
    }
  }, [fetchLeads, fetchCalendar, pushToast, startLoading, stopLoading]);

  const fetchSmsTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/sms/templates");
      const json = await res.json();
      setSmsTemplates((json.data || []) as SmsTemplate[]);
      setSmsTestMode(json.meta?.testMode ?? true);
    } catch {
      /* templates are non-critical */
    }
  }, []);

  const sendSms = async (leadId: number, msg: string, templateKey?: string) => {
    if (!msg.trim()) {
      pushToast("메시지 내용을 입력하세요.", "error");
      return;
    }
    try {
      setSmsSending(true);
      const res = await fetch(`/api/crm/leads/${leadId}/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msg: msg.trim(),
          templateKey,
          senderName: currentUser,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "SMS 발송 실패");
      pushToast(json.message, json.data?.testMode ? "info" : "success");
      // 메모 새로고침 (system 메모가 추가되었으므로)
      if (selectedLeadId) {
        const memosRes = await fetch(`/api/crm/leads/${selectedLeadId}/memos`);
        const memosJson = await memosRes.json();
        if (memosRes.ok) setMemos(memosJson.data || []);
      }
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "SMS 발송 실패", "error");
    } finally {
      setSmsSending(false);
    }
  };

  useEffect(() => { fetchUsers(); fetchSmsTemplates(); }, [fetchUsers, fetchSmsTemplates]);
  useEffect(() => { refreshAll(); }, [refreshAll]);
  // 30초 폴링으로 실시간성 보강
  useEffect(() => {
    const t = setInterval(() => {
      setPollTick((v) => v + 1);
    }, 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    void refreshAll();
  }, [pollTick, refreshAll]);

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
        setMemoLoading(true);
        const res = await fetch(`/api/crm/leads/${id}/memos`, {
          headers: apiKey ? { "x-api-key": apiKey } : undefined,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "메모 조회 실패");
        const data = (json.data || []) as LeadMemo[];
        setMemos(data);
        setMemoInput(data[0]?.body || "");
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "메모 조회 실패", "error");
      } finally {
        setMemoLoading(false);
      }
    };
    if (selectedLeadId) {
      void fetchMemos(selectedLeadId);
    } else {
      setMemos([]);
      setMemoInput("");
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
        body: JSON.stringify({ authorName: currentUser, body: memoInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "메모 저장 실패");
      setMemos([json.data as LeadMemo]);
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

  const saveQuickMemo = async (leadId: number, body: string) => {
    const res = await fetch(`/api/crm/leads/${leadId}/memos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorName: currentUser, body }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "메모 저장 실패");
    // 로컬 leads 상태에서 해당 리드의 memoBody 갱신
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, memoBody: body } : l));
    // 현재 열린 리드와 같으면 메모 상태도 갱신
    if (selectedLeadId === leadId) {
      setMemos([json.data as LeadMemo]);
      setMemoInput((json.data as LeadMemo).body);
    }
    pushToast("메모가 저장되었습니다.", "success");
  };

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
      <aside className="hidden md:flex w-16 flex-col items-center py-6 bg-card border-r border-border shrink-0">
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
        <header className="flex flex-col gap-2 px-3 py-2 md:h-16 md:flex-row md:items-center md:justify-between md:px-6 md:py-0 bg-card border-b border-border shrink-0">
          <div className="flex items-center gap-2 flex-wrap md:gap-6 md:flex-nowrap">
            <h1 className="text-base md:text-xl font-bold">접수 현황</h1>
            <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
              <button aria-pressed={viewMode === "kanban"} onClick={() => setViewMode("kanban")} disabled={loading} className={`px-2 py-1 text-[10px] md:px-3 md:py-1.5 md:text-xs font-medium rounded flex items-center gap-1.5 transition-all ${viewMode === "kanban" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"} ${loading ? "opacity-60 cursor-not-allowed" : ""}`}><span className="material-icons text-sm">view_kanban</span> 칸반</button>
              <button aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")} disabled={loading} className={`px-2 py-1 text-[10px] md:px-3 md:py-1.5 md:text-xs font-medium rounded flex items-center gap-1.5 transition-all ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"} ${loading ? "opacity-60 cursor-not-allowed" : ""}`}><span className="material-icons text-sm">view_list</span> 리스트</button>
              <button aria-pressed={viewMode === "calendar"} onClick={() => setViewMode("calendar")} disabled={loading} className={`px-2 py-1 text-[10px] md:px-3 md:py-1.5 md:text-xs font-medium rounded flex items-center gap-1.5 transition-all ${viewMode === "calendar" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"} ${loading ? "opacity-60 cursor-not-allowed" : ""}`}><span className="material-icons text-sm">calendar_today</span> 캘린더</button>
            </div>
            
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg shrink-0 ml-0 md:ml-2">
              <button onClick={() => { setScope("all"); setSelectedUserId(null); }} className={`px-3 py-1.5 text-[11px] font-bold rounded transition-all ${scope === "all" ? "bg-primary text-white" : "text-slate-500"}`}>전체보기</button>
              <button onClick={() => { setScope("mine"); if (users.length > 0 && !selectedUserId) setSelectedUserId(users[0].id); }} className={`px-3 py-1.5 text-[11px] font-bold rounded transition-all ${scope === "mine" ? "bg-primary text-white" : "text-slate-500"}`}>내 할당</button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer ml-0 md:ml-4">
              <input type="checkbox" checked={includeDone} onChange={e => setIncludeDone(e.target.checked)} className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4" />
              <span className="text-[11px] font-bold text-slate-500">완료 항목 포함</span>
            </label>
          </div>

          <div className="flex items-center flex-wrap gap-2 w-full md:w-auto md:flex-nowrap md:gap-4">
            <div className="relative flex-1 min-w-0 md:flex-none"><span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">search</span><input ref={searchInputRef} type="text" placeholder="환자명, 전화번호..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-64 bg-slate-100 border-none rounded-lg py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/20" /></div>
            {/* Desktop: native select */}
            <select value={selectedUserId || ""} onChange={(e) => { const v = e.target.value ? Number(e.target.value) : null; setSelectedUserId(v); if(v) setScope("mine"); }} className="hidden md:block shrink-0 bg-card border border-border rounded-lg px-3 py-2 text-sm font-medium">
              <option value="">전체 상담원</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            {/* Mobile: custom dropdown */}
            <div className="relative shrink-0 md:hidden">
              <button onClick={() => setCounselorOpen(!counselorOpen)} className="flex items-center gap-1 bg-card border border-border rounded-lg px-3 py-2 text-sm font-medium">
                {selectedUserId ? users.find(u => u.id === selectedUserId)?.name ?? "상담원" : "전체 상담원"}
                <span className="material-icons text-sm">{counselorOpen ? "expand_less" : "expand_more"}</span>
              </button>
              {counselorOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCounselorOpen(false)} />
                  <div className="absolute top-full right-0 mt-1 bg-white border border-border rounded-lg shadow-xl z-50 min-w-[140px] py-1 max-h-60 overflow-y-auto">
                    <button onClick={() => { setSelectedUserId(null); setCounselorOpen(false); }} className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${!selectedUserId ? "text-primary font-bold" : ""}`}>전체 상담원</button>
                    {users.map(u => (
                      <button key={u.id} onClick={() => { setSelectedUserId(u.id); setScope("mine"); setCounselorOpen(false); }} className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${selectedUserId === u.id ? "text-primary font-bold" : ""}`}>{u.name}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="hidden md:flex"><Legend /></div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-2 md:p-6 relative" tabIndex={-1} ref={viewContainerRef}>
          {loading && !hasLoaded.current && <SkeletonOverlay viewMode={viewMode} />}
          {(hasLoaded.current || !loading) && viewMode === "kanban" && <KanbanView grouped={groupedLeads} users={users} onSelect={setSelectedLeadId} selectedId={selectedLeadId} onStatus={updateStatus} onSaveMemo={saveQuickMemo} draggingId={draggingId} setDraggingId={setDraggingId} dragOverStatus={dragOverStatus} setDragOverStatus={setDragOverStatus} />}
          {(hasLoaded.current || !loading) && viewMode === "list" && <ListView leads={filteredLeads} users={users} onSelect={setSelectedLeadId} selectedId={selectedLeadId} onStatus={updateStatus} onAssignee={updateAssignee} onSchedule={updateSchedule} loading={loading} />}
          {(hasLoaded.current || !loading) && viewMode === "calendar" && <CalendarView events={calendarEvents} />}
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
        memoLoading={memoLoading}
        onMemoInput={setMemoInput}
        onSaveMemo={() => selectedLeadId && saveMemo(selectedLeadId)}
        smsTemplates={smsTemplates}
        smsSending={smsSending}
        smsTestMode={smsTestMode}
        onSendSms={(msg, templateKey) => selectedLeadId && sendSms(selectedLeadId, msg, templateKey)}
      />
      
      {error && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-2 rounded-full shadow-2xl z-50 flex items-center gap-2"><span className="material-icons">warning</span> {error} <button onClick={() => setError(null)}>✕</button></div>}
      </div>
    </FeedbackProvider>
  );
}

function KanbanView({ grouped, users, onSelect, selectedId, onStatus, onSaveMemo, draggingId, setDraggingId, dragOverStatus, setDragOverStatus }: KanbanProps) {
  return (
    <div className="flex gap-2 h-full overflow-x-auto pb-4 items-start snap-x snap-mandatory md:gap-4 md:snap-none">
      {statusOptions.map(status => (
        <div key={status} onDragOver={(e) => { e.preventDefault(); setDragOverStatus(status); }} onDragLeave={() => setDragOverStatus(null)} onDrop={() => { if (!draggingId) return; setDragOverStatus(null); onStatus(draggingId, status); setDraggingId(null); }}
          className={`w-72 shrink-0 snap-center md:w-80 flex flex-col max-h-full rounded-xl border border-border bg-slate-100/40 transition-colors ${dragOverStatus === status ? "bg-primary/5 border-primary/40" : ""}`}
        >
          <div className="p-3 md:p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${statusStyles[status].dot}`}></span><span className="font-bold text-sm text-slate-700">{status}</span><span className="bg-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm">{grouped[status].length}</span></div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 space-y-2 pb-3 md:px-3 md:space-y-3 md:pb-4">
            {grouped[status].map((l) => (
              <KanbanCard key={l.id} lead={l} users={users} selectedId={selectedId} draggingId={draggingId} onSelect={onSelect} onSaveMemo={onSaveMemo} setDraggingId={setDraggingId} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function KanbanCard({ lead: l, users, selectedId, draggingId, onSelect, onSaveMemo, setDraggingId }: {
  lead: Lead; users: User[]; selectedId: number | null; draggingId: number | null;
  onSelect: (id: number) => void; onSaveMemo: (leadId: number, body: string) => Promise<void>;
  setDraggingId: (id: number | null) => void;
}) {
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoText, setMemoText] = useState("");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const openEditor = () => {
    setMemoText(l.memoBody || "");
    setMemoOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSave = async () => {
    if (!memoText.trim()) return;
    try {
      setSaving(true);
      await onSaveMemo(l.id, memoText.trim());
      setMemoOpen(false);
    } catch { /* toast handled upstream */ }
    finally { setSaving(false); }
  };

  return (
    <div draggable onDragStart={() => setDraggingId(l.id)} onDragEnd={() => setDraggingId(null)} onClick={() => onSelect(l.id)}
      className={`p-3 md:p-4 rounded-xl shadow-sm border bg-white cursor-grab transition-all hover:shadow-md ${statusStyles[l.crmStatus].border} ${selectedId === l.id ? "ring-2 ring-primary" : ""} ${draggingId === l.id ? "opacity-40" : ""}`}
    >
      <div className="flex justify-between items-start mb-2">
        <div><div className="font-bold text-sm">{l.name}</div><PhoneLink phone={l.phone} className="text-xs md:text-[10px] text-slate-500" /></div>
        <div className="text-[10px] text-slate-400 whitespace-nowrap">{fmtCreatedAt(l.createdAt)}</div>
      </div>
      <div className="flex flex-wrap gap-1 mb-2 md:mb-3">
        {l.age != null && <TagChip label={`${l.age}세`} tone="blue" />}
        {l.gender && <TagChip label={l.gender === "남" ? "남" : "여"} tone={l.gender === "남" ? "blue" : "pink"} />}
        {l.media && <TagChip label={l.media} tone="purple" />}
        <TagChip label={l.careTag} tone={l.careTag.includes("임플란트") ? "indigo" : "slate"} />
        {l.appointmentAt && <TagChip label={`${new Date(l.appointmentAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })} 예약`} tone="green" />}
      </div>
      {/* Inline memo */}
      <div className="mt-2 pt-2 border-t border-slate-50" onClick={e => e.stopPropagation()}>
        {!memoOpen ? (
          l.memoBody ? (
            <button onClick={openEditor}
              className="group flex items-start gap-1 text-left text-[11px] text-slate-600 leading-relaxed w-full hover:text-primary transition-colors">
              <span className="material-icons text-[12px] mt-0.5 shrink-0 text-slate-300 group-hover:text-primary transition-colors">edit_note</span>
              <span className="line-clamp-2">{l.memoBody}</span>
            </button>
          ) : (
            <button onClick={openEditor}
              className="flex items-center gap-1 text-xs py-1 md:text-[10px] md:py-0 text-slate-400 hover:text-primary transition-colors w-full">
              <span className="material-icons text-[12px]">edit_note</span> 메모 입력...
            </button>
          )
        ) : (
          <div className="space-y-1.5">
            <textarea ref={textareaRef} value={memoText} onChange={e => setMemoText(e.target.value)}
              rows={3} maxLength={2000} placeholder="메모를 입력하세요..."
              className="w-full text-[11px] border border-slate-200 rounded-lg p-2 resize-none focus:ring-1 focus:ring-primary/30 focus:outline-none"
              onKeyDown={e => { if (e.ctrlKey && e.key === "Enter") { e.preventDefault(); handleSave(); } if (e.key === "Escape") { setMemoOpen(false); setMemoText(""); } }}
            />
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => { setMemoOpen(false); setMemoText(""); }} className="text-xs px-3 py-1.5 md:text-[10px] md:px-2 md:py-0.5 rounded bg-slate-100 text-slate-500">취소</button>
              <button onClick={handleSave} disabled={saving || !memoText.trim()}
                className="text-xs px-3 py-1.5 md:text-[10px] md:px-2 md:py-0.5 rounded bg-primary text-white disabled:opacity-40">
                {saving ? "저장..." : "저장"}
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

function ListView({ leads, users, onSelect, selectedId, onStatus, onAssignee, onSchedule, loading }: ViewProps) {
  const stop = (e: React.MouseEvent | React.ChangeEvent) => e.stopPropagation();
  return (
    <div className="h-full flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Mobile card list */}
      <div className="flex-1 overflow-auto md:hidden">
        {loading && <div className="flex items-center justify-center py-10"><span className="material-icons text-slate-400 animate-pulse">hourglass_empty</span></div>}
        {!loading && leads.length === 0 && <div className="py-20 text-center text-slate-400">조회된 데이터가 없습니다.</div>}
        {!loading && <div className="divide-y divide-slate-100">
          {leads.map((l) => (
            <div key={l.id} onClick={() => onSelect(l.id)} className={`p-3 cursor-pointer transition-colors ${selectedId === l.id ? "bg-blue-50/50" : ""}`}>
              <div className="flex justify-between items-start mb-2">
                <div><div className="font-bold text-sm text-slate-900">{l.name}</div><PhoneLink phone={l.phone} className="text-xs text-slate-500" /></div>
                <div className="text-[10px] text-slate-400 whitespace-nowrap">{fmtCreatedAt(l.createdAt)}</div>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {l.age != null && <TagChip label={`${l.age}세`} tone="blue" />}
                {l.gender && <TagChip label={l.gender === "남" ? "남" : "여"} tone={l.gender === "남" ? "blue" : "pink"} />}
                {l.media && <TagChip label={l.media} tone="purple" />}
                <TagChip label={l.careTag} tone={l.careTag.includes("임플란트") ? "indigo" : "slate"} />
              </div>
              <div className="flex items-center gap-2" onClick={stop}>
                <select value={l.crmStatus} onChange={e => onStatus(l.id, e.target.value as CrmStatus)} className={`text-[11px] font-bold border-slate-200 rounded px-2 py-1.5 bg-white focus:ring-1 focus:ring-primary flex-1 ${statusStyles[l.crmStatus].badge}`}>
                  {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={l.assigneeId || ""} onChange={e => onAssignee(l.id, e.target.value ? Number(e.target.value) : null)} className="text-[11px] border-slate-200 rounded px-2 py-1.5 bg-white flex-1">
                  <option value="">미할당</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>}
      </div>
      {/* Desktop table */}
      <div className="flex-1 overflow-auto relative hidden md:block">
        {loading && <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10 flex items-center justify-center"><span className="material-icons text-slate-400 animate-pulse">hourglass_empty</span></div>}
        <table className="w-full text-left text-sm border-collapse">
          <thead className="sticky top-0 bg-slate-50 border-b border-border z-10">
            <tr>
              <th className="px-6 py-3 font-semibold text-slate-500 uppercase text-[10px]">환자 정보</th>
              <th className="px-6 py-3 font-semibold text-slate-500 uppercase text-[10px]">태그 및 뱃지</th>
              <th className="px-6 py-3 font-semibold text-slate-500 uppercase text-[10px]">상태 (인라인)</th>
              <th className="px-6 py-3 font-semibold text-slate-500 uppercase text-[10px]">담당자 (인라인)</th>
              <th className="px-3 py-3 font-semibold text-slate-500 uppercase text-[10px]">예약 일정</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((l) => (
              <tr key={l.id} onClick={() => onSelect(l.id)} className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedId === l.id ? "bg-blue-50/50" : ""}`}>
                <td className="px-6 py-3"><div className="flex items-center gap-2"><div><div className="font-bold text-slate-900">{l.name}</div><PhoneLink phone={l.phone} className="text-[10px] text-slate-500" /></div></div></td>
                <td className="px-6 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {l.age != null && <TagChip label={`${l.age}세`} tone="blue" />}
                    {l.gender && <TagChip label={l.gender === "남" ? "남" : "여"} tone={l.gender === "남" ? "blue" : "pink"} />}
                    {l.media && <TagChip label={l.media} tone="purple" />}
                    <TagChip label={fmtCreatedAt(l.createdAt)} tone="gray" />
                    <TagChip label={l.careTag} tone={l.careTag.includes("임플란트") ? "indigo" : "slate"} />
                  </div>
                </td>
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
                <td className="px-3 py-3" onClick={stop}>
                    <input type="datetime-local" defaultValue={toIsoLocal(l.appointmentAt)} onBlur={e => onSchedule(l.id, "appointmentAt", e.target.value)} className="text-[10px] border-slate-200 rounded px-1 py-0.5" />
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
      <div className="p-3 md:p-4 bg-slate-50 border-b border-border flex justify-between items-center"><h3 className="font-bold">{cur.getFullYear()}년 {cur.getMonth()+1}월 일정</h3><div className="flex gap-1"><button onClick={() => setCur(new Date(cur.getFullYear(), cur.getMonth()-1))} className="p-2 md:p-1 border border-border rounded hover:bg-white"><span className="material-icons">chevron_left</span></button><button onClick={() => setCur(new Date())} className="px-3 py-1 border border-border rounded hover:bg-white text-xs">오늘</button><button onClick={() => setCur(new Date(cur.getFullYear(), cur.getMonth()+1))} className="p-2 md:p-1 border border-border rounded hover:bg-white"><span className="material-icons">chevron_right</span></button></div></div>
      <div className="flex-1 overflow-auto p-4"><div className="grid grid-cols-7 bg-slate-200 border border-slate-200 gap-px">
        {["일","월","화","수","목","금","토"].map(d => <div key={d} className="bg-slate-50 py-1 text-center text-[9px] md:py-2 md:text-[10px] font-bold text-slate-400">{d}</div>)}
        {Array.from({length: start}).map((_, i) => <div key={i} className="bg-slate-50/50 min-h-[60px] md:min-h-[100px]"></div>)}
        {Array.from({length: days}).map((_, i) => { const d = i+1; return <div key={d} className="bg-white min-h-[60px] md:min-h-[100px] p-1 md:p-2 space-y-1"><div className="text-[10px] text-slate-400 font-bold">{d}</div>{grouped[d]?.map(e => <div key={e.id} className={`text-[9px] p-1 rounded border truncate ${e.type==='appointment'?'bg-emerald-50 border-emerald-100 text-emerald-700':'bg-blue-50 border-blue-100 text-blue-700'}`}>{e.patientName}</div>)}</div> })}
      </div></div>
    </div>
  );
}

function LeadDrawer({
  lead,
  loading,
  error,
  onRetry,
  onClose,
  users,
  onStatus,
  onAssignee,
  onSchedule,
  memos,
  memoInput,
  onMemoInput,
  onSaveMemo,
  memoSaving,
  memoLoading,
  smsTemplates,
  smsSending,
  smsTestMode,
  onSendSms,
}: {
  lead: Lead | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClose: () => void;
  users: User[];
  onStatus: (id: number, s: CrmStatus) => Promise<void>;
  onAssignee: (id: number, userId: number | null) => Promise<void>;
  onSchedule: (id: number, field: string, val: string) => Promise<void>;
  memos: LeadMemo[];
  memoInput: string;
  onMemoInput: (v: string) => void;
  onSaveMemo: () => void;
  memoSaving: boolean;
  memoLoading: boolean;
  smsTemplates: SmsTemplate[];
  smsSending: boolean;
  smsTestMode: boolean;
  onSendSms: (msg: string, templateKey?: string) => void;
}) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [smsMsg, setSmsMsg] = useState("");
  const [smsWithMemo, setSmsWithMemo] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [washing, setWashing] = useState(false);

  const handleWash = async () => {
    if (!memoInput.trim() || !lead) return;
    try {
      setWashing(true);
      const res = await fetch("/api/crm/memos/wash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: memoInput.trim(), patientName: lead.name, phone: lead.phone }),
      });
      const json = await res.json();
      if (res.ok && json.data?.washed) onMemoInput(json.data.washed);
    } catch { /* silent */ }
    finally { setWashing(false); }
  };

  useEffect(() => {
    if (lead && closeBtnRef.current) {
      closeBtnRef.current.focus();
    }
  }, [lead]);

  // 리드 변경 시 SMS 입력 초기화
  useEffect(() => {
    setSmsMsg("");
    setQuickMenuOpen(false);
  }, [lead?.id]);

  const handleSendSms = () => {
    if (!smsMsg.trim()) return;
    onSendSms(smsMsg.trim());
    // SMS와 동시에 메모 저장
    if (smsWithMemo && smsMsg.trim()) {
      onMemoInput(`[SMS 발송] ${smsMsg.trim()}`);
    }
    setSmsMsg("");
  };

  const handleTemplateSelect = (tpl: SmsTemplate) => {
    // %고객명% 치환 preview
    const msg = lead ? tpl.body.replace(/%고객명%/g, lead.name) : tpl.body;
    setSmsMsg(msg);
    setQuickMenuOpen(false);
  };

  if (!lead && !loading && !error) return null;
  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm" onClick={onClose}></div>
      <aside className="fixed bottom-0 left-0 right-0 z-40 max-h-[90vh] w-full rounded-t-2xl md:top-0 md:bottom-auto md:left-auto md:right-0 md:h-full md:max-h-full md:w-[420px] md:rounded-none bg-white shadow-2xl flex flex-col">
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2 pb-1 md:hidden"><div className="w-10 h-1 rounded-full bg-slate-300"></div></div>
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-start bg-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-primary font-bold text-xl shrink-0">{lead?.name?.[0] || "?"}</div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg">{lead?.name || (loading ? "불러오는 중..." : "데이터 없음")}</h2>
                {lead?.crmStatus && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusStyles[lead.crmStatus]?.badge || ""}`}>{lead.crmStatus}</span>}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 mt-0.5">
                <span className="material-icons text-[14px]">smartphone</span>
                {lead?.phone ? <PhoneLink phone={lead.phone} /> : ""}
              </div>
            </div>
          </div>
          <button ref={closeBtnRef} onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 -m-2 md:p-0 md:m-0"><span className="material-icons">close</span></button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {loading && (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-400 gap-2">
              <span className="material-icons animate-spin">refresh</span>
              <span className="text-sm">상세 정보를 불러오는 중</span>
            </div>
          )}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-500 gap-3">
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
              {/* Status & Assignment */}
              <div className="p-4 space-y-4 md:p-6 md:space-y-6">
                <section>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">상태 변경</h4>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${statusStyles[lead.crmStatus].dot}`}></span>
                    <select value={lead.crmStatus} onChange={e => onStatus(lead.id, e.target.value as CrmStatus)} className={`flex-1 border border-slate-200 rounded-lg p-2.5 text-sm font-medium focus:ring-1 focus:ring-primary ${statusStyles[lead.crmStatus].badge}`}>
                      {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </section>
                <section><h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">담당 상담원</h4><select value={lead.assigneeId || ""} onChange={e => onAssignee(lead.id, Number(e.target.value) || null)} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm">{users.map((u: User) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></section>
                <section className="flex flex-wrap gap-1">
                  {lead.age != null && <TagChip label={`${lead.age}세`} tone="blue" />}
                  {lead.gender && <TagChip label={lead.gender === "남" ? "남" : "여"} tone={lead.gender === "남" ? "blue" : "pink"} />}
                  {lead.media && <TagChip label={lead.media} tone="purple" />}
                  <TagChip label={fmtCreatedAt(lead.createdAt)} tone="gray" />
                  <TagChip label={lead.careTag} tone={lead.careTag.includes("임플란트") ? "indigo" : "slate"} />
                </section>
                <section><h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">예약 확정</h4><input type="datetime-local" defaultValue={toIsoLocal(lead.appointmentAt)} onBlur={e => onSchedule(lead.id, "appointmentAt", e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-xs" /></section>
              </div>

              {/* SMS Send Area */}
              <div className="p-4 bg-white border-t border-slate-200">
                <div className="relative">
                  <textarea
                    value={smsMsg}
                    onChange={(e) => setSmsMsg(e.target.value)}
                    maxLength={2000}
                    rows={3}
                    className="w-full bg-slate-50 border-none rounded-lg p-3 pr-12 text-sm text-slate-700 focus:ring-2 focus:ring-primary/20 resize-none placeholder-slate-400"
                    placeholder="메시지를 입력하세요... (전송: Enter)"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendSms();
                      }
                    }}
                  />
                  <div className="absolute bottom-2 right-2 text-[10px] text-slate-400">
                    {smsMsg.length > 0 && `${smsMsg.length}자`}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuickMenuOpen(!quickMenuOpen)}
                      className="text-xs flex items-center gap-1 px-2 py-1 bg-yellow-50 text-yellow-600 rounded border border-yellow-100 hover:bg-yellow-100 transition-colors"
                    >
                      <span className="material-icons text-[14px]">bolt</span> 빠른 답변
                    </button>
                    <div className="flex items-center gap-1 ml-2">
                      <input
                        type="checkbox"
                        checked={smsWithMemo}
                        onChange={(e) => setSmsWithMemo(e.target.checked)}
                        id="sms-memo-sync"
                        className="rounded border-slate-300 text-primary focus:ring-primary h-3 w-3"
                      />
                      <label htmlFor="sms-memo-sync" className="text-xs text-slate-500">SMS 동시 전송</label>
                    </div>
                    {smsTestMode && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">TEST</span>
                    )}
                  </div>
                  <button
                    onClick={handleSendSms}
                    disabled={smsSending || !smsMsg.trim()}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm ${
                      smsSending || !smsMsg.trim()
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-primary hover:bg-blue-700 text-white"
                    }`}
                  >
                    {smsSending ? "발송 중..." : "전송"}
                  </button>
                </div>

                {/* Quick Template Menu */}
                {quickMenuOpen && (() => {
                  const recommended = smsTemplates.filter(t => t.statuses?.includes(lead.crmStatus));
                  const others = smsTemplates.filter(t => !t.statuses?.includes(lead.crmStatus));
                  return (
                    <div className="mt-2 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                      {recommended.length > 0 && (
                        <>
                          <div className="px-4 py-1.5 bg-primary/5 text-[10px] font-bold text-primary uppercase tracking-wider">추천 ({lead.crmStatus})</div>
                          {recommended.map((tpl) => (
                            <button key={tpl.key} onClick={() => handleTemplateSelect(tpl)}
                              className="w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-primary/5 flex items-center gap-2 text-left transition-colors border-l-2 border-l-primary">
                              <span className="material-icons text-sm text-primary">{tpl.icon}</span>
                              <span className="font-medium">{tpl.label}</span>
                              <span className="ml-auto text-[10px] text-slate-400">{tpl.msgType}</span>
                            </button>
                          ))}
                        </>
                      )}
                      {others.length > 0 && (
                        <>
                          {recommended.length > 0 && <div className="px-4 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">전체</div>}
                          {others.map((tpl) => (
                            <button key={tpl.key} onClick={() => handleTemplateSelect(tpl)}
                              className="w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-left transition-colors">
                              <span className="material-icons text-sm text-slate-400">{tpl.icon}</span>
                              <span>{tpl.label}</span>
                              <span className="ml-auto text-[10px] text-slate-400">{tpl.msgType}</span>
                            </button>
                          ))}
                        </>
                      )}
                      {smsTemplates.length === 0 && (
                        <div className="px-4 py-3 text-sm text-slate-400">템플릿이 없습니다.</div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Staff Memos */}
              <div className="p-4 border-t border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-icons text-slate-400 text-sm">lock</span>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">직원 메모 (내부용)</h4>
                  <span className={`ml-auto text-[10px] ${memoInput.length > 1800 ? "text-red-500" : "text-slate-400"}`}>{memoInput.length}/2000</span>
                </div>
                <textarea
                  value={memoInput}
                  onChange={(e) => onMemoInput(e.target.value)}
                  maxLength={2000}
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg p-3 text-sm resize-none focus:ring-primary/30 focus:outline-none bg-white"
                  placeholder="통화 특이사항을 기록하세요."
                  onKeyDown={(e) => {
                    if (e.ctrlKey && e.key === "Enter") {
                      e.preventDefault();
                      onSaveMemo();
                    }
                  }}
                />
                <div className="flex justify-between mt-2">
                  <button
                    onClick={handleWash}
                    disabled={washing || !memoInput.trim()}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-violet-50 text-violet-600 hover:bg-violet-100 disabled:opacity-40 transition-colors"
                    title="자연어를 구조화 템플릿으로 변환"
                  >
                    <span className="material-icons text-[13px]">auto_fix_high</span> {washing ? "변환중..." : "워싱"}
                  </button>
                  <button
                    onClick={onSaveMemo}
                    disabled={memoSaving}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${memoSaving ? "bg-slate-200 text-slate-500" : "bg-primary text-white shadow-sm"}`}
                  >
                    {memoSaving ? "저장 중..." : "메모 저장"}
                  </button>
                </div>
                {memoLoading && <div className="text-sm text-slate-400 mt-2">메모를 불러오는 중...</div>}
                {!memoLoading && memos.length > 0 && memos[0].updatedAt && (
                  <div className="text-[11px] text-slate-400 mt-2">
                    마지막 수정: {new Date(memos[0].updatedAt).toLocaleString()}
                    {memos[0].version ? ` (v${memos[0].version})` : ""}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Action Buttons */}
        {lead && !loading && !error && (
          <div className="p-3 gap-2 md:p-4 md:gap-3 bg-white border-t border-slate-200 grid grid-cols-2 shrink-0">
            <div className="relative group">
              <button
                onClick={() => setQuickMenuOpen(!quickMenuOpen)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium transition-colors"
              >
                <span className="material-icons text-[18px] text-primary">send</span> 빠른 메시지
                <span className="material-icons text-[16px]">{quickMenuOpen ? "expand_less" : "expand_more"}</span>
              </button>
            </div>
            <button
              onClick={() => lead.appointmentAt ? undefined : onSchedule(lead.id, "appointmentAt", new Date().toISOString())}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-white hover:bg-blue-700 text-sm font-medium transition-colors shadow-sm shadow-primary/20"
            >
              <span className="material-icons text-[18px]">event</span> 예약 하기
            </button>
          </div>
        )}
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


function PhoneLink({ phone, className = "" }: { phone: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* fallback: do nothing */ }
  };
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} onClick={e => e.stopPropagation()}>
      <a href={`tel:${phone}`} className="hover:underline hover:text-primary transition-colors" title="전화 걸기">{phone}</a>
      <button onClick={copy} className="text-slate-400 hover:text-primary transition-colors shrink-0 p-1 -m-1 md:p-0 md:m-0" title="번호 복사" aria-label="전화번호 복사">
        <span className="material-icons" style={{ fontSize: "12px" }}>{copied ? "check" : "content_copy"}</span>
      </button>
    </span>
  );
}

function TagChip({ label, tone }: { label: string; tone: "indigo" | "slate" | "amber" | "blue" | "pink" | "purple" | "gray" | "green" }) {
  if (!label) return null;
  const classes = {
    indigo: "bg-indigo-50 text-indigo-700",
    slate: "bg-slate-100 text-slate-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    pink: "bg-pink-50 text-pink-700",
    purple: "bg-purple-50 text-purple-700",
    gray: "bg-slate-50 text-slate-500",
    green: "bg-emerald-50 text-emerald-700",
  }[tone];
  return <span className={`px-2 py-1 text-[11px] md:px-1.5 md:py-0.5 md:text-[10px] rounded font-bold ${classes}`} title={label} aria-label={label}>{label}</span>;
}

function Legend() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-slate-500">
      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></span>나이/성별</span>
      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-100 border border-purple-200"></span>유입채널</span>
      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-200"></span>유입일시</span>
      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-100 border border-indigo-200"></span>특화진료</span>
    </div>
  );
}

