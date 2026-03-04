import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Thenable chain mock ──
let queryIndex = 0;
const queryResults: unknown[][] = [];

const chain: Record<string, unknown> = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  then: vi.fn((resolve: (v: unknown) => unknown) =>
    resolve(queryResults[queryIndex++] ?? [])
  ),
};

vi.mock("@/lib/db", () => ({ db: chain }));

vi.mock("drizzle-orm", async () => {
  const actual =
    await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return { ...actual };
});

const { GET } = await import("./route");

function makeParams(leadId: string) {
  return { params: Promise.resolve({ leadId }) };
}

describe("GET /api/crm/leads/[leadId]/activities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryIndex = 0;
    queryResults.length = 0;
  });

  it("leadId가 NaN이면 400을 반환해야 한다", async () => {
    const req = new NextRequest(
      "http://localhost/api/crm/leads/abc/activities"
    );
    const res = await GET(req, makeParams("abc"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe(400);
  });

  it("활동 + SMS 통합 타임라인을 createdAt 내림차순으로 반환해야 한다", async () => {
    // queryResults[0] → leadActivities
    queryResults.push([
      {
        id: 1,
        leadId: 1,
        action: "status_change",
        actorName: "김상담",
        detail: "상태 변경",
        oldValue: "new",
        newValue: "contacted",
        createdAt: new Date("2025-03-01T10:00:00Z"),
      },
    ]);
    // queryResults[1] → smsLogs
    queryResults.push([
      {
        id: 5,
        leadId: 1,
        senderName: "박상담",
        phone: "01012345678",
        body: "짧은 메시지",
        status: "sent",
        createdAt: new Date("2025-03-02T10:00:00Z"),
      },
    ]);

    const req = new NextRequest(
      "http://localhost/api/crm/leads/1/activities"
    );
    const res = await GET(req, makeParams("1"));
    const json = await res.json();

    expect(json.code).toBe(200);
    expect(json.data).toHaveLength(2);
    // SMS(3/2)가 활동(3/1)보다 최신이므로 먼저 와야 함
    expect(json.data[0].id).toBe("sms-5");
    expect(json.data[1].id).toBe("activity-1");
  });

  it("SMS body > 50자일 때 detail이 truncation되어야 한다", async () => {
    const longBody = "가".repeat(60); // 60자
    // activities: 빈 배열
    queryResults.push([]);
    // smsLogs
    queryResults.push([
      {
        id: 1,
        leadId: 1,
        senderName: "김상담",
        phone: "01012345678",
        body: longBody,
        status: "sent",
        createdAt: new Date("2025-03-01T10:00:00Z"),
      },
    ]);

    const req = new NextRequest(
      "http://localhost/api/crm/leads/1/activities"
    );
    const res = await GET(req, makeParams("1"));
    const json = await res.json();

    const smsItem = json.data[0];
    // "SMS 발송: " + 50자 + "..."
    expect(smsItem.detail).toContain("...");
    expect(smsItem.detail).toBe(`SMS 발송: ${"가".repeat(50)}...`);
  });

  it("SMS body ≤ 50자일 때 truncation 없이 그대로 포함되어야 한다", async () => {
    const shortBody = "안녕하세요";
    queryResults.push([]);
    queryResults.push([
      {
        id: 1,
        leadId: 1,
        senderName: "김상담",
        phone: "01012345678",
        body: shortBody,
        status: "sent",
        createdAt: new Date("2025-03-01T10:00:00Z"),
      },
    ]);

    const req = new NextRequest(
      "http://localhost/api/crm/leads/1/activities"
    );
    const res = await GET(req, makeParams("1"));
    const json = await res.json();

    expect(json.data[0].detail).toBe(`SMS 발송: ${shortBody}`);
    expect(json.data[0].detail).not.toContain("...");
  });

  it('SMS status가 "sent"이면 "발송" prefix를 사용해야 한다', async () => {
    queryResults.push([]);
    queryResults.push([
      {
        id: 1,
        leadId: 1,
        senderName: "김상담",
        phone: "01012345678",
        body: "테스트",
        status: "sent",
        createdAt: new Date("2025-03-01T10:00:00Z"),
      },
    ]);

    const req = new NextRequest(
      "http://localhost/api/crm/leads/1/activities"
    );
    const res = await GET(req, makeParams("1"));
    const json = await res.json();

    expect(json.data[0].detail).toMatch(/^SMS 발송:/);
  });

  it('SMS status가 "test"이면 "테스트 발송" prefix를 사용해야 한다', async () => {
    queryResults.push([]);
    queryResults.push([
      {
        id: 1,
        leadId: 1,
        senderName: "김상담",
        phone: "01012345678",
        body: "테스트",
        status: "test",
        createdAt: new Date("2025-03-01T10:00:00Z"),
      },
    ]);

    const req = new NextRequest(
      "http://localhost/api/crm/leads/1/activities"
    );
    const res = await GET(req, makeParams("1"));
    const json = await res.json();

    expect(json.data[0].detail).toMatch(/^SMS 테스트 발송:/);
  });

  it('SMS status가 그 외 값이면 "실패" prefix를 사용해야 한다', async () => {
    queryResults.push([]);
    queryResults.push([
      {
        id: 1,
        leadId: 1,
        senderName: "김상담",
        phone: "01012345678",
        body: "테스트",
        status: "failed",
        createdAt: new Date("2025-03-01T10:00:00Z"),
      },
    ]);

    const req = new NextRequest(
      "http://localhost/api/crm/leads/1/activities"
    );
    const res = await GET(req, makeParams("1"));
    const json = await res.json();

    expect(json.data[0].detail).toMatch(/^SMS 실패:/);
  });

  it("활동만 있고 SMS 없는 경우 활동만 반환해야 한다", async () => {
    queryResults.push([
      {
        id: 1,
        leadId: 1,
        action: "status_change",
        actorName: "김상담",
        detail: "상태 변경",
        oldValue: "new",
        newValue: "contacted",
        createdAt: new Date("2025-03-01T10:00:00Z"),
      },
    ]);
    queryResults.push([]); // SMS 없음

    const req = new NextRequest(
      "http://localhost/api/crm/leads/1/activities"
    );
    const res = await GET(req, makeParams("1"));
    const json = await res.json();

    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe("activity-1");
    expect(json.data[0].type).toBe("status_change");
  });

  it("SMS만 있고 활동 없는 경우 SMS만 반환해야 한다", async () => {
    queryResults.push([]); // 활동 없음
    queryResults.push([
      {
        id: 3,
        leadId: 1,
        senderName: "박상담",
        phone: "01012345678",
        body: "SMS 메시지",
        status: "sent",
        createdAt: new Date("2025-03-01T10:00:00Z"),
      },
    ]);

    const req = new NextRequest(
      "http://localhost/api/crm/leads/1/activities"
    );
    const res = await GET(req, makeParams("1"));
    const json = await res.json();

    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe("sms-3");
    expect(json.data[0].type).toBe("sms_sent");
    expect(json.data[0].newValue).toBe("01012345678");
  });

  it("둘 다 없으면 빈 배열을 반환해야 한다", async () => {
    queryResults.push([]);
    queryResults.push([]);

    const req = new NextRequest(
      "http://localhost/api/crm/leads/1/activities"
    );
    const res = await GET(req, makeParams("1"));
    const json = await res.json();

    expect(json.code).toBe(200);
    expect(json.data).toHaveLength(0);
  });
});
