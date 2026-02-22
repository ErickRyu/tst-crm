CREATE TABLE "lead_memos" (
	"id" serial NOT NULL,
	"lead_id" integer NOT NULL,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lead_memos_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"site" text NOT NULL,
	"advertiser" text NOT NULL,
	"media" text NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"age" integer,
	"gender" text,
	"branch" text,
	"address" text,
	"email" text,
	"survey1" text,
	"survey2" text,
	"survey3" text,
	"survey4" text,
	"survey5" text,
	"survey6" text,
	"status" text DEFAULT '대기' NOT NULL,
	"memo" text,
	"ip" text,
	"crm_status" text DEFAULT '신규인입' NOT NULL,
	"assignee_id" integer,
	"birth_date" date,
	"last_call_at" timestamp,
	"follow_up_at" timestamp,
	"appointment_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"contact_fail_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"phone" text NOT NULL,
	"template_key" text,
	"body" text NOT NULL,
	"msg_type" text NOT NULL,
	"status" text NOT NULL,
	"sender_name" text NOT NULL,
	"msg_id" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_memos" ADD CONSTRAINT "lead_memos_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;