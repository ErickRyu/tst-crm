"use client";

import { useState, useRef, useEffect } from "react";
import type { CrmStatus, User, SmsTemplate } from "../types";
import { statusOptions } from "../types";
import { Button } from "@/components/ui/button";

interface BulkActionBarProps {
  selectedCount: number;
  users: User[];
  smsTemplates: SmsTemplate[];
  onUpdateStatus: (status: CrmStatus) => Promise<void>;
  onUpdateAssignee: (assigneeId: number | null) => Promise<void>;
  onSendSms: (msg: string, templateKey?: string) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

export function BulkActionBar({
  selectedCount,
  users,
  smsTemplates,
  onUpdateStatus,
  onUpdateAssignee,
  onSendSms,
  onCancel,
  loading,
}: BulkActionBarProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsMsg, setSmsMsg] = useState("");
  const [smsTemplateKey, setSmsTemplateKey] = useState<string | undefined>();
  const [confirmAction, setConfirmAction] = useState<{ label: string; action: () => Promise<void> } | null>(null);

  const statusRef = useRef<HTMLDivElement>(null);
  const assignRef = useRef<HTMLDivElement>(null);
  const smsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
      if (assignRef.current && !assignRef.current.contains(e.target as Node)) setAssignOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (selectedCount === 0) return null;

  const handleStatusSelect = (status: CrmStatus) => {
    setStatusOpen(false);
    setConfirmAction({
      label: `${selectedCount}건의 리드 상태를 '${status}'(으)로 변경하시겠습니까?`,
      action: () => onUpdateStatus(status),
    });
  };

  const handleAssignSelect = (userId: number | null, userName: string) => {
    setAssignOpen(false);
    setConfirmAction({
      label: `${selectedCount}건의 리드 담당자를 '${userName}'(으)로 변경하시겠습니까?`,
      action: () => onUpdateAssignee(userId),
    });
  };

  const handleSmsSend = () => {
    if (!smsMsg.trim()) return;
    setSmsOpen(false);
    setConfirmAction({
      label: `${selectedCount}건의 리드에 SMS를 발송하시겠습니까?`,
      action: () => onSendSms(smsMsg.trim(), smsTemplateKey),
    });
  };

  return (
    <>
      {/* Floating action bar */}
      <div className="fixed bottom-4 left-2 right-2 md:left-20 md:right-4 z-50 transition-all animate-in slide-in-from-bottom-4">
        <div className="bg-slate-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center justify-center gap-2 md:gap-3 max-w-xl mx-auto">
          {/* Selected count */}
          <span className="flex items-center gap-1.5 text-sm font-medium shrink-0">
            <span className="material-icons text-sm text-emerald-400">check_circle</span>
            <span>{selectedCount}건 선택</span>
          </span>

          <div className="w-px h-6 bg-slate-700 shrink-0" />

          {/* Status dropdown */}
          <div className="relative" ref={statusRef}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStatusOpen(v => !v); setAssignOpen(false); }}
              disabled={loading}
              className="text-white hover:bg-slate-800 hover:text-white"
            >
              <span className="material-icons text-sm">swap_horiz</span>
              <span className="hidden md:inline ml-1">상태 변경</span>
            </Button>
            {statusOpen && (
              <div className="absolute bottom-full mb-2 left-0 bg-white text-slate-900 rounded-lg shadow-xl border border-slate-200 py-1 w-40 max-h-64 overflow-y-auto">
                {statusOptions.map(s => (
                  <button key={s} onClick={() => handleStatusSelect(s)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Assign dropdown */}
          <div className="relative" ref={assignRef}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setAssignOpen(v => !v); setStatusOpen(false); }}
              disabled={loading}
              className="text-white hover:bg-slate-800 hover:text-white"
            >
              <span className="material-icons text-sm">person_add</span>
              <span className="hidden md:inline ml-1">담당자 배정</span>
            </Button>
            {assignOpen && (
              <div className="absolute bottom-full mb-2 left-0 bg-white text-slate-900 rounded-lg shadow-xl border border-slate-200 py-1 w-40 max-h-64 overflow-y-auto">
                <button onClick={() => handleAssignSelect(null, "미배정")}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors text-slate-400">
                  미배정
                </button>
                {users.map(u => (
                  <button key={u.id} onClick={() => handleAssignSelect(u.id, u.name)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors">
                    {u.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SMS button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSmsOpen(true); setStatusOpen(false); setAssignOpen(false); }}
            disabled={loading}
            className="text-white hover:bg-slate-800 hover:text-white"
          >
            <span className="material-icons text-sm">sms</span>
            <span className="hidden md:inline ml-1">SMS</span>
          </Button>

          <div className="w-px h-6 bg-slate-700 shrink-0" />

          {/* Cancel */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={loading}
            className="text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <span className="material-icons text-sm">close</span>
          </Button>
        </div>
      </div>

      {/* SMS Modal */}
      {smsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setSmsOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">일괄 SMS 발송 ({selectedCount}건)</h3>

            {smsTemplates.length > 0 && (
              <div className="mb-3">
                <label className="text-xs font-medium text-slate-500 mb-1 block">템플릿 선택</label>
                <select
                  value={smsTemplateKey || ""}
                  onChange={e => {
                    const key = e.target.value;
                    setSmsTemplateKey(key || undefined);
                    const tpl = smsTemplates.find(t => t.key === key);
                    if (tpl) setSmsMsg(tpl.body);
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">직접 입력</option>
                  {smsTemplates.map(t => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>
            )}

            <textarea
              value={smsMsg}
              onChange={e => setSmsMsg(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="메시지 내용을 입력하세요..."
              className="w-full border border-slate-200 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-primary/30 focus:outline-none"
            />
            <div className="flex justify-between items-center mt-1 mb-4">
              <span className="text-xs text-slate-400">{smsMsg.length}/2000</span>
              <span className="text-xs text-slate-500">발송 대상: {selectedCount}명</span>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setSmsOpen(false)}>취소</Button>
              <Button onClick={handleSmsSend} disabled={!smsMsg.trim()}>발송</Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setConfirmAction(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-6">
              <span className="material-icons text-amber-500 text-2xl shrink-0">warning</span>
              <p className="text-sm text-slate-700">{confirmAction.label}</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setConfirmAction(null)} disabled={loading}>취소</Button>
              <Button
                onClick={async () => {
                  await confirmAction.action();
                  setConfirmAction(null);
                }}
                disabled={loading}
              >
                {loading ? "처리 중..." : "확인"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
