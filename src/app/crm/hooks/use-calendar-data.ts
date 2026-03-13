"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalendarEvent } from "../types";

interface UseCalendarDataOptions {
  assigneeId?: number | null;
  pollingMs?: number;
}

interface UseCalendarDataReturn {
  calendarEvents: CalendarEvent[];
  fetchCalendar: () => Promise<void>;
}

export function useCalendarData(options: UseCalendarDataOptions = {}): UseCalendarDataReturn {
  const { assigneeId = null, pollingMs = 30000 } = options;
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const fetchCalendar = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (assigneeId) qs.set("assigneeId", String(assigneeId));
      const res = await fetch(`/api/crm/calendar?${qs.toString()}`);
      const json = await res.json();
      if (res.ok) {
        const newEvents = (json.data || []) as CalendarEvent[];
        setCalendarEvents(prev => {
          if (JSON.stringify(prev) === JSON.stringify(newEvents)) return prev;
          return newEvents;
        });
      }
    } catch {
      /* non-critical */
    }
  }, [assigneeId]);

  // Initial fetch
  useEffect(() => {
    void fetchCalendar();
  }, [fetchCalendar]);

  // Polling (disabled when pollingMs is 0)
  useEffect(() => {
    if (!pollingMs) return;
    const t = setInterval(fetchCalendar, pollingMs);
    return () => clearInterval(t);
  }, [fetchCalendar, pollingMs]);

  return { calendarEvents, fetchCalendar };
}
