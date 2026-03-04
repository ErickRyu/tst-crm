"use client";

import { useRef, useState, useEffect } from "react";
import type { Lead, User, CrmStatus, LeadMemo, SmsTemplate } from "../types";
import { statusOptions, statusStyles, fmtCreatedAt, toIsoLocal } from "../types";
import { PhoneLink, downloadVCard } from "./phone-link";
import { TagChip } from "./tag-chip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LeadDrawerProps {
  lead: Lead | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClose: () => void;
  users: User[];
  onStatus: (id: number, s: CrmStatus) => Promise<void>;
  onAssignee: (id: number, userId: number | null) => Promise<void>;
  onSchedule: (id: number, field: string, val: string) => Promise<void>;
  memos: LeadMemo[];
  memoInput: string;
  onMemoInput: (v: string) => void;
  onSaveMemo: () => void;
  memoSaving: boolean;
  memoLoading: boolean;
  smsTemplates: SmsTemplate[];
  smsSending: boolean;
  smsTestMode: boolean;
  onSendSms: (msg: string, templateKey?: string) => void;
}

export function LeadDrawer({
  lead,
  loading,
  error,
  onRetry,
  onClose,
  users,
  onStatus,
  onAssignee,
  onSchedule,
  memos,
  memoInput,
  onMemoInput,
  onSaveMemo,
  memoSaving,
  memoLoading,
  smsTemplates,
  smsSending,
  smsTestMode,
  onSendSms,
}: LeadDrawerProps) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [smsMsg, setSmsMsg] = useState("");
  const [smsWithMemo, setSmsWithMemo] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [washing, setWashing] = useState(false);

  const isOpen = !!(lead || loading || error);

  const handleWash = async () => {
    if (!memoInput.trim() || !lead) return;
    try {
      setWashing(true);
      const res = await fetch("/api/crm/memos/wash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: memoInput.trim(), patientName: lead.name, phone: lead.phone }),
      });
      const json = await res.json();
      if (res.ok && json.data?.washed) onMemoInput(json.data.washed);
    } catch { /* silent */ }
    finally { setWashing(false); }
  };

  useEffect(() => {
    if (lead && closeBtnRef.current) {
      closeBtnRef.current.focus();
    }
  }, [lead]);

  useEffect(() => {
    setSmsMsg("");
    setQuickMenuOpen(false);
  }, [lead?.id]);

  const handleSendSms = () => {
    if (!smsMsg.trim()) return;
    onSendSms(smsMsg.trim());
    if (smsWithMemo && smsMsg.trim()) {
      onMemoInput(`[SMS 발송] ${smsMsg.trim()}`);
    }
    setSmsMsg("");
  };

  const handleTemplateSelect = (tpl: SmsTemplate) => {
    const msg = lead ? tpl.body.replace(/%고객명%/g, lead.name) : tpl.body;
    setSmsMsg(msg);
    setQuickMenuOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-none md:w-[480px] p-0 gap-0 flex flex-col max-md:inset-x-0 max-md:inset-y-auto max-md:bottom-0 max-md:top-auto max-md:h-auto max-md:max-h-[90vh] max-md:rounded-t-2xl max-md:data-[state=open]:slide-in-from-bottom max-md:data-[state=closed]:slide-out-to-bottom"
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2 pb-1 md:hidden"><div className="w-10 h-1 rounded-full bg-slate-300"></div></div>
        {/* 정보 영역 */}
        <div className="p-4 md:px-8 md:py-4 border-b border-slate-100 bg-white shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <SheetTitle className="font-bold text-lg md:text-xl truncate">{lead?.name || (loading ? "불러오는 중..." : "데이터 없음")}</SheetTitle>
              {lead && (
                <Select value={lead.crmStatus} onValueChange={(v) => onStatus(lead.id, v as CrmStatus)}>
                  <SelectTrigger className={`h-7 w-auto text-xs font-bold ${statusStyles[lead.crmStatus]?.badge || ""}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {lead?.createdAt && <span className="text-xs md:text-sm text-slate-400 shrink-0">{fmtCreatedAt(lead.createdAt)}</span>}
            </div>
            <button ref={closeBtnRef} onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 -m-2 md:p-0 md:m-0 shrink-0 ml-2"><span className="material-icons">close</span></button>
          </div>
          <div className="flex items-center gap-2 text-sm md:text-base text-slate-500">
            <span className="material-icons text-[14px] md:text-[16px]">smartphone</span>
            {lead?.phone ? <PhoneLink phone={lead.phone} /> : ""}
            {lead?.phone && (
              <button
                onClick={() => downloadVCard(lead.name, lead.phone)}
                className="text-slate-400 hover:text-primary transition-colors shrink-0 p-1 -m-1"
                title="연락처 저장"
                aria-label="연락처 저장"
              >
                <span className="material-icons" style={{ fontSize: "16px" }}>person_add</span>
              </button>
            )}
          </div>
          {lead && (
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              {lead.age != null && <TagChip label={`${lead.age}세`} tone="blue" />}
              {lead.gender && <TagChip label={lead.gender === "남" ? "남" : "여"} tone={lead.gender === "남" ? "blue" : "pink"} />}
              {lead.media && <TagChip label={lead.media} tone="purple" />}
              {lead.careTag && <TagChip label={lead.careTag} tone={lead.careTag.includes("임플란트") ? "indigo" : "slate"} />}
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {loading && (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-400 gap-2">
              <span className="material-icons animate-spin">refresh</span>
              <span className="text-sm">상세 정보를 불러오는 중</span>
            </div>
          )}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-500 gap-3">
              <span className="material-icons text-red-500 text-3xl">error</span>
              <div className="text-sm font-semibold">{error}</div>
              <div className="flex gap-2">
                <Button size="sm" onClick={onRetry}>재시도</Button>
                <Button variant="secondary" size="sm" onClick={onClose}>닫기</Button>
              </div>
            </div>
          )}
          {!loading && !error && lead && (
            <>
              {/* 예약 확정 */}
              <div className="p-4 md:px-8 md:py-3">
                <section><h4 className="text-[10px] md:text-xs font-bold text-slate-400 uppercase mb-2">예약 확정</h4><Input type="datetime-local" defaultValue={toIsoLocal(lead.appointmentAt)} onBlur={e => onSchedule(lead.id, "appointmentAt", e.target.value)} className="text-xs md:text-sm" /></section>
              </div>

              {/* SMS Send Area */}
              <div className="p-4 md:px-8 md:py-3 bg-white border-t border-slate-200">
                <div className="relative">
                  <Textarea
                    value={smsMsg}
                    onChange={(e) => setSmsMsg(e.target.value)}
                    maxLength={2000}
                    rows={4}
                    className="bg-slate-50 border-none pr-12 text-sm resize-none"
                    placeholder="메시지를 입력하세요... (전송: Enter)"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendSms();
                      }
                    }}
                  />
                  <div className="absolute bottom-2 right-2 text-[10px] text-slate-400">
                    {smsMsg.length > 0 && `${smsMsg.length}자`}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuickMenuOpen(!quickMenuOpen)}
                      className="text-xs flex items-center gap-1 px-2 py-1 bg-yellow-50 text-yellow-600 rounded border border-yellow-100 hover:bg-yellow-100 transition-colors"
                    >
                      <span className="material-icons text-[14px]">bolt</span> 빠른 답변
                    </button>
                    <div className="flex items-center gap-1.5 ml-2">
                      <Checkbox
                        checked={smsWithMemo}
                        onCheckedChange={(checked) => setSmsWithMemo(checked === true)}
                        id="sms-memo-sync"
                        className="h-3.5 w-3.5"
                      />
                      <label htmlFor="sms-memo-sync" className="text-xs text-slate-500 cursor-pointer">SMS 동시 전송</label>
                    </div>
                    {smsTestMode && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">TEST</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={handleSendSms}
                    disabled={smsSending || !smsMsg.trim()}
                  >
                    {smsSending ? "발송 중..." : "전송"}
                  </Button>
                </div>

                {/* Quick Template Menu */}
                {quickMenuOpen && (() => {
                  const recommended = smsTemplates.filter(t => t.statuses?.includes(lead.crmStatus));
                  const others = smsTemplates.filter(t => !t.statuses?.includes(lead.crmStatus));
                  return (
                    <div className="mt-2 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                      {recommended.length > 0 && (
                        <>
                          <div className="px-4 py-1.5 bg-primary/5 text-[10px] font-bold text-primary uppercase tracking-wider">추천 ({lead.crmStatus})</div>
                          {recommended.map((tpl) => (
                            <button key={tpl.key} onClick={() => handleTemplateSelect(tpl)}
                              className="w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-primary/5 flex items-center gap-2 text-left transition-colors border-l-2 border-l-primary">
                              <span className="material-icons text-sm text-primary">{tpl.icon}</span>
                              <span className="font-medium">{tpl.label}</span>
                              <span className="ml-auto text-[10px] text-slate-400">{tpl.msgType}</span>
                            </button>
                          ))}
                        </>
                      )}
                      {others.length > 0 && (
                        <>
                          {recommended.length > 0 && <div className="px-4 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">전체</div>}
                          {others.map((tpl) => (
                            <button key={tpl.key} onClick={() => handleTemplateSelect(tpl)}
                              className="w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-left transition-colors">
                              <span className="material-icons text-sm text-slate-400">{tpl.icon}</span>
                              <span>{tpl.label}</span>
                              <span className="ml-auto text-[10px] text-slate-400">{tpl.msgType}</span>
                            </button>
                          ))}
                        </>
                      )}
                      {smsTemplates.length === 0 && (
                        <div className="px-4 py-3 text-sm text-slate-400">템플릿이 없습니다.</div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Staff Memos */}
              <div className="p-4 md:px-8 md:py-3 border-t border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-icons text-slate-400 text-sm">lock</span>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">상담메모</h4>
                  <span className={`ml-auto text-[10px] ${memoInput.length > 1800 ? "text-red-500" : "text-slate-400"}`}>{memoInput.length}/2000</span>
                </div>
                <Textarea
                  value={memoInput}
                  onChange={(e) => onMemoInput(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  className="bg-white resize-none"
                  placeholder="통화 특이사항을 기록하세요."
                  onKeyDown={(e) => {
                    if (e.ctrlKey && e.key === "Enter") {
                      e.preventDefault();
                      onSaveMemo();
                    }
                  }}
                />
                <div className="flex justify-between mt-2">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={handleWash}
                    disabled={washing || !memoInput.trim()}
                    className="bg-violet-50 text-violet-600 hover:bg-violet-100"
                    title="자연어를 구조화 템플릿으로 변환"
                  >
                    <span className="material-icons text-[13px]">auto_fix_high</span> {washing ? "변환중..." : "워싱"}
                  </Button>
                  <Button
                    size="xs"
                    onClick={onSaveMemo}
                    disabled={memoSaving}
                  >
                    {memoSaving ? "저장 중..." : "메모 저장"}
                  </Button>
                </div>
                {memoLoading && <div className="text-sm text-slate-400 mt-2">메모를 불러오는 중...</div>}
                {!memoLoading && memos.length > 0 && memos[0].updatedAt && (
                  <div className="text-[11px] text-slate-400 mt-2">
                    마지막 수정: {new Date(memos[0].updatedAt).toLocaleString()}
                    {memos[0].version ? ` (v${memos[0].version})` : ""}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Action Buttons */}
        {lead && !loading && !error && (
          <div className="p-3 gap-2 md:p-4 md:gap-3 bg-white border-t border-slate-200 grid grid-cols-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => setQuickMenuOpen(!quickMenuOpen)}
              className="w-full"
            >
              <span className="material-icons text-[18px] text-primary">send</span> 빠른 메시지
              <span className="material-icons text-[16px]">{quickMenuOpen ? "expand_less" : "expand_more"}</span>
            </Button>
            <Button
              onClick={() => lead.appointmentAt ? undefined : onSchedule(lead.id, "appointmentAt", new Date().toISOString())}
            >
              <span className="material-icons text-[18px]">event</span> 예약 하기
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
