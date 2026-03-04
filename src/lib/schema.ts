import { pgTable, serial, text, integer, timestamp, date, primaryKey } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  isActive: integer("is_active").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  event: text("event").notNull(),
  site: text("site").notNull(),
  advertiser: text("advertiser").notNull(),
  media: text("media").notNull(),
  category: text("category").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  age: integer("age"),
  gender: text("gender"),
  branch: text("branch"),
  address: text("address"),
  email: text("email"),
  survey1: text("survey1"),
  survey2: text("survey2"),
  survey3: text("survey3"),
  survey4: text("survey4"),
  survey5: text("survey5"),
  survey6: text("survey6"),
  status: text("status").default("대기").notNull(),
  memo: text("memo"),
  ip: text("ip"),
  crmStatus: text("crm_status").default("신규인입").notNull(),
  assigneeId: integer("assignee_id").references(() => users.id),
  birthDate: date("birth_date"),
  lastCallAt: timestamp("last_call_at"),
  followUpAt: timestamp("follow_up_at"),
  appointmentAt: timestamp("appointment_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  version: integer("version").default(1).notNull(),
  contactFailCount: integer("contact_fail_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leadMemos = pgTable(
  "lead_memos",
  {
    id: serial("id").notNull(),
    leadId: integer("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
  })
);

export const smsLogs = pgTable("sms_logs", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  phone: text("phone").notNull(),
  templateKey: text("template_key"),
  body: text("body").notNull(),
  msgType: text("msg_type").notNull(), // SMS, LMS
  status: text("status").notNull(), // sent, failed, test
  senderName: text("sender_name").notNull(),
  msgId: text("msg_id"), // Aligo response msg_id
  errorMessage: text("error_message"),
  isAutoSend: integer("is_auto_send").default(0),
  autoSendRuleId: integer("auto_send_rule_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const smsTemplates = pgTable("sms_templates", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  icon: text("icon").notNull(),
  body: text("body").notNull(),
  msgType: text("msg_type").notNull(), // SMS, LMS
  category: text("category"),
  statuses: text("statuses"), // JSON string array
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: integer("is_active").default(1).notNull(),
  isDefault: integer("is_default").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const autoSendRules = pgTable("auto_send_rules", {
  id: serial("id").primaryKey(),
  triggerType: text("trigger_type").notNull(), // "new_lead" | "appointment_set" | "status_absent"
  triggerValue: text("trigger_value"), // e.g. "1차부재"
  templateId: integer("template_id").notNull().references(() => smsTemplates.id),
  isEnabled: integer("is_enabled").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const crmSettings = pgTable("crm_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
