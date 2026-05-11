-- Migration: Corrigir RLS da tabela servicos para compressor
-- Problema: compressor só podia inserir tipo_servico = 'Cava em Rocha',
-- bloqueando criação de outros serviços (Book de Aterramento, etc.) e
-- impedindo o fetch de obras no sync offline.
-- Solução: permitir que compressor opere qualquer tipo de serviço em obras da
-- sua equipe (a restrição de visibilidade de obras permanece por equipe).
-- Data: 2026-05-06

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Atualizar política SELECT de obras para compressor:
--    Remove restrição de tipo_servico = 'Cava em Rocha' → compressor passa a ver
--    todas as obras da sua equipe (necessário para o sync buscar a obra corretamente)
-- ──────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS obras_select_policy ON public.obras;

CREATE POLICY obras_select_policy ON public.obras
FOR SELECT TO anon, authenticated
USING (
  (public.get_session_role() = 'admin')
  OR (public.get_session_role() IS NULL)
  OR (
    public.get_session_role() = 'compressor'
    AND public.get_session_equipe() IS NOT NULL
    AND equipe = public.get_session_equipe()
  )
  OR (
    public.get_session_role() = 'equipe'
    AND public.get_session_equipe() IS NOT NULL
    AND equipe = public.get_session_equipe()
  )
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Recriar política SELECT de servicos para compressor:
--    Remove restrição de tipo_servico = 'Cava em Rocha'
-- ──────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS servicos_select_policy ON public.servicos;

CREATE POLICY servicos_select_policy ON public.servicos
FOR SELECT TO anon, authenticated
USING (
  (public.get_session_role() = 'admin')
  OR (public.get_session_role() IS NULL)
  OR (
    public.get_session_role() IN ('equipe', 'compressor')
    AND public.get_session_equipe() IS NOT NULL
    AND obra_id IN (
      SELECT id FROM public.obras
      WHERE equipe = public.get_session_equipe()
    )
  )
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Recriar política INSERT de servicos para compressor:
--    Remove restrição de tipo_servico = 'Cava em Rocha'
-- ──────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS servicos_insert_policy ON public.servicos;

CREATE POLICY servicos_insert_policy ON public.servicos
FOR INSERT TO anon, authenticated
WITH CHECK (
  (public.get_session_role() = 'admin')
  OR (public.get_session_role() IS NULL)
  OR (
    public.get_session_role() IN ('equipe', 'compressor')
    AND public.get_session_equipe() IS NOT NULL
    AND obra_id IN (
      SELECT id FROM public.obras
      WHERE equipe = public.get_session_equipe()
    )
  )
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Recriar política UPDATE de servicos para compressor:
--    Remove restrição de tipo_servico = 'Cava em Rocha'
-- ──────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS servicos_update_policy ON public.servicos;

CREATE POLICY servicos_update_policy ON public.servicos
FOR UPDATE TO anon, authenticated
USING (
  (public.get_session_role() = 'admin')
  OR (public.get_session_role() IS NULL)
  OR (
    public.get_session_role() IN ('equipe', 'compressor')
    AND public.get_session_equipe() IS NOT NULL
    AND obra_id IN (
      SELECT id FROM public.obras
      WHERE equipe = public.get_session_equipe()
    )
  )
)
WITH CHECK (
  (public.get_session_role() = 'admin')
  OR (public.get_session_role() IS NULL)
  OR (
    public.get_session_role() IN ('equipe', 'compressor')
    AND public.get_session_equipe() IS NOT NULL
    AND obra_id IN (
      SELECT id FROM public.obras
      WHERE equipe = public.get_session_equipe()
    )
  )
);

COMMIT;
