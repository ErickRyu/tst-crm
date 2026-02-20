-- users table
create table if not exists users (
  id serial primary key,
  name text not null,
  is_active integer not null default 1,
  created_at timestamp not null default now()
);

-- leads extensions
alter table leads add column if not exists crm_status text not null default '신규인입';
alter table leads add column if not exists assignee_id integer references users(id);
alter table leads add column if not exists birth_date date;
alter table leads add column if not exists last_call_at timestamp;
alter table leads add column if not exists follow_up_at timestamp;
alter table leads add column if not exists appointment_at timestamp;

-- backfill
update leads set crm_status = '신규인입' where crm_status is null;

-- indexes for CRM list/calendar
create index if not exists idx_leads_crm_priority
  on leads (crm_status, last_call_at, created_at);
create index if not exists idx_leads_followup
  on leads (assignee_id, follow_up_at);
create index if not exists idx_leads_appointment
  on leads (assignee_id, appointment_at);
