-- Personal Finance Manager: isolated per-user salary settings and transaction ledger.
create table if not exists public.finance_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_salary numeric(14,2) not null default 0 check (monthly_salary >= 0),
  payday_day smallint not null default 25 check (payday_day between 1 and 31),
  salary_start_date date not null default current_date,
  currency text not null default 'IDR' check (currency = 'IDR'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  occurred_on date not null default current_date,
  direction text not null check (direction in ('expense','income')),
  amount numeric(14,2) not null check (amount > 0),
  note text not null,
  category text not null default 'Lainnya',
  source_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_transactions_user_date_idx
  on public.finance_transactions (user_id, occurred_on desc, created_at desc);

alter table public.finance_profiles enable row level security;
alter table public.finance_transactions enable row level security;

drop policy if exists "finance_profiles_select_own" on public.finance_profiles;
create policy "finance_profiles_select_own" on public.finance_profiles
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "finance_profiles_insert_own" on public.finance_profiles;
create policy "finance_profiles_insert_own" on public.finance_profiles
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "finance_profiles_update_own" on public.finance_profiles;
create policy "finance_profiles_update_own" on public.finance_profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "finance_transactions_select_own" on public.finance_transactions;
create policy "finance_transactions_select_own" on public.finance_transactions
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "finance_transactions_insert_own" on public.finance_transactions;
create policy "finance_transactions_insert_own" on public.finance_transactions
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "finance_transactions_update_own" on public.finance_transactions;
create policy "finance_transactions_update_own" on public.finance_transactions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "finance_transactions_delete_own" on public.finance_transactions;
create policy "finance_transactions_delete_own" on public.finance_transactions
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update on public.finance_profiles to authenticated;
grant select, insert, update, delete on public.finance_transactions to authenticated;
