"use client";

import { useState } from "react";

export function downloadVCard(name: string, phone: string, clinicName?: string) {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile) {
    // 모바일: API 엔드포인트로 이동하면 연락처 저장 화면이 바로 뜸
    const params = new URLSearchParams({ name, phone });
    if (clinicName) params.set("org", clinicName);
    window.location.href = `/api/crm/vcard?${params.toString()}`;
  } else {
    // 데스크탑: .vcf 파일 다운로드
    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${name}`,
      `N:${name};;;;`,
      `TEL;TYPE=CELL:${phone}`,
    ];
    if (clinicName) lines.push(`ORG:${clinicName}`);
    lines.push(`NOTE:${clinicName ? clinicName + " " : ""}문의 환자`);
    lines.push("END:VCARD");
    const vcard = lines.join("\r\n");

    const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  }
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
