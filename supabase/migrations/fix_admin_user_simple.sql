-- Script SIMPLES para promover usuário a admin
-- Execute este script no SQL Editor do Supabase Dashboard

-- Buscar e promover o usuário mateusalmeidacx@gmail.com para admin
INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
SELECT
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', 'Mateus Almeida'),
    'admin',
    NOW(),
    NOW()
FROM auth.users u
WHERE u.email = 'mateusalmeidacx@gmail.com'
ON CONFLICT (id)
DO UPDATE SET
    role = 'admin',
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = NOW();

-- Verificar o resultado
SELECT
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.created_at
FROM public.profiles p
WHERE p.email = 'mateusalmeidacx@gmail.com';
