-- CRIAR STORAGE BUCKET para fotos de obras
-- Execute este SQL no Supabase SQL Editor

-- 1. Criar bucket para fotos de obras (público)
INSERT INTO storage.buckets (id, name, public)
VALUES ('obra-photos', 'obra-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Users can upload obra photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view obra photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own photos" ON storage.objects;

-- 3. Criar políticas
CREATE POLICY "Users can upload obra photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'obra-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Public can view obra photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'obra-photos');

CREATE POLICY "Users can delete their own photos"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'obra-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own photos"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'obra-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Verificar bucket criado
SELECT * FROM storage.buckets WHERE id = 'obra-photos';
