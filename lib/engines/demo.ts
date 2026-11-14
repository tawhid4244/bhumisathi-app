import { getSql } from "../sql";

// Read-only helpers for the sub-registry demo screen: people to pick from and the live activity
// (mock SMS outbox, mutation cases, ledger events).

export interface Person {
  id: number;
  kind: "person" | "bank";
  name_bn: string;
  name_en: string;
}

export async function listPeople(): Promise<Person[]> {
  const sql = getSql();
  return sql<Person[]>`
    select id, kind, name_bn, name_en from owners
    where kind in ('person', 'bank') and not is_deceased
    order by case kind when 'person' then 0 else 1 end, id`;
}

export interface Activity {
  sms: { id: number; name_bn: string; phone: string; body_bn: string; at: string }[];
  mutations: {
    case_no: string;
    dag_no: number;
    mouza_bn: string;
    from_bn: string;
    to_bn: string;
    area_dec: number;
    status: string;
    deadline_on: string;
  }[];
  events: {
    id: number;
    event_type: string;
    status: string;
    dag_no: number;
    area_dec: number;
    ref: string | null;
    at: string;
  }[];
}

export async function recentActivity(): Promise<Activity> {
  const sql = getSql();
  const [sms, mutations, events] = await Promise.all([
    sql<Activity["sms"]>`
      select s.id::int, o.name_bn, s.phone, s.body_bn,
             to_char(s.created_at at time zone 'Asia/Dhaka', 'HH24:MI:SS') as at
      from sms_log s join owners o on o.id = s.owner_id
      order by s.id desc limit 20`,
    sql<Activity["mutations"]>`
      select m.case_no, d.dag_no, mz.name_bn as mouza_bn, f.name_bn as from_bn, t.name_bn as to_bn,
             m.area_dec::float8 as area_dec, m.status, to_char(m.deadline_on, 'YYYY-MM-DD') as deadline_on
      from mutation_cases m
      join dags d on d.id = m.dag_id join mouzas mz on mz.id = d.mouza_id
      join owners f on f.id = m.from_owner_id join owners t on t.id = m.to_owner_id
      order by m.id desc limit 10`,
    sql<Activity["events"]>`
      select e.id::int, e.event_type, e.status, d.dag_no, e.area_dec::float8 as area_dec, e.ref,
             to_char(e.created_at at time zone 'Asia/Dhaka', 'HH24:MI:SS') as at
      from ledger_events e join dags d on d.id = e.dag_id
      order by e.id desc limit 10`,
  ]);
  return { sms, mutations, events };
}
