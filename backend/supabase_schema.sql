-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Table: workspaces (Slack integration management)
create table if not exists workspaces (
  id uuid primary key default uuid_generate_v4(),
  team_id text not null unique, -- Added unique constraint
  access_token text not null,
  team_name text, -- Added team_name
  icon_url text, -- Added icon_url
  user_id uuid, -- Link to your app's user if you implement auth later
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: items (All messages and links)
create table if not exists items (
  id uuid primary key default uuid_generate_v4(),
  source_type text not null check (source_type in ('slack', 'web')),
  content text not null,
  meta_data jsonb default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'summarized', 'done', 'archived')),
  priority_score integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: summaries (AI Reports)
create table if not exists summaries (
  id uuid primary key default uuid_generate_v4(),
  summary_text text not null,
  target_items uuid[] not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for performance
create index if not exists idx_items_status on items(status);
create index if not exists idx_workspaces_team_id on workspaces(team_id);

