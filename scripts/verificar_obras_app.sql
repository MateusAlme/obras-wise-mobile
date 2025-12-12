-- ========================================
-- Script: Verificar Por Que Obras Não Aparecem no App
-- Data: 2025-02-07
-- Descrição: Diagnóstico completo para entender por que
--            o app mobile não está mostrando obras
-- ========================================

-- 1. VERIFICAR TOTAL DE OBRAS NO BANCO
SELECT
  '1. TOTAL DE OBRAS NO BANCO' as secao,
  COUNT(*) as total_obras
FROM obras;

-- 2. VERIFICAR OBRAS POR USUÁRIO
SELECT
  '2. OBRAS POR USUÁRIO' as secao,
  u.email,
  COUNT(o.id) as total_obras,
  MIN(o.created_at) as primeira_obra,
  MAX(o.created_at) as ultima_obra
FROM auth.users u
LEFT JOIN obras o ON o.user_id = u.id
GROUP BY u.id, u.email
ORDER BY COUNT(o.id) DESC;

-- 3. VERIFICAR DETALHES DAS ÚLTIMAS 5 OBRAS
SELECT
  '3. ÚLTIMAS 5 OBRAS (DETALHES)' as secao,
  o.id,
  o.obra as nome_obra,
  o.equipe,
  o.responsavel,
  o.data,
  u.email as criado_por,
  o.created_at as data_cadastro,
  o.user_id
FROM obras o
LEFT JOIN auth.users u ON u.id = o.user_id
ORDER BY o.created_at DESC
LIMIT 5;

-- 4. VERIFICAR SE HÁ OBRAS SEM user_id
SELECT
  '4. OBRAS SEM USER_ID' as secao,
  COUNT(*) as total_obras_sem_user
FROM obras
WHERE user_id IS NULL;

-- 5. VERIFICAR POLÍTICAS RLS ATIVAS
SELECT
  '5. POLÍTICAS RLS ATIVAS' as secao,
  policyname as politica,
  cmd as operacao,
  qual::text as condicao_using,
  with_check::text as condicao_with_check
FROM pg_policies
WHERE tablename = 'obras'
ORDER BY cmd, policyname;

-- 6. VERIFICAR SE RLS ESTÁ HABILITADO
SELECT
  '6. STATUS RLS' as secao,
  tablename,
  rowsecurity as rls_habilitado
FROM pg_tables
WHERE tablename = 'obras';

-- 7. VERIFICAR USUÁRIO 2025
SELECT
  '7. USUÁRIO 2025' as secao,
  u.id as user_id,
  u.email,
  u.created_at as cadastrado_em,
  ua.matricula,
  ua.ativo as usuario_ativo
FROM auth.users u
LEFT JOIN usuarios_app ua ON ua.supabase_user_id = u.id
WHERE u.email = '2025@obraswise.com';

-- 8. SIMULAR QUERY QUE O APP FAZ
-- Esta query mostra exatamente o que o app deveria receber
SELECT
  '8. QUERY SIMULADA (O QUE O APP DEVERIA VER)' as secao,
  COUNT(*) as total_obras_visiveis
FROM obras;

-- 9. VERIFICAR SE HÁ FOTOS NAS OBRAS
SELECT
  '9. OBRAS COM FOTOS' as secao,
  COUNT(CASE WHEN fotos_antes IS NOT NULL THEN 1 END) as com_fotos_antes,
  COUNT(CASE WHEN fotos_durante IS NOT NULL THEN 1 END) as com_fotos_durante,
  COUNT(CASE WHEN fotos_depois IS NOT NULL THEN 1 END) as com_fotos_depois,
  COUNT(*) as total_obras
FROM obras;

-- 10. VERIFICAR ESTRUTURA DA TABELA OBRAS
SELECT
  '10. COLUNAS DA TABELA OBRAS' as secao,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'obras'
  AND column_name IN ('id', 'user_id', 'obra', 'data', 'equipe', 'created_at')
ORDER BY ordinal_position;

-- ========================================
-- DIAGNÓSTICO FINAL
-- ========================================

DO $$
DECLARE
  v_total_obras INTEGER;
  v_total_usuarios INTEGER;
  v_user_2025_exists BOOLEAN;
  v_rls_enabled BOOLEAN;
  v_total_policies INTEGER;
BEGIN
  -- Contagens
  SELECT COUNT(*) INTO v_total_obras FROM obras;
  SELECT COUNT(*) INTO v_total_usuarios FROM auth.users;
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = '2025@obraswise.com') INTO v_user_2025_exists;
  SELECT rowsecurity INTO v_rls_enabled FROM pg_tables WHERE tablename = 'obras';
  SELECT COUNT(*) INTO v_total_policies FROM pg_policies WHERE tablename = 'obras';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'DIAGNÓSTICO - POR QUE OBRAS NÃO APARECEM';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'BANCO DE DADOS:';
  RAISE NOTICE '  Total de obras: %', v_total_obras;
  RAISE NOTICE '  Total de usuários: %', v_total_usuarios;
  RAISE NOTICE '  Usuário 2025 existe: %', CASE WHEN v_user_2025_exists THEN 'SIM ✓' ELSE 'NÃO ✗' END;
  RAISE NOTICE '  RLS habilitado: %', CASE WHEN v_rls_enabled THEN 'SIM ✓' ELSE 'NÃO ✗' END;
  RAISE NOTICE '  Políticas RLS: %', v_total_policies;
  RAISE NOTICE '';

  IF v_total_obras = 0 THEN
    RAISE NOTICE '⚠ PROBLEMA IDENTIFICADO:';
    RAISE NOTICE '  NÃO HÁ OBRAS CADASTRADAS NO BANCO!';
    RAISE NOTICE '';
    RAISE NOTICE 'POSSÍVEIS CAUSAS:';
    RAISE NOTICE '  1. Ninguém cadastrou obras ainda';
    RAISE NOTICE '  2. Obras foram deletadas';
    RAISE NOTICE '  3. App está salvando em outra tabela';
    RAISE NOTICE '  4. App não está sincronizando com o banco';
    RAISE NOTICE '';
    RAISE NOTICE 'SOLUÇÕES:';
    RAISE NOTICE '  1. Cadastre uma obra manualmente pelo app';
    RAISE NOTICE '  2. Ou execute: criar_obra_teste.sql';
    RAISE NOTICE '  3. Verifique se o app está conectado ao Supabase correto';
    RAISE NOTICE '  4. Verifique se o app está salvando localmente apenas';
  ELSE
    RAISE NOTICE '✓ BANCO TEM OBRAS:';
    RAISE NOTICE '  % obras cadastradas', v_total_obras;
    RAISE NOTICE '';
    RAISE NOTICE '⚠ MAS APP NÃO MOSTRA?';
    RAISE NOTICE '';
    RAISE NOTICE 'POSSÍVEIS CAUSAS:';
    RAISE NOTICE '  1. Cache do app desatualizado';
    RAISE NOTICE '  2. App está em modo offline';
    RAISE NOTICE '  3. Filtro no código do app';
    RAISE NOTICE '  4. Erro de sincronização';
    RAISE NOTICE '  5. Token de autenticação inválido';
    RAISE NOTICE '';
    RAISE NOTICE 'SOLUÇÕES:';
    RAISE NOTICE '  1. Feche o app completamente (force stop)';
    RAISE NOTICE '  2. Limpe o cache: Configurações > Apps > Limpar Cache';
    RAISE NOTICE '  3. Faça logout e login novamente';
    RAISE NOTICE '  4. Verifique os logs do console do app';
    RAISE NOTICE '  5. Verifique se há filtro por user_id no código';
  END IF;

  RAISE NOTICE '========================================';
END $$;
