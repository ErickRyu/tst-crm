alter table leads
  add column if not exists updated_at timestamp not null default now(),
  add column if not exists version integer not null default 1,
  add column if not exists contact_fail_count integer not null default 0;

-- backfill updated_at for existing rows
update leads set updated_at = coalesce(updated_at, now()) where updated_at is null;

create index if not exists idx_leads_updated_at on leads (updated_at);
