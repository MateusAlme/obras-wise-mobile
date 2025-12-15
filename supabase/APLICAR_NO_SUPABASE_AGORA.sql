-- =====================================================
-- 🚀 EXECUTAR ESTE SQL NO DASHBOARD DO SUPABASE
-- =====================================================
--
-- Acesse: https://supabase.com/dashboard/project/SEU_PROJECT_ID/sql/new
-- Cole este SQL completo e clique em "RUN"
--
-- =====================================================

-- Adicionar coluna doc_autorizacao_passagem
ALTER TABLE obras
ADD COLUMN IF NOT EXISTS doc_autorizacao_passagem jsonb DEFAULT '[]'::jsonb;

-- Adicionar comentário
COMMENT ON COLUMN obras.doc_autorizacao_passagem IS 'Array JSONB contendo documentos PDF de Autorização de Passagem com URLs do Supabase Storage';

-- Verificar se foi criado
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'obras'
  AND column_name = 'doc_autorizacao_passagem';

-- Se retornar uma linha, está OK! ✅
