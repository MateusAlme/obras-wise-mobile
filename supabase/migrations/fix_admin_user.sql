-- Script para corrigir e criar usuário admin
-- Execute este script no SQL Editor do Supabase Dashboard

-- 1. Verificar se a tabela profiles existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        RAISE EXCEPTION 'Tabela profiles não existe! Execute primeiro a migração 20250126_auth_setup.sql';
    END IF;
END $$;

-- 2. Buscar o ID do usuário mateusalmeidacx@gmail.com
DO $$
DECLARE
    user_id UUID;
    user_email TEXT := 'mateusalmeidacx@gmail.com';
BEGIN
    -- Buscar ID do usuário na tabela auth.users
    SELECT id INTO user_id
    FROM auth.users
    WHERE email = user_email;

    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário % não encontrado na tabela auth.users. Crie o usuário primeiro!', user_email;
    END IF;

    RAISE NOTICE 'Usuário encontrado: ID = %', user_id;

    -- 3. Inserir ou atualizar o perfil como admin
    INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
    VALUES (
        user_id,
        user_email,
        'Mateus Almeida',
        'admin',
        NOW(),
        NOW()
    )
    ON CONFLICT (id)
    DO UPDATE SET
        role = 'admin',
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        updated_at = NOW();

    RAISE NOTICE 'Perfil criado/atualizado com sucesso! Usuário % agora é ADMIN', user_email;
END $$;

-- 4. Verificar o resultado
SELECT
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.created_at
FROM public.profiles p
WHERE p.email = 'mateusalmeidacx@gmail.com';
