-- Migration: Configurar mateusalmeidacz@gmail.com como Admin
-- Data: 2025-02-26
-- Descrição: Promover usuário Mateus para admin

-- Promover mateusalmeidacz@gmail.com para admin
INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
SELECT
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', 'Mateus Almeida'),
    'admin',
    NOW(),
    NOW()
FROM auth.users u
WHERE u.email = 'mateusalmeidacz@gmail.com'
ON CONFLICT (id)
DO UPDATE SET
    role = 'admin',
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = NOW();

-- Verificar o resultado
SELECT
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.created_at,
    p.updated_at
FROM public.profiles p
WHERE p.email = 'mateusalmeidacz@gmail.com';
