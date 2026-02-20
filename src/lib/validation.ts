import { z } from "zod";

const phoneRegex = /^01[0-9]-[0-9]{3,4}-[0-9]{4}$/;

export const leadCreateSchema = z.object({
  event: z.string().min(1, "이벤트 코드는 필수입니다."),
  site: z.string().min(1, "사이트 코드는 필수입니다."),
  advertiser: z.string().min(1, "광고주명은 필수입니다."),
  media: z.string().min(1, "매체는 필수입니다."),
  category: z.string().min(1, "구분은 필수입니다."),
  name: z.string().min(1, "이름은 필수입니다."),
  phone: z
    .string()
    .regex(phoneRegex, "연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)"),
  age: z.number().int().min(1).max(150).nullable().optional(),
  gender: z.enum(["남", "여"]).nullable().optional(),
  branch: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  email: z
    .string()
    .email("이메일 형식이 올바르지 않습니다.")
    .nullable()
    .optional(),
  survey1: z.string().nullable().optional(),
  survey2: z.string().nullable().optional(),
  survey3: z.string().nullable().optional(),
  survey4: z.string().nullable().optional(),
  survey5: z.string().nullable().optional(),
  survey6: z.string().nullable().optional(),
  status: z.enum(["인정", "미인정", "대기"]).default("대기"),
  memo: z.string().nullable().optional(),
});

export const leadUpdateSchema = z.object({
  event: z.string().min(1).optional(),
  site: z.string().min(1).optional(),
  advertiser: z.string().min(1).optional(),
  media: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  phone: z.string().regex(phoneRegex, "연락처 형식이 올바르지 않습니다.").optional(),
  age: z.number().int().min(1).max(150).nullable().optional(),
  gender: z.enum(["남", "여"]).nullable().optional(),
  branch: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  email: z
    .string()
    .email("이메일 형식이 올바르지 않습니다.")
    .nullable()
    .optional(),
  survey1: z.string().nullable().optional(),
  survey2: z.string().nullable().optional(),
  survey3: z.string().nullable().optional(),
  survey4: z.string().nullable().optional(),
  survey5: z.string().nullable().optional(),
  survey6: z.string().nullable().optional(),
  status: z.enum(["인정", "미인정", "대기"]).optional(),
  memo: z.string().nullable().optional(),
});

export const crmStatusValues = [
  "신규인입",
  "1차부재",
  "2차부재",
  "3차부재",
  "노쇼",
  "응대중",
  "통화완료",
  "예약완료",
] as const;

export const crmStatusSchema = z.enum(crmStatusValues);

export const crmStatusUpdateSchema = z.object({
  crmStatus: crmStatusSchema,
});

const isoDateTime = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime({ local: true }));

export const crmScheduleUpdateSchema = z.object({
  followUpAt: z.union([isoDateTime, z.null()]).optional(),
  appointmentAt: z.union([isoDateTime, z.null()]).optional(),
});

export const crmAssignSchema = z.object({
  assigneeId: z.number().int().positive().nullable(),
});

export const crmUserCreateSchema = z.object({
  name: z.string().min(1, "상담원 이름은 필수입니다."),
});
