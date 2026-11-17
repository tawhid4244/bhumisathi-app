-- Phase C: mutation (namjari), land development tax (dakhila) and complaints on the shared
-- application framework (0007). docs/LAND_SERVICES_PLAN.md, services #1, #2 and #9.

-- 1. Two more application states:
--    hearing            the office has called both parties to a hearing (mutation)
--    final_payment_due  approved; the second fee is due before the document is issued
--                       (mutation: DCR = record-correction fee + khatian copy)
alter table applications drop constraint applications_status_check;
alter table applications add constraint applications_status_check check (status in
  ('payment_due', 'in_review', 'hearing', 'final_payment_due', 'completed', 'rejected', 'cancelled'));

-- 2. Hearings (mutation): date and place, as on the notice sent to both parties.
create table hearings (
  id             bigserial primary key,
  application_id bigint not null references applications(id) on delete cascade,
  hearing_on     date not null,
  place_bn       text not null,
  place_en       text not null,
  created_at     timestamptz not null default now()
);
create index on hearings (application_id);
alter table hearings enable row level security;
grant select on hearings to app_user;
create policy hearings_read on hearings for select to app_user
  using (application_id in (select id from applications));

-- 3. A mutation is a ledger event too: it moves recorded shares and bumps the dag version, so a
--    sealed report from before turns "superseded" on /verify.
alter table ledger_events drop constraint ledger_events_event_type_check;
alter table ledger_events add constraint ledger_events_event_type_check
  check (event_type in ('baina', 'sale', 'lien', 'mutation'));

-- 4. Carry out an approved mutation for a registered sale deed, in one transaction with the dag
--    row locked (same discipline as register_event):
--      seller's share on the BS khatian goes down by the deed's area,
--      a new BS khatian is opened for the buyer with that area,
--      the deed no longer counts as "sold but not mutated",
--      the mutation case is closed, the dag version bumps, both parties get an SMS (mock).
create or replace function approve_mutation(p_deed_id int) returns jsonb
language plpgsql as $$
declare
  v_deed      deeds%rowtype;
  v_dag       dags%rowtype;
  v_case      mutation_cases%rowtype;
  v_share     ownership_shares%rowtype;
  v_khatian   int;
  v_khatian_no int;
  v_event_id  bigint;
  v_place     text;
begin
  select * into v_deed from deeds where id = p_deed_id;
  if not found then raise exception 'deed % not found', p_deed_id; end if;
  select * into v_dag from dags where id = v_deed.dag_id for update;
  select * into v_deed from deeds where id = p_deed_id; -- re-read after the lock
  if not v_deed.after_latest_khatian then
    return jsonb_build_object('ok', false, 'reason_en', 'This deed is already mutated.',
                              'reason_bn', 'এই দলিলের নামজারি আগেই হয়েছে।');
  end if;

  select s.* into v_share from ownership_shares s join khatians k on k.id = s.khatian_id
   where s.dag_id = v_deed.dag_id and s.owner_id = v_deed.seller_owner_id and k.survey = 'BS'
   order by s.share_dec desc limit 1;
  if not found or v_share.share_dec < v_deed.area_dec then
    return jsonb_build_object('ok', false, 'reason_en', 'The seller''s recorded share is smaller than the deed.',
                              'reason_bn', 'বিক্রেতার রেকর্ডের অংশ দলিলের চেয়ে কম।');
  end if;

  -- seller: less (row removed when nothing is left)
  if v_share.share_dec = v_deed.area_dec then
    delete from ownership_shares where id = v_share.id;
  else
    update ownership_shares set share_dec = share_dec - v_deed.area_dec where id = v_share.id;
  end if;

  -- buyer: a new BS khatian (mutation khatian) with the bought area
  select coalesce(max(id), 0) + 1 into v_khatian from khatians;
  select coalesce(max(khatian_no), 0) + 1 into v_khatian_no from khatians
   where mouza_id = v_dag.mouza_id and survey = 'BS';
  insert into khatians (id, mouza_id, survey, khatian_no, prepared_year)
  values (v_khatian, v_dag.mouza_id, 'BS', v_khatian_no, extract(year from bd_today())::int);
  insert into khatian_dags (khatian_id, dag_id, survey_dag_no, area_dec)
  values (v_khatian, v_dag.id, v_dag.dag_no, v_deed.area_dec);
  insert into ownership_shares (id, khatian_id, dag_id, owner_id, share_dec)
  values ((select coalesce(max(id), 0) + 1 from ownership_shares), v_khatian, v_dag.id,
          v_deed.buyer_owner_id, v_deed.area_dec);

  -- the buyer takes over the tax status of the land bought
  insert into land_tax (dag_id, owner_id, paid_through_fy, last_paid_on)
  select v_dag.id, v_deed.buyer_owner_id, t.paid_through_fy, t.last_paid_on
    from land_tax t where t.dag_id = v_dag.id and t.owner_id = v_deed.seller_owner_id
  on conflict (dag_id, owner_id) do nothing;

  update deeds set after_latest_khatian = false where id = v_deed.id;
  update mutation_cases set status = 'approved' where deed_id = v_deed.id and status = 'pending'
  returning * into v_case;
  update dags set ledger_version = ledger_version + 1 where id = v_dag.id;

  insert into ledger_events (event_type, status, dag_id, owner_id, counterparty_id, area_dec, ref, dag_version)
  values ('mutation', 'accepted', v_dag.id, v_deed.seller_owner_id, v_deed.buyer_owner_id,
          v_deed.area_dec, coalesce(v_case.case_no, v_deed.deed_no), v_dag.ledger_version + 1)
  returning id into v_event_id;

  select m.name_bn || ' দাগ ' || bn_digits(v_dag.dag_no::text) into v_place
    from mouzas m where m.id = v_dag.mouza_id;
  perform sms_to(v_deed.buyer_owner_id, 'ভূমিসাথী: ' || v_place || '-এ আপনার নামে '
    || bn_digits(trim_scale(v_deed.area_dec)::text) || ' শতকের নামজারি অনুমোদিত। নতুন বিএস খতিয়ান নং '
    || bn_digits(v_khatian_no::text) || '।', v_event_id);
  perform sms_to(v_deed.seller_owner_id, 'ভূমিসাথী: দলিল ' || bn_digits(v_deed.deed_no)
    || ' অনুযায়ী ' || v_place || '-এর নামজারি সম্পন্ন; আপনার রেকর্ডের অংশ কমেছে।', v_event_id);

  return jsonb_build_object('ok', true, 'khatian_no', v_khatian_no, 'case_no', v_case.case_no,
                            'version', v_dag.ledger_version + 1, 'event_id', v_event_id);
end $$;
revoke execute on function approve_mutation(int) from public;

-- 5. Demo reset (seed → after_seed) rebuilds the synthetic land records, so the service
--    applications that point at them (deeds, dags, tax rows) go too, with their timelines,
--    payments, documents, hearings and notifications. Accounts and numbering are kept.
create or replace function after_seed() returns void
language plpgsql as $$
begin
  perform setval('baina_no_seq', 21, false);
  perform setval('lien_no_seq', 4, false);
  perform setval('deed_no_seq', 5001, false);
  perform setval('mutation_no_seq', 1, false);
  update dags set ledger_version = 0;
  delete from uploads where owner_user_id is null;
  delete from applications;
  delete from notifications where link like '/my/applications/%';
end;
$$;
revoke execute on function after_seed() from public;

-- Supabase: keep the public API roles away from the new table (see 0006).
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on hearings from %I', r);
      execute format('revoke all on all sequences in schema public from %I', r);
    end if;
  end loop;
end $$;
