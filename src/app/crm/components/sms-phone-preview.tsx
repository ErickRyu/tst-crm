"use client";

interface SmsPhonePreviewProps {
  message: string;
  msgType: "SMS" | "LMS";
  charCount: number;
  byteCount: number;
}

export function SmsPhonePreview({ message, msgType, charCount, byteCount }: SmsPhonePreviewProps) {
  return (
    <div className="mx-auto w-[260px] rounded-[2rem] border-2 border-slate-300 bg-white shadow-lg overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center justify-between px-5 pt-3 pb-1 text-[10px] text-slate-500">
        <span className="font-medium">12:34</span>
        <div className="w-16 h-[5px] rounded-full bg-slate-900 mx-auto" />
        <div className="flex items-center gap-1">
          <span className="material-icons" style={{ fontSize: "10px" }}>signal_cellular_alt</span>
          <span className="material-icons" style={{ fontSize: "10px" }}>battery_full</span>
        </div>
      </div>

      {/* Header - sender */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-100">
        <span className="material-icons text-slate-400" style={{ fontSize: "16px" }}>arrow_back_ios</span>
        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
          <span className="material-icons text-slate-400" style={{ fontSize: "14px" }}>person</span>
        </div>
        <span className="text-xs font-medium text-slate-700">문자 메시지</span>
      </div>

      {/* Message area */}
      <div className="px-4 py-3 min-h-[140px] max-h-[180px] overflow-y-auto">
        {message.trim() ? (
          <div className="flex">
            <div className="max-w-[85%] bg-slate-100 rounded-2xl rounded-tl-sm px-3 py-2">
              <p className="text-xs text-slate-800 whitespace-pre-wrap break-words leading-relaxed">{message}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[120px]">
            <p className="text-[11px] text-slate-300 text-center">메시지를 입력하면<br />미리보기가 표시됩니다</p>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-center gap-2 px-4 py-2 border-t border-slate-100 bg-slate-50">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${msgType === "LMS" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>
          {msgType}
        </span>
        <span className="text-[10px] text-slate-400">{charCount}자 / {byteCount}B</span>
      </div>
    </div>
  );
}
