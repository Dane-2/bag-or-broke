-- Shared sports-complex share market (shared_ownership.json, bobupdates Packet 1).
--
-- The founder's ledger is the authority for company value (the founder's board progress is the
-- only clock). This table is the shared cap table and listing book. Every write goes through a
-- SECURITY DEFINER function that locks the company row, so two buyers can never take the same
-- units and a stale quote (old revision) is refused. Each player's own cash, tax and loan
-- changes are applied in their ledger exactly once, keyed by the transfer id.

create table if not exists public.ventures (
  id text primary key,                 -- founder's asset id
  room_id text not null,
  founder_id text not null,
  founder_name text,
  title text not null,
  value_cents bigint not null check (value_cents >= 0),
  rate_bps integer not null,
  founder_progress integer not null default 0,
  revision integer not null default 0,
  owners jsonb not null,               -- { player_id: units } summing to 10000
  listings jsonb not null default '{}'::jsonb,
  frozen jsonb not null default '{}'::jsonb,
  stopped boolean not null default false,
  failed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.venture_transfers (
  id text primary key,                 -- client operation id; retries return the same row
  venture_id text not null references public.ventures (id) on delete cascade,
  room_id text not null,
  seller_id text not null,
  buyer_id text not null,
  buyer_name text,
  units integer not null check (units > 0),
  gross_cents bigint not null,
  company_value_cents bigint not null,
  revision integer not null,
  seller_applied boolean not null default false,
  buyer_applied boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists ventures_room_idx on public.ventures (room_id);
create index if not exists venture_transfers_room_idx on public.venture_transfers (room_id);

alter table public.ventures enable row level security;
alter table public.venture_transfers enable row level security;

-- Anyone in the app can read room ventures (needed for quotes); nobody writes directly.
drop policy if exists ventures_read on public.ventures;
create policy ventures_read on public.ventures for select using (true);
drop policy if exists venture_transfers_read on public.venture_transfers;
create policy venture_transfers_read on public.venture_transfers for select using (true);

create or replace function public.venture_is_member(p_room text, p_player text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.player_state where room_id::text = p_room and player_id::text = p_player);
$$;

-- Founder publishes the company's current value and clock (creates the row the first time).
create or replace function public.venture_publish(
  p_id text, p_room text, p_founder text, p_founder_name text, p_title text,
  p_value bigint, p_rate integer, p_progress integer, p_failed boolean, p_stopped boolean
) returns public.ventures language plpgsql security definer set search_path = public as $$
declare v public.ventures;
begin
  if not public.venture_is_member(p_room, p_founder) then raise exception 'not a room member'; end if;
  select * into v from public.ventures where id = p_id for update;
  if not found then
    insert into public.ventures (id, room_id, founder_id, founder_name, title, value_cents, rate_bps, founder_progress, owners, failed, stopped)
    values (p_id, p_room, p_founder, p_founder_name, p_title, p_value, p_rate, p_progress,
            jsonb_build_object(p_founder, 10000), p_failed, p_stopped)
    returning * into v;
    return v;
  end if;
  if v.founder_id <> p_founder then raise exception 'only the founder publishes'; end if;
  if v.stopped then return v; end if;                     -- frozen after founder finish
  if p_progress < v.founder_progress then raise exception 'clock cannot reverse'; end if;
  update public.ventures set
    value_cents = p_value, rate_bps = p_rate, founder_progress = p_progress,
    failed = p_failed, stopped = p_stopped,
    listings = case when p_failed or p_stopped then '{}'::jsonb else listings end,
    revision = revision + 1, updated_at = now()
  where id = p_id returning * into v;
  return v;
end $$;

-- A current holder offers units of the whole company (multiples of 100; 0 withdraws).
create or replace function public.venture_list(p_id text, p_seller text, p_units integer)
returns public.ventures language plpgsql security definer set search_path = public as $$
declare v public.ventures; owned integer;
begin
  select * into v from public.ventures where id = p_id for update;
  if not found then raise exception 'unknown company'; end if;
  if not public.venture_is_member(v.room_id, p_seller) then raise exception 'not a room member'; end if;
  if v.stopped or v.failed or v.frozen ? p_seller then raise exception 'closed offering'; end if;
  owned := coalesce((v.owners ->> p_seller)::integer, 0);
  if p_units < 0 or p_units % 100 <> 0 or p_units > owned then raise exception 'invalid units'; end if;
  update public.ventures set
    listings = case when p_units = 0 then listings - p_seller else listings || jsonb_build_object(p_seller, p_units) end,
    revision = revision + 1, updated_at = now()
  where id = p_id returning * into v;
  return v;
end $$;

-- Atomic purchase of listed units at the quoted revision. Same transfer id -> same row.
create or replace function public.venture_buy(
  p_id text, p_transfer text, p_buyer text, p_buyer_name text, p_seller text, p_units integer, p_revision integer
) returns public.venture_transfers language plpgsql security definer set search_path = public as $$
declare v public.ventures; t public.venture_transfers; listed integer; owned integer; gross bigint;
begin
  select * into t from public.venture_transfers where id = p_transfer;
  if found then
    if t.buyer_id <> p_buyer or t.seller_id <> p_seller or t.units <> p_units or t.venture_id <> p_id then
      raise exception 'transfer id reused for a different purchase';
    end if;
    return t;
  end if;
  select * into v from public.ventures where id = p_id for update;
  if not found then raise exception 'unknown company'; end if;
  if not public.venture_is_member(v.room_id, p_buyer) then raise exception 'not a room member'; end if;
  if v.stopped or v.failed then raise exception 'company closed'; end if;
  if p_buyer = p_seller or v.frozen ? p_buyer or v.frozen ? p_seller then raise exception 'ineligible transfer'; end if;
  if v.revision <> p_revision then raise exception 'stale quote'; end if;
  if p_units < 100 or p_units % 100 <> 0 then raise exception 'invalid units'; end if;
  listed := coalesce((v.listings ->> p_seller)::integer, 0);
  owned := coalesce((v.owners ->> p_seller)::integer, 0);
  if p_units > least(listed, owned) then raise exception 'not offered'; end if;
  gross := round(v.value_cents::numeric * p_units / 10000);
  update public.ventures set
    owners = owners || jsonb_build_object(p_seller, owned - p_units,
                                          p_buyer, coalesce((owners ->> p_buyer)::integer, 0) + p_units),
    listings = case when listed - p_units = 0 then listings - p_seller else listings || jsonb_build_object(p_seller, listed - p_units) end,
    revision = revision + 1, updated_at = now()
  where id = p_id;
  insert into public.venture_transfers (id, venture_id, room_id, seller_id, buyer_id, buyer_name, units, gross_cents, company_value_cents, revision)
  values (p_transfer, p_id, v.room_id, p_seller, p_buyer, p_buyer_name, p_units, gross, v.value_cents, v.revision)
  returning * into t;
  return t;
end $$;

-- Each side marks its ledger as having applied the transfer.
create or replace function public.venture_mark_applied(p_transfer text, p_player text)
returns public.venture_transfers language plpgsql security definer set search_path = public as $$
declare t public.venture_transfers;
begin
  update public.venture_transfers set
    seller_applied = seller_applied or seller_id = p_player,
    buyer_applied = buyer_applied or buyer_id = p_player
  where id = p_transfer returning * into t;
  return t;
end $$;

-- A finished player's stake becomes a frozen, nontradable snapshot; a founder's finish stops the company.
create or replace function public.venture_freeze(p_id text, p_player text, p_stake_cents bigint)
returns public.ventures language plpgsql security definer set search_path = public as $$
declare v public.ventures;
begin
  select * into v from public.ventures where id = p_id for update;
  if not found then raise exception 'unknown company'; end if;
  if not public.venture_is_member(v.room_id, p_player) then raise exception 'not a room member'; end if;
  if v.frozen ? p_player then return v; end if;
  update public.ventures set
    frozen = frozen || jsonb_build_object(p_player, jsonb_build_object('units', coalesce((owners ->> p_player)::integer, 0), 'stake_cents', p_stake_cents)),
    listings = case when p_player = founder_id then '{}'::jsonb else listings - p_player end,
    stopped = stopped or p_player = founder_id,
    revision = revision + 1, updated_at = now()
  where id = p_id returning * into v;
  return v;
end $$;

grant select on public.ventures, public.venture_transfers to anon, authenticated;
grant execute on function public.venture_publish(text, text, text, text, text, bigint, integer, integer, boolean, boolean) to anon, authenticated;
grant execute on function public.venture_list(text, text, integer) to anon, authenticated;
grant execute on function public.venture_buy(text, text, text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.venture_mark_applied(text, text) to anon, authenticated;
grant execute on function public.venture_freeze(text, text, bigint) to anon, authenticated;

-- Realtime updates for listings, prices and transfers.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.ventures; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.venture_transfers; exception when duplicate_object then null; end;
  end if;
end $$;
