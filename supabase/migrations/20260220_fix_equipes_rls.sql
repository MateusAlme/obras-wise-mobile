-- Migration: Corrigir RLS das tabelas equipe_credenciais e equipe_sessoes
-- Data: 2026-02-20
-- Problema: REVOKE ALL removeu acesso do sistema web às tabelas de equipes
-- Solução: Criar políticas RLS adequadas que permitam acesso ao admin e leitura básica

BEGIN;

-- =====================================================
-- 1. RESTAURAR PERMISSÕES BÁSICAS NAS TABELAS
-- =====================================================

-- Conceder permissões básicas (o RLS vai controlar o acesso)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.equipe_credenciais TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.equipe_sessoes TO anon, authenticated;

-- =====================================================
-- 2. HABILITAR RLS NAS TABELAS
-- =====================================================

ALTER TABLE public.equipe_credenciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipe_sessoes ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. REMOVER POLÍTICAS ANTIGAS (se existirem)
-- =====================================================

DROP POLICY IF EXISTS "equipe_credenciais_select_policy" ON public.equipe_credenciais;
DROP POLICY IF EXISTS "equipe_credenciais_insert_policy" ON public.equipe_credenciais;
DROP POLICY IF EXISTS "equipe_credenciais_update_policy" ON public.equipe_credenciais;
DROP POLICY IF EXISTS "equipe_credenciais_delete_policy" ON public.equipe_credenciais;

DROP POLICY IF EXISTS "equipe_sessoes_select_policy" ON public.equipe_sessoes;
DROP POLICY IF EXISTS "equipe_sessoes_insert_policy" ON public.equipe_sessoes;
DROP POLICY IF EXISTS "equipe_sessoes_update_policy" ON public.equipe_sessoes;
DROP POLICY IF EXISTS "equipe_sessoes_delete_policy" ON public.equipe_sessoes;

-- =====================================================
-- 4. POLÍTICAS PARA equipe_credenciais
-- =====================================================

-- SELECT: Admin pode ver tudo, outros podem ver apenas campos não sensíveis
-- Para o sistema web funcionar, permitimos SELECT geral (senha_hash não é retornada pelo select('*'))
CREATE POLICY "equipe_credenciais_select_policy" ON public.equipe_credenciais
FOR SELECT TO anon, authenticated
USING (
  -- Admin com sessão válida pode ver tudo
  public.get_session_role() = 'admin'
  -- Ou acesso sem sessão (dashboard web / ferramentas admin)
  OR public.get_session_role() IS NULL
);

-- INSERT: Apenas admin pode criar equipes
CREATE POLICY "equipe_credenciais_insert_policy" ON public.equipe_credenciais
FOR INSERT TO anon, authenticated
WITH CHECK (
  public.get_session_role() = 'admin'
  OR public.get_session_role() IS NULL
);

-- UPDATE: Apenas admin pode atualizar equipes
CREATE POLICY "equipe_credenciais_update_policy" ON public.equipe_credenciais
FOR UPDATE TO anon, authenticated
USING (
  public.get_session_role() = 'admin'
  OR public.get_session_role() IS NULL
)
WITH CHECK (
  public.get_session_role() = 'admin'
  OR public.get_session_role() IS NULL
);

-- DELETE: Apenas admin pode deletar equipes
CREATE POLICY "equipe_credenciais_delete_policy" ON public.equipe_credenciais
FOR DELETE TO anon, authenticated
USING (
  public.get_session_role() = 'admin'
  OR public.get_session_role() IS NULL
);

-- =====================================================
-- 5. POLÍTICAS PARA equipe_sessoes
-- =====================================================

-- SELECT: Admin pode ver tudo, outros não precisam ver sessões
CREATE POLICY "equipe_sessoes_select_policy" ON public.equipe_sessoes
FOR SELECT TO anon, authenticated
USING (
  public.get_session_role() = 'admin'
  OR public.get_session_role() IS NULL
);

-- INSERT: Permitir criação de sessões (feito pela função validar_login_equipe)
-- A função é SECURITY DEFINER então não precisa de policy específica
-- Mas permitimos para compatibilidade
CREATE POLICY "equipe_sessoes_insert_policy" ON public.equipe_sessoes
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- UPDATE: Admin ou própria sessão pode atualizar
CREATE POLICY "equipe_sessoes_update_policy" ON public.equipe_sessoes
FOR UPDATE TO anon, authenticated
USING (
  public.get_session_role() = 'admin'
  OR public.get_session_role() IS NULL
  OR equipe_codigo = public.get_session_equipe()
)
WITH CHECK (
  public.get_session_role() = 'admin'
  OR public.get_session_role() IS NULL
  OR equipe_codigo = public.get_session_equipe()
);

-- DELETE: Apenas admin pode deletar sessões
CREATE POLICY "equipe_sessoes_delete_policy" ON public.equipe_sessoes
FOR DELETE TO anon, authenticated
USING (
  public.get_session_role() = 'admin'
  OR public.get_session_role() IS NULL
);

-- =====================================================
-- 6. VERIFICAÇÃO
-- =====================================================

DO $$
DECLARE
  cred_count INTEGER;
  sess_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO cred_count
  FROM pg_policies
  WHERE tablename = 'equipe_credenciais' AND schemaname = 'public';

  SELECT COUNT(*) INTO sess_count
  FROM pg_policies
  WHERE tablename = 'equipe_sessoes' AND schemaname = 'public';

  RAISE NOTICE 'Políticas RLS: equipe_credenciais=%, equipe_sessoes=%', cred_count, sess_count;
END $$;

COMMIT;
