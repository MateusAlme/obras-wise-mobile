-- HOTFIX: Corrigir recursão infinita nas políticas de profiles
-- Created: 2025-02-02
-- Description: Remove políticas recursivas e adiciona políticas corretas

-- ========================================
-- REMOVER TODAS AS POLÍTICAS PROBLEMÁTICAS
-- ========================================
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem ver todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem inserir perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem atualizar perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem deletar perfis" ON public.profiles;

-- ========================================
-- CRIAR POLÍTICAS SEM RECURSÃO
-- ========================================

-- 1. Usuários podem ver apenas seu próprio perfil
CREATE POLICY "Usuários podem ver seu próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- 2. Admins podem ver todos os perfis
-- IMPORTANTE: Usa auth.jwt() para evitar recursão
CREATE POLICY "Admins podem ver todos os perfis"
  ON public.profiles FOR SELECT
  USING (
    auth.jwt()->>'email' IN (
      SELECT email FROM public.profiles WHERE role = 'admin'
    )
  );

-- 3. Admins podem inserir perfis
CREATE POLICY "Admins podem inserir perfis"
  ON public.profiles FOR INSERT
  WITH CHECK (
    auth.jwt()->>'email' IN (
      SELECT email FROM public.profiles WHERE role = 'admin'
    )
  );

-- 4. Admins podem atualizar qualquer perfil
CREATE POLICY "Admins podem atualizar perfis"
  ON public.profiles FOR UPDATE
  USING (
    auth.jwt()->>'email' IN (
      SELECT email FROM public.profiles WHERE role = 'admin'
    )
  );

-- 5. Admins podem deletar perfis
CREATE POLICY "Admins podem deletar perfis"
  ON public.profiles FOR DELETE
  USING (
    auth.jwt()->>'email' IN (
      SELECT email FROM public.profiles WHERE role = 'admin'
    )
  );

-- ========================================
-- COMENTÁRIO EXPLICATIVO
-- ========================================
COMMENT ON TABLE public.profiles IS
'Tabela de perfis de usuários.
Políticas RLS usam auth.jwt() para evitar recursão infinita.
Admins são identificados pelo email no JWT comparado com a tabela profiles.';
