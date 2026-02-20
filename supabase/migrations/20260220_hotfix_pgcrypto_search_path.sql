-- Hotfix: garantir acesso ao pgcrypto nas funcoes de login/sessao
-- Data: 2026-02-20

BEGIN;

-- Em projetos Supabase, funcoes de extensao costumam ficar em schema "extensions"
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Garantir que as funcoes SECURITY DEFINER consigam resolver crypt/digest
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'validar_login_equipe'
      AND pg_get_function_identity_arguments(p.oid) = 'p_equipe_codigo character varying, p_senha text'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.validar_login_equipe(VARCHAR, TEXT) SET search_path = public, extensions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_session_equipe'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE 'ALTER FUNCTION public.get_session_equipe() SET search_path = public, extensions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_session_role'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE 'ALTER FUNCTION public.get_session_role() SET search_path = public, extensions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'criar_admin_individual'
      AND pg_get_function_identity_arguments(p.oid) = 'p_nome_identificador text, p_prefixo text, p_senha text'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.criar_admin_individual(TEXT, TEXT, TEXT) SET search_path = public, extensions';
  END IF;
END $$;

COMMIT;
