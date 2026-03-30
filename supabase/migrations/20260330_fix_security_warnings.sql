-- Migration: Corrigir Avisos de Segurança do Supabase
-- Data: 2026-03-30
-- Descrição: Corrige avisos CRITICAL e WARNING do Supabase Security Advisor:
--   1. CRITICAL: vw_usuarios_sistema - revogar acesso de 'authenticated' (mobile não precisa)
--   2. WARNING:  Funções com search_path mutável - adicionar SET search_path fixo

BEGIN;

-- =====================================================
-- 1. CRITICAL: Revogar acesso à view de usuários admin
--    para usuários autenticados (mobile/equipes)
--    O acesso via service_role (admin web) permanece.
-- =====================================================
REVOKE SELECT ON vw_usuarios_sistema FROM authenticated;

-- Confirmar que service_role ainda tem acesso
GRANT SELECT ON vw_usuarios_sistema TO service_role;

-- =====================================================
-- 2. WARNING: Fixar search_path nas funções SECURITY DEFINER
--    Funções que usam pgcrypto (crypt, gen_salt):
--    precisam de 'extensions' no path (onde o pgcrypto fica no Supabase)
-- =====================================================

-- 2a. criar_equipe_com_senha (usa crypt/gen_salt)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'criar_equipe_com_senha'
  ) THEN
    ALTER FUNCTION public.criar_equipe_com_senha(VARCHAR, TEXT)
      SET search_path = public, extensions;
  END IF;
END $$;

-- 2b. admin_resetar_senha_equipe (usa crypt/gen_salt)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'admin_resetar_senha_equipe'
  ) THEN
    ALTER FUNCTION public.admin_resetar_senha_equipe(VARCHAR, TEXT)
      SET search_path = public, extensions;
  END IF;
END $$;

-- 2c. alterar_senha_equipe (usa crypt/gen_salt)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'alterar_senha_equipe'
      AND pg_get_function_identity_arguments(p.oid) = 'p_equipe_codigo character varying, p_senha_atual text, p_senha_nova text'
  ) THEN
    ALTER FUNCTION public.alterar_senha_equipe(VARCHAR, TEXT, TEXT)
      SET search_path = public, extensions;
  END IF;
END $$;

-- 2d. calcular_fotos_pendentes (não usa pgcrypto, apenas public basta)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'calcular_fotos_pendentes'
  ) THEN
    ALTER FUNCTION public.calcular_fotos_pendentes(obras)
      SET search_path = public, extensions;
  END IF;
END $$;

-- 2e. generate_storage_path (se existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'generate_storage_path'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.generate_storage_path SET search_path = public, extensions';
  END IF;
END $$;

-- 2f. criar_equipe (versão antiga da função se ainda existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'criar_equipe'
      AND pg_get_function_identity_arguments(p.oid) = 'p_equipe_codigo character varying, p_senha text'
  ) THEN
    ALTER FUNCTION public.criar_equipe(VARCHAR, TEXT)
      SET search_path = public, extensions;
  END IF;
END $$;

-- 2g. admin_alterar_senha_equipe (versão alternativa se existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'admin_alterar_senha_equipe'
      AND pg_get_function_identity_arguments(p.oid) = 'p_equipe_codigo character varying, p_senha_nova text'
  ) THEN
    ALTER FUNCTION public.admin_alterar_senha_equipe(VARCHAR, TEXT)
      SET search_path = public, extensions;
  END IF;
END $$;

COMMIT;

-- =====================================================
-- Resumo das correções:
--
-- ANTES (inseguro):
--   - vw_usuarios_sistema: qualquer usuário autenticado (mobile) podia ver
--     emails e dados dos admins do sistema
--   - Funções SECURITY DEFINER: search_path mutável permite ataque de
--     "schema injection" (trocar funções como crypt() por versões maliciosas)
--
-- DEPOIS (seguro):
--   - vw_usuarios_sistema: apenas service_role (admin web) tem acesso
--   - Funções: search_path fixo em 'public, extensions' - crypt() sempre
--     resolve para a versão correta do pgcrypto
-- =====================================================
