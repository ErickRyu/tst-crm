"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface User {
  id: number;
  name: string;
  phone: string | null;
  isActive: number;
}

export function GlobalSettings() {
  const [clinicName, setClinicName] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingPhones, setEditingPhones] = useState<Record<number, string>>({});

  const fetchSettings = useCallback(async () => {
    try {
      const [settingsRes, usersRes] = await Promise.all([
        fetch("/api/crm/settings"),
        fetch("/api/crm/users"),
      ]);
      const settingsJson = await settingsRes.json();
      const usersJson = await usersRes.json();
      setClinicName(settingsJson.data?.clinic_name || "");
      const userData = (usersJson.data || []) as User[];
      setUsers(userData);
      const phones: Record<number, string> = {};
      userData.forEach((u: User) => { phones[u.id] = u.phone || ""; });
      setEditingPhones(phones);
    } catch {
      toast.error("설정 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveClinicName = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/crm/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinic_name: clinicName }),
      });
      if (res.ok) toast.success("치과명이 저장되었습니다.");
      else toast.error("저장 실패");
    } catch {
      toast.error("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const saveUserPhone = async (userId: number) => {
    const phone = editingPhones[userId] || "";
    try {
      const res = await fetch(`/api/crm/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone || null }),
      });
      if (res.ok) toast.success("전화번호가 저장되었습니다.");
      else toast.error("저장 실패");
    } catch {
      toast.error("저장 실패");
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-400 py-8 text-center">불러오는 중...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Clinic Name */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <span className="material-icons text-primary text-lg">local_hospital</span>
          치과명 설정
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          SMS 템플릿에서 &#123;치과명&#125; 변수로 사용됩니다.
        </p>
        <div className="flex gap-2">
          <Input
            value={clinicName}
            onChange={(e) => setClinicName(e.target.value)}
            placeholder="예: OO치과"
            className="max-w-xs"
          />
          <Button onClick={saveClinicName} disabled={saving}>
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>

      {/* User Phone Numbers */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <span className="material-icons text-primary text-lg">group</span>
          상담사 전화번호
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          SMS 템플릿에서 &#123;상담사 전화번호&#125; 변수로 사용됩니다. 담당 상담사의 번호가 자동으로 삽입됩니다.
        </p>

        {users.length === 0 ? (
          <p className="text-sm text-slate-400">등록된 상담사가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex items-center gap-3">
                <div className="w-20">
                  <Label className="text-sm font-medium text-slate-700">{user.name}</Label>
                </div>
                <Input
                  value={editingPhones[user.id] || ""}
                  onChange={(e) => setEditingPhones((prev) => ({ ...prev, [user.id]: e.target.value }))}
                  placeholder="010-1234-5678"
                  className="max-w-xs text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveUserPhone(user.id)}
                >
                  저장
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
