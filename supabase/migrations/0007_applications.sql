-- Phase B: one shared framework for land-service applications (docs/LAND_SERVICES_PLAN.md).
--
-- Every service has the same shape: apply → pay → review → decision → signed document.
--   applications         one row per application, numbered like CPY-2026-0001
--   application_events   its timeline (who did what, when) — also mirrored in the audit log
--   payments             SANDBOX payments only: no real money ever moves in this prototype
--   issued_documents     signed documents (BhumiSathi document code "BD1.…", checked on /verify/doc)
--   notifications        the in-app bell
--
-- Security: the engine (lib/engines/applications.ts) is the only writer. Citizens read through
-- the restricted role app_user, so Row Level Security shows them only their own rows; officers
-- and admins see all. No foreign keys to land records: the demo reset rebuilds those, and dag
-- ids are stable (1000 × mouza + dag number).

create table application_counters (
  prefix text not null,
  year   int  not null,
  n      int  not null default 0,
  primary key (prefix, year)
);

create table applications (
  id                bigserial primary key,
  app_no            text not null unique,
  type              text not null check (type ~ '^[a-z_]{3,30}$'),
  applicant_user_id uuid not null references users(id) on delete cascade,
  dag_id            int,
  status            text not null check (status in
                      ('payment_due', 'in_review', 'completed', 'rejected', 'cancelled')),
  details           jsonb not null default '{}',
  fee_taka          int not null check (fee_taka >= 0),
  submitted_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  due_on            date,
  decided_by        uuid,
  decision_note     text,
  is_synthetic      boolean not null default true
);
create index on applications (applicant_user_id, id desc);
create index on applications (status, due_on);

create table application_events (
  id             bigserial primary key,
  application_id bigint not null references applications(id) on delete cascade,
  at             timestamptz not null default now(),
  actor_role     text not null check (actor_role in ('citizen', 'officer', 'admin', 'system')),
  action         text not null,  -- submitted | paid | approved | rejected | document_issued | cancelled
  note_bn        text not null,
  note_en        text not null
);
create index on application_events (application_id, id);

create table payments (
  id             bigserial primary key,
  application_id bigint not null references applications(id) on delete cascade,
  amount_taka    int not null check (amount_taka > 0),
  method         text not null check (method in ('bkash', 'nagad', 'rocket', 'card')),
  txn_ref        text not null unique check (txn_ref ~ '^SBX-[A-Z0-9]{10}$'),
  status         text not null check (status in ('paid')),
  paid_at        timestamptz not null default now(),
  is_sandbox     boolean not null default true check (is_sandbox)
);
create index on payments (application_id);

create table issued_documents (
  id             text primary key check (id ~ '^[a-f0-9]{16}$'),
  application_id bigint not null references applications(id) on delete cascade,
  kind           text not null,
  code           text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  issued_at      timestamptz not null default now(),
  revoked        boolean not null default false
);
create index on issued_documents (application_id);

create table notifications (
  id       bigserial primary key,
  user_id  uuid not null references users(id) on delete cascade,
  at       timestamptz not null default now(),
  title_bn text not null,
  title_en text not null,
  body_bn  text not null,
  body_en  text not null,
  link     text,
  read_at  timestamptz
);
create index on notifications (user_id, id desc);

-- ---------- Row Level Security ----------
alter table application_counters enable row level security; -- no grants: engine only
alter table applications      enable row level security;
alter table application_events enable row level security;
alter table payments          enable row level security;
alter table issued_documents  enable row level security;
alter table notifications     enable row level security;

grant select on applications, application_events, payments, issued_documents to app_user;
grant select, update (read_at) on notifications to app_user;

create policy app_read on applications for select to app_user
  using (applicant_user_id = app_user_id() or app_role() in ('officer', 'admin'));

-- The child tables follow their application (the subquery runs under the same policy).
create policy app_events_read on application_events for select to app_user
  using (application_id in (select id from applications));
create policy app_payments_read on payments for select to app_user
  using (application_id in (select id from applications));
create policy app_docs_read on issued_documents for select to app_user
  using (application_id in (select id from applications));

create policy notif_read on notifications for select to app_user
  using (user_id = app_user_id());
create policy notif_mark_read on notifications for update to app_user
  using (user_id = app_user_id()) with check (user_id = app_user_id());

-- Supabase: keep the public API roles away from the new tables too (see 0006).
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on application_counters, applications, application_events, payments, issued_documents, notifications from %I', r);
      execute format('revoke all on all sequences in schema public from %I', r);
    end if;
  end loop;
end $$;

-- Next number for a prefix and year, safe under concurrent submits.
create or replace function next_app_no(p_prefix text, p_year int) returns text
language sql as $$
  insert into application_counters (prefix, year, n) values (p_prefix, p_year, 1)
  on conflict (prefix, year) do update set n = application_counters.n + 1
  returning p_prefix || '-' || p_year || '-' || lpad(n::text, 4, '0');
$$;
revoke execute on function next_app_no(text, int) from public;
