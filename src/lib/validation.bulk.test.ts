import { describe, it, expect } from "vitest";
import {
  bulkStatusUpdateSchema,
  bulkAssignSchema,
  bulkSmsSchema,
} from "./validation";

// ─── bulkStatusUpdateSchema ───

describe("bulkStatusUpdateSchema", () => {
  it("유효한 입력을 파싱해야 한다", () => {
    const result = bulkStatusUpdateSchema.safeParse({
      leadIds: [1, 2, 3],
      crmStatus: "예약완료",
      actorName: "김상담",
    });
    expect(result.success).toBe(true);
  });

  it("actorName 없이도 파싱해야 한다", () => {
    const result = bulkStatusUpdateSchema.safeParse({
      leadIds: [1],
      crmStatus: "신규인입",
    });
    expect(result.success).toBe(true);
  });

  it("빈 leadIds는 실패해야 한다", () => {
    const result = bulkStatusUpdateSchema.safeParse({
      leadIds: [],
      crmStatus: "예약완료",
    });
    expect(result.success).toBe(false);
  });

  it("leadIds가 100건 초과이면 실패해야 한다", () => {
    const result = bulkStatusUpdateSchema.safeParse({
      leadIds: Array.from({ length: 101 }, (_, i) => i + 1),
      crmStatus: "예약완료",
    });
    expect(result.success).toBe(false);
  });

  it("100건 이하이면 성공해야 한다", () => {
    const result = bulkStatusUpdateSchema.safeParse({
      leadIds: Array.from({ length: 100 }, (_, i) => i + 1),
      crmStatus: "예약완료",
    });
    expect(result.success).toBe(true);
  });

  it("유효하지 않은 crmStatus이면 실패해야 한다", () => {
    const result = bulkStatusUpdateSchema.safeParse({
      leadIds: [1],
      crmStatus: "없는상태",
    });
    expect(result.success).toBe(false);
  });

  it("leadIds에 0이 있으면 실패해야 한다", () => {
    const result = bulkStatusUpdateSchema.safeParse({
      leadIds: [0],
      crmStatus: "예약완료",
    });
    expect(result.success).toBe(false);
  });

  it("leadIds에 음수가 있으면 실패해야 한다", () => {
    const result = bulkStatusUpdateSchema.safeParse({
      leadIds: [-1],
      crmStatus: "예약완료",
    });
    expect(result.success).toBe(false);
  });

  it("모든 유효한 crmStatus 값을 허용해야 한다", () => {
    const validStatuses = [
      "신규인입", "1차부재", "2차부재", "3차부재", "노쇼",
      "추후 통화희망", "응대중", "통화완료", "예약완료",
      "추가상담거부", "블랙리스트", "중복",
    ];
    for (const status of validStatuses) {
      const result = bulkStatusUpdateSchema.safeParse({
        leadIds: [1],
        crmStatus: status,
      });
      expect(result.success).toBe(true);
    }
  });
});

// ─── bulkAssignSchema ───

describe("bulkAssignSchema", () => {
  it("유효한 입력을 파싱해야 한다", () => {
    const result = bulkAssignSchema.safeParse({
      leadIds: [1, 2],
      assigneeId: 5,
    });
    expect(result.success).toBe(true);
  });

  it("assigneeId가 null이면 성공해야 한다 (미배정)", () => {
    const result = bulkAssignSchema.safeParse({
      leadIds: [1],
      assigneeId: null,
    });
    expect(result.success).toBe(true);
  });

  it("빈 leadIds는 실패해야 한다", () => {
    const result = bulkAssignSchema.safeParse({
      leadIds: [],
      assigneeId: 1,
    });
    expect(result.success).toBe(false);
  });

  it("100건 초과이면 실패해야 한다", () => {
    const result = bulkAssignSchema.safeParse({
      leadIds: Array.from({ length: 101 }, (_, i) => i + 1),
      assigneeId: 1,
    });
    expect(result.success).toBe(false);
  });

  it("assigneeId가 0이면 실패해야 한다", () => {
    const result = bulkAssignSchema.safeParse({
      leadIds: [1],
      assigneeId: 0,
    });
    expect(result.success).toBe(false);
  });

  it("assigneeId가 누락되면 실패해야 한다", () => {
    const result = bulkAssignSchema.safeParse({
      leadIds: [1],
    });
    expect(result.success).toBe(false);
  });
});

// ─── bulkSmsSchema ───

describe("bulkSmsSchema", () => {
  it("유효한 입력을 파싱해야 한다", () => {
    const result = bulkSmsSchema.safeParse({
      leadIds: [1, 2],
      msg: "안녕하세요",
      senderName: "김상담",
    });
    expect(result.success).toBe(true);
  });

  it("선택적 필드가 포함되어도 성공해야 한다", () => {
    const result = bulkSmsSchema.safeParse({
      leadIds: [1],
      msg: "테스트",
      templateKey: "welcome",
      msgType: "LMS",
      senderName: "김상담",
    });
    expect(result.success).toBe(true);
  });

  it("빈 msg이면 실패해야 한다", () => {
    const result = bulkSmsSchema.safeParse({
      leadIds: [1],
      msg: "",
      senderName: "김상담",
    });
    expect(result.success).toBe(false);
  });

  it("senderName이 누락되면 실패해야 한다", () => {
    const result = bulkSmsSchema.safeParse({
      leadIds: [1],
      msg: "테스트",
    });
    expect(result.success).toBe(false);
  });

  it("leadIds가 50건 초과이면 실패해야 한다", () => {
    const result = bulkSmsSchema.safeParse({
      leadIds: Array.from({ length: 51 }, (_, i) => i + 1),
      msg: "테스트",
      senderName: "김상담",
    });
    expect(result.success).toBe(false);
  });

  it("50건 이하이면 성공해야 한다", () => {
    const result = bulkSmsSchema.safeParse({
      leadIds: Array.from({ length: 50 }, (_, i) => i + 1),
      msg: "테스트",
      senderName: "김상담",
    });
    expect(result.success).toBe(true);
  });

  it("유효하지 않은 msgType이면 실패해야 한다", () => {
    const result = bulkSmsSchema.safeParse({
      leadIds: [1],
      msg: "테스트",
      msgType: "MMS",
      senderName: "김상담",
    });
    expect(result.success).toBe(false);
  });

  it("msg가 2000자 초과이면 실패해야 한다", () => {
    const result = bulkSmsSchema.safeParse({
      leadIds: [1],
      msg: "a".repeat(2001),
      senderName: "김상담",
    });
    expect(result.success).toBe(false);
  });
});
