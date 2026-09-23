-- Cola de tareas y estado del worker (la Mac). La web encola y observa; la Mac reclama y reporta.
-- Comunicación solo saliente desde la Mac: hace polling a Postgres, no necesita puertos abiertos.

-- ---------------------------------------------------------------------------
-- Workers: una fila por máquina que corre `places-ingest worker`. Heartbeat cada ~15 s.
-- ---------------------------------------------------------------------------

create table public.workers (
  id              text primary key,                  -- hostname (o WORKER_NAME)
  status          text not null default 'online' check (status in ('online','busy','offline')),
  current_job_id  uuid,                              -- FK abajo, cuando exista jobs
  hostname        text,
  version         text,                              -- git sha corto del repo
  meta            jsonb not null default '{}'::jsonb, -- modelo, ocr, ollama, carga, energía, uptime
  started_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index workers_last_seen_idx on public.workers (last_seen_at desc);

-- ---------------------------------------------------------------------------
-- Jobs: tareas que la web (o el propio worker) encola y la Mac ejecuta con progreso.
-- ---------------------------------------------------------------------------

create table public.jobs (
  id                  uuid primary key default gen_random_uuid(),
  kind                text not null check (kind in ('process','scrape','festivities','seed','doctor')),
  params              jsonb not null default '{}'::jsonb,
  status              text not null default 'queued' check (status in ('queued','running','done','failed','cancelled')),
  priority            integer not null default 0,     -- mayor = antes
  origin              text not null default 'admin' check (origin in ('admin','auto','cli')),
  requested_by        uuid,                           -- auth.users.id cuando viene del admin
  worker_id           text references public.workers (id) on delete set null,
  progress_done       integer not null default 0,
  progress_total      integer,
  progress_message    text,
  result              jsonb,
  error               text,
  log                 text[] not null default '{}',
  cancel_requested_at timestamptz,
  heartbeat_at        timestamptz,
  created_at          timestamptz not null default now(),
  started_at          timestamptz,
  finished_at         timestamptz,
  updated_at          timestamptz not null default now()
);
create index jobs_queue_idx on public.jobs (status, priority desc, created_at);
create index jobs_created_idx on public.jobs (created_at desc);
create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

alter table public.workers
  add constraint workers_current_job_fk foreign key (current_job_id) references public.jobs (id) on delete set null;

-- Qué tarea procesó cada flyer
alter table public.raw_ingestions add column job_id uuid references public.jobs (id) on delete set null;
create index raw_ingestions_job_idx on public.raw_ingestions (job_id);

-- ---------------------------------------------------------------------------
-- RLS: solo admin (la Mac usa service_role y salta RLS). Los grants vienen de los default privileges.
-- ---------------------------------------------------------------------------

alter table public.workers enable row level security;
alter table public.jobs    enable row level security;

create policy "admin all workers" on public.workers for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all jobs"    on public.jobs    for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.workers, public.jobs to authenticated;
grant all on public.workers, public.jobs to service_role;
