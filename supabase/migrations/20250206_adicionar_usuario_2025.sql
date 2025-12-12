-- ========================================
-- Migration: Adicionar usuário mobile matrícula 2025
-- Data: 2025-02-06
-- Descrição: Criar usuário com matrícula 2025 e senha teccel2025
-- ========================================

-- 1. CRIAR USUÁRIO NO AUTH.USERS
-- Nota: O Supabase usa bcrypt internamente para hash de senhas
-- A senha 'teccel2025' será hasheada automaticamente pelo Supabase

DO $$
DECLARE
  v_user_id UUID;
  v_equipe_id UUID;
BEGIN
  -- Buscar uma equipe padrão (vamos usar CNT 01 como exemplo)
  -- Você pode alterar para qualquer outra equipe conforme necessário
  SELECT id INTO v_equipe_id FROM equipes WHERE codigo = 'CNT 01' LIMIT 1;

  -- Verificar se usuário já existe
  SELECT id INTO v_user_id FROM auth.users WHERE email = '2025@obraswise.com';

  -- Se não existe, criar usuário no auth.users
  IF v_user_id IS NULL THEN
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
      crypt('teccel2025', gen_salt('bf')), -- Hash bcrypt da senha
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
  ELSE
    -- Se já existe, atualizar a senha
    UPDATE auth.users
    SET encrypted_password = crypt('teccel2025', gen_salt('bf')),
        updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  -- 2. CRIAR PERFIL NA TABELA PROFILES (se existir)
  -- O trigger handle_new_user() pode já ter criado, mas vamos garantir
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
      v_user_id,
      '2025@obraswise.com',
      'Usuário 2025',
      'user'
    );
  ELSE
    UPDATE public.profiles
    SET full_name = 'Usuário 2025',
        role = 'user',
        updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  -- 3. CRIAR REGISTRO NA TABELA USUARIOS_APP
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
      'Usuário criado via migration - matrícula 2025'
    );
  ELSE
    UPDATE usuarios_app
    SET nome = 'Usuário 2025',
        equipe_id = v_equipe_id,
        ativo = true,
        supabase_user_id = v_user_id,
        observacoes = 'Usuário atualizado via migration - matrícula 2025',
        updated_at = NOW()
    WHERE matricula = '2025';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ Usuário criado com sucesso!';
  RAISE NOTICE '✓ Matrícula: 2025';
  RAISE NOTICE '✓ Email: 2025@obraswise.com';
  RAISE NOTICE '✓ Senha: teccel2025';
  RAISE NOTICE '✓ User ID: %', v_user_id;
  RAISE NOTICE '✓ Equipe: % (ID: %)', (SELECT nome FROM equipes WHERE id = v_equipe_id), v_equipe_id;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Para fazer login no app mobile:';
  RAISE NOTICE '  Matrícula: 2025';
  RAISE NOTICE '  Senha: teccel2025';
  RAISE NOTICE '========================================';

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao criar usuário: %', SQLERRM;
END $$;
