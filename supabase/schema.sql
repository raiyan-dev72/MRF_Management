create extension if not exists "pgcrypto";

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('Old Staff', 'New Staff')),
  daily_rate numeric not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.staff add column if not exists active boolean not null default true;

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  staff_id uuid references public.staff(id) on delete cascade,
  status text not null check (status in ('Present', 'Absent', 'Half Day')),
  daily_rate numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.waste_inward (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  site_name text not null,
  dc_number text not null,
  material_name text not null,
  quantity numeric not null,
  vehicle_number text not null,
  driver_name text not null,
  dc_copy text,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_movements (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  driver_name text not null,
  vehicle_number text not null,
  trip_number text not null,
  from_location text not null,
  to_location text not null,
  material_type text not null,
  purpose text not null check (purpose in ('Clearance', 'Sales', 'Material Delivery')),
  created_at timestamptz not null default now()
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  vehicle_number text unique not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  from_location text not null,
  to_location text not null,
  vendor_name text not null,
  material text not null,
  gross_quantity numeric not null,
  less_quantity numeric not null,
  final_quantity numeric not null,
  rate_per_kg numeric not null,
  gst numeric not null,
  total_amount numeric not null,
  final_amount numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bale_stock (
  id uuid primary key default gen_random_uuid(),
  material text unique not null,
  produced numeric not null default 0,
  sold numeric not null default 0,
  threshold numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.segregation (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  material text not null,
  bales_produced numeric not null,
  labour_count numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.safety_dispatch (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  site_name text not null,
  dc_number text not null,
  material_name text not null,
  quantity numeric not null,
  vehicle text not null,
  driver text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  category text not null,
  vendor text not null,
  site_name text not null,
  description text not null,
  amount numeric not null,
  bill_upload text,
  status text not null check (status in ('Pending', 'Submitted To Accounts', 'Approved', 'Paid')),
  created_at timestamptz not null default now()
);

create table if not exists public.petty_cash (
  id uuid primary key default gen_random_uuid(),
  voucher_number text not null,
  date date not null,
  category text not null,
  description text not null,
  amount numeric not null,
  bill_upload text,
  payment_mode text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.accenture_entries (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  site_name text not null,
  material text not null,
  quantity numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  name text not null,
  category text not null,
  year text not null,
  month text not null,
  source_module text not null,
  linked_record text not null,
  url text,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  key text primary key,
  value numeric not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value)
values ('petty_cash_opening_balance', 0)
on conflict (key) do nothing;

insert into storage.buckets (id, name, public)
values ('mrf-documents', 'mrf-documents', true)
on conflict (id) do nothing;

alter table public.staff enable row level security;
alter table public.attendance enable row level security;
alter table public.waste_inward enable row level security;
alter table public.vehicle_movements enable row level security;
alter table public.drivers enable row level security;
alter table public.vehicles enable row level security;
alter table public.sales enable row level security;
alter table public.bale_stock enable row level security;
alter table public.segregation enable row level security;
alter table public.safety_dispatch enable row level security;
alter table public.purchases enable row level security;
alter table public.petty_cash enable row level security;
alter table public.accenture_entries enable row level security;
alter table public.documents enable row level security;
alter table public.settings enable row level security;

drop policy if exists "authenticated staff crud" on public.staff;
drop policy if exists "authenticated attendance crud" on public.attendance;
drop policy if exists "authenticated waste inward crud" on public.waste_inward;
drop policy if exists "authenticated vehicle movement crud" on public.vehicle_movements;
drop policy if exists "authenticated drivers crud" on public.drivers;
drop policy if exists "authenticated vehicles crud" on public.vehicles;
drop policy if exists "authenticated sales crud" on public.sales;
drop policy if exists "authenticated bale stock crud" on public.bale_stock;
drop policy if exists "authenticated segregation crud" on public.segregation;
drop policy if exists "authenticated safety dispatch crud" on public.safety_dispatch;
drop policy if exists "authenticated purchases crud" on public.purchases;
drop policy if exists "authenticated petty cash crud" on public.petty_cash;
drop policy if exists "authenticated accenture crud" on public.accenture_entries;
drop policy if exists "authenticated documents crud" on public.documents;
drop policy if exists "authenticated settings crud" on public.settings;

create policy "authenticated staff crud" on public.staff
  for all to authenticated using (true) with check (true);
create policy "authenticated attendance crud" on public.attendance
  for all to authenticated using (true) with check (true);
create policy "authenticated waste inward crud" on public.waste_inward
  for all to authenticated using (true) with check (true);
create policy "authenticated vehicle movement crud" on public.vehicle_movements
  for all to authenticated using (true) with check (true);
create policy "authenticated drivers crud" on public.drivers
  for all to authenticated using (true) with check (true);
create policy "authenticated vehicles crud" on public.vehicles
  for all to authenticated using (true) with check (true);
create policy "authenticated sales crud" on public.sales
  for all to authenticated using (true) with check (true);
create policy "authenticated bale stock crud" on public.bale_stock
  for all to authenticated using (true) with check (true);
create policy "authenticated segregation crud" on public.segregation
  for all to authenticated using (true) with check (true);
create policy "authenticated safety dispatch crud" on public.safety_dispatch
  for all to authenticated using (true) with check (true);
create policy "authenticated purchases crud" on public.purchases
  for all to authenticated using (true) with check (true);
create policy "authenticated petty cash crud" on public.petty_cash
  for all to authenticated using (true) with check (true);
create policy "authenticated accenture crud" on public.accenture_entries
  for all to authenticated using (true) with check (true);
create policy "authenticated documents crud" on public.documents
  for all to authenticated using (true) with check (true);
create policy "authenticated settings crud" on public.settings
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated document upload" on storage.objects;
drop policy if exists "authenticated document read" on storage.objects;
drop policy if exists "authenticated document update" on storage.objects;
drop policy if exists "authenticated document delete" on storage.objects;

create policy "authenticated document upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'mrf-documents');

create policy "authenticated document read" on storage.objects
  for select to authenticated
  using (bucket_id = 'mrf-documents');

create policy "authenticated document update" on storage.objects
  for update to authenticated
  using (bucket_id = 'mrf-documents')
  with check (bucket_id = 'mrf-documents');

create policy "authenticated document delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'mrf-documents');
