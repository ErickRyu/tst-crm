"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CrmSidebar } from "../components/sidebar";

interface AuditLog {
  id: number;
  userId: number | null;
  userName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditLogsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED !== "false";
  const role = authEnabled ? ((session?.user as Record<string, unknown>)?.role as string) : "ADMIN";

  useEffect(() => {
    if (authEnabled && role !== "ADMIN") {
      router.push("/crm");
    }
  }, [role, router, authEnabled]);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/crm/audit-logs?page=${page}&pageSize=50`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setLogs(json.data || []);
    } catch {
      toast.error("감사 로그 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const fmtDate = (d: string) => {
    return new Date(d).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  };

  return (
    <div className="flex h-screen bg-background">
      <CrmSidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 bg-card border-b border-border">
          <h1 className="text-xl font-bold">감사 로그</h1>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="text-center text-slate-400 py-12">불러오는 중...</div>
          ) : logs.length === 0 ? (
            <div className="text-center text-slate-400 py-12">감사 로그가 없습니다.</div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">시간</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">사용자</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">액션</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">대상</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">상세</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                      <td className="px-4 py-3">{log.userName || "-"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{log.targetType ? `${log.targetType}#${log.targetId}` : "-"}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                        {log.details ? JSON.stringify(log.details) : "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{log.ipAddress || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-center gap-2 mt-4">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50 hover:bg-slate-50"
            >
              이전
            </button>
            <span className="px-3 py-1.5 text-sm text-slate-600">페이지 {page + 1}</span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={logs.length < 50}
              className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50 hover:bg-slate-50"
            >
              다음
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
