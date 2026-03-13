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
  "추후 통화희망",
  "응대중",
  "통화완료",
  "예약완료",
  "추가상담거부",
  "블랙리스트",
  "중복",
] as const;

export const crmStatusSchema = z.enum(crmStatusValues);

export const crmStatusUpdateSchema = z.object({
  crmStatus: crmStatusSchema,
  version: z.number().int().positive().optional(),
  actorName: z.string().max(50).optional(),
});

const isoDateTime = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime({ local: true }));

export const crmScheduleUpdateSchema = z.object({
  followUpAt: z.union([isoDateTime, z.null()]).optional(),
  appointmentAt: z.union([isoDateTime, z.null()]).optional(),
  version: z.number().int().positive().optional(),
  actorName: z.string().max(50).optional(),
});

export const crmAssignSchema = z.object({
  assigneeId: z.number().int().positive().nullable(),
  version: z.number().int().positive().optional(),
  actorName: z.string().max(50).optional(),
});

export const memoCreateSchema = z.object({
  authorName: z.string().max(50).optional(),
  body: z.string().min(1).max(2000),
});

export const memoUpdateSchema = z.object({
  body: z.string().min(1).max(2000),
  version: z.number().int().positive(),
});

export const crmUserCreateSchema = z.object({
  name: z.string().min(1, "상담원 이름은 필수입니다."),
});

// --- SMS Template schemas ---
export const smsTemplateCreateSchema = z.object({
  key: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  icon: z.string().min(1).max(50),
  body: z.string().min(1).max(2000),
  category: z.string().max(50).nullable().optional(),
  statuses: z.array(z.string()).nullable().optional(),
});

export const smsTemplateUpdateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  icon: z.string().min(1).max(50).optional(),
  body: z.string().min(1).max(2000).optional(),
  category: z.string().max(50).nullable().optional(),
  statuses: z.array(z.string()).nullable().optional(),
  isActive: z.boolean().optional(),
});

// --- Auto-send rule schemas ---
export const autoSendRuleCreateSchema = z.object({
  triggerType: z.enum(["new_lead", "appointment_set", "status_absent"]),
  triggerValue: z.string().nullable().optional(),
  templateId: z.number().int().positive(),
  isEnabled: z.boolean().optional(),
});

export const autoSendRuleUpdateSchema = z.object({
  triggerType: z.enum(["new_lead", "appointment_set", "status_absent"]).optional(),
  triggerValue: z.string().nullable().optional(),
  templateId: z.number().int().positive().optional(),
  isEnabled: z.boolean().optional(),
});

// --- Bulk operation schemas ---
export const bulkStatusUpdateSchema = z.object({
  leadIds: z.array(z.number().int().positive()).min(1).max(100),
  crmStatus: crmStatusSchema,
  actorName: z.string().max(50).optional(),
});

export const bulkAssignSchema = z.object({
  leadIds: z.array(z.number().int().positive()).min(1).max(100),
  assigneeId: z.number().int().positive().nullable(),
  actorName: z.string().max(50).optional(),
});

export const bulkSmsSchema = z.object({
  leadIds: z.array(z.number().int().positive()).min(1).max(50),
  msg: z.string().min(1, "메시지 내용은 필수입니다.").max(2000),
  templateKey: z.string().optional(),
  msgType: z.enum(["SMS", "LMS"]).optional(),
  senderName: z.string().min(1).max(50),
});

// --- CRM Settings schemas ---
export const crmSettingsUpdateSchema = z.record(z.string(), z.string());

// --- User phone update ---
export const crmUserUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  isActive: z.number().int().min(0).max(1).optional(),
});

// --- Admin user update ---
export const adminUserUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email("유효한 이메일을 입력하세요.").optional(),
  role: z.enum(["ADMIN", "COUNSELOR", "HOSPITAL_STAFF"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  isActive: z.number().int().min(0).max(1).optional(),
});
