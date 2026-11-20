-- /docs module: one row that says whether the public documentation page is open, and when.
-- visible = false → closed for everyone except admins. starts_at / ends_at (optional) limit
-- the public window, e.g. the judging period. Changed only by admins through the
-- docs_settings_update tool (engine only: RLS on, no grants).
create table docs_settings (
  id          int primary key default 1 check (id = 1),
  visible     boolean not null default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  updated_at  timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
insert into docs_settings (id) values (1);
alter table docs_settings enable row level security;
