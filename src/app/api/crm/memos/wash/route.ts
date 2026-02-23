import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/crm/memos/wash
 * 자연어 메모를 구조화된 상담 템플릿으로 변환합니다.
 * 향후 LLM API 연동 시 이 엔드포인트를 교체하면 됩니다.
 */
export async function POST(request: NextRequest) {
  try {
    const { raw, patientName, phone } = await request.json();

    if (!raw || typeof raw !== "string") {
      return NextResponse.json({ code: 400, message: "raw 필드가 필요합니다." }, { status: 400 });
    }

    // 규칙 기반 변환 (LLM 연동 전 임시)
    const washed = ruleBasedWash(raw, patientName, phone);

    return NextResponse.json({
      code: 200,
      message: "변환 완료",
      data: { washed, method: "rule-based" },
    });
  } catch {
    return NextResponse.json({ code: 400, message: "잘못된 요청입니다." }, { status: 400 });
  }
}

function ruleBasedWash(raw: string, patientName?: string, phone?: string): string {
  const lines = raw.split(/\n/).map(l => l.trim()).filter(Boolean);

  // 날짜/시간 패턴 추출
  const datePattern = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/;
  const timePattern = /(오전|오후)?\s*(\d{1,2})\s*시\s*(\d{1,2})?\s*분?/;
  let schedule = "";
  for (const line of lines) {
    const dm = line.match(datePattern);
    const tm = line.match(timePattern);
    if (dm) schedule += `${dm[1]}월 ${dm[2]}일 `;
    if (tm) {
      let h = parseInt(tm[2]);
      if (tm[1] === "오후" && h < 12) h += 12;
      schedule += `${h}:${tm[3] || "00"}`;
    }
  }

  // 지역 패턴
  const regionPattern = /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[\s가-힣]*/;
  const regionMatch = raw.match(regionPattern);

  // 시술 키워드
  const procedures = ["임플란트", "교정", "발치", "스케일링", "충전", "보철", "신경치료", "미백", "틀니", "라미네이트", "브릿지", "크라운"];
  const foundProcedure = procedures.find(p => raw.includes(p));

  const parts: string[] = [];
  parts.push(`[시술종류] ${foundProcedure || "-"}`);
  parts.push(`${patientName || "-"}`);
  if (phone) parts.push(`${phone}`);
  if (schedule.trim()) parts.push(`내원희망: ${schedule.trim()}`);
  if (regionMatch) parts.push(`지역: ${regionMatch[0]}`);

  // 원본 중 템플릿에 매핑되지 않은 내용을 비고로
  const mapped = [foundProcedure, schedule.trim(), regionMatch?.[0], patientName, phone].filter(Boolean);
  const remaining = lines.filter(l => !mapped.some(m => m && l.includes(m)));
  if (remaining.length > 0) parts.push(`비고: ${remaining.join(", ")}`);

  return parts.join("\n");
}
