import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Telegram lib mocks ──
const mockGetTelegramSettings = vi.fn();
const mockTestTelegramConnection = vi.fn();
const mockDetectChatIds = vi.fn();

vi.mock("@/lib/telegram", () => ({
  getTelegramSettings: (...args: unknown[]) => mockGetTelegramSettings(...args),
  testTelegramConnection: (...args: unknown[]) => mockTestTelegramConnection(...args),
  detectChatIds: (...args: unknown[]) => mockDetectChatIds(...args),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    error: null,
    user: { id: 1, name: "테스트", email: "test@test.com", role: "ADMIN" },
  }),
}));

const { POST } = await import("./route");

describe("POST /api/crm/telegram/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTelegramSettings.mockReset();
    mockTestTelegramConnection.mockReset();
    mockDetectChatIds.mockReset();
  });

  // ─── 토큰 없음 ───

  it("봇 토큰이 없으면 400을 반환해야 한다", async () => {
    mockGetTelegramSettings.mockResolvedValue({ botToken: "" });

    const req = new NextRequest("http://localhost/api/crm/telegram/test", {
      method: "POST",
      body: JSON.stringify({ chatId: "123" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.message).toContain("Bot Token");
  });

  // ─── 테스트 메시지 전송 ───

  it("테스트 메시지 전송 성공 시 200을 반환해야 한다", async () => {
    mockGetTelegramSettings.mockResolvedValue({ botToken: "test-token" });
    mockTestTelegramConnection.mockResolvedValue({ ok: true });

    const req = new NextRequest("http://localhost/api/crm/telegram/test", {
      method: "POST",
      body: JSON.stringify({ chatId: "123456" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.code).toBe(200);
    expect(mockTestTelegramConnection).toHaveBeenCalledWith("test-token", "123456");
  });

  it("botToken을 직접 제공하면 DB 조회 없이 사용해야 한다", async () => {
    mockTestTelegramConnection.mockResolvedValue({ ok: true });

    const req = new NextRequest("http://localhost/api/crm/telegram/test", {
      method: "POST",
      body: JSON.stringify({ botToken: "custom-token", chatId: "123" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockTestTelegramConnection).toHaveBeenCalledWith("custom-token", "123");
  });

  it("테스트 메시지 전송 실패 시 400을 반환해야 한다", async () => {
    mockGetTelegramSettings.mockResolvedValue({ botToken: "test-token" });
    mockTestTelegramConnection.mockResolvedValue({ ok: false, description: "chat not found" });

    const req = new NextRequest("http://localhost/api/crm/telegram/test", {
      method: "POST",
      body: JSON.stringify({ chatId: "999" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.message).toContain("chat not found");
  });

  it("chatId가 없으면 400을 반환해야 한다", async () => {
    mockGetTelegramSettings.mockResolvedValue({ botToken: "test-token" });

    const req = new NextRequest("http://localhost/api/crm/telegram/test", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.message).toContain("Chat ID");
  });

  // ─── 자동 감지 ───

  it("자동 감지 성공 시 채팅 목록을 반환해야 한다", async () => {
    const chats = [
      { id: 111, type: "private", first_name: "홍길동" },
      { id: -222, type: "group", title: "상담실" },
    ];
    mockDetectChatIds.mockResolvedValue({ ok: true, chats });

    const req = new NextRequest("http://localhost/api/crm/telegram/test", {
      method: "POST",
      body: JSON.stringify({ botToken: "token", action: "detect" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(2);
    expect(json.data[0].first_name).toBe("홍길동");
    expect(mockDetectChatIds).toHaveBeenCalledWith("token");
  });

  it("감지된 채팅이 없으면 404를 반환해야 한다", async () => {
    mockDetectChatIds.mockResolvedValue({ ok: true, chats: [] });

    const req = new NextRequest("http://localhost/api/crm/telegram/test", {
      method: "POST",
      body: JSON.stringify({ botToken: "token", action: "detect" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.message).toContain("감지된 채팅이 없습니다");
  });

  it("감지 실패 시 400을 반환해야 한다", async () => {
    mockDetectChatIds.mockResolvedValue({ ok: false, description: "Unauthorized" });

    const req = new NextRequest("http://localhost/api/crm/telegram/test", {
      method: "POST",
      body: JSON.stringify({ botToken: "bad-token", action: "detect" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.message).toContain("Unauthorized");
  });

  // ─── 예외 처리 ───

  it("예외 발생 시 500을 반환해야 한다", async () => {
    mockGetTelegramSettings.mockRejectedValue(new Error("DB 연결 실패"));

    const req = new NextRequest("http://localhost/api/crm/telegram/test", {
      method: "POST",
      body: JSON.stringify({ chatId: "123" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.message).toContain("네트워크");
  });
});
