
-- 1. Enable RLS on all tables
alter table workspaces enable row level security;
alter table items enable row level security;
alter table summaries enable row level security;
alter table user_settings enable row level security;

-- 2. Add user_id column to tables (and update user_settings)
-- Note: For user_settings, we first drop the old unique constraint/column if needed or alter it.
-- Since we are in development, we can just alter types.
-- Assuming user_settings.user_id was text 'user-1'. We need to change it to uuid referencing auth.users.
-- Since we can't easily cast 'user-1' to uuid, we will clear data or assume it's empty/test data.
truncate table user_settings cascade;
truncate table items cascade;
truncate table summaries cascade;
truncate table workspaces cascade;

-- Alter user_settings
alter table user_settings 
  drop column user_id,
  add column user_id uuid not null references auth.users(id) on delete cascade;

create unique index idx_user_settings_user_id on user_settings(user_id);

-- Alter workspaces
alter table workspaces 
  drop column if exists user_id; -- in case it existed
alter table workspaces
  add column user_id uuid not null references auth.users(id) on delete cascade;

-- Alter items
alter table items 
  add column user_id uuid not null references auth.users(id) on delete cascade;

-- Alter summaries
alter table summaries 
  add column user_id uuid not null references auth.users(id) on delete cascade;


-- 3. Create RLS Policies

-- Workspaces
create policy "Users can view their own workspaces" on workspaces
  for select using (auth.uid() = user_id);

create policy "Users can insert their own workspaces" on workspaces
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own workspaces" on workspaces
  for update using (auth.uid() = user_id);

create policy "Users can delete their own workspaces" on workspaces
  for delete using (auth.uid() = user_id);

-- Items
create policy "Users can view their own items" on items
  for select using (auth.uid() = user_id);

create policy "Users can insert their own items" on items
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own items" on items
  for update using (auth.uid() = user_id);

create policy "Users can delete their own items" on items
  for delete using (auth.uid() = user_id);

-- Summaries
create policy "Users can view their own summaries" on summaries
  for select using (auth.uid() = user_id);

create policy "Users can insert their own summaries" on summaries
  for insert with check (auth.uid() = user_id);

-- User Settings
create policy "Users can view their own settings" on user_settings
  for select using (auth.uid() = user_id);

create policy "Users can insert/update their own settings" on user_settings
  for all using (auth.uid() = user_id);


