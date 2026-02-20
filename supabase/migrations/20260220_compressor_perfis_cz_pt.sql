-- Migration: Ajustar perfis de compressor para COM-CZ e COM-PT
-- Data: 2026-02-20
-- Objetivo:
-- 1) Garantir credenciais COM-CZ e COM-PT com role='compressor'
-- 2) Reaproveitar senha do COMP legado (quando existir)
-- 3) Desativar COMP legado para evitar uso do perfil genérico

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  v_hash_legado TEXT;
BEGIN
  SELECT ec.senha_hash
    INTO v_hash_legado
  FROM public.equipe_credenciais ec
  WHERE ec.equipe_codigo = 'COMP'
    AND ec.role = 'compressor'
  ORDER BY ec.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_hash_legado IS NULL OR btrim(v_hash_legado) = '' THEN
    v_hash_legado := extensions.crypt('Teccel2025', extensions.gen_salt('bf'));
  END IF;

  INSERT INTO public.equipe_credenciais (equipe_codigo, senha_hash, ativo, role)
  VALUES ('COM-CZ', v_hash_legado, true, 'compressor')
  ON CONFLICT (equipe_codigo) DO UPDATE
  SET role = 'compressor', ativo = true, updated_at = NOW();

  INSERT INTO public.equipe_credenciais (equipe_codigo, senha_hash, ativo, role)
  VALUES ('COM-PT', v_hash_legado, true, 'compressor')
  ON CONFLICT (equipe_codigo) DO UPDATE
  SET role = 'compressor', ativo = true, updated_at = NOW();

  UPDATE public.equipe_credenciais
  SET ativo = false,
      updated_at = NOW()
  WHERE equipe_codigo = 'COMP'
    AND role = 'compressor';
END $$;

COMMIT;