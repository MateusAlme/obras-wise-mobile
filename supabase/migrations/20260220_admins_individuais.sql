-- Migration: Criar perfis admin individuais
-- Data: 2026-02-20
-- Objetivo: permitir multiplos admins com nomes identificaveis
-- Ex: Admin-Pereira, Coord-Joao, Sup-Maria
-- Todos com role='admin' podem lancar qualquer book e escolher equipe

BEGIN;

-- Em Supabase, pgcrypto costuma ficar no schema extensions
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Pre-requisito para ambientes onde role ainda nao foi criada
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

-- 1) Funcao para criar admin individual
CREATE OR REPLACE FUNCTION public.criar_admin_individual(
  p_nome_identificador TEXT,  -- Ex: 'Pereira', 'Silva', 'Joao'
  p_prefixo TEXT DEFAULT 'Admin',  -- Ex: 'Admin', 'Coord', 'Sup'
  p_senha TEXT DEFAULT 'Teccel2025'
)
RETURNS TABLE(
  sucesso BOOLEAN,
  equipe_codigo TEXT,
  mensagem TEXT
) AS $$
DECLARE
  v_prefixo TEXT;
  v_nome TEXT;
  v_codigo TEXT;
  v_senha_final TEXT;
BEGIN
  v_prefixo := regexp_replace(UPPER(COALESCE(btrim(p_prefixo), '')), '[^A-Z0-9]+', '-', 'g');
  v_nome := regexp_replace(UPPER(COALESCE(btrim(p_nome_identificador), '')), '[^A-Z0-9]+', '-', 'g');

  v_prefixo := regexp_replace(v_prefixo, '(^-+|-+$)', '', 'g');
  v_nome := regexp_replace(v_nome, '(^-+|-+$)', '', 'g');

  IF v_prefixo = '' OR v_nome = '' THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Prefixo e nome identificador sao obrigatorios.';
    RETURN;
  END IF;

  -- Codigo final: PREFIXO-NOME (ex: COORD-PEREIRA)
  v_codigo := v_prefixo || '-' || v_nome;

  -- Validar tamanho maximo (coluna equipe_codigo e VARCHAR(20))
  IF LENGTH(v_codigo) > 20 THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Codigo muito longo (max 20). Use nomes mais curtos.';
    RETURN;
  END IF;

  v_senha_final := COALESCE(NULLIF(btrim(p_senha), ''), 'Teccel2025');

  -- Inserir ou atualizar (nao sobrescreve senha de admin existente)
  -- SQL dinamico evita ambiguidade com variavel de saida "equipe_codigo" do RETURNS TABLE.
  EXECUTE $sql$
    INSERT INTO public.equipe_credenciais (equipe_codigo, senha_hash, ativo, role)
    VALUES ($1, extensions.crypt($2, extensions.gen_salt('bf')), true, 'admin')
    ON CONFLICT (equipe_codigo) DO UPDATE
    SET role = 'admin', ativo = true, updated_at = NOW()
  $sql$
  USING v_codigo, v_senha_final;

  RETURN QUERY SELECT true, v_codigo, 'Admin criado com sucesso: ' || v_codigo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.criar_admin_individual(TEXT, TEXT, TEXT) TO anon, authenticated;

-- 2) Criar alguns admins de exemplo (ajuste conforme necessario)
-- Coordenadores
SELECT * FROM criar_admin_individual('Pereira', 'Coord');
SELECT * FROM criar_admin_individual('Silva', 'Coord');

-- Supervisores
SELECT * FROM criar_admin_individual('Santos', 'Sup');

-- Voce pode criar mais usando:
-- SELECT * FROM criar_admin_individual('NomeDoUsuario', 'Prefixo', 'SenhaOpcional');

-- 3) Adicionar coluna para rastrear criador nas obras (se nao existir)
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS created_by_admin TEXT;

COMMENT ON COLUMN public.obras.created_by_admin IS
'Codigo do admin que criou/editou a obra (ex: COORD-PEREIRA, SUP-SANTOS)';

CREATE INDEX IF NOT EXISTS idx_obras_created_by_admin
ON public.obras(created_by_admin);

-- 4) Listar todos os admins criados
DO $$
DECLARE
  admin_count INTEGER;
  admin_list TEXT;
BEGIN
  SELECT COUNT(*), string_agg(equipe_codigo, ', ')
  INTO admin_count, admin_list
  FROM equipe_credenciais
  WHERE role = 'admin';

  RAISE NOTICE 'Total de admins: %. Lista: %', admin_count, admin_list;
END $$;

COMMIT;
