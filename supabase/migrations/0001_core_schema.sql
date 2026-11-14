-- BhumiSathi core land-record schema (task 2).
-- Every table carries is_synthetic: this prototype holds fictional data only.
-- CHECK constraints make it impossible to store a real-looking NID or phone number.

-- pgvector powers retrieval (RAG) over law texts in task 7. Supabase cloud has it;
-- the local embedded server does not, so we enable it only where it exists.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'vector') then
    create extension if not exists vector;
  else
    raise notice 'pgvector is not available on this server; RAG will use the in-app fallback.';
  end if;
end $$;

create table mouzas (
  id                    smallint primary key,
  code                  text not null unique,
  name_bn               text not null,
  name_en               text not null,
  jl_no                 int  not null unique,
  district_bn           text not null,
  district_en           text not null,
  upazila_bn            text not null,
  upazila_en            text not null,
  map_sheet             int,
  map_scale_in_per_mile int,
  has_map               boolean not null default false,
  is_synthetic          boolean not null default true
);

-- A dag (plot) as numbered in the latest survey (BS). Its number may differ in older surveys.
create table dags (
  id                int primary key,
  mouza_id          smallint not null references mouzas(id),
  dag_no            int not null,
  land_class_bn     text not null,
  land_class_en     text not null,
  recorded_area_dec numeric(10,2) not null check (recorded_area_dec > 0),
  is_synthetic      boolean not null default true,
  unique (mouza_id, dag_no)
);

create table owners (
  id               int primary key,
  kind             text not null check (kind in ('person', 'bank', 'government')),
  name_bn          text not null,
  name_en          text not null,
  guardian_name_bn text,          -- father's or husband's name, as written on a khatian
  nid              text unique check (nid ~ '^SYN-[0-9]{4}-[0-9]{4}$'),
  phone            text check (phone ~ '^\+880-SYN-[0-9]{4}$'),
  is_deceased      boolean not null default false,
  died_on          date,
  is_synthetic     boolean not null default true
);

-- Record of rights (khatian / porcha) from each survey: CS, SA, RS, BS.
create table khatians (
  id            int primary key,
  mouza_id      smallint not null references mouzas(id),
  survey        text not null check (survey in ('CS', 'SA', 'RS', 'BS')),
  khatian_no    int not null,
  prepared_year int not null,
  is_synthetic  boolean not null default true,
  unique (mouza_id, survey, khatian_no)
);

-- Which dags a khatian lists, with the dag number and area used in THAT survey.
create table khatian_dags (
  khatian_id    int not null references khatians(id),
  dag_id        int not null references dags(id),
  survey_dag_no int not null,
  area_dec      numeric(10,2) not null check (area_dec > 0),
  is_synthetic  boolean not null default true,
  primary key (khatian_id, dag_id)
);

-- Who holds how many decimals of a dag on a khatian.
create table ownership_shares (
  id           int primary key,
  khatian_id   int not null references khatians(id),
  dag_id       int not null references dags(id),
  owner_id     int not null references owners(id),
  share_dec    numeric(10,2) not null check (share_dec > 0),
  is_synthetic boolean not null default true,
  unique (khatian_id, dag_id, owner_id)
);

-- Registered deeds. after_latest_khatian = registered after the latest (BS) khatian was
-- prepared, so a sale still reduces the seller's recorded share until mutation is done.
create table deeds (
  id                   int primary key,
  deed_no              text not null unique,
  deed_type            text not null check (deed_type in ('sale', 'heba', 'exchange', 'partition')),
  registered_on        date not null,
  sub_registry_bn      text not null,
  seller_owner_id      int not null references owners(id),
  buyer_owner_id       int not null references owners(id),
  dag_id               int not null references dags(id),
  khatian_id           int references khatians(id),
  area_dec             numeric(10,2) not null check (area_dec > 0),
  price_tk             bigint check (price_tk >= 0),
  after_latest_khatian boolean not null default false,
  is_synthetic         boolean not null default true
);

-- Registered baina (sale agreement). While active it reserves part of the seller's share.
create table bainas (
  id              text primary key,
  dag_id          int not null references dags(id),
  seller_owner_id int not null references owners(id),
  buyer_owner_id  int not null references owners(id),
  area_dec        numeric(10,2) not null check (area_dec > 0),
  amount_tk       bigint check (amount_tk >= 0),
  registered_on   date not null,
  expires_on      date not null check (expires_on > registered_on),
  status          text not null check (status in ('active', 'completed', 'cancelled', 'expired')),
  is_synthetic    boolean not null default true
);

-- Mortgage (lien). While active it locks that portion of the owner's share.
create table liens (
  id              text primary key,
  dag_id          int not null references dags(id),
  owner_id        int not null references owners(id),
  lender_owner_id int not null references owners(id),
  area_dec        numeric(10,2) not null check (area_dec > 0),
  loan_ref        text not null,
  registered_on   date not null,
  status          text not null check (status in ('active', 'released')),
  is_synthetic    boolean not null default true
);

create table court_cases (
  id           int primary key,
  case_no      text not null,
  court_bn     text not null,
  court_en     text not null,
  case_type    text not null check (case_type in ('civil', 'criminal', 'other')),
  dag_id       int not null references dags(id),
  plaintiff_bn text not null,
  defendant_bn text not null,
  filed_on     date not null,
  status       text not null check (status in ('pending', 'disposed')),
  summary_bn   text not null,
  summary_en   text not null,
  is_synthetic boolean not null default true
);

-- Government (khas) land: cannot be bought or sold by private parties.
create table khas_flags (
  dag_id       int primary key references dags(id),
  category_bn  text not null,
  category_en  text not null,
  source       text not null,
  is_synthetic boolean not null default true
);

-- Land development tax status per holder of a dag. Fiscal year as 'YYYY-YY' (July to June).
create table land_tax (
  dag_id           int not null references dags(id),
  owner_id         int not null references owners(id),
  paid_through_fy  text not null check (paid_through_fy ~ '^[0-9]{4}-[0-9]{2}$'),
  last_paid_on     date,
  is_synthetic     boolean not null default true,
  primary key (dag_id, owner_id)
);

-- Dag outlines on the mouza map, in map units (units_per_inch map units = 1 inch of paper).
create table map_polygons (
  dag_id         int primary key references dags(id),
  map_sheet      int not null,
  units_per_inch int not null check (units_per_inch > 0),
  points         jsonb not null,
  is_synthetic   boolean not null default true
);

create index on khatian_dags (dag_id);
create index on ownership_shares (dag_id);
create index on deeds (dag_id);
create index on bainas (dag_id);
create index on liens (dag_id);
create index on court_cases (dag_id);
