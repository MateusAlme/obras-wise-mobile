-- =====================================================
-- QUERY PARA LIMPAR TODAS AS OBRAS E FOTOS
-- ⚠️ ATENÇÃO: Esta operação é IRREVERSÍVEL!
-- ⚠️ Use apenas em ambiente de desenvolvimento/testes
-- =====================================================

-- =====================================================
-- PARTE 1: DELETAR TODAS AS FOTOS DO STORAGE
-- =====================================================
-- Remove todos os arquivos do bucket 'obra-photos'

DO $$
DECLARE
  foto_record RECORD;
  total_deletadas INTEGER := 0;
BEGIN
  RAISE NOTICE '🗑️ Iniciando exclusão de fotos do storage...';
  
  -- Iterar por todas as fotos no bucket e deletar
  FOR foto_record IN 
    SELECT * FROM storage.objects WHERE bucket_id = 'obra-photos'
  LOOP
    DELETE FROM storage.objects 
    WHERE id = foto_record.id AND bucket_id = 'obra-photos';
    
    total_deletadas := total_deletadas + 1;
  END LOOP;
  
  RAISE NOTICE '✅ Total de fotos deletadas do storage: %', total_deletadas;
END $$;

-- =====================================================
-- PARTE 2: DELETAR TODAS AS OBRAS DO BANCO DE DADOS
-- =====================================================
-- Remove todos os registros da tabela 'obras'

DO $$
DECLARE
  total_obras INTEGER;
BEGIN
  -- Contar obras antes de deletar
  SELECT COUNT(*) INTO total_obras FROM obras;
  
  RAISE NOTICE '🗑️ Iniciando exclusão de obras do banco de dados...';
  RAISE NOTICE 'Total de obras a serem deletadas: %', total_obras;
  
  -- Deletar todas as obras
  DELETE FROM obras;
  
  RAISE NOTICE '✅ Todas as obras foram deletadas!';
END $$;

-- =====================================================
-- PARTE 3: VERIFICAÇÃO FINAL
-- =====================================================
-- Confirma que tudo foi removido

DO $$
DECLARE
  count_obras INTEGER;
  count_fotos INTEGER;
BEGIN
  RAISE NOTICE '📊 Verificando limpeza...';
  
  -- Contar obras restantes
  SELECT COUNT(*) INTO count_obras FROM obras;
  
  -- Contar fotos restantes no storage
  SELECT COUNT(*) INTO count_fotos 
  FROM storage.objects WHERE bucket_id = 'obra-photos';
  
  RAISE NOTICE '📊 Obras restantes no banco: %', count_obras;
  RAISE NOTICE '📊 Fotos restantes no storage: %', count_fotos;
  
  IF count_obras = 0 AND count_fotos = 0 THEN
    RAISE NOTICE '✅ ✅ ✅ Limpeza completa realizada com sucesso!';
  ELSE
    RAISE WARNING '⚠️ Ainda existem registros no banco. Verifique as policies de RLS.';
  END IF;
END $$;

-- =====================================================
-- INSTRUÇÕES DE USO
-- =====================================================
-- 1. Abra o Supabase SQL Editor
-- 2. Cole todo este script
-- 3. Execute o script
-- 4. Verifique os logs no console para confirmar a limpeza
-- 
-- IMPORTANTE: 
-- - Esta operação NÃO pode ser desfeita!
-- - Crie um backup antes se necessário
-- - Use apenas em desenvolvimento/testes
-- =====================================================
