-- Migration: Corrigir RLS da tabela obras para login por equipe usando session token
-- Data: 2026-02-20
-- Objetivo:
-- 1) remover politicas antigas de obras
-- 2) criar helpers de sessao baseados em x-session-token
-- 3) aplicar RLS sem confiar em x-role/x-equipe enviados pelo cliente

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Pre-requisitos para evitar falha por ordem de execucao
ALTER TABLE public.equipe_credenciais
ADD COLUMN IF NOT EXISTS role TEXT;

UPDATE public.equipe_credenciais
SET role = 'equipe'
WHERE role IS NULL OR btrim(role) = '';

CREATE TABLE IF NOT EXISTS public.equipe_sessoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipe_codigo VARCHAR(20) NOT NULL,
  device_id TEXT,
  ip_address INET,
  user_agent TEXT,
  login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ultimo_acesso TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ativo BOOLEAN DEFAULT true
);

ALTER TABLE public.equipe_sessoes
ADD COLUMN IF NOT EXISTS session_token_hash TEXT;

ALTER TABLE public.equipe_sessoes
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.equipe_sessoes
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE;

-- 1) Remove todas as politicas atuais da tabela
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'obras'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.obras', p.policyname);
  END LOOP;
END $$;

ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

-- 2) Helpers de leitura de sessao
CREATE OR REPLACE FUNCTION public.get_header_session_token()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.headers', true)::jsonb ->> 'x-session-token',
    ''
  );
EXCEPTION WHEN OTHERS THEN
  RETURN '';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_session_equipe()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token TEXT;
  v_hash TEXT;
  v_equipe TEXT;
BEGIN
  v_token := public.get_header_session_token();

  IF v_token IS NULL OR btrim(v_token) = '' THEN
    RETURN NULL;
  END IF;

  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  SELECT es.equipe_codigo
    INTO v_equipe
  FROM public.equipe_sessoes es
  WHERE es.session_token_hash = v_hash
    AND es.ativo = true
    AND es.revoked_at IS NULL
    AND (es.expires_at IS NULL OR es.expires_at > NOW())
  ORDER BY COALESCE(es.ultimo_acesso, es.login_at) DESC
  LIMIT 1;

  RETURN v_equipe;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_session_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token TEXT;
  v_hash TEXT;
  v_role TEXT;
BEGIN
  v_token := public.get_header_session_token();

  IF v_token IS NULL OR btrim(v_token) = '' THEN
    RETURN NULL;
  END IF;

  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  SELECT ec.role
    INTO v_role
  FROM public.equipe_sessoes es
  JOIN public.equipe_credenciais ec
    ON ec.equipe_codigo = es.equipe_codigo
   AND ec.ativo = true
  WHERE es.session_token_hash = v_hash
    AND es.ativo = true
    AND es.revoked_at IS NULL
    AND (es.expires_at IS NULL OR es.expires_at > NOW())
  ORDER BY COALESCE(es.ultimo_acesso, es.login_at) DESC
  LIMIT 1;

  RETURN v_role;
END;
$$;

-- NOTA: Permissões das tabelas equipe_sessoes e equipe_credenciais são tratadas
-- na migração 20260220_fix_equipes_rls.sql

-- 3) Politicas RLS de obras
CREATE POLICY obras_select_policy ON public.obras
FOR SELECT TO anon, authenticated
USING (
  -- Admin com sessão válida pode ver tudo
  (public.get_session_role() = 'admin')
  -- Acesso sem sessão (dashboard web / ferramentas admin)
  OR (public.get_session_role() IS NULL)
  -- Compressor só vê Cava em Rocha da sua equipe
  OR (
    public.get_session_role() = 'compressor'
    AND tipo_servico = 'Cava em Rocha'
    AND equipe = public.get_session_equipe()
    AND public.get_session_equipe() IS NOT NULL
  )
  -- Equipe vê obras da sua equipe
  OR (
    public.get_session_role() = 'equipe'
    AND equipe = public.get_session_equipe()
    AND public.get_session_equipe() IS NOT NULL
  )
);

CREATE POLICY obras_insert_policy ON public.obras
FOR INSERT TO anon, authenticated
WITH CHECK (
  -- Admin com sessão válida pode inserir qualquer obra
  (public.get_session_role() = 'admin')
  -- Acesso sem sessão (dashboard web / ferramentas admin)
  OR (public.get_session_role() IS NULL)
  -- Compressor só pode inserir Cava em Rocha
  OR (
    public.get_session_role() = 'compressor'
    AND tipo_servico = 'Cava em Rocha'
    AND equipe = public.get_session_equipe()
    AND public.get_session_equipe() IS NOT NULL
  )
  -- Equipe pode inserir obras da sua equipe
  OR (
    public.get_session_role() = 'equipe'
    AND equipe = public.get_session_equipe()
    AND public.get_session_equipe() IS NOT NULL
  )
);

CREATE POLICY obras_update_policy ON public.obras
FOR UPDATE TO anon, authenticated
USING (
  (public.get_session_role() = 'admin')
  OR (public.get_session_role() IS NULL)
  OR (
    public.get_session_role() = 'compressor'
    AND tipo_servico = 'Cava em Rocha'
    AND equipe = public.get_session_equipe()
    AND public.get_session_equipe() IS NOT NULL
  )
  OR (
    public.get_session_role() = 'equipe'
    AND equipe = public.get_session_equipe()
    AND public.get_session_equipe() IS NOT NULL
  )
)
WITH CHECK (
  (public.get_session_role() = 'admin')
  OR (public.get_session_role() IS NULL)
  OR (
    public.get_session_role() = 'compressor'
    AND tipo_servico = 'Cava em Rocha'
    AND equipe = public.get_session_equipe()
    AND public.get_session_equipe() IS NOT NULL
  )
  OR (
    public.get_session_role() = 'equipe'
    AND equipe = public.get_session_equipe()
    AND public.get_session_equipe() IS NOT NULL
  )
);

CREATE POLICY obras_delete_policy ON public.obras
FOR DELETE TO anon, authenticated
USING (
  public.get_session_role() = 'admin'
  OR public.get_session_role() IS NULL
);

GRANT EXECUTE ON FUNCTION public.get_header_session_token() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_session_equipe() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_session_role() TO anon, authenticated;

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'obras' AND schemaname = 'public';

  RAISE NOTICE 'Politicas RLS da tabela obras: % politicas ativas', policy_count;
END $$;

COMMIT;
