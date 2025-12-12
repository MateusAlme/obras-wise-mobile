-- ========================================
-- Script: Adicionar usuário mobile matrícula 2025
-- Data: 2025-02-06
-- Descrição: Criar usuário com matrícula 2025 e senha teccel2025
-- ========================================
--
-- INSTRUÇÕES:
-- 1. Acesse o Supabase Dashboard: https://app.supabase.com
-- 2. Selecione seu projeto
-- 3. Vá em "SQL Editor"
-- 4. Cole e execute este script completo
-- ========================================

-- Criar usuário no auth.users e nas tabelas relacionadas
DO $$
DECLARE
  v_user_id UUID;
  v_equipe_id UUID;
  v_encrypted_password TEXT;
BEGIN
  -- Buscar uma equipe padrão (CNT 01)
  -- Você pode alterar para qualquer outra equipe conforme necessário
  SELECT id INTO v_equipe_id FROM equipes WHERE codigo = 'CNT 01' LIMIT 1;

  -- Gerar hash da senha usando bcrypt (mesma que Supabase usa)
  v_encrypted_password := crypt('teccel2025', gen_salt('bf'));

  -- Verificar se usuário já existe
  SELECT id INTO v_user_id FROM auth.users WHERE email = '2025@obraswise.com';

  IF v_user_id IS NULL THEN
    -- Criar usuário no auth.users
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
      v_encrypted_password,
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

    RAISE NOTICE 'Usuário criado no auth.users com ID: %', v_user_id;
  ELSE
    RAISE NOTICE 'Usuário já existe no auth.users com ID: %', v_user_id;

    -- Atualizar senha se o usuário já existe
    UPDATE auth.users
    SET encrypted_password = v_encrypted_password,
        updated_at = NOW()
    WHERE id = v_user_id;

    RAISE NOTICE 'Senha atualizada para o usuário existente';
  END IF;

  -- Criar ou atualizar perfil na tabela profiles (se já não foi criado pelo trigger)
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
      v_user_id,
      '2025@obraswise.com',
      'Usuário 2025',
      'user'
    );
    RAISE NOTICE 'Perfil criado na tabela profiles';
  ELSE
    UPDATE public.profiles
    SET full_name = 'Usuário 2025',
        role = 'user',
        updated_at = NOW()
    WHERE id = v_user_id;
    RAISE NOTICE 'Perfil atualizado na tabela profiles';
  END IF;

  -- Criar ou atualizar registro na tabela usuarios_app
  IF NOT EXISTS (SELECT 1 FROM usuarios_app WHERE matricula = '2025') THEN
    INSERT INTO usuarios_app (
      matricula,
      nome,
      equipe_id,
      ativo,
      supabase_user_id,
      observacoes
    ) VALUES (
      '2025',
      'Usuário 2025',
      v_equipe_id,
      true,
      v_user_id,
      'Usuário mobile com matrícula 2025'
    );
    RAISE NOTICE 'Registro criado na tabela usuarios_app';
  ELSE
    UPDATE usuarios_app
    SET nome = 'Usuário 2025',
        equipe_id = v_equipe_id,
        ativo = true,
        supabase_user_id = v_user_id,
        observacoes = 'Usuário mobile com matrícula 2025',
        updated_at = NOW()
    WHERE matricula = '2025';
    RAISE NOTICE 'Registro atualizado na tabela usuarios_app';
  END IF;

  -- Verificação final
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ Usuário configurado com sucesso!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CREDENCIAIS DE LOGIN:';
  RAISE NOTICE '  Matrícula: 2025';
  RAISE NOTICE '  Senha: teccel2025';
  RAISE NOTICE '  Email: 2025@obraswise.com';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DADOS TÉCNICOS:';
  RAISE NOTICE '  User ID: %', v_user_id;
  RAISE NOTICE '  Equipe: % (ID: %)', (SELECT nome FROM equipes WHERE id = v_equipe_id), v_equipe_id;
  RAISE NOTICE '========================================';

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao criar usuário: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;

-- Verificar se o usuário foi criado corretamente
SELECT
  ua.matricula,
  ua.nome,
  ua.ativo,
  e.nome as equipe,
  u.email,
  u.email_confirmed_at IS NOT NULL as email_confirmado,
  p.role as perfil_role
FROM usuarios_app ua
LEFT JOIN equipes e ON e.id = ua.equipe_id
LEFT JOIN auth.users u ON u.id = ua.supabase_user_id
LEFT JOIN profiles p ON p.id = ua.supabase_user_id
WHERE ua.matricula = '2025';
