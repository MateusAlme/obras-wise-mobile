-- Corrigir recursão infinita nas políticas RLS da tabela profiles
-- O problema: as políticas tentam verificar se o usuário é admin consultando
-- a própria tabela profiles, o que cria um loop infinito

-- Remover políticas problemáticas
DROP POLICY IF EXISTS "Admins podem ver todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem inserir perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem atualizar perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem deletar perfis" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;

-- Criar função auxiliar para verificar se usuário é admin
-- Esta função usa SECURITY DEFINER para bypassar RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas simplificadas e sem recursão
-- Usuários podem ver seu próprio perfil
CREATE POLICY "Usuários podem ver seu próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins podem ver todos os perfis (usando função segura)
CREATE POLICY "Admins podem ver todos os perfis"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- Admins podem inserir perfis
CREATE POLICY "Admins podem inserir perfis"
  ON public.profiles FOR INSERT
  WITH CHECK (public.is_admin());

-- Usuários podem atualizar seu próprio perfil
CREATE POLICY "Usuários podem atualizar próprio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admins podem atualizar qualquer perfil
CREATE POLICY "Admins podem atualizar perfis"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

-- Admins podem deletar perfis
CREATE POLICY "Admins podem deletar perfis"
  ON public.profiles FOR DELETE
  USING (public.is_admin());
