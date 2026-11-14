-- Task 19: ready for serverless hosting and Supabase.
--
-- 1. Uploaded images live in the database (serverless instances share no disk). The same RLS
--    policies as before protect the bytes. owner_user_id may be NULL for system uploads
--    (demo sample read by judge mode); only officers and trusted server code can read those.
alter table uploads add column data bytea;
alter table uploads alter column owner_user_id drop not null;
alter table uploads add constraint uploads_size check (size_bytes between 1 and 5242880);

-- 2. Supabase hardening. Supabase publishes the public schema through its REST/GraphQL API to the
--    roles `anon` and `authenticated` (anyone holding the public anon key). BhumiSathi never uses
--    that API: the browser only talks to our server. RLS already denies those roles every table
--    row, but VIEWS and FUNCTIONS are not covered by RLS, so take every privilege away from them,
--    now and for anything created later. (Skipped on plain Postgres, where the roles do not exist.)
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables in schema public from %I', r);
      execute format('revoke all on all sequences in schema public from %I', r);
      execute format('revoke all on all functions in schema public from %I', r);
      execute format('alter default privileges in schema public revoke all on tables from %I', r);
      execute format('alter default privileges in schema public revoke all on sequences from %I', r);
      execute format('alter default privileges in schema public revoke all on functions from %I', r);
    end if;
  end loop;
end $$;

-- Functions are executable by PUBLIC by default (which includes anon). Only our server role
-- (owner) and the restricted app_user (for the RLS helper functions) need them.
revoke execute on all functions in schema public from public;
alter default privileges in schema public revoke execute on functions from public;
grant execute on function app_user_id(), app_role(), app_owner_id() to app_user;

-- Demo reset (seed → after_seed) also removes system uploads; citizens' own uploads are kept
-- with their accounts.
create or replace function after_seed() returns void
language plpgsql as $$
begin
  perform setval('baina_no_seq', 21, false);
  perform setval('lien_no_seq', 4, false);
  perform setval('deed_no_seq', 5001, false);
  perform setval('mutation_no_seq', 1, false);
  update dags set ledger_version = 0;
  delete from uploads where owner_user_id is null;
end;
$$;
revoke execute on function after_seed() from public;
