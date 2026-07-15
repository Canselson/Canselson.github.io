create table game_players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  games_played integer not null default 0,
  goals integer not null default 0,
  assists integer not null default 0,
  pims integer not null default 0,
  years_in_club integer not null default 0,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table game_players enable row level security;

create policy "Public read access"
  on game_players for select
  using (true);
