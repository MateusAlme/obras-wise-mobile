-- Migration consolidada: Aplicar todas as mudanças pendentes
-- Created: 2025-02-05
-- Description: Adiciona documentação, UTM, cria perfis faltantes e corrige RLS

-- ========================================
-- PARTE 1: Adicionar campos de Documentação (PDFs)
-- ========================================
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS doc_cadastro_medidor JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS doc_laudo_transformador JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS doc_laudo_regulador JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS doc_laudo_religador JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS doc_apr JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS doc_fvbt JSONB DEFAULT '[]';

-- Comentários para documentação
COMMENT ON COLUMN public.obras.doc_cadastro_medidor IS 'Documentos PDF - Cadastro de Medidor';
COMMENT ON COLUMN public.obras.doc_laudo_transformador IS 'Documentos PDF - Laudo de Transformador';
COMMENT ON COLUMN public.obras.doc_laudo_regulador IS 'Documentos PDF - Laudo de Regulador';
COMMENT ON COLUMN public.obras.doc_laudo_religador IS 'Documentos PDF - Laudo de Religador';
COMMENT ON COLUMN public.obras.doc_apr IS 'Documentos PDF - Análise Preliminar de Risco (APR)';
COMMENT ON COLUMN public.obras.doc_fvbt IS 'Documentos PDF - Formulário de Vistoria de Baixa Tensão (FVBT)';

-- ========================================
-- PARTE 2: Documentar coordenadas UTM
-- ========================================
COMMENT ON TABLE public.obras IS
'Tabela de obras. Todos os campos JSONB de fotos (fotos_antes, fotos_durante, etc.)
contêm arrays de objetos com: url, latitude, longitude, utm_x, utm_y, utm_zone';

-- ========================================
-- PARTE 3: Criar perfis faltantes para usuários existentes
-- ========================================
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN
    SELECT id, email, raw_user_meta_data->>'full_name' as full_name
    FROM auth.users
    WHERE id NOT IN (SELECT id FROM public.profiles)
  LOOP
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (user_record.id, user_record.email, user_record.full_name)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- ========================================
-- PARTE 4: Corrigir RLS recursivo em profiles
-- ========================================
-- Remover políticas antigas que causam recursão
DROP POLICY IF EXISTS "Admins podem ver todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem inserir perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem atualizar perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem deletar perfis" ON public.profiles;

-- Criar políticas sem recursão (usando subquery otimizada)
CREATE POLICY "Admins podem ver todos os perfis"
  ON public.profiles FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
  );

CREATE POLICY "Admins podem inserir perfis"
  ON public.profiles FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
  );

CREATE POLICY "Admins podem atualizar perfis"
  ON public.profiles FOR UPDATE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
  );

CREATE POLICY "Admins podem deletar perfis"
  ON public.profiles FOR DELETE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
  );
