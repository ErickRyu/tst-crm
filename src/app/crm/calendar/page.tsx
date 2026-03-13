"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "../types";
import { CalendarView } from "../components/calendar-view";
import { LeadDrawer } from "../components/lead-drawer";
import { CrmSidebar } from "../components/sidebar";
import { useLeadDetail } from "../hooks/use-lead-detail";
import { useCalendarData } from "../hooks/use-calendar-data";

export default function CalendarPage() {
  const [users, setUsers] = useState<User[]>([]);
  const { calendarEvents } = useCalendarData();
  const {
    selectedLeadId, setSelectedLeadId,
    detailLead, detailLoading, detailError,
    memos, memoLoading,
    activities, activitiesLoading,
  } = useLeadDetail({ readOnly: true });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/users");
      const json = await res.json();
      setUsers((json.data || []) as User[]);
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

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
