-- =====================================================
-- POLÍTICAS RLS PARA SUPABASE STORAGE
-- Permitir upload e leitura sem autenticação Supabase Auth
-- (necessário para sistema de login por equipe)
-- =====================================================

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon uploads to obra-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon reads from obra-photos" ON storage.objects;

-- =====================================================
-- POLÍTICA 1: Permitir UPLOAD (INSERT) sem autenticação
-- =====================================================
-- Necessário porque login por equipe não cria sessão Supabase Auth
-- Permite qualquer usuário (anon) fazer upload para o bucket 'obra-photos'

CREATE POLICY "Allow anon uploads to obra-photos"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'obra-photos');

-- =====================================================
-- POLÍTICA 2: Permitir LEITURA (SELECT) sem autenticação
-- =====================================================
-- Permite visualizar fotos das obras

CREATE POLICY "Allow anon reads from obra-photos"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'obra-photos');

-- =====================================================
-- POLÍTICA 3: Permitir ATUALIZAÇÃO (UPDATE) sem autenticação
-- =====================================================
-- Permite atualizar metadados de fotos se necessário

CREATE POLICY "Allow anon updates to obra-photos"
ON storage.objects
FOR UPDATE
TO anon
USING (bucket_id = 'obra-photos')
WITH CHECK (bucket_id = 'obra-photos');

-- =====================================================
-- POLÍTICA 4: Permitir EXCLUSÃO (DELETE) sem autenticação
-- =====================================================
-- Permite deletar fotos antigas se necessário

CREATE POLICY "Allow anon deletes from obra-photos"
ON storage.objects
FOR DELETE
TO anon
USING (bucket_id = 'obra-photos');

-- =====================================================
-- VERIFICAÇÃO: Bucket obra-photos existe e está configurado
-- =====================================================

-- Verificar se bucket existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'obra-photos'
  ) THEN
    -- Criar bucket se não existir
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'obra-photos',
      'obra-photos',
      true, -- público para facilitar acesso
      10485760, -- 10MB máximo por arquivo
      ARRAY['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']::text[]
    );

    RAISE NOTICE 'Bucket obra-photos criado com sucesso!';
  ELSE
    RAISE NOTICE 'Bucket obra-photos já existe.';
  END IF;
END $$;

-- =====================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON POLICY "Allow anon uploads to obra-photos" ON storage.objects IS
'Permite upload de fotos sem autenticação Supabase Auth. Necessário para sistema de login por equipe.';

COMMENT ON POLICY "Allow anon reads from obra-photos" ON storage.objects IS
'Permite leitura pública de fotos de obras.';

COMMENT ON POLICY "Allow anon updates to obra-photos" ON storage.objects IS
'Permite atualização de metadados de fotos.';

COMMENT ON POLICY "Allow anon deletes from obra-photos" ON storage.objects IS
'Permite exclusão de fotos antigas ou duplicadas.';
