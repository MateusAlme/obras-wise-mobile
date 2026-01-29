-- Migration: Configurar Sistema de Usuários do Web
-- Data: 2026-01-29
-- Descrição: Garantir que a view de usuários existe e que o usuário admin está configurado

-- =====================================================
-- 1. Criar/Recriar VIEW: vw_usuarios_sistema
-- =====================================================
DROP VIEW IF EXISTS vw_usuarios_sistema;

CREATE OR REPLACE VIEW vw_usuarios_sistema AS
SELECT
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.created_at,
  p.updated_at,
  u.last_sign_in_at,
  u.email_confirmed_at
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.role IN ('admin', 'viewer')
ORDER BY p.created_at DESC;

-- Garantir permissões
GRANT SELECT ON vw_usuarios_sistema TO authenticated;
GRANT SELECT ON vw_usuarios_sistema TO service_role;

-- =====================================================
-- 2. Garantir que mateusalmeidacz@gmail.com está como admin
-- =====================================================
-- Atualizar o perfil para admin (caso exista)
UPDATE public.profiles
SET
  role = 'admin',
  updated_at = NOW()
WHERE email = 'mateusalmeidacz@gmail.com';

-- =====================================================
-- 3. Verificar se há usuário sem perfil
-- =====================================================
-- Criar profiles faltantes para usuários que existem no auth mas não no profiles
INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.email) as full_name,
  CASE
    WHEN u.email = 'mateusalmeidacz@gmail.com' THEN 'admin'
    ELSE 'viewer'
  END as role,
  u.created_at,
  NOW()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
AND u.email IS NOT NULL;

-- =====================================================
-- 4. Comentários
-- =====================================================
COMMENT ON VIEW vw_usuarios_sistema IS 'View para listar usuários admin e viewer do sistema web';
