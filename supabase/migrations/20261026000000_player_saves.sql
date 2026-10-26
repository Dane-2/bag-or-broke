-- Server copy of each group player's game save (Fix Log v1.2 #5 Session Recovery).
--
-- The device's localStorage save is the first copy; this table lets a player recover the same
-- game on another device or after clearing the browser. A save is only replaced by a newer one
-- (higher board progress, then higher ledger sequence), so a stale tab or a late retry can never
-- roll a player back. It is kept out of the realtime publication: other players only need the
-- small player_state row, not the whole ledger.

create table if not exists public.player_saves (
  room_id text not null,
  player_id text not null,
  ruleset_id text not null,
  progress integer not null default 0,
  seq integer not null default 0,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (room_id, player_id)
);

alter table public.player_saves enable row level security;
-- No policies: reads and writes go through the functions below.

create or replace function public.player_save_put(
  p_room text, p_player text, p_ruleset text, p_progress integer, p_seq integer, p_state jsonb
) returns boolean language plpgsql security definer set search_path = public as $$
declare cur public.player_saves;
begin
  if not exists (select 1 from public.player_state where room_id::text = p_room and player_id::text = p_player) then
    raise exception 'not a room member';
  end if;
  select * into cur from public.player_saves where room_id = p_room and player_id = p_player for update;
  if found and cur.ruleset_id = p_ruleset and (cur.progress, cur.seq) >= (p_progress, p_seq) then
    return false;                                          -- already have this or newer
  end if;
  insert into public.player_saves (room_id, player_id, ruleset_id, progress, seq, state, updated_at)
  values (p_room, p_player, p_ruleset, p_progress, p_seq, p_state, now())
  on conflict (room_id, player_id) do update set
    ruleset_id = excluded.ruleset_id, progress = excluded.progress, seq = excluded.seq,
    state = excluded.state, updated_at = now();
  return true;
end $$;

create or replace function public.player_save_get(p_room text, p_player text)
returns public.player_saves language sql stable security definer set search_path = public as $$
  select * from public.player_saves where room_id = p_room and player_id = p_player;
$$;

-- Leaving a room on purpose removes the save with the seat.
create or replace function public.player_saves_drop_left() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.player_saves where room_id = old.room_id::text and player_id = old.player_id::text;
  return old;
end $$;

do $$ begin
  if to_regclass('public.player_state') is not null then
    drop trigger if exists player_saves_drop_left on public.player_state;
    create trigger player_saves_drop_left after delete on public.player_state
      for each row execute function public.player_saves_drop_left();
  end if;
end $$;

grant execute on function public.player_save_put(text, text, text, integer, integer, jsonb) to anon, authenticated;
grant execute on function public.player_save_get(text, text) to anon, authenticated;
