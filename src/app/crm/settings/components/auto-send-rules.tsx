"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Rule {
  id: number;
  triggerType: string;
  triggerValue: string | null;
  templateId: number;
  isEnabled: number;
  templateKey: string | null;
  templateLabel: string | null;
  templateIcon: string | null;
  templateBody: string | null;
  templateMsgType: string | null;
}

interface Template {
  id: number;
  key: string;
  label: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  new_lead: "신규 상담 인입",
  appointment_set: "예약 희망일 지정",
  status_absent: "부재중 상태 변화",
};

const TRIGGER_ICONS: Record<string, string> = {
  new_lead: "person_add",
  appointment_set: "event_available",
  status_absent: "phone_missed",
};

const TRIGGER_DESCRIPTIONS: Record<string, string> = {
  new_lead: "새로운 리드가 등록되면 자동으로 SMS를 발송합니다.",
  appointment_set: "예약 희망일이 처음 설정되면 자동으로 예약 안내 SMS를 발송합니다.",
  status_absent: "부재중 상태(1차/2차/3차)로 변경되면 자동으로 안내 SMS를 발송합니다.",
};

export function AutoSendRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTriggerType, setNewTriggerType] = useState("new_lead");
  const [newTriggerValue, setNewTriggerValue] = useState("");
  const [newTemplateId, setNewTemplateId] = useState<number | null>(null);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/sms/auto-send");
      const json = await res.json();
      setRules(json.data || []);
    } catch {
      toast.error("규칙 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/sms/templates");
      const json = await res.json();
      setTemplates((json.data || []).map((t: { id: number; key: string; label: string }) => ({
        id: t.id,
        key: t.key,
        label: t.label,
      })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchRules();
    fetchTemplates();
  }, [fetchRules, fetchTemplates]);

  const toggleRule = async (ruleId: number, currentEnabled: number) => {
    try {
      const res = await fetch(`/api/crm/sms/auto-send/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: currentEnabled === 0 }),
      });
      if (res.ok) {
        toast.success(currentEnabled ? "규칙이 비활성화되었습니다." : "규칙이 활성화되었습니다.");
        fetchRules();
      }
    } catch {
      toast.error("변경 실패");
    }
  };

  const deleteRule = async (ruleId: number) => {
    if (!confirm("이 규칙을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/crm/sms/auto-send/${ruleId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("규칙이 삭제되었습니다.");
        fetchRules();
      }
    } catch {
      toast.error("삭제 실패");
    }
  };

  const createRule = async () => {
    if (!newTemplateId) { toast.error("템플릿을 선택하세요."); return; }
    try {
      const res = await fetch("/api/crm/sms/auto-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          triggerType: newTriggerType,
          triggerValue: newTriggerValue || null,
          templateId: newTemplateId,
          isEnabled: false,
        }),
      });
      if (res.ok) {
        toast.success("규칙이 생성되었습니다.");
        setDialogOpen(false);
        fetchRules();
      } else {
        toast.error("생성 실패");
      }
    } catch {
      toast.error("생성 실패");
    }
  };

  // Group rules by trigger type
  const grouped = rules.reduce<Record<string, Rule[]>>((acc, r) => {
    if (!acc[r.triggerType]) acc[r.triggerType] = [];
    acc[r.triggerType].push(r);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-slate-800">자동발송 규칙</h2>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <span className="material-icons text-sm mr-1">add</span> 새 규칙
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400 py-8 text-center">불러오는 중...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-sm text-slate-400 py-8 text-center">등록된 규칙이 없습니다.</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([triggerType, typeRules]) => (
            <div key={triggerType} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <span className="material-icons text-primary text-lg">{TRIGGER_ICONS[triggerType] || "bolt"}</span>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{TRIGGER_LABELS[triggerType] || triggerType}</h3>
                  <p className="text-[11px] text-slate-500">{TRIGGER_DESCRIPTIONS[triggerType]}</p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {typeRules.map((rule) => (
                  <div key={rule.id} className="px-4 py-3 flex items-center gap-3">
                    <Switch
                      checked={rule.isEnabled === 1}
                      onCheckedChange={() => toggleRule(rule.id, rule.isEnabled)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {rule.templateIcon && (
                          <span className="material-icons text-sm text-slate-400">{rule.templateIcon}</span>
                        )}
                        <span className="text-sm font-medium text-slate-700">
                          {rule.templateLabel || "(템플릿 없음)"}
                        </span>
                        {rule.triggerValue && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                            {rule.triggerValue}
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          rule.isEnabled ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                        }`}>
                          {rule.isEnabled ? "활성" : "비활성"}
                        </span>
                      </div>
                      {rule.templateBody && (
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{rule.templateBody}</p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-red-50"
                    >
                      <span className="material-icons text-sm">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 자동발송 규칙</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>트리거 유형</Label>
              <Select value={newTriggerType} onValueChange={setNewTriggerType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_lead">신규 상담 인입</SelectItem>
                  <SelectItem value="appointment_set">예약 희망일 지정</SelectItem>
                  <SelectItem value="status_absent">부재중 상태 변화</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newTriggerType === "status_absent" && (
              <div>
                <Label>트리거 값 (부재 상태)</Label>
                <Select value={newTriggerValue} onValueChange={setNewTriggerValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="상태 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1차부재">1차부재</SelectItem>
                    <SelectItem value="2차부재">2차부재</SelectItem>
                    <SelectItem value="3차부재">3차부재</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>발송 템플릿</Label>
              <Select value={newTemplateId ? String(newTemplateId) : ""} onValueChange={(v) => setNewTemplateId(Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="템플릿 선택" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
              <Button onClick={createRule}>생성</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
