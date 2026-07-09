-- ============================================================
-- BHAGYA — Duel of Fates schema
-- Run this whole file once in Supabase SQL Editor
-- (Project: fvpwmgdvuekwwhzckryg → SQL Editor → New Query → paste → Run)
-- ============================================================

create table if not exists duel_rooms (
  room_code   text primary key,
  status      text not null default 'lobby',   -- 'lobby' | 'in_progress' | 'completed'
  state       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- keep updated_at fresh automatically
create or replace function bhagya_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_duel_rooms_touch on duel_rooms;
create trigger trg_duel_rooms_touch
before update on duel_rooms
for each row execute function bhagya_touch_updated_at();

-- Row Level Security — open policy, since this is a private gift game for
-- you, Khushi, and friends, protected only by the 6-character room code.
-- (Note: this is NOT server-validated anti-cheat — see the delivery notes.)
alter table duel_rooms enable row level security;

drop policy if exists "public read" on duel_rooms;
create policy "public read" on duel_rooms for select using (true);

drop policy if exists "public insert" on duel_rooms;
create policy "public insert" on duel_rooms for insert with check (true);

drop policy if exists "public update" on duel_rooms;
create policy "public update" on duel_rooms for update using (true);

-- Enable Realtime on this table so both players see live updates
alter publication supabase_realtime add table duel_rooms;

-- Housekeeping: auto-delete rooms older than 24 hours so the table never grows unbounded
create or replace function bhagya_cleanup_old_rooms()
returns void as $$
begin
  delete from duel_rooms where created_at < now() - interval '24 hours';
end;
$$ language plpgsql;
