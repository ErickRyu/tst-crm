alter table lead_memos
  add column if not exists updated_at timestamp not null default now(),
  add column if not exists version integer not null default 1;

create index if not exists idx_lead_memos_lead_created on lead_memos (lead_id, created_at desc);
