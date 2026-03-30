-- Migration: Corrigir search_path de todas as funções restantes
-- Data: 2026-03-30
-- Funções: get_header_equipe, get_header_role, sync_obra_status,
--          seed_turma_membros, is_admin, update_updated_at_column,
--          update_foto_completion_status, update_equipe_credenciais_updated_at,
--          get_header_session_token, handle_new_user

BEGIN;

-- Corrigir search_path em todas as funções flagadas de uma vez
-- O loop detecta a assinatura exata automaticamente (sem precisar hardcodar)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'get_header_equipe',
        'get_header_role',
        'get_header_session_token',
        'sync_obra_status',
        'seed_turma_membros',
        'is_admin',
        'update_updated_at_column',
        'update_foto_completion_status',
        'update_equipe_credenciais_updated_at',
        'handle_new_user',
        -- funções já corrigidas por migrations anteriores (não faz mal repetir)
        'criar_equipe_com_senha',
        'admin_resetar_senha_equipe',
        'alterar_senha_equipe',
        'calcular_fotos_pendentes',
        'criar_equipe',
        'admin_alterar_senha_equipe',
        'validar_login_equipe',
        'get_session_equipe',
        'get_session_role',
        'criar_admin_individual'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) SET search_path = public, extensions',
      r.proname,
      r.args
    );
    RAISE NOTICE 'Fixed search_path: public.%(%) ', r.proname, r.args;
  END LOOP;
END $$;

-- =====================================================
-- RLS Policy Always True: equipe_sessoes INSERT
-- A política atual permite que qualquer anon insira sessões.
-- Isso é necessário para o fluxo de login por equipe (antes de autenticar).
-- Melhorar: limitar a inserção para não abusar (ex: impedir campos inválidos)
-- =====================================================
-- Remover política antiga
DROP POLICY IF EXISTS equipe_sessoes_insert_policy ON equipe_sessoes;

-- Recriar com restrição mínima: equipe_codigo não pode ser nulo/vazio
CREATE POLICY equipe_sessoes_insert_policy
  ON equipe_sessoes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    equipe_codigo IS NOT NULL
    AND length(trim(equipe_codigo)) > 0
  );

COMMIT;
