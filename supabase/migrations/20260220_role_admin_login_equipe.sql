-- Migration: Suporte a role no login por equipe + sessao segura por token
-- Data: 2026-02-20
-- Objetivo:
-- 1) garantir coluna role em equipe_credenciais
-- 2) garantir credenciais ADMIN e perfis de compressor (COM-CZ e COM-PT)
-- 3) evoluir validar_login_equipe para emitir session_token

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Coluna role em equipe_credenciais
ALTER TABLE public.equipe_credenciais
ADD COLUMN IF NOT EXISTS role TEXT;

UPDATE public.equipe_credenciais
SET role = 'equipe'
WHERE role IS NULL OR btrim(role) = '';

ALTER TABLE public.equipe_credenciais
ALTER COLUMN role SET DEFAULT 'equipe';

ALTER TABLE public.equipe_credenciais
ALTER COLUMN role SET NOT NULL;

ALTER TABLE public.equipe_credenciais
DROP CONSTRAINT IF EXISTS equipe_credenciais_role_check;

ALTER TABLE public.equipe_credenciais
ADD CONSTRAINT equipe_credenciais_role_check
CHECK (role IN ('equipe', 'admin', 'compressor'));

CREATE INDEX IF NOT EXISTS idx_equipe_credenciais_role
ON public.equipe_credenciais(role);

-- 2) Garantir credenciais especiais
INSERT INTO public.equipe_credenciais (equipe_codigo, senha_hash, ativo, role)
VALUES ('ADMIN', crypt('Teccel2025', gen_salt('bf')), true, 'admin')
ON CONFLICT (equipe_codigo) DO UPDATE
SET role = 'admin', ativo = true, updated_at = NOW();

INSERT INTO public.equipe_credenciais (equipe_codigo, senha_hash, ativo, role)
VALUES ('COM-CZ', crypt('Teccel2025', gen_salt('bf')), true, 'compressor')
ON CONFLICT (equipe_codigo) DO UPDATE
SET role = 'compressor', ativo = true, updated_at = NOW();

INSERT INTO public.equipe_credenciais (equipe_codigo, senha_hash, ativo, role)
VALUES ('COM-PT', crypt('Teccel2025', gen_salt('bf')), true, 'compressor')
ON CONFLICT (equipe_codigo) DO UPDATE
SET role = 'compressor', ativo = true, updated_at = NOW();

-- 3) Estrutura de sessao segura por token
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

UPDATE public.equipe_sessoes
SET expires_at = COALESCE(expires_at, login_at + INTERVAL '30 days')
WHERE expires_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_equipe_sessoes_token_hash
ON public.equipe_sessoes(session_token_hash)
WHERE session_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_equipe_sessoes_validade
ON public.equipe_sessoes(equipe_codigo, ativo, expires_at);

-- 4) Atualizar funcao de login para retornar role + session_token
DROP FUNCTION IF EXISTS public.validar_login_equipe(VARCHAR, TEXT);

CREATE OR REPLACE FUNCTION public.validar_login_equipe(
  p_equipe_codigo VARCHAR(20),
  p_senha TEXT
)
RETURNS TABLE(
  valido BOOLEAN,
  equipe_id UUID,
  equipe_codigo VARCHAR(20),
  role TEXT,
  session_token TEXT,
  session_expires_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_equipe_id UUID;
  v_equipe_codigo VARCHAR(20);
  v_role TEXT;
  v_senha_hash TEXT;
  v_session_token TEXT;
  v_session_hash TEXT;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT ec.id, ec.equipe_codigo, ec.role, ec.senha_hash
    INTO v_equipe_id, v_equipe_codigo, v_role, v_senha_hash
  FROM public.equipe_credenciais ec
  WHERE ec.equipe_codigo = p_equipe_codigo
    AND ec.ativo = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT false, NULL::UUID, NULL::VARCHAR(20), NULL::TEXT, NULL::TEXT, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;

  IF v_senha_hash IS NULL OR v_senha_hash <> crypt(p_senha, v_senha_hash) THEN
    RETURN QUERY
    SELECT false, v_equipe_id, v_equipe_codigo, v_role, NULL::TEXT, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;

  v_session_token := encode(gen_random_bytes(32), 'hex');
  v_session_hash := encode(digest(v_session_token, 'sha256'), 'hex');
  v_expires_at := NOW() + INTERVAL '30 days';

  INSERT INTO public.equipe_sessoes (
    equipe_codigo,
    session_token_hash,
    login_at,
    ultimo_acesso,
    ativo,
    expires_at,
    revoked_at
  ) VALUES (
    v_equipe_codigo,
    v_session_hash,
    NOW(),
    NOW(),
    true,
    v_expires_at,
    NULL
  );

  RETURN QUERY
  SELECT true, v_equipe_id, v_equipe_codigo, v_role, v_session_token, v_expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.validar_login_equipe(VARCHAR, TEXT) TO anon, authenticated;

COMMIT;
