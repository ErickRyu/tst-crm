"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProfileData {
  name: string;
  phone: string;
  email: string;
}

export function MyProfile() {
  const [profile, setProfile] = useState<ProfileData>({ name: "", phone: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/my-profile");
      const json = await res.json();
      if (json.data) {
        setProfile({
          name: json.data.name || "",
          phone: json.data.phone || "",
          email: json.data.email || "",
        });
      }
    } catch {
      toast.error("프로필 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const saveProfile = async () => {
    if (!profile.name.trim()) {
      toast.error("이름을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/crm/my-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profile.name.trim(), phone: profile.phone.trim() }),
      });
      if (res.ok) {
        toast.success("프로필이 저장되었습니다.");
      } else {
        const json = await res.json();
        toast.error(json.message || "저장 실패");
      }
    } catch {
      toast.error("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-400 py-8 text-center">불러오는 중...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span className="material-icons text-primary text-lg">person</span>
          내 정보
        </h3>

        <div className="space-y-4 max-w-md">
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-1.5 block">이메일</Label>
            <Input value={profile.email} disabled className="bg-slate-50 text-slate-500" />
            <p className="text-xs text-slate-400 mt-1">이메일은 변경할 수 없습니다.</p>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-700 mb-1.5 block">이름</Label>
            <Input
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              placeholder="이름을 입력하세요"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-700 mb-1.5 block">전화번호</Label>
            <Input
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              placeholder="010-0000-0000"
            />
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100">
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}
