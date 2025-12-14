-- Add team_name and icon_url to workspaces table
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS team_name text;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS icon_url text;

-- Add unique constraint to team_id if not already present (needed for UPSERT)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_team_id_key') THEN
        ALTER TABLE workspaces ADD CONSTRAINT workspaces_team_id_key UNIQUE (team_id);
    END IF;
END
$$;
