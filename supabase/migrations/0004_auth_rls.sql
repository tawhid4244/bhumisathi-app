-- Task 16: accounts, sessions, owned uploads, rate limits, and Row Level Security.
--
-- Security model
-- * The browser never talks to the database. All access goes through the server.
-- * Every table has RLS ENABLED (deny by default). The server's owner role is used only by the
--   engines (trusted code). Anything scoped to a user — uploads, and later reports — is read
--   through the restricted role `app_user` with the user's id set for the transaction, so even a
--   bug in a route cannot return another citizen's rows.
-- * `app_user` cannot see NID or phone columns, users, sessions or rate-limit rows at all.

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique check (email = lower(email) and email like '%@%'),
  name_bn       text not null,
  role          text not null check (role in ('citizen', 'officer', 'admin')),
  password_hash text not null,
  failed_logins int not null default 0,
  locked_until  timestamptz,
  created_at    timestamptz not null default now(),
  is_synthetic  boolean not null default true
);

-- Only a SHA-256 hash of the session token is stored: a stolen database row cannot log anyone in.
create table sessions (
  token_hash text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index on sessions (user_id);

-- Private deed uploads: the file is in private storage, this row says whose it is.
create table uploads (
  id            text primary key check (id ~ '^[a-f0-9]{24}$'),
  owner_user_id uuid not null references users(id) on delete cascade,
  mime          text not null,
  size_bytes    int not null,
  created_at    timestamptz not null default now()
);
create index on uploads (owner_user_id);

-- Fixed-window rate limits, shared by every server instance.
create table rate_limits (
  key          text not null,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (key, window_start)
);

-- ---------- restricted role ----------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin noinherit;
  end if;
end $$;
-- The server's login role may switch to app_user inside a transaction (SET LOCAL ROLE).
do $$
begin
  execute format('grant app_user to %I', current_user);
end $$;

grant usage on schema public to app_user;

-- Helpers read the per-transaction settings made by the server (lib/auth/db.ts).
create or replace function app_user_id() returns uuid
language sql stable as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;
create or replace function app_role() returns text
language sql stable as $$ select coalesce(nullif(current_setting('app.user_role', true), ''), 'anon') $$;

-- ---------- RLS on every table (deny by default) ----------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t.tablename);
  end loop;
end $$;

-- Public land records (synthetic): readable by app_user.
do $$
declare t text;
begin
  foreach t in array array['mouzas','dags','khatians','khatian_dags','ownership_shares','deeds',
                           'bainas','liens','court_cases','khas_flags','land_tax','map_polygons']
  loop
    execute format('grant select on %I to app_user', t);
    execute format('create policy records_read on %I for select to app_user using (true)', t);
  end loop;
end $$;

-- Owners: names yes, NID and phone NO (column privileges).
grant select (id, kind, name_bn, name_en, guardian_name_bn, is_deceased, died_on, is_synthetic)
  on owners to app_user;
create policy owners_read on owners for select to app_user using (true);

-- Uploads: a citizen sees only their own; officers and admins see all.
grant select, insert on uploads to app_user;
create policy uploads_own_read on uploads for select to app_user
  using (owner_user_id = app_user_id() or app_role() in ('officer', 'admin'));
create policy uploads_own_insert on uploads for insert to app_user
  with check (owner_user_id = app_user_id());

-- Ledger activity, SMS outbox and mutation cases: officers and admins only.
do $$
declare t text;
begin
  foreach t in array array['ledger_events','sms_log','mutation_cases'] loop
    execute format('grant select on %I to app_user', t);
    execute format(
      'create policy officers_read on %I for select to app_user using (app_role() in (''officer'',''admin''))', t);
  end loop;
end $$;
-- users, sessions, rate_limits, law_embeddings, _migrations: no grants, no policies → no access.
