-- ========================================
-- EXECUTAR NO SUPABASE DASHBOARD - SQL EDITOR
-- ========================================

-- PARTE 1: Adicionar colunas de Documentação
-- ========================================
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS doc_cadastro_medidor JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS doc_laudo_transformador JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS doc_laudo_regulador JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS doc_laudo_religador JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS doc_apr JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS doc_fvbt JSONB DEFAULT '[]';

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
-- PARTE 3: CORRIGIR RECURSÃO INFINITA NAS POLÍTICAS RLS
-- ========================================

-- Desabilitar RLS temporariamente
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem ver todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem inserir perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem atualizar perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem deletar perfis" ON public.profiles;

-- Reabilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Criar política simples para usuários verem seu próprio perfil
CREATE POLICY "Usuários podem ver seu próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- IMPORTANTE: Substitua 'seu-email-admin@exemplo.com' pelo email real do administrador
-- Se tiver múltiplos admins, adicione mais emails: ('admin1@example.com', 'admin2@example.com')

CREATE POLICY "Admins podem ver todos"
  ON public.profiles FOR SELECT
  USING ((auth.jwt()->>'email') IN ('seu-email-admin@exemplo.com'));

CREATE POLICY "Admins podem inserir"
  ON public.profiles FOR INSERT
  WITH CHECK ((auth.jwt()->>'email') IN ('seu-email-admin@exemplo.com'));

CREATE POLICY "Admins podem atualizar"
  ON public.profiles FOR UPDATE
  USING ((auth.jwt()->>'email') IN ('seu-email-admin@exemplo.com'));

CREATE POLICY "Admins podem deletar"
  ON public.profiles FOR DELETE
  USING ((auth.jwt()->>'email') IN ('seu-email-admin@exemplo.com'));

-- ========================================
-- PARTE 4: Criar perfis faltantes
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
-- FIM - Tudo aplicado com sucesso!
-- ========================================
