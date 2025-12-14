
-- Table: user_settings (Single user configuration for MVP)
create table if not exists user_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null unique, -- Simplified for single user MVP (e.g. 'user-1')
  alert_keywords text[] default '{}',
  vip_user_ids text[] default '{}',
  report_custom_instructions text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
