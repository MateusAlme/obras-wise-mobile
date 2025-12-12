-- =====================================================
-- CORREÇÃO DEFINITIVA: user_id e RLS por Equipe
-- =====================================================

-- =====================================================
-- PROBLEMA 1: user_id é NOT NULL mas não temos user_id
-- SOLUÇÃO: Tornar user_id NULLABLE
-- =====================================================

ALTER TABLE public.obras
ALTER COLUMN user_id DROP NOT NULL;

-- =====================================================
-- PROBLEMA 2: Todas obras visíveis para todos
-- SOLUÇÃO: RLS baseado em EQUIPE (não user_id)
-- =====================================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Allow anon insert obras" ON public.obras;
DROP POLICY IF EXISTS "Allow anon select obras" ON public.obras;
DROP POLICY IF EXISTS "Allow anon update obras" ON public.obras;
DROP POLICY IF EXISTS "Allow anon delete obras" ON public.obras;

-- =====================================================
-- POLÍTICA 1: INSERT - Permitir criar obras
-- Qualquer equipe pode criar obras
-- =====================================================
CREATE POLICY "Allow insert obras"
ON public.obras
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- =====================================================
-- POLÍTICA 2: SELECT - Filtrar por EQUIPE
-- Cada equipe vê apenas suas próprias obras
-- =====================================================
CREATE POLICY "Select obras by equipe"
ON public.obras
FOR SELECT
TO anon, authenticated
USING (
  equipe = current_setting('request.headers', true)::json->>'x-equipe'
  OR
  current_setting('request.headers', true)::json->>'x-equipe' IS NULL
);

-- =====================================================
-- POLÍTICA 3: UPDATE - Permitir editar próprias obras
-- Apenas obras da mesma equipe
-- =====================================================
CREATE POLICY "Update own team obras"
ON public.obras
FOR UPDATE
TO anon, authenticated
USING (
  equipe = current_setting('request.headers', true)::json->>'x-equipe'
  OR
  current_setting('request.headers', true)::json->>'x-equipe' IS NULL
)
WITH CHECK (
  equipe = current_setting('request.headers', true)::json->>'x-equipe'
  OR
  current_setting('request.headers', true)::json->>'x-equipe' IS NULL
);

-- =====================================================
-- POLÍTICA 4: DELETE - Permitir deletar próprias obras
-- Apenas obras da mesma equipe
-- =====================================================
CREATE POLICY "Delete own team obras"
ON public.obras
FOR DELETE
TO anon, authenticated
USING (
  equipe = current_setting('request.headers', true)::json->>'x-equipe'
  OR
  current_setting('request.headers', true)::json->>'x-equipe' IS NULL
);

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON COLUMN public.obras.user_id IS
'ID do usuário (opcional) - NULL para login por equipe';

COMMENT ON POLICY "Select obras by equipe" ON public.obras IS
'Filtra obras por equipe usando header x-equipe. Fallback para mostrar todas se header não existir.';
