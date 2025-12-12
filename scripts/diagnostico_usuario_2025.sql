-- ========================================
-- Script de Diagnóstico: Usuário 2025
-- Data: 2025-02-07
-- Descrição: Verificar se usuário 2025 foi criado corretamente
--            e investigar por que obras não aparecem
-- ========================================

-- 1. VERIFICAR SE USUÁRIO 2025 EXISTE NO AUTH.USERS
SELECT
  '1. Verificação auth.users' as secao,
  id,
  email,
  email_confirmed_at,
  created_at,
  CASE
    WHEN email_confirmed_at IS NOT NULL THEN '✓ Email confirmado'
    ELSE '✗ Email NÃO confirmado'
  END as status_email
FROM auth.users
WHERE email = '2025@obraswise.com';

-- 2. VERIFICAR SE PERFIL EXISTE NA TABELA PROFILES
SELECT
  '2. Verificação profiles' as secao,
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.created_at
FROM public.profiles p
WHERE p.email = '2025@obraswise.com';

-- 3. VERIFICAR SE USUÁRIO EXISTE NA TABELA USUARIOS_APP
SELECT
  '3. Verificação usuarios_app' as secao,
  ua.id,
  ua.matricula,
  ua.nome,
  ua.ativo,
  ua.supabase_user_id,
  e.nome as equipe_nome,
  e.codigo as equipe_codigo,
  CASE
    WHEN ua.ativo THEN '✓ Usuário ativo'
    ELSE '✗ Usuário INATIVO'
  END as status_ativo
FROM usuarios_app ua
LEFT JOIN equipes e ON e.id = ua.equipe_id
WHERE ua.matricula = '2025';

-- 4. VERIFICAR TOTAL DE OBRAS NO SISTEMA
SELECT
  '4. Total de obras no sistema' as secao,
  COUNT(*) as total_obras
FROM obras;

-- 5. VERIFICAR OBRAS POR USUÁRIO (TOP 5)
SELECT
  '5. Obras por usuário' as secao,
  u.email,
  COUNT(o.id) as total_obras,
  MAX(o.created_at) as ultima_obra
FROM auth.users u
LEFT JOIN obras o ON o.user_id = u.id
GROUP BY u.id, u.email
ORDER BY COUNT(o.id) DESC
LIMIT 5;

-- 6. VERIFICAR POLÍTICAS RLS DA TABELA OBRAS
SELECT
  '6. Políticas RLS obras' as secao,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'obras'
ORDER BY cmd, policyname;

-- 7. TESTAR ACESSO DO USUÁRIO 2025 (se existir)
DO $$
DECLARE
  v_user_id UUID;
  v_total_obras INTEGER;
BEGIN
  -- Buscar ID do usuário 2025
  SELECT id INTO v_user_id FROM auth.users WHERE email = '2025@obraswise.com';

  IF v_user_id IS NULL THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✗ PROBLEMA: Usuário 2025 NÃO EXISTE!';
    RAISE NOTICE '  Execute a migration: 20250206_adicionar_usuario_2025.sql';
    RAISE NOTICE '========================================';
  ELSE
    -- Contar obras totais
    SELECT COUNT(*) INTO v_total_obras FROM obras;

    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ Usuário 2025 encontrado';
    RAISE NOTICE '  User ID: %', v_user_id;
    RAISE NOTICE '  Total de obras no sistema: %', v_total_obras;
    RAISE NOTICE '========================================';

    -- Verificar se o usuário consegue ver obras com as políticas atuais
    -- Nota: Este teste não considera o contexto de autenticação real
    RAISE NOTICE 'DIAGNÓSTICO:';

    IF v_total_obras = 0 THEN
      RAISE NOTICE '  ⚠ NÃO HÁ OBRAS cadastradas no sistema';
      RAISE NOTICE '  Solução: Cadastre obras pelo app mobile ou web';
    ELSE
      RAISE NOTICE '  ✓ Existem % obras no sistema', v_total_obras;
      RAISE NOTICE '  ⚠ Verifique se as políticas RLS estão corretas (seção 6 acima)';
      RAISE NOTICE '  ⚠ Verifique se o app mobile está fazendo login corretamente';
    END IF;

    RAISE NOTICE '========================================';
  END IF;
END $$;

-- 8. VERIFICAR SE RLS ESTÁ HABILITADO NA TABELA OBRAS
SELECT
  '7. Status RLS da tabela obras' as secao,
  schemaname,
  tablename,
  rowsecurity as rls_habilitado,
  CASE
    WHEN rowsecurity THEN '✓ RLS está HABILITADO'
    ELSE '✗ RLS está DESABILITADO'
  END as status
FROM pg_tables
WHERE tablename = 'obras';

-- 9. LISTAR ALGUMAS OBRAS (SAMPLE)
SELECT
  '8. Amostra de obras (últimas 5)' as secao,
  o.id,
  o.obra as nome_obra,
  o.equipe,
  u.email as criado_por,
  o.created_at
FROM obras o
LEFT JOIN auth.users u ON u.id = o.user_id
ORDER BY o.created_at DESC
LIMIT 5;

-- 10. RESUMO FINAL
DO $$
DECLARE
  v_user_exists BOOLEAN;
  v_user_active BOOLEAN;
  v_total_obras INTEGER;
  v_policies_count INTEGER;
BEGIN
  -- Verificações
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = '2025@obraswise.com') INTO v_user_exists;
  SELECT ativo INTO v_user_active FROM usuarios_app WHERE matricula = '2025';
  SELECT COUNT(*) INTO v_total_obras FROM obras;
  SELECT COUNT(*) INTO v_policies_count FROM pg_policies WHERE tablename = 'obras';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESUMO DO DIAGNÓSTICO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Usuário 2025 existe: %', CASE WHEN v_user_exists THEN '✓ SIM' ELSE '✗ NÃO' END;
  RAISE NOTICE 'Usuário 2025 ativo: %', CASE WHEN v_user_active THEN '✓ SIM' ELSE '✗ NÃO' END;
  RAISE NOTICE 'Total de obras: %', v_total_obras;
  RAISE NOTICE 'Políticas RLS ativas: %', v_policies_count;
  RAISE NOTICE '========================================';

  IF NOT v_user_exists THEN
    RAISE NOTICE 'AÇÃO NECESSÁRIA:';
    RAISE NOTICE '1. Execute: 20250206_adicionar_usuario_2025.sql';
  ELSIF v_total_obras = 0 THEN
    RAISE NOTICE 'AÇÃO NECESSÁRIA:';
    RAISE NOTICE '1. Cadastre obras pelo app mobile ou web';
  ELSIF v_policies_count = 0 THEN
    RAISE NOTICE 'AÇÃO NECESSÁRIA:';
    RAISE NOTICE '1. Execute: 20250207_compartilhar_obras_entre_usuarios.sql';
  ELSE
    RAISE NOTICE 'POSSÍVEIS CAUSAS:';
    RAISE NOTICE '1. App mobile não está fazendo login corretamente';
    RAISE NOTICE '2. Cache do app precisa ser limpo';
    RAISE NOTICE '3. Políticas RLS incorretas';
    RAISE NOTICE '4. Problema de sincronização offline';
  END IF;

  RAISE NOTICE '========================================';
END $$;
