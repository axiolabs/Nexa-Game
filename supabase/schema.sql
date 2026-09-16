-- ============================================================
-- Guess The Scene - Esquema de Supabase
-- Pégalo en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- Configuración compartida (clave-valor)
create table if not exists public.config (
  clave text primary key,
  valor jsonb not null,
  actualizado_en timestamptz default now()
);

-- Series
create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null default 'Fotorealista',
  creado_en timestamptz default now()
);

-- Variantes de nombre de cada serie (los jugadores aciertan con cualquiera)
alter table public.series add column if not exists variantes text[] not null default '{}';

-- Imágenes de cada serie
create table if not exists public.imagenes (
  id uuid primary key default gen_random_uuid(),
  serie_id uuid not null references public.series(id) on delete cascade,
  ruta text not null,
  dificultad int not null default 3,
  posicion int not null default 1
);

-- Ranking global
create table if not exists public.rankings (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  modo text not null,
  puntos int not null,
  fecha date not null default current_date,
  creado_en timestamptz default now()
);

-- Anuncios compartidos
create table if not exists public.anuncios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  mensaje text,
  fecha date not null default current_date,
  creado_en timestamptz default now()
);

-- Bucket para las imágenes (si no existe, créalo en Storage)
insert into storage.buckets (id, name, public)
values ('imagenes', 'imagenes', true)
on conflict (id) do nothing;

-- ============================================================
-- Políticas de seguridad por fila (RLS)
-- Todo es público por diseño (juego colaborativo): cualquier
-- jugador puede leer y escribir series, config y anuncios.
-- ============================================================
alter table public.config enable row level security;
alter table public.series enable row level security;
alter table public.imagenes enable row level security;
alter table public.rankings enable row level security;
alter table public.anuncios enable row level security;

drop policy if exists config_public on public.config;
drop policy if exists config_public_write on public.config;
drop policy if exists series_public on public.series;
drop policy if exists series_public_write on public.series;
drop policy if exists imagenes_public on public.imagenes;
drop policy if exists imagenes_public_write on public.imagenes;
drop policy if exists rankings_public_read on public.rankings;
drop policy if exists rankings_public_insert on public.rankings;
drop policy if exists anuncios_public on public.anuncios;
drop policy if exists anuncios_public_write on public.anuncios;

create policy config_public on public.config
  for select using (true);

create policy config_public_write on public.config
  for all using (true) with check (true);

create policy series_public on public.series
  for select using (true);

create policy series_public_write on public.series
  for all using (true) with check (true);

create policy imagenes_public on public.imagenes
  for select using (true);

create policy imagenes_public_write on public.imagenes
  for all using (true) with check (true);

create policy rankings_public_read on public.rankings
  for select using (true);

create policy rankings_public_insert on public.rankings
  for insert with check (true);

create policy anuncios_public on public.anuncios
  for select using (true);

create policy anuncios_public_write on public.anuncios
  for all using (true) with check (true);

-- ============================================================
-- Insertar la configuración por defecto
-- ============================================================
insert into public.config (clave, valor) values
  ('partida', '{"rondasPorPartida":5,"segundosPasoBlur":2.5,"segundosContrarreloj":25,"vidasSupervivencia":3,"maxRanking":10}')
on conflict (clave) do nothing;