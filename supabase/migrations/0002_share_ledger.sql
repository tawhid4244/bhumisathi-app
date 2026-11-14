-- Share ledger (task 3): one share of a dag can be promised or sold only once.
--
--   sellable = recorded share − registered sales − active bainas − locked portions
--
-- Every write goes through register_event(), which locks the dag row (SELECT … FOR UPDATE),
-- recomputes the balance AFTER getting the lock, and then either records the event or refuses
-- it with a Bangla + English reason. Two offices trying the same share in the same second are
-- therefore serialised: the second one sees the first one's sale and is refused.

-- Bangladesh date (Asia/Dhaka), used for baina expiry and mutation deadlines.
create or replace function bd_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Dhaka')::date $$;

-- Western digits → Bangla digits for SMS text (১৪৫ instead of 145).
create or replace function bn_digits(t text) returns text
language sql immutable as $$ select translate(t, '0123456789', '০১২৩৪৫৬৭৮৯') $$;

-- Ledger version per dag: bumps on every accepted event. BhumiSeal uses it for "still current".
alter table dags add column ledger_version int not null default 0;

create sequence baina_no_seq start 21;
create sequence lien_no_seq start 4;
create sequence deed_no_seq start 5001;
create sequence mutation_no_seq start 1;

create table ledger_events (
  id              bigserial primary key,
  event_type      text not null check (event_type in ('baina', 'sale', 'lien')),
  status          text not null check (status in ('accepted', 'rejected')),
  dag_id          int not null references dags(id),
  owner_id        int not null references owners(id),      -- seller or mortgagor
  counterparty_id int not null references owners(id),      -- buyer or lender
  area_dec        numeric(10,2) not null,
  ref             text,                                    -- B-0021, 5001/2026, L-0004
  reason_bn       text,
  reason_en       text,
  dag_version     int,                                     -- version after an accepted event
  created_at      timestamptz not null default now(),
  is_synthetic    boolean not null default true
);
create index on ledger_events (dag_id, id);

-- Mock SMS outbox. Nothing is ever sent; the demo shows this table.
create table sms_log (
  id           bigserial primary key,
  owner_id     int references owners(id),
  phone        text,
  body_bn      text not null,
  ledger_event_id bigint references ledger_events(id),
  created_at   timestamptz not null default now(),
  is_synthetic boolean not null default true
);

-- Mutation (namjari) case opened automatically when a sale is registered (28-day service limit).
create table mutation_cases (
  id            bigserial primary key,
  case_no       text not null unique,
  dag_id        int not null references dags(id),
  deed_id       int not null references deeds(id),
  from_owner_id int not null references owners(id),
  to_owner_id   int not null references owners(id),
  area_dec      numeric(10,2) not null,
  status        text not null check (status in ('pending', 'approved', 'rejected')),
  filed_on      date not null,
  deadline_on   date not null,
  is_synthetic  boolean not null default true
);

-- Holders on the latest (BS) khatian of each dag.
create view bs_holdings as
select s.dag_id, s.owner_id, s.share_dec as recorded_dec
from ownership_shares s
join khatians k on k.id = s.khatian_id and k.survey = 'BS';

-- Whole-dag locks: khas land, or a pending court case (lis pendens, Transfer of Property Act 1882 s.52).
create view dag_locks as
select d.id as dag_id,
       exists (select 1 from khas_flags kf where kf.dag_id = d.id) as is_khas,
       (select string_agg(c.case_no, ', ' order by c.case_no)
          from court_cases c where c.dag_id = d.id and c.status = 'pending') as pending_cases
from dags d;

-- The balance of every holder of every dag.
create view share_balances as
select h.dag_id,
       h.owner_id,
       h.recorded_dec,
       coalesce((select sum(dd.area_dec) from deeds dd
                  where dd.dag_id = h.dag_id and dd.seller_owner_id = h.owner_id
                    and dd.after_latest_khatian), 0) as sold_dec,
       coalesce((select sum(b.area_dec) from bainas b
                  where b.dag_id = h.dag_id and b.seller_owner_id = h.owner_id
                    and b.status = 'active' and b.expires_on >= bd_today()), 0) as reserved_dec,
       coalesce((select sum(l.area_dec) from liens l
                  where l.dag_id = h.dag_id and l.owner_id = h.owner_id
                    and l.status = 'active'), 0) as locked_dec,
       o.is_deceased,
       dl.is_khas,
       dl.pending_cases
from bs_holdings h
join owners o on o.id = h.owner_id
join dag_locks dl on dl.dag_id = h.dag_id;

-- sellable as a separate view so the formula sits in one readable place.
create view share_sellable as
select b.*,
       case
         when b.is_khas or b.pending_cases is not null or b.is_deceased then 0
         else greatest(b.recorded_dec - b.sold_dec - b.reserved_dec - b.locked_dec, 0)
       end as sellable_dec
from share_balances b;

-- Write a mock SMS to one owner (skips owners without a phone, e.g. banks).
create or replace function sms_to(p_owner int, p_body text, p_event bigint) returns void
language sql as $$
  insert into sms_log (owner_id, phone, body_bn, ledger_event_id)
  select o.id, o.phone, p_body, p_event from owners o where o.id = p_owner and o.phone is not null
$$;

create or replace function register_event(
  p_type         text,      -- 'baina' | 'sale' | 'lien'
  p_dag_id       int,
  p_owner_id     int,       -- seller / mortgagor
  p_counterparty int,       -- buyer / lender
  p_area         numeric,
  p_days         int  default 90,   -- baina validity
  p_ref          text default null  -- loan reference for a lien
) returns jsonb
language plpgsql
as $$
declare
  v_dag        dags%rowtype;
  v_bal        share_sellable%rowtype;
  v_mouza      text;
  v_own_baina  bainas%rowtype;
  v_available  numeric;
  v_ref        text;
  v_reason_bn  text;
  v_reason_en  text;
  v_event_id   bigint;
  v_deed_id    int;
  v_case_no    text;
  v_holds_bn   text;
  v_holds_en   text;
  v_place      text;
  r            record;
begin
  if p_type not in ('baina', 'sale', 'lien') then
    raise exception 'unknown event type %', p_type;
  end if;

  -- 1. Lock the dag. Every other register_event on this dag waits here until we commit.
  select * into v_dag from dags where id = p_dag_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason_bn', 'দাগটি পাওয়া যায়নি।', 'reason_en', 'Dag not found.');
  end if;
  -- Also lock the share rows of this dag (the recorded shares the balance is built on).
  perform 1 from ownership_shares where dag_id = p_dag_id for update;

  select m.name_bn into v_mouza from mouzas m where m.id = v_dag.mouza_id;
  v_place := v_mouza || ' দাগ ' || bn_digits(v_dag.dag_no::text);

  -- 2. Balance computed AFTER the lock, so it includes anything committed while we waited.
  select * into v_bal from share_sellable where dag_id = p_dag_id and owner_id = p_owner_id;

  -- 3. Checks, in the order a sub-registrar would ask them.
  if p_area is null or p_area <= 0 then
    v_reason_bn := 'জমির পরিমাণ শূন্যের বেশি হতে হবে।';
    v_reason_en := 'Area must be greater than zero.';
  elsif p_counterparty = p_owner_id or not exists (select 1 from owners where id = p_counterparty) then
    v_reason_bn := 'ক্রেতা/পক্ষ সঠিক নয়।';
    v_reason_en := 'The other party is not valid.';
  elsif (select is_khas from dag_locks where dag_id = p_dag_id) then
    v_reason_bn := 'খাস জমি: সরকারি জমি বিক্রি, বায়না বা বন্ধক রাখা যায় না।';
    v_reason_en := 'Khas land: government land cannot be sold, promised or mortgaged.';
  elsif v_bal.owner_id is null then
    v_reason_bn := 'বিক্রেতার নাম এই দাগের সর্বশেষ (বিএস) খতিয়ানে নেই।';
    v_reason_en := 'The seller is not on the latest (BS) khatian for this dag.';
  elsif v_bal.is_deceased then
    v_reason_bn := 'রেকর্ডীয় মালিক মৃত: আগে ওয়ারিশ সনদ, বণ্টননামা ও নামজারি করতে হবে।';
    v_reason_en := 'The recorded owner has died: heirs must complete succession, partition and mutation first.';
  elsif v_bal.pending_cases is not null then
    v_reason_bn := 'এই দাগে দেওয়ানি মামলা চলমান (মামলা নং ' || bn_digits(v_bal.pending_cases)
                   || ')। মামলা চলাকালে হস্তান্তর করা যায় না (সম্পত্তি হস্তান্তর আইন ১৮৮২, ধারা ৫২)।';
    v_reason_en := 'A civil case is pending on this dag (case ' || v_bal.pending_cases
                   || '). Transfer is barred while it is pending (Transfer of Property Act 1882, s.52).';
  end if;

  -- 4. Balance check. For a sale, the buyer's OWN active baina is available to that buyer.
  if v_reason_bn is null then
    select * into v_own_baina from bainas
     where dag_id = p_dag_id and seller_owner_id = p_owner_id and buyer_owner_id = p_counterparty
       and status = 'active' and expires_on >= bd_today()
     order by id limit 1;
    v_available := v_bal.sellable_dec
                   + case when p_type = 'sale' and v_own_baina.id is not null then v_own_baina.area_dec else 0 end;

    if p_area > v_available then
      -- Explain exactly what is holding the rest of the share.
      select string_agg(x.bn, '; '), string_agg(x.en, '; ') into v_holds_bn, v_holds_en from (
        select bn_digits(trim_scale(b.area_dec)::text) || ' শতক বায়না ' || b.id || ' দ্বারা সংরক্ষিত' as bn,
               trim_scale(b.area_dec) || ' reserved by baina ' || b.id as en, 1 as o, b.id as k
          from bainas b where b.dag_id = p_dag_id and b.seller_owner_id = p_owner_id
           and b.status = 'active' and b.expires_on >= bd_today()
           and not (p_type = 'sale' and b.buyer_owner_id = p_counterparty)
        union all
        select bn_digits(trim_scale(l.area_dec)::text) || ' শতক ' || lo.name_bn || '-এর কাছে বন্ধক (' || l.id || ')',
               trim_scale(l.area_dec) || ' mortgaged to ' || lo.name_en || ' (' || l.id || ')', 2, l.id
          from liens l join owners lo on lo.id = l.lender_owner_id
         where l.dag_id = p_dag_id and l.owner_id = p_owner_id and l.status = 'active'
        union all
        select bn_digits(trim_scale(d.area_dec)::text) || ' শতক আগেই বিক্রি (দলিল ' || d.deed_no || ')',
               trim_scale(d.area_dec) || ' already sold (deed ' || d.deed_no || ')', 3, d.deed_no
          from deeds d where d.dag_id = p_dag_id and d.seller_owner_id = p_owner_id and d.after_latest_khatian
        order by o, k
      ) x;
      v_reason_bn := 'অনুরোধ করা জমি বিক্রয়যোগ্য পরিমাণের চেয়ে বেশি: বিক্রয়যোগ্য মাত্র '
                     || bn_digits(trim_scale(v_available)::text) || ' শতক'
                     || coalesce('; ' || v_holds_bn, '') || '।';
      v_reason_en := 'Requested area exceeds the sellable balance: only '
                     || trim_scale(v_available) || ' decimals sellable'
                     || coalesce('; ' || v_holds_en, '') || '.';
      if p_type = 'lien' then
        v_reason_bn := replace(v_reason_bn, 'বিক্রয়যোগ্য পরিমাণের', 'বন্ধকযোগ্য পরিমাণের');
      end if;
    end if;
  end if;

  -- 5a. Refused: record the attempt (no version bump) and warn everyone already holding a claim.
  if v_reason_bn is not null then
    insert into ledger_events (event_type, status, dag_id, owner_id, counterparty_id, area_dec,
                               reason_bn, reason_en)
    values (p_type, 'rejected', p_dag_id, p_owner_id,
            case when exists (select 1 from owners where id = p_counterparty) then p_counterparty else p_owner_id end,
            coalesce(p_area, 0), v_reason_bn, v_reason_en)
    returning id into v_event_id;

    if p_type = 'sale' and v_bal.owner_id is not null then
      for r in select b.id, b.buyer_owner_id from bainas b
                where b.dag_id = p_dag_id and b.seller_owner_id = p_owner_id and b.status = 'active'
                  and b.expires_on >= bd_today() and b.buyer_owner_id <> p_counterparty loop
        perform sms_to(r.buyer_owner_id,
          'ভূমিসাথী সতর্কতা: আপনার বায়না ' || r.id || ' থাকা ' || v_place
          || '-এর জমি অন্য ক্রেতার কাছে বিক্রির চেষ্টা সাব-রেজিস্ট্রি অফিসে আটকানো হয়েছে।', v_event_id);
      end loop;
    end if;

    return jsonb_build_object(
      'ok', false, 'event_id', v_event_id, 'reason_bn', v_reason_bn, 'reason_en', v_reason_en,
      'version', v_dag.ledger_version);
  end if;

  -- 5b. Accepted: write the record, bump the version, log the event, notify.
  update dags set ledger_version = ledger_version + 1 where id = p_dag_id;

  if p_type = 'baina' then
    v_ref := 'B-' || lpad(nextval('baina_no_seq')::text, 4, '0');
    insert into bainas (id, dag_id, seller_owner_id, buyer_owner_id, area_dec, registered_on, expires_on, status)
    values (v_ref, p_dag_id, p_owner_id, p_counterparty, p_area, bd_today(),
            bd_today() + greatest(coalesce(p_days, 90), 1), 'active');
  elsif p_type = 'lien' then
    v_ref := 'L-' || lpad(nextval('lien_no_seq')::text, 4, '0');
    insert into liens (id, dag_id, owner_id, lender_owner_id, area_dec, loan_ref, registered_on, status)
    values (v_ref, p_dag_id, p_owner_id, p_counterparty, p_area,
            coalesce(p_ref, 'LOAN-' || v_ref), bd_today(), 'active');
  else
    v_ref := nextval('deed_no_seq')::text || '/' || extract(year from bd_today())::text;
    insert into deeds (id, deed_no, deed_type, registered_on, sub_registry_bn, seller_owner_id,
                       buyer_owner_id, dag_id, khatian_id, area_dec, after_latest_khatian)
    values ((select coalesce(max(id), 0) + 1 from deeds), v_ref, 'sale', bd_today(),
            'ডেমো সাব-রেজিস্ট্রি অফিস (কাল্পনিক)', p_owner_id, p_counterparty, p_dag_id,
            (select s.khatian_id from ownership_shares s join khatians k on k.id = s.khatian_id
              where s.dag_id = p_dag_id and s.owner_id = p_owner_id and k.survey = 'BS' limit 1),
            p_area, true)
    returning id into v_deed_id;
    -- The buyer's own baina is now fulfilled.
    if v_own_baina.id is not null then
      update bainas set status = 'completed' where id = v_own_baina.id;
    end if;
  end if;

  insert into ledger_events (event_type, status, dag_id, owner_id, counterparty_id, area_dec, ref, dag_version)
  values (p_type, 'accepted', p_dag_id, p_owner_id, p_counterparty, p_area, v_ref, v_dag.ledger_version + 1)
  returning id into v_event_id;

  if p_type = 'baina' then
    perform sms_to(p_owner_id, 'ভূমিসাথী: ' || v_place || '-এ ' || bn_digits(trim_scale(p_area)::text)
      || ' শতক জমির বায়না ' || v_ref || ' নিবন্ধিত হয়েছে। মেয়াদ: '
      || bn_digits(to_char(bd_today() + greatest(coalesce(p_days, 90), 1), 'DD-MM-YYYY')) || ' পর্যন্ত।', v_event_id);
    perform sms_to(p_counterparty, 'ভূমিসাথী: আপনার বায়না ' || v_ref || ' (' || v_place || ', '
      || bn_digits(trim_scale(p_area)::text) || ' শতক) নিবন্ধিত। এই অংশ অন্য কারো কাছে বিক্রি করা যাবে না।', v_event_id);
  elsif p_type = 'lien' then
    perform sms_to(p_owner_id, 'ভূমিসাথী: ' || v_place || '-এর ' || bn_digits(trim_scale(p_area)::text)
      || ' শতক জমিতে বন্ধক ' || v_ref || ' নিবন্ধিত হয়েছে।', v_event_id);
  else
    v_case_no := 'M-' || extract(year from bd_today())::text || '-' || lpad(nextval('mutation_no_seq')::text, 4, '0');
    insert into mutation_cases (case_no, dag_id, deed_id, from_owner_id, to_owner_id, area_dec, status, filed_on, deadline_on)
    values (v_case_no, p_dag_id, v_deed_id, p_owner_id, p_counterparty, p_area, 'pending', bd_today(), bd_today() + 28);
    perform sms_to(p_owner_id, 'ভূমিসাথী: ' || v_place || '-এর ' || bn_digits(trim_scale(p_area)::text)
      || ' শতক জমির বিক্রয় দলিল ' || bn_digits(v_ref) || ' নিবন্ধিত হয়েছে।', v_event_id);
    perform sms_to(p_counterparty, 'ভূমিসাথী: দলিল ' || bn_digits(v_ref) || ' নিবন্ধিত। নামজারি মামলা '
      || v_case_no || ' খোলা হয়েছে; ২৮ দিনের মধ্যে নিষ্পত্তির কথা।', v_event_id);
  end if;

  return jsonb_build_object(
    'ok', true, 'event_id', v_event_id, 'ref', v_ref, 'mutation_case', v_case_no,
    'version', v_dag.ledger_version + 1);
end;
$$;

-- Called by the seed after loading data: restart numbering so the demo always shows B-0021 first.
create or replace function after_seed() returns void
language plpgsql as $$
begin
  perform setval('baina_no_seq', 21, false);
  perform setval('lien_no_seq', 4, false);
  perform setval('deed_no_seq', 5001, false);
  perform setval('mutation_no_seq', 1, false);
  update dags set ledger_version = 0;
end;
$$;
