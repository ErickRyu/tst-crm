"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Lead, LeadMemo, ActivityItem } from "../types";

interface UseLeadDetailOptions {
  readOnly?: boolean;
  leads?: Lead[];
}

interface UseLeadDetailReturn {
  selectedLeadId: number | null;
  setSelectedLeadId: (id: number | null) => void;
  detailLead: Lead | null;
  detailLoading: boolean;
  detailError: string | null;
  memos: LeadMemo[];
  setMemos: (memos: LeadMemo[]) => void;
  memoInput: string;
  setMemoInput: (v: string) => void;
  memoLoading: boolean;
  activities: ActivityItem[];
  activitiesLoading: boolean;
  fetchActivities: (id: number) => Promise<void>;
}

export function useLeadDetail(options: UseLeadDetailOptions = {}): UseLeadDetailReturn {
  const { readOnly = false, leads = [] } = options;
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";

  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [memos, setMemos] = useState<LeadMemo[]>([]);
  const [memoInput, setMemoInput] = useState("");
  const [memoLoading, setMemoLoading] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // Fetch lead detail
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
        const base = leads.find((l) => l.id === selectedLeadId);
        if (base) {
          setDetailLead({ ...base, ...(json.data || {}) });
        } else {
          setDetailLead(json.data as Lead);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "상세 조회 실패";
        setDetailError(msg);
        toast.error(msg);
      } finally {
        setDetailLoading(false);
      }
    };
    void fetchDetail();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeadId, apiKey]);

  // leads 변경 시 detailLead 동기화
  useEffect(() => {
    if (!selectedLeadId || !detailLead) return;
    const updated = leads.find((l) => l.id === selectedLeadId);
    if (updated) {
      setDetailLead((prev) => prev ? { ...prev, ...updated } : prev);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, selectedLeadId]);

  // Fetch memos
  useEffect(() => {
    if (!selectedLeadId) {
      setMemos([]);
      setMemoInput("");
      return;
    }
    const fetchMemos = async () => {
      try {
        setMemoLoading(true);
        const res = await fetch(`/api/crm/leads/${selectedLeadId}/memos`, {
          headers: apiKey ? { "x-api-key": apiKey } : undefined,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "메모 조회 실패");
        const data = (json.data || []) as LeadMemo[];
        setMemos(data);
        if (!readOnly) {
          setMemoInput(data[0]?.body || "치아상태 :\n거주지 :\n갯수:");
        }
      } catch (e) {
        if (!readOnly) {
          toast.error(e instanceof Error ? e.message : "메모 조회 실패");
        }
      } finally {
        setMemoLoading(false);
      }
    };
    void fetchMemos();
  }, [selectedLeadId, apiKey, readOnly]);

  // Fetch activities
  const fetchActivities = useCallback(async (id: number) => {
    try {
      setActivitiesLoading(true);
      const res = await fetch(`/api/crm/leads/${id}/activities`);
      const json = await res.json();
      if (res.ok) setActivities((json.data || []) as ActivityItem[]);
    } catch {
      /* non-critical */
    } finally {
      setActivitiesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLeadId) {
      void fetchActivities(selectedLeadId);
    } else {
      setActivities([]);
    }
  }, [selectedLeadId, fetchActivities]);

  return {
    selectedLeadId,
    setSelectedLeadId,
    detailLead,
    detailLoading,
    detailError,
    memos,
    setMemos,
    memoInput,
    setMemoInput,
    memoLoading,
    activities,
    activitiesLoading,
    fetchActivities,
  };
}
