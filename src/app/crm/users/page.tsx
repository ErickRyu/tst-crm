"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CrmSidebar } from "../components/sidebar";

interface UserRow {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "관리자",
  COUNSELOR: "상담원",
  HOSPITAL_STAFF: "병원 스태프",
};

export default function UsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "COUNSELOR" });
  const [saving, setSaving] = useState(false);

  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED !== "false";
  const role = authEnabled ? ((session?.user as Record<string, unknown>)?.role as string) : "ADMIN";

  useEffect(() => {
    if (authEnabled && role !== "ADMIN") {
      router.push("/crm");
    }
  }, [role, router, authEnabled]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/users?includeAll=true");
      const json = await res.json();
      setUsers((json.data || []) as UserRow[]);
    } catch {
      toast.error("사용자 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreate = () => {
    setEditUser(null);
    setForm({ name: "", email: "", password: "", role: "COUNSELOR" });
    setShowDialog(true);
  };

  const openEdit = (u: UserRow) => {
    setEditUser(u);
    setForm({ name: u.name, email: u.email || "", password: "", role: u.role });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name || (!editUser && (!form.email || !form.password))) {
      toast.error("이름, 이메일, 비밀번호는 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      if (editUser) {
        const body: Record<string, string> = { name: form.name, role: form.role };
        if (form.email) body.email = form.email;
        const res = await fetch(`/api/crm/users/${editUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.message);
        }
        toast.success("사용자가 수정되었습니다.");
      } else {
        const res = await fetch("/api/crm/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.message);
        }
        toast.success("사용자가 생성되었습니다.");
      }
      setShowDialog(false);
      fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u: UserRow) => {
    const action = u.status === "ACTIVE" ? "deactivate" : "activate";
    const confirmMsg = u.status === "ACTIVE"
      ? `${u.name}님을 비활성화하시겠습니까?`
      : `${u.name}님을 다시 활성화하시겠습니까?`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/crm/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: u.status === "ACTIVE" ? 0 : 1,
          status: u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message);
      }
      toast.success(`${u.name}님이 ${action === "deactivate" ? "비활성화" : "활성화"}되었습니다.`);
      fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "상태 변경 실패");
    }
  };

  const fmtDate = (d: string | null) => {
    if (!d) return "-";
    return new Date(d).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  };

  if (loading) {
    return (
      <div className="flex h-screen">
        <CrmSidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-slate-400">불러오는 중...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <CrmSidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 bg-card border-b border-border">
          <h1 className="text-xl font-bold">사용자 관리</h1>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            + 사용자 추가
          </button>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">이름</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">이메일</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">역할</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">마지막 로그인</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">작업</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        u.role === "ADMIN" ? "bg-purple-100 text-purple-700" :
                        u.role === "COUNSELOR" ? "bg-blue-100 text-blue-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        u.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {u.status === "ACTIVE" ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(u.lastLoginAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => openEdit(u)}
                          className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => toggleStatus(u)}
                          className={`px-2 py-1 text-xs rounded ${
                            u.status === "ACTIVE"
                              ? "text-red-600 hover:bg-red-50"
                              : "text-green-600 hover:bg-green-50"
                          }`}
                        >
                          {u.status === "ACTIVE" ? "비활성화" : "활성화"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editUser ? "사용자 수정" : "사용자 추가"}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">이름</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">이메일</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              {!editUser && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">임시 비밀번호</label>
                  <input
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="첫 로그인 시 변경 필요"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">역할</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="ADMIN">관리자</option>
                  <option value="COUNSELOR">상담원</option>
                  <option value="HOSPITAL_STAFF">병원 스태프</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowDialog(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "저장 중..." : editUser ? "수정" : "생성"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
