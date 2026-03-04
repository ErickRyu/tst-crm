"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Template {
  id: number;
  key: string;
  label: string;
  icon: string;
  body: string;
  msgType: "SMS" | "LMS";
  category: string | null;
  statuses: string[] | null;
}

interface TemplateEditorProps {
  template?: Template;
  onSave: (data: Omit<Template, "id">, id?: number) => void;
  onCancel: () => void;
}

const ICON_OPTIONS = [
  "sms", "fiber_new", "phone_missed", "phone_in_talk", "event_available",
  "event", "event_busy", "check_circle", "place", "local_parking",
  "access_time", "notification_add", "send", "chat", "mark_email_read", "info",
];

const VARIABLES = [
  { name: "{고객명}", desc: "고객 이름" },
  { name: "{문의내용}", desc: "진료 카테고리" },
  { name: "{치과명}", desc: "설정된 치과명" },
  { name: "{예약확정일시}", desc: "예약 날짜/시간" },
  { name: "{상담사 전화번호}", desc: "담당 상담사 번호" },
  { name: "{Today}", desc: "오늘 날짜" },
];

const STATUS_OPTIONS = [
  "신규인입", "1차부재", "2차부재", "3차부재", "노쇼",
  "추후 통화희망", "응대중", "통화완료", "예약완료",
];

function calcMsgTypeClient(msg: string): { byteLength: number; msgType: "SMS" | "LMS" } {
  let byteLength = 0;
  for (const ch of msg) {
    byteLength += ch.charCodeAt(0) > 127 ? 2 : 1;
  }
  return { byteLength, msgType: byteLength > 90 ? "LMS" : "SMS" };
}

export function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const [key, setKey] = useState(template?.key || "");
  const [label, setLabel] = useState(template?.label || "");
  const [icon, setIcon] = useState(template?.icon || "sms");
  const [body, setBody] = useState(template?.body || "");
  const [statuses, setStatuses] = useState<string[]>(template?.statuses || []);
  const [saving, setSaving] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const iconRef = useRef<HTMLDivElement>(null);

  const { byteLength, msgType } = useMemo(() => calcMsgTypeClient(body), [body]);

  // Close icon popover on outside click
  useEffect(() => {
    if (!iconOpen) return;
    const handler = (e: MouseEvent) => {
      if (iconRef.current && !iconRef.current.contains(e.target as Node)) {
        setIconOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [iconOpen]);

  const insertVariable = (v: string) => {
    setBody((prev) => prev + v);
  };

  const toggleStatus = (s: string) => {
    setStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const handleSubmit = async () => {
    if (!key.trim() || !label.trim() || !body.trim()) return;
    setSaving(true);
    await onSave(
      {
        key: key.trim(),
        label: label.trim(),
        icon: icon.trim(),
        body: body.trim(),
        msgType,
        category: null,
        statuses: statuses.length > 0 ? statuses : null,
      },
      template?.id
    );
    setSaving(false);
  };

  // Preview: replace variables with sample data
  const previewBody = body
    .replace(/\{고객명\}/g, "홍길동")
    .replace(/\{고객이름\}/g, "홍길동")
    .replace(/\{문의내용\}/g, "임플란트")
    .replace(/\{치과명\}/g, "OO치과")
    .replace(/\{예약확정일시\}/g, "2026-03-10 14:00")
    .replace(/\{상담사 전화번호\}/g, "010-1234-5678")
    .replace(/\{Today\}/g, new Date().toISOString().slice(0, 10))
    .replace(/%고객명%/g, "홍길동");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-slate-800">
          {template ? "템플릿 수정" : "새 템플릿 생성"}
        </h2>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          취소
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tpl-key">키 (고유값)</Label>
              <Input
                id="tpl-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="my_template"
                disabled={!!template}
              />
            </div>
            <div>
              <Label htmlFor="tpl-label">표시 이름</Label>
              <Input
                id="tpl-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="신규 상담 안내"
              />
            </div>
          </div>

          <div ref={iconRef} className="relative">
            <Label>아이콘</Label>
            <button
              type="button"
              onClick={() => setIconOpen(!iconOpen)}
              className="mt-1 flex items-center gap-2 px-3 py-2 w-full border border-slate-200 rounded-md bg-white hover:bg-slate-50 transition-colors text-left"
            >
              <span className="material-icons text-slate-600">{icon}</span>
              <span className="text-sm text-slate-600">{icon}</span>
              <span className="material-icons text-slate-400 ml-auto text-sm">
                {iconOpen ? "expand_less" : "expand_more"}
              </span>
            </button>
            {iconOpen && (
              <div className="absolute z-20 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 grid grid-cols-8 gap-1 w-full">
                {ICON_OPTIONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => { setIcon(ic); setIconOpen(false); }}
                    className={`flex items-center justify-center p-2 rounded-md transition-colors ${
                      icon === ic
                        ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                        : "hover:bg-slate-100 text-slate-500"
                    }`}
                    title={ic}
                  >
                    <span className="material-icons text-lg">{ic}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>변수 삽입</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {VARIABLES.map((v) => (
                <button
                  key={v.name}
                  onClick={() => insertVariable(v.name)}
                  className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded border border-blue-100 hover:bg-blue-100 transition-colors"
                  title={v.desc}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="tpl-body">메시지 본문</Label>
            <Textarea
              id="tpl-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="메시지 내용을 입력하세요..."
              className="font-mono text-sm"
            />
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                msgType === "LMS" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
              }`}>
                {byteLength}byte · {msgType}
              </span>
              {msgType === "LMS" && (
                <span className="text-[10px] text-slate-400">90byte 초과 → 자동 LMS</span>
              )}
            </div>
          </div>

          <div>
            <Label>추천 상태 (선택)</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    statuses.includes(s)
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={saving || !key.trim() || !label.trim() || !body.trim()}>
            {saving ? "저장 중..." : template ? "수정 완료" : "생성"}
          </Button>
        </div>

        {/* Preview */}
        <div>
          <Label>미리보기</Label>
          <div className="mt-2 bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-icons text-slate-400">{icon}</span>
              <span className="font-medium text-sm">{label || "(이름 없음)"}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                msgType === "LMS" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
              }`}>
                {byteLength}byte · {msgType}
              </span>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-sm whitespace-pre-wrap text-slate-800 leading-relaxed">
              {previewBody || "(본문 없음)"}
            </div>
            {statuses.length > 0 && (
              <div className="flex gap-1 mt-3">
                {statuses.map((s) => (
                  <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">{s}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
