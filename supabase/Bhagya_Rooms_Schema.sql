-- ============================================================
-- BHAGYA — Unified rooms schema (Duel, Reading Circle, Party Prediction)
-- Run this whole file once in Supabase SQL Editor.
-- If you already ran the old Bhagya_Duel_Schema.sql, this is independent —
-- it creates a NEW table (bhagya_rooms) and does not touch the old one.
-- ============================================================

create table if not exists bhagya_rooms (
  room_code   text primary key,
  mode        text not null,                  -- 'duel' | 'circle' | 'party'
  status      text not null default 'lobby',  -- 'lobby' | 'in_progress' | 'completed'
  state       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function bhagya_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_bhagya_rooms_touch on bhagya_rooms;
create trigger trg_bhagya_rooms_touch
before update on bhagya_rooms
for each row execute function bhagya_touch_updated_at();

-- Open policy — private game protected by the 6-character room code only.
-- (Not server-validated anti-cheat — see delivery notes.)
alter table bhagya_rooms enable row level security;

drop policy if exists "public read" on bhagya_rooms;
create policy "public read" on bhagya_rooms for select using (true);

drop policy if exists "public insert" on bhagya_rooms;
create policy "public insert" on bhagya_rooms for insert with check (true);

drop policy if exists "public update" on bhagya_rooms;
create policy "public update" on bhagya_rooms for update using (true);

alter publication supabase_realtime add table bhagya_rooms;

create or replace function bhagya_cleanup_old_rooms()
returns void as $$
begin
  delete from bhagya_rooms where created_at < now() - interval '24 hours';
end;
$$ language plpgsql;
