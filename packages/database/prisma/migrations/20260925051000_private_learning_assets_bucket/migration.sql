INSERT INTO storage.buckets (id, name, public)
VALUES ('learning-assets', 'learning-assets', false)
ON CONFLICT (id) DO UPDATE SET public = false;
