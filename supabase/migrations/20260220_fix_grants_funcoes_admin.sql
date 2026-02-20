-- Migration: Corrigir grants das funções admin
-- Data: 2026-02-20
-- Problema: Funções admin só tinham GRANT para authenticated, não anon
-- Solução: Adicionar GRANT para anon também

BEGIN;

-- Conceder grants somente para funções que existirem no banco
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'criar_equipe_com_senha'
      AND pg_get_function_identity_arguments(p.oid) = 'p_equipe_codigo character varying, p_senha text'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.criar_equipe_com_senha(VARCHAR, TEXT) TO anon';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'admin_resetar_senha_equipe'
      AND pg_get_function_identity_arguments(p.oid) = 'p_equipe_codigo character varying, p_senha_nova text'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.admin_resetar_senha_equipe(VARCHAR, TEXT) TO anon';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'admin_alterar_senha_equipe'
      AND pg_get_function_identity_arguments(p.oid) = 'p_equipe_codigo character varying, p_senha_nova text'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.admin_alterar_senha_equipe(VARCHAR, TEXT) TO anon';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'validar_login_equipe'
      AND pg_get_function_identity_arguments(p.oid) = 'p_equipe_codigo character varying, p_senha text'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.validar_login_equipe(VARCHAR, TEXT) TO anon, authenticated';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'alterar_senha_equipe'
      AND pg_get_function_identity_arguments(p.oid) = 'p_equipe_codigo character varying, p_senha_atual text, p_senha_nova text'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.alterar_senha_equipe(VARCHAR, TEXT, TEXT) TO anon, authenticated';
  END IF;
END $$;

COMMIT;
