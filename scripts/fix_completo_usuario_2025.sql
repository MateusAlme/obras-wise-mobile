-- ========================================
-- Script Completo: Corrigir e Verificar Usuário 2025
-- Data: 2025-02-07
-- Descrição: Script all-in-one que:
--   1. Cria usuário 2025 (se não existe)
--   2. Atualiza políticas RLS para compartilhamento
--   3. Cria obra de teste
--   4. Executa diagnóstico completo
-- ========================================

DO $$
DECLARE
  v_user_id UUID;
  v_equipe_id UUID;
  v_obra_id UUID;
  v_total_obras INTEGER;
  v_total_policies INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'INICIANDO CORREÇÃO COMPLETA';
  RAISE NOTICE '========================================';

  -- ========================================
  -- PASSO 1: CRIAR USUÁRIO 2025
  -- ========================================
  RAISE NOTICE '';
  RAISE NOTICE '[1/5] Verificando usuário 2025...';

  -- Verificar se usuário já existe
  SELECT id INTO v_user_id FROM auth.users WHERE email = '2025@obraswise.com';

  IF v_user_id IS NULL THEN
    RAISE NOTICE '  → Criando usuário 2025...';

    -- Buscar equipe padrão
    SELECT id INTO v_equipe_id FROM equipes WHERE codigo = 'CNT 01' LIMIT 1;

    -- Criar usuário
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      '2025@obraswise.com',
      crypt('teccel2025', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Usuário 2025"}',
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO v_user_id;

    RAISE NOTICE '  ✓ Usuário criado no auth.users';

    -- Criar perfil
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (v_user_id, '2025@obraswise.com', 'Usuário 2025', 'user');

    RAISE NOTICE '  ✓ Perfil criado';

    -- Criar registro em usuarios_app
    INSERT INTO usuarios_app (
      matricula, nome, equipe_id, ativo, supabase_user_id,
      observacoes
    ) VALUES (
      '2025', 'Usuário 2025', v_equipe_id, true, v_user_id,
      'Criado via script de correção'
    );

    RAISE NOTICE '  ✓ Registro em usuarios_app criado';
  ELSE
    RAISE NOTICE '  ✓ Usuário 2025 já existe (ID: %)', v_user_id;
  END IF;

  -- ========================================
  -- PASSO 2: ATUALIZAR POLÍTICAS RLS
  -- ========================================
  RAISE NOTICE '';
  RAISE NOTICE '[2/5] Atualizando políticas RLS...';

  -- Remover TODAS as políticas antigas (incluindo as novas se já existirem)
  DROP POLICY IF EXISTS "Users can view their own obras" ON obras;
  DROP POLICY IF EXISTS "Users can create their own obras" ON obras;
  DROP POLICY IF EXISTS "Users can update their own obras" ON obras;
  DROP POLICY IF EXISTS "Users can delete their own obras" ON obras;
  DROP POLICY IF EXISTS "Usuários autenticados podem ler obras" ON obras;
  DROP POLICY IF EXISTS "Usuários autenticados podem inserir obras" ON obras;
  DROP POLICY IF EXISTS "Usuários autenticados podem atualizar obras" ON obras;
  DROP POLICY IF EXISTS "Usuários autenticados podem ver todas as obras" ON obras;
  DROP POLICY IF EXISTS "Usuários autenticados podem criar obras" ON obras;
  DROP POLICY IF EXISTS "Usuários autenticados podem editar todas as obras" ON obras;
  DROP POLICY IF EXISTS "Usuários autenticados podem deletar todas as obras" ON obras;

  RAISE NOTICE '  ✓ Políticas antigas removidas';

  -- Criar novas políticas compartilhadas
  CREATE POLICY "Usuários autenticados podem ver todas as obras"
    ON obras FOR SELECT
    TO authenticated
    USING (true);

  CREATE POLICY "Usuários autenticados podem criar obras"
    ON obras FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Usuários autenticados podem editar todas as obras"
    ON obras FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

  CREATE POLICY "Usuários autenticados podem deletar todas as obras"
    ON obras FOR DELETE
    TO authenticated
    USING (true);

  RAISE NOTICE '  ✓ Novas políticas criadas (compartilhamento total)';

  -- ========================================
  -- PASSO 3: GARANTIR RLS HABILITADO
  -- ========================================
  RAISE NOTICE '';
  RAISE NOTICE '[3/5] Verificando RLS...';

  ALTER TABLE obras ENABLE ROW LEVEL SECURITY;

  RAISE NOTICE '  ✓ RLS habilitado na tabela obras';

  -- ========================================
  -- PASSO 4: CRIAR OBRA DE TESTE
  -- ========================================
  RAISE NOTICE '';
  RAISE NOTICE '[4/5] Criando obra de teste...';

  SELECT COUNT(*) INTO v_total_obras FROM obras;

  IF v_total_obras = 0 THEN
    -- Criar obra de teste
    INSERT INTO obras (
      user_id, data, obra, responsavel, equipe,
      tipo_servico, tem_atipicidade, created_at, updated_at
    ) VALUES (
      v_user_id,
      CURRENT_DATE,
      'Obra de Teste - Verificação Sistema',
      'Sistema Automático',
      'CNT 01',
      ARRAY['Teste', 'Verificação'],
      false,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_obra_id;

    RAISE NOTICE '  ✓ Obra de teste criada (ID: %)', v_obra_id;
  ELSE
    RAISE NOTICE '  ✓ Já existem % obras no sistema', v_total_obras;
  END IF;

  -- ========================================
  -- PASSO 5: DIAGNÓSTICO FINAL
  -- ========================================
  RAISE NOTICE '';
  RAISE NOTICE '[5/5] Executando diagnóstico final...';

  -- Contar políticas
  SELECT COUNT(*) INTO v_total_policies
  FROM pg_policies
  WHERE tablename = 'obras';

  -- Atualizar contagem de obras
  SELECT COUNT(*) INTO v_total_obras FROM obras;

  RAISE NOTICE '  ✓ Políticas RLS ativas: %', v_total_policies;
  RAISE NOTICE '  ✓ Total de obras: %', v_total_obras;

  -- ========================================
  -- RESUMO FINAL
  -- ========================================
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ CORREÇÃO CONCLUÍDA COM SUCESSO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'CREDENCIAIS DO USUÁRIO:';
  RAISE NOTICE '  Matrícula: 2025';
  RAISE NOTICE '  Senha: teccel2025';
  RAISE NOTICE '  Email: 2025@obraswise.com';
  RAISE NOTICE '';
  RAISE NOTICE 'ESTATÍSTICAS:';
  RAISE NOTICE '  User ID: %', v_user_id;
  RAISE NOTICE '  Total de obras: %', v_total_obras;
  RAISE NOTICE '  Políticas RLS: %', v_total_policies;
  RAISE NOTICE '';
  RAISE NOTICE 'PRÓXIMOS PASSOS:';
  RAISE NOTICE '  1. Feche o app mobile completamente';
  RAISE NOTICE '  2. Abra novamente e faça login';
  RAISE NOTICE '  3. Verifique se as obras aparecem';
  RAISE NOTICE '';
  RAISE NOTICE 'Se ainda não funcionar:';
  RAISE NOTICE '  1. Limpe o cache do app';
  RAISE NOTICE '  2. Verifique os logs do console';
  RAISE NOTICE '  3. Execute: diagnostico_usuario_2025.sql';
  RAISE NOTICE '========================================';

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro durante correção: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;

-- ========================================
-- VERIFICAÇÃO PÓS-EXECUÇÃO
-- ========================================

-- Mostrar detalhes do usuário 2025
SELECT
  '=== USUÁRIO 2025 ===' as info,
  u.id as user_id,
  u.email,
  ua.matricula,
  ua.nome,
  ua.ativo,
  e.nome as equipe
FROM auth.users u
LEFT JOIN usuarios_app ua ON ua.supabase_user_id = u.id
LEFT JOIN equipes e ON e.id = ua.equipe_id
WHERE u.email = '2025@obraswise.com';

-- Mostrar políticas RLS ativas
SELECT
  '=== POLÍTICAS RLS ===' as info,
  policyname as politica,
  cmd as operacao,
  CASE
    WHEN qual::text = 'true' THEN 'Todos (compartilhado)'
    ELSE 'Restrito'
  END as alcance
FROM pg_policies
WHERE tablename = 'obras'
ORDER BY cmd;

-- Mostrar últimas 3 obras
SELECT
  '=== ÚLTIMAS OBRAS ===' as info,
  o.id,
  o.obra as nome,
  o.equipe,
  u.email as criado_por,
  o.created_at
FROM obras o
LEFT JOIN auth.users u ON u.id = o.user_id
ORDER BY o.created_at DESC
LIMIT 3;
