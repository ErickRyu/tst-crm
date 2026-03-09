import { describe, it, expect, vi, afterEach } from "vitest";

// DB 모듈을 먼저 mock해서 import 에러 방지
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/schema", () => ({ crmSettings: {} }));
vi.mock("@/lib/crypto", () => ({ decrypt: (v: string) => v }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { sendTelegramMessage } from "./telegram";

const BOT_TOKEN = "fake-bot-token";
const CHAT_ID = "fake-chat-id";
const TEXT = "테스트 메시지";

describe("sendTelegramMessage — 재시도 및 타임아웃 테스트", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("정상 응답 시 1회 호출로 성공", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const result = await sendTelegramMessage(BOT_TOKEN, CHAT_ID, TEXT);

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("첫 번째 실패 → 재시도 1회로 성공", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

    const result = await sendTelegramMessage(BOT_TOKEN, CHAT_ID, TEXT);

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("2번 실패 → 3번째 시도에서 성공", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

    const result = await sendTelegramMessage(BOT_TOKEN, CHAT_ID, TEXT);

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("3번 모두 실패 → 에러 throw", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new TypeError("fetch failed"));

    await expect(
      sendTelegramMessage(BOT_TOKEN, CHAT_ID, TEXT)
    ).rejects.toThrow("fetch failed");

    // 최초 1회 + 재시도 2회 = 총 3회
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("AbortError(타임아웃) 발생 시 재시도하여 성공", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(async () => {
        throw new DOMException("The operation was aborted", "AbortError");
      })
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

    const result = await sendTelegramMessage(BOT_TOKEN, CHAT_ID, TEXT);

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("fetch에 AbortSignal이 항상 전달됨", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await sendTelegramMessage(BOT_TOKEN, CHAT_ID, TEXT);

    const options = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("동시 10회 호출 — 모두 성공", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        sendTelegramMessage(BOT_TOKEN, CHAT_ID, TEXT)
      )
    );

    expect(results).toHaveLength(10);
    results.forEach((r) => expect(r).toEqual({ ok: true }));
  });

  it("동시 5회 호출 — 일부 실패해도 재시도로 전부 성공", async () => {
    let callCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      callCount++;
      // 3번째마다 실패 시뮬레이션
      if (callCount % 3 === 0) {
        throw new TypeError("fetch failed");
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        sendTelegramMessage(BOT_TOKEN, CHAT_ID, TEXT)
      )
    );

    expect(results).toHaveLength(5);
    results.forEach((r) => expect(r).toEqual({ ok: true }));
  });

  it("ETIMEDOUT 에러 시뮬레이션 — 재시도로 성공", async () => {
    const etimedout = new Error("connect ETIMEDOUT 149.154.166.110:443");
    (etimedout as NodeJS.ErrnoException).code = "ETIMEDOUT";

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("fetch failed", { cause: etimedout }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

    const result = await sendTelegramMessage(BOT_TOKEN, CHAT_ID, TEXT);

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
