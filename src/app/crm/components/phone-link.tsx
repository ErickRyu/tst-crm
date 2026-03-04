"use client";

import { useState } from "react";

export function downloadVCard(name: string, phone: string) {
  const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;TYPE=CELL:${phone}\nEND:VCARD`;
  const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.vcf`;
  a.click();
  URL.revokeObjectURL(url);
}

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
