create table if not exists public.lore_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  saved_spots jsonb not null default '[]'::jsonb,
  recent_planning_locations jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.lore_user_data enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'lore_user_data'
      and policyname = 'Users can read their own Lore data'
  ) then
    create policy "Users can read their own Lore data"
      on public.lore_user_data
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'lore_user_data'
      and policyname = 'Users can insert their own Lore data'
  ) then
    create policy "Users can insert their own Lore data"
      on public.lore_user_data
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'lore_user_data'
      and policyname = 'Users can update their own Lore data'
  ) then
    create policy "Users can update their own Lore data"
      on public.lore_user_data
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'lore_user_data'
      and policyname = 'Users can delete their own Lore data'
  ) then
    create policy "Users can delete their own Lore data"
      on public.lore_user_data
      for delete
      using (auth.uid() = user_id);
  end if;
end
$$;
