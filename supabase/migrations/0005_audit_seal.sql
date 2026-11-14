-- Task 17: hash-chained audit log ("who checked my land") and links for BhumiSeal-lite.
--
-- Every view and every write through a tool appends one row. Each row stores the exact text that
-- was hashed (`body`) and hash = sha256(prev_hash || body). Changing, inserting or deleting any
-- row breaks the chain from that point, and lib/engines/audit.ts finds where.

-- A citizen account may stand for a land holder (demo: the owner of dag 141). No foreign key on
-- purpose: the demo reset truncates owners, and accounts must survive it. Owner ids are stable.
alter table users add column owner_id int;

create table audit_log (
  id        bigserial primary key,
  at        timestamptz not null,
  actor     uuid,          -- user id, null for a signed-out visitor
  role      text not null, -- public | citizen | officer | admin
  action    text not null, -- view_report, view_ledger, register_sale, seal_issue, ...
  dag_id    int,
  detail    jsonb not null default '{}',
  body      text not null, -- the canonical JSON that was hashed
  prev_hash text not null check (prev_hash ~ '^[0-9a-f]{64}$'),
  hash      text not null unique check (hash ~ '^[0-9a-f]{64}$')
);
create index on audit_log (dag_id, id desc);
alter table audit_log enable row level security;

-- Append one entry. One writer at a time (advisory lock), so the chain never forks.
-- The columns are filled FROM the hashed body, so they cannot disagree with it.
create or replace function append_audit(p_body text) returns table (id bigint, hash text)
language plpgsql as $$
declare
  v_prev text;
  v_hash text;
  v_json jsonb := p_body::jsonb;
  v_id   bigint;
begin
  perform pg_advisory_xact_lock(hashtext('audit_log'));
  select a.hash into v_prev from audit_log a order by a.id desc limit 1;
  v_prev := coalesce(v_prev, repeat('0', 64)); -- genesis
  v_hash := encode(sha256(convert_to(v_prev || p_body, 'UTF8')), 'hex');
  insert into audit_log (at, actor, role, action, dag_id, detail, body, prev_hash, hash)
  values ((v_json->>'at')::timestamptz, (v_json->>'actor')::uuid, v_json->>'role',
          v_json->>'action', (v_json->>'dag_id')::int, coalesce(v_json->'detail', '{}'),
          p_body, v_prev, v_hash)
  returning audit_log.id into v_id;
  return query select v_id, v_hash;
end $$;

-- ---------- who may read it (restricted role app_user, lib/auth/db.ts) ----------
create or replace function app_owner_id() returns int
language sql stable as $$ select nullif(current_setting('app.owner_id', true), '')::int $$;

grant select on bs_holdings to app_user;
grant select (id, at, role, action, dag_id, detail) on audit_log to app_user;

-- Officers and admins see everything. A citizen sees the entries for dags they hold.
-- Nobody (through app_user) sees who the other actors were: the actor column is not granted.
create policy audit_read on audit_log for select to app_user using (
  app_role() in ('officer', 'admin')
  or dag_id in (select h.dag_id from bs_holdings h where h.owner_id = app_owner_id())
);
