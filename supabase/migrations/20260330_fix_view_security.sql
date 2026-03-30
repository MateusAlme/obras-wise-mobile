-- Migration: Corrigir Security Definer View e Exposed Auth Users
-- Data: 2026-03-30
-- Descrição: A view vw_usuarios_sistema tem dois problemas:
--   1. SECURITY DEFINER: executa com permissões do criador (bypassa RLS)
--   2. Exposta para anon e authenticated (mobile pode ver dados dos admins)
-- Solução: Recriar a view com security_invoker = true + revogar acesso público

BEGIN;

-- =====================================================
-- 1. Revogar acesso público (anon E authenticated)
--    Apenas service_role (admin web) deve ter acesso
-- =====================================================
REVOKE SELECT ON vw_usuarios_sistema FROM anon;
REVOKE SELECT ON vw_usuarios_sistema FROM authenticated;

-- =====================================================
-- 2. Recriar a view com SECURITY INVOKER
--    Isso faz a view executar com as permissões de QUEM CHAMA,
--    não do criador. Assim anon/authenticated não conseguem
--    acessar auth.users mesmo que tentem.
-- =====================================================
DROP VIEW IF EXISTS vw_usuarios_sistema;

CREATE VIEW vw_usuarios_sistema
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.avatar_url,
  p.created_at,
  p.updated_at,
  u.last_sign_in_at,
  u.email_confirmed_at
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.role IN ('admin', 'viewer')
ORDER BY p.created_at DESC;

-- Apenas service_role tem acesso (usado pelo supabaseAdmin no web)
GRANT SELECT ON vw_usuarios_sistema TO service_role;

COMMENT ON VIEW vw_usuarios_sistema IS 'View para listar usuários admin e viewer do sistema web. Acesso restrito a service_role.';

COMMIT;
