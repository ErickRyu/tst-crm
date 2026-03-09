"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import type { CalendarEvent, Lead, User, LeadMemo, ActivityItem } from "../types";
import { CalendarView } from "../components/calendar-view";
import { LeadDrawer } from "../components/lead-drawer";
import { CrmSidebar } from "../components/sidebar";

export default function CalendarPage() {
  const { data: session } = useSession();
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [memos, setMemos] = useState<LeadMemo[]>([]);
  const [memoLoading, setMemoLoading] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const hasLoaded = useRef(false);

  const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";

  const fetchCalendar = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/calendar");
      const json = await res.json();
      if (res.ok) {
        setCalendarEvents((prev) => {
          const next = (json.data || []) as CalendarEvent[];
          if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
          return next;
        });
      }
    } catch {
      /* non-critical */
    } finally {
      hasLoaded.current = true;
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/users");
      const json = await res.json();
      setUsers((json.data || []) as User[]);
    } catch {
      /* non-critical */
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchCalendar();
    fetchUsers();
  }, [fetchCalendar, fetchUsers]);

  // 30s polling
  useEffect(() => {
    const t = setInterval(fetchCalendar, 30000);
    return () => clearInterval(t);
  }, [fetchCalendar]);

  // Fetch lead detail when selected
  useEffect(() => {
    if (!selectedLeadId) {
      setDetailLead(null);
      setDetailError(null);
      return;
    }
    const fetchDetail = async () => {
      try {
        setDetailLoading(true);
        setDetailError(null);
        const res = await fetch(`/api/leads/${selectedLeadId}`, {
          headers: apiKey ? { "x-api-key": apiKey } : undefined,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "상세 조회 실패");
        setDetailLead(json.data as Lead);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "상세 조회 실패";
        setDetailError(msg);
        toast.error(msg);
      } finally {
        setDetailLoading(false);
      }
    };
    void fetchDetail();
  }, [selectedLeadId, apiKey]);

  // Fetch memos when lead selected
  useEffect(() => {
    if (!selectedLeadId) {
      setMemos([]);
      return;
    }
    const fetchMemos = async () => {
      try {
        setMemoLoading(true);
        const res = await fetch(`/api/crm/leads/${selectedLeadId}/memos`);
        const json = await res.json();
        if (res.ok) setMemos((json.data || []) as LeadMemo[]);
      } catch {
        /* non-critical */
      } finally {
        setMemoLoading(false);
      }
    };
    void fetchMemos();
  }, [selectedLeadId]);

  // Fetch activities when lead selected
  useEffect(() => {
    if (!selectedLeadId) {
      setActivities([]);
      return;
    }
    const fetchActivities = async () => {
      try {
        setActivitiesLoading(true);
        const res = await fetch(`/api/crm/leads/${selectedLeadId}/activities`);
        const json = await res.json();
        if (res.ok) setActivities((json.data || []) as ActivityItem[]);
      } catch {
        /* non-critical */
      } finally {
        setActivitiesLoading(false);
      }
    };
    void fetchActivities();
  }, [selectedLeadId]);

  // No-op handlers for readOnly drawer
  const noop = async () => {};

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-slate-900 font-[family-name:var(--font-sans)]">
      <CrmSidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="h-14 md:h-16 px-4 md:px-8 flex items-center border-b border-border bg-card shrink-0">
          <h1 className="font-bold text-base md:text-lg">캘린더</h1>
        </div>

        <div className="flex-1 overflow-hidden p-2 md:p-6">
          <CalendarView events={calendarEvents} onSelect={setSelectedLeadId} />
        </div>
      </main>

      <LeadDrawer
        lead={detailLead}
        loading={detailLoading}
        error={detailError}
        onRetry={() => selectedLeadId && setSelectedLeadId(selectedLeadId)}
        onClose={() => setSelectedLeadId(null)}
        users={users}
        onStatus={noop}
        onAssignee={noop}
        onSchedule={noop}
        memos={memos}
        memoInput=""
        memoSaving={false}
        memoLoading={memoLoading}
        onMemoInput={() => {}}
        onSaveMemo={() => {}}
        smsTemplates={[]}
        smsSending={false}
        onSendSms={() => {}}
        activities={activities}
        activitiesLoading={activitiesLoading}
        readOnly
      />
    </div>
  );
}
