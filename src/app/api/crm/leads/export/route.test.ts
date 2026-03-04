import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";

// ── Thenable chain mock ──
let queryIndex = 0;
const queryResults: unknown[][] = [];

const chain: Record<string, unknown> = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  then: vi.fn((resolve: (v: unknown) => unknown) =>
    resolve(queryResults[queryIndex++] ?? [])
  ),
};

vi.mock("@/lib/db", () => ({ db: chain }));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return { ...actual };
});

const { GET } = await import("./route");

function makeLead(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    event: "test",
    site: "web",
    advertiser: "ad",
    media: "media",
    category: "임플란트",
    name: "홍길동",
    phone: "010-1234-5678",
    age: 30,
    gender: "남",
    branch: "강남점",
    address: "서울",
    email: "test@test.com",
    survey1: null,
    survey2: null,
    survey3: null,
    survey4: null,
    survey5: null,
    survey6: null,
    status: "대기",
    memo: "원본 메모",
    ip: null,
    crmStatus: "신규인입",
    assigneeId: 1,
    birthDate: "1990-01-01",
    lastCallAt: new Date("2025-03-01"),
    followUpAt: null,
    appointmentAt: null,
    updatedAt: new Date("2025-01-01"),
    version: 1,
    contactFailCount: 0,
    createdAt: new Date("2025-01-01"),
    ...overrides,
  };
}

function parseXlsxResponse(buf: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(new Uint8Array(buf), { type: "array" });
}

const EXPECTED_HEADERS = [
  "이름", "전화번호", "나이", "성별", "생년월일", "이메일", "주소",
  "치료종류", "지점", "매체", "광고주", "이벤트", "사이트",
  "CRM 상태", "담당 상담원", "부재 횟수", "유입일", "마지막 통화",
  "팔로업 예정", "예약일", "메모",
];

describe("GET /api/crm/leads/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryIndex = 0;
    queryResults.length = 0;
  });

  it("Content-Type이 xlsx여야 한다", async () => {
    queryResults.push([]);

    const req = new NextRequest("http://localhost/api/crm/leads/export");
    const res = await GET(req);

    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  it("Content-Disposition에 filename이 포함되어야 한다", async () => {
    queryResults.push([]);

    const req = new NextRequest("http://localhost/api/crm/leads/export");
    const res = await GET(req);

    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("CRM_");
    expect(disposition).toContain(".xlsx");
  });

  it("XLSX 파싱하여 21개 컬럼 헤더를 검증해야 한다", async () => {
    queryResults.push([
      { lead: makeLead(), memoBody: "상담 메모", assigneeName: "이상담" },
    ]);

    const req = new NextRequest("http://localhost/api/crm/leads/export");
    const res = await GET(req);
    const buf = await res.arrayBuffer();
    const wb = parseXlsxResponse(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1 });

    // 1행: 헤더
    const headers = data[0] as string[];
    expect(headers).toEqual(EXPECTED_HEADERS);
  });

  it("리드 데이터가 올바르게 매핑되어야 한다", async () => {
    queryResults.push([
      { lead: makeLead({ name: "박철수", phone: "010-9999-8888" }), memoBody: "메모 내용", assigneeName: "이상담" },
    ]);

    const req = new NextRequest("http://localhost/api/crm/leads/export");
    const res = await GET(req);
    const buf = await res.arrayBuffer();
    const wb = parseXlsxResponse(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

    expect(rows).toHaveLength(1);
    expect(rows[0]["이름"]).toBe("박철수");
    expect(rows[0]["전화번호"]).toBe("010-9999-8888");
    expect(rows[0]["담당 상담원"]).toBe("이상담");
    expect(rows[0]["메모"]).toBe("메모 내용");
  });

  it("LEFT JOIN 중복 제거가 되어야 한다", async () => {
    const lead = makeLead({ id: 1 });
    queryResults.push([
      { lead, memoBody: "메모1", assigneeName: "이상담" },
      { lead, memoBody: "메모2", assigneeName: "이상담" },
    ]);

    const req = new NextRequest("http://localhost/api/crm/leads/export");
    const res = await GET(req);
    const buf = await res.arrayBuffer();
    const wb = parseXlsxResponse(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);

    expect(rows).toHaveLength(1);
  });

  it("memoBody가 null이면 lead.memo를 fallback으로 사용해야 한다", async () => {
    queryResults.push([
      { lead: makeLead({ memo: "원본 메모 텍스트" }), memoBody: null, assigneeName: null },
    ]);

    const req = new NextRequest("http://localhost/api/crm/leads/export");
    const res = await GET(req);
    const buf = await res.arrayBuffer();
    const wb = parseXlsxResponse(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

    expect(rows[0]["메모"]).toBe("원본 메모 텍스트");
  });

  it("빈 데이터 시 유효한 XLSX 파일을 반환해야 한다", async () => {
    queryResults.push([]);

    const req = new NextRequest("http://localhost/api/crm/leads/export");
    const res = await GET(req);

    expect(res.status).toBe(200);

    const buf = await res.arrayBuffer();
    const wb = parseXlsxResponse(buf);

    // 유효한 워크북이고 시트가 있어야 함
    expect(wb.SheetNames).toHaveLength(1);
    expect(wb.SheetNames[0]).toBe("리드 목록");

    // 빈 데이터이므로 행이 없어야 함
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);
    expect(rows).toHaveLength(0);
  });

  it("scope=mine에 assigneeId가 없으면 400을 반환해야 한다", async () => {
    const req = new NextRequest("http://localhost/api/crm/leads/export?scope=mine");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe(400);
  });
});
