create table game_participants (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null unique,
  display_name text not null,
  current_streak integer not null default 0,
  last_played_date date,
  created_at timestamptz not null default now()
);

create table game_results (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references game_participants(id) on delete cascade,
  play_date date not null,
  guesses integer not null,
  created_at timestamptz not null default now(),
  unique (participant_id, play_date)
);

alter table game_participants enable row level security;
alter table game_results enable row level security;

-- No login exists for site visitors, so these policies are intentionally
-- public read/write (matching game_players). Anyone with browser devtools
-- could in theory edit another entry's name/streak or insert a fake score.
-- Acceptable for a casual fan leaderboard; do not reuse this pattern for
-- anything sensitive.
create policy "Public read access" on game_participants for select using (true);
create policy "Public insert access" on game_participants for insert with check (true);
create policy "Public update access" on game_participants for update using (true) with check (true);

create policy "Public read access" on game_results for select using (true);
create policy "Public insert access" on game_results for insert with check (true);
create policy "Public update access" on game_results for update using (true) with check (true);
