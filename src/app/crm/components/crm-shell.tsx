"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useLoading } from "../ui/loading-overlay";
import type { ViewMode, Scope, CrmStatus, Lead, User, LeadMemo, SmsTemplate } from "../types";
import { statusOptions, kanbanStatusOptions, statusStyles } from "../types";
import { KanbanView } from "./kanban-view";
import { ListView } from "./list-view";
import { CalendarView } from "./calendar-view";
import { LeadDrawer } from "./lead-drawer";
import { SkeletonOverlay } from "./skeleton-overlay";
import { PrimaryBar } from "./primary-bar";
import { FilterPanel } from "./filter-panel";
import { CrmSidebar } from "./sidebar";
import { useLeadDetail } from "../hooks/use-lead-detail";
import { useCalendarData } from "../hooks/use-calendar-data";

export function CrmShell() {
  const router = useRouter();
  const { data: session } = useSession();
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [scope, setScope] = useState<Scope>("all");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memoSaving, setMemoSaving] = useState(false);
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>([]);
  const [smsSending, setSmsSending] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<CrmStatus | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [kanbanDoneDays, setKanbanDoneDays] = useState<7 | 30 | null>(7);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [excelMenuOpen, setExcelMenuOpen] = useState(false);
  const [excelDownloading, setExcelDownloading] = useState(false);
  const hasLoaded = useRef(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const { start: startLoading, stop: stopLoading } = useLoading();
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED !== "false";
  const currentUser = authEnabled
    ? (session?.user?.name || "상담원")
    : (process.env.NEXT_PUBLIC_USER_NAME || "상담원");
  const [pollTick, setPollTick] = useState(0);

  const { calendarEvents, fetchCalendar } = useCalendarData({
    assigneeId: selectedUserId,
    pollingMs: 0,
  });

  const {
    selectedLeadId, setSelectedLeadId,
    detailLead, detailLoading, detailError,
    memos, setMemos, memoInput, setMemoInput, memoLoading,
    activities, activitiesLoading, fetchActivities,
  } = useLeadDetail({ leads });

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (scope !== "all") count++;
    if (dateFrom || dateTo) count++;
    if (sortOrder !== "desc") count++;
    return count;
  }, [scope, dateFrom, dateTo, sortOrder]);

  const resetFilters = useCallback(() => {
    setScope("all");
    setSelectedUserId(null);
    setSortOrder("desc");
    setDateFrom("");
    setDateTo("");
  }, []);

  useEffect(() => {
    if (viewMode !== "list") return;
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm, viewMode]);

  useEffect(() => {
    setCurrentPage(0);
  }, [scope, selectedUserId, sortOrder, dateFrom, dateTo, debouncedSearch, pageSize]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/users");
      const json = await res.json();
      setUsers((json.data || []) as User[]);
    } catch {
      setError("상담원 목록 조회 실패");
      toast.error("상담원 목록 조회 실패");
    }
  }, []);

  const fetchLeads = useCallback(async () => {
    const qs = new URLSearchParams({
      scope,
      includeDone: "true",
      sortOrder
    });
    if (selectedUserId) {
      qs.set("assigneeId", String(selectedUserId));
      if (scope !== "mine") setScope("mine");
    }
    if (dateFrom) qs.set("from", dateFrom);
    if (dateTo) qs.set("to", dateTo);

    if (viewMode === "list") {
      qs.set("page", String(currentPage));
      qs.set("pageSize", String(pageSize));
      if (debouncedSearch) qs.set("search", debouncedSearch);
    } else {
      qs.set("limit", "300");
    }

    const res = await fetch(`/api/crm/leads?${qs.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "리드 조회 실패");
    const newLeads = (json.data || []) as Lead[];
    setLeads(prev => {
      if (JSON.stringify(prev) === JSON.stringify(newLeads)) return prev;
      return newLeads;
    });

    if (viewMode === "list" && json.meta) {
      setTotalCount(json.meta.totalCount ?? 0);
      setTotalPages(json.meta.totalPages ?? 1);
      if (currentPage >= (json.meta.totalPages ?? 1) && (json.meta.totalPages ?? 1) > 0) {
        setCurrentPage((json.meta.totalPages ?? 1) - 1);
      }
    }
  }, [scope, selectedUserId, sortOrder, dateFrom, dateTo, viewMode, currentPage, pageSize, debouncedSearch]);

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
      toast.error(msg, { action: { label: "재시도", onClick: refreshAll } });
    }
    finally {
      setLoading(false);
      if (loadingId) stopLoading(loadingId);
    }
  }, [fetchLeads, fetchCalendar, startLoading, stopLoading]);

  const fetchSmsTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/sms/templates");
      const json = await res.json();
      setSmsTemplates((json.data || []) as SmsTemplate[]);
    } catch {
      /* templates are non-critical */
    }
  }, []);

  const sendSms = async (leadId: number, msg: string, templateKey?: string) => {
    if (!msg.trim()) {
      toast.error("메시지 내용을 입력하세요.");
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
      if (json.data?.testMode) toast.info(json.message); else toast.success(json.message);
      if (selectedLeadId) {
        const memosRes = await fetch(`/api/crm/leads/${selectedLeadId}/memos`);
        const memosJson = await memosRes.json();
        if (memosRes.ok) setMemos(memosJson.data || []);
        void fetchActivities(selectedLeadId);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "SMS 발송 실패");
    } finally {
      setSmsSending(false);
    }
  };

  useEffect(() => { fetchUsers(); fetchSmsTemplates(); }, [fetchUsers, fetchSmsTemplates]);
  useEffect(() => { refreshAll(); }, [refreshAll]);
  useEffect(() => {
    const t = setInterval(() => {
      setPollTick((v) => v + 1);
    }, 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    void refreshAll();
  }, [pollTick, refreshAll]);

  const updateStatus = async (id: number, status: CrmStatus) => {
    try {
      const version = leads.find(l => l.id === id)?.version;
      const res = await fetch(`/api/crm/leads/${id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ crmStatus: status, version, actorName: currentUser }),
      });
      if (res.ok) {
        toast.success("상태가 변경되었습니다.");
        await refreshAll();
        if (selectedLeadId === id) void fetchActivities(id);
      } else if (res.status === 409) {
        setError("다른 상담원이 먼저 변경했습니다. 새로고침 후 다시 시도하세요.");
        toast.error("다른 상담원이 먼저 변경했습니다.");
      } else setError("상태 변경 실패");
    } catch {
      setError("서버 통신 오류");
      toast.error("서버 통신 오류");
    }
  };

  const updateAssignee = async (id: number, assigneeId: number | null) => {
    try {
      const version = leads.find(l => l.id === id)?.version;
      const res = await fetch(`/api/crm/leads/${id}/assign`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assigneeId, version, actorName: currentUser }),
      });
      if (res.ok) {
        toast.success("담당자가 변경되었습니다.");
        await refreshAll();
        if (selectedLeadId === id) void fetchActivities(id);
      } else if (res.status === 409) {
        setError("다른 상담원이 먼저 변경했습니다. 새로고침 후 다시 시도하세요.");
        toast.error("다른 상담원이 먼저 변경했습니다.");
      }
    } catch { setError("할당 변경 실패"); toast.error("할당 변경 실패"); }
  };

  const updateSchedule = async (id: number, field: string, value: string) => {
    try {
      const version = leads.find(l => l.id === id)?.version;
      const res = await fetch(`/api/crm/leads/${id}/schedule`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value ? new Date(value).toISOString() : null, version, actorName: currentUser }),
      });
      if (res.ok) {
        toast.success("일정이 변경되었습니다.");
        await refreshAll();
        if (selectedLeadId === id) void fetchActivities(id);
      } else if (res.status === 409) {
        setError("다른 상담원이 먼저 변경했습니다. 새로고침 후 다시 시도하세요.");
        toast.error("다른 상담원이 먼저 변경했습니다.");
      }
    } catch { setError("일정 변경 실패"); toast.error("일정 변경 실패"); }
  };

  const saveMemo = async (leadId: number) => {
    if (!memoInput.trim()) {
      toast.error("메모를 입력하세요.");
      return;
    }
    if (memoInput.length > 2000) {
      toast.error("메모는 2000자 이하로 작성해주세요.");
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
      toast.success("메모가 저장되었습니다.");
      if (selectedLeadId) void fetchActivities(selectedLeadId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "메모 저장 실패");
    } finally {
      setMemoSaving(false);
    }
  };

  const filteredLeads = useMemo(() => {
    if (viewMode === "list") return leads;
    if (!searchTerm) return leads;
    const t = searchTerm.toLowerCase();
    return leads.filter(l => l.name.toLowerCase().includes(t) || l.phone.includes(t));
  }, [leads, searchTerm, viewMode]);

  const saveQuickMemo = async (leadId: number, body: string) => {
    const res = await fetch(`/api/crm/leads/${leadId}/memos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorName: currentUser, body }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "메모 저장 실패");
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, memoBody: body } : l));
    if (selectedLeadId === leadId) {
      setMemos([json.data as LeadMemo]);
      setMemoInput((json.data as LeadMemo).body);
    }
    toast.success("메모가 저장되었습니다.");
  };

  const DONE_STATUS_SET = useMemo(() => new Set<CrmStatus>(["응대중", "통화완료", "예약완료"]), []);

  const HIDDEN_STATUS_SET = useMemo(() => new Set<CrmStatus>(["추가상담거부", "블랙리스트", "중복"]), []);
  const KANBAN_STATUS_SET = useMemo(() => new Set<string>(kanbanStatusOptions), []);

  const groupedLeads = useMemo(() => {
    const g: Record<string, Lead[]> = Object.fromEntries(kanbanStatusOptions.map(s => [s, [] as Lead[]]));
    const cutoff = kanbanDoneDays != null
      ? new Date(Date.now() - kanbanDoneDays * 24 * 60 * 60 * 1000)
      : null;
    filteredLeads.forEach(l => {
      if (!KANBAN_STATUS_SET.has(l.crmStatus)) return;
      if (DONE_STATUS_SET.has(l.crmStatus) && cutoff) {
        if (new Date(l.createdAt) >= cutoff) g[l.crmStatus].push(l);
      } else {
        g[l.crmStatus].push(l);
      }
    });
    return g;
  }, [filteredLeads, kanbanDoneDays, DONE_STATUS_SET, KANBAN_STATUS_SET]);

  const doneTotalCounts = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(kanbanStatusOptions.map(s => [s, 0]));
    filteredLeads.forEach(l => {
      if (l.crmStatus in counts) counts[l.crmStatus]++;
    });
    return counts;
  }, [filteredLeads]);

  const hiddenCounts = useMemo(() => {
    const counts: Record<string, number> = { "추가상담거부": 0, "블랙리스트": 0, "중복": 0 };
    filteredLeads.forEach(l => {
      if (l.crmStatus in counts) counts[l.crmStatus]++;
    });
    return counts;
  }, [filteredLeads]);

  const selectedLead = useMemo(() => leads.find(l => l.id === selectedLeadId) || null, [leads, selectedLeadId]);
  const viewContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      node.focus();
    }
  }, []);

  useEffect(() => {
    if (!loading && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [viewMode, loading]);

  const downloadExcel = async (allWithDone: boolean) => {
    setExcelDownloading(true);
    setExcelMenuOpen(false);
    try {
      const params = new URLSearchParams();
      if (allWithDone) {
        params.set("includeDone", "true");
      } else {
        params.set("scope", scope);
        if (scope === "mine" && selectedUserId) params.set("assigneeId", String(selectedUserId));
      }
      const res = await fetch(`/api/crm/leads/export?${params.toString()}`);
      if (!res.ok) throw new Error("다운로드 실패");
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const match = cd?.match(/filename="?([^"]+)"?/);
      const filename = match ? decodeURIComponent(match[1]) : "CRM_리드목록.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("엑셀 다운로드 완료");
    } catch {
      toast.error("엑셀 다운로드 실패");
    } finally {
      setExcelDownloading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-slate-900 font-[family-name:var(--font-sans)]">
      <CrmSidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <PrimaryBar
          viewMode={viewMode}
          setViewMode={setViewMode}
          loading={loading}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          searchInputRef={searchInputRef}
          filtersOpen={filtersOpen}
          setFiltersOpen={setFiltersOpen}
          activeFilterCount={activeFilterCount}
          excelMenuOpen={excelMenuOpen}
          setExcelMenuOpen={setExcelMenuOpen}
          excelDownloading={excelDownloading}
          downloadExcel={downloadExcel}
        />

        <FilterPanel
          filtersOpen={filtersOpen}
          scope={scope}
          setScope={setScope}
          users={users}
          selectedUserId={selectedUserId}
          setSelectedUserId={setSelectedUserId}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          activeFilterCount={activeFilterCount}
          resetFilters={resetFilters}
        />

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-2 md:p-6 relative" tabIndex={-1} ref={viewContainerRef}>
          {loading && !hasLoaded.current && <SkeletonOverlay viewMode={viewMode} />}
          {(hasLoaded.current || !loading) && viewMode === "kanban" && (
            <div className="flex flex-col h-full gap-2">
              {(hiddenCounts["추가상담거부"] > 0 || hiddenCounts["블랙리스트"] > 0 || hiddenCounts["중복"] > 0) && (
                <div className="flex gap-2 shrink-0 px-1">
                  {(["추가상담거부", "블랙리스트", "중복"] as const).map(s => hiddenCounts[s] > 0 && (
                    <button key={s} onClick={() => { setViewMode("list"); }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[s].badge} hover:opacity-80 transition-opacity`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusStyles[s].dot}`} />
                      {s}: {hiddenCounts[s]}건
                    </button>
                  ))}
                </div>
              )}
              <div className="flex-1 min-h-0">
                <KanbanView grouped={groupedLeads} users={users} onSelect={setSelectedLeadId} selectedId={selectedLeadId} onStatus={updateStatus} onSaveMemo={saveQuickMemo} draggingId={draggingId} setDraggingId={setDraggingId} dragOverStatus={dragOverStatus} setDragOverStatus={setDragOverStatus} doneTotalCounts={doneTotalCounts} kanbanDoneDays={kanbanDoneDays} onKanbanDoneDaysChange={setKanbanDoneDays} />
              </div>
            </div>
          )}
          {(hasLoaded.current || !loading) && viewMode === "list" && <ListView leads={filteredLeads} users={users} onSelect={setSelectedLeadId} selectedId={selectedLeadId} onStatus={updateStatus} onAssignee={updateAssignee} onSchedule={updateSchedule} loading={loading} pagination={{ currentPage, pageSize, totalCount, totalPages, onPageChange: setCurrentPage, onPageSizeChange: setPageSize }} />}
          {(hasLoaded.current || !loading) && viewMode === "calendar" && <CalendarView events={calendarEvents} onSelect={setSelectedLeadId} />}
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
        onSendSms={(msg, templateKey) => selectedLeadId && sendSms(selectedLeadId, msg, templateKey)}
        activities={activities}
        activitiesLoading={activitiesLoading}
      />

      {error && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-2 rounded-full shadow-2xl z-50 flex items-center gap-2"><span className="material-icons">warning</span> {error} <button onClick={() => setError(null)}>✕</button></div>}
    </div>
  );
}
