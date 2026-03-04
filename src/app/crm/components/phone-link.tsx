"use client";

import { useState } from "react";

export function PhoneLink({ phone, className = "" }: { phone: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* fallback: do nothing */ }
  };
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} onClick={e => e.stopPropagation()}>
      <a href={`tel:${phone}`} className="hover:underline hover:text-primary transition-colors" title="전화 걸기">{phone}</a>
      <button onClick={copy} className="text-slate-400 hover:text-primary transition-colors shrink-0 p-1 -m-1 md:p-0 md:m-0" title="번호 복사" aria-label="전화번호 복사">
        <span className="material-icons" style={{ fontSize: "12px" }}>{copied ? "check" : "content_copy"}</span>
      </button>
    </span>
  );
}
