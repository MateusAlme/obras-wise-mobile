-- ========================================
-- Migration: Criar tabelas de equipes e usuários
-- Data: 2025-01-17
-- Descrição: Sistema de gestão de usuários por matrícula
-- ========================================

-- 1. CRIAR TABELA DE EQUIPES
CREATE TABLE IF NOT EXISTS equipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  nome VARCHAR(100) NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('CNT', 'MNT', 'LV')),
  descricao TEXT,
  ativa BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. CRIAR TABELA DE USUÁRIOS DO APP
CREATE TABLE IF NOT EXISTS usuarios_app (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  matricula VARCHAR(20) UNIQUE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  equipe_id UUID REFERENCES equipes(id) ON DELETE SET NULL,
  ativo BOOLEAN DEFAULT true NOT NULL,
  supabase_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. CRIAR ÍNDICES
CREATE INDEX IF NOT EXISTS idx_equipes_codigo ON equipes(codigo);
CREATE INDEX IF NOT EXISTS idx_equipes_tipo ON equipes(tipo);
CREATE INDEX IF NOT EXISTS idx_equipes_ativa ON equipes(ativa);

CREATE INDEX IF NOT EXISTS idx_usuarios_matricula ON usuarios_app(matricula);
CREATE INDEX IF NOT EXISTS idx_usuarios_equipe_id ON usuarios_app(equipe_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_supabase_id ON usuarios_app(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_ativo ON usuarios_app(ativo);

-- 4. POPULAR TABELA DE EQUIPES COM AS 18 EQUIPES EXISTENTES
INSERT INTO equipes (codigo, nome, tipo, descricao) VALUES
-- CNT - Construção
('CNT 01', 'Construção 01', 'CNT', 'Equipe de construção 01'),
('CNT 02', 'Construção 02', 'CNT', 'Equipe de construção 02'),
('CNT 03', 'Construção 03', 'CNT', 'Equipe de construção 03'),
('CNT 04', 'Construção 04', 'CNT', 'Equipe de construção 04'),
('CNT 06', 'Construção 06', 'CNT', 'Equipe de construção 06'),
('CNT 07', 'Construção 07', 'CNT', 'Equipe de construção 07'),
('CNT 10', 'Construção 10', 'CNT', 'Equipe de construção 10'),
('CNT 11', 'Construção 11', 'CNT', 'Equipe de construção 11'),
('CNT 12', 'Construção 12', 'CNT', 'Equipe de construção 12'),
-- MNT - Manutenção
('MNT 01', 'Manutenção 01', 'MNT', 'Equipe de manutenção 01'),
('MNT 02', 'Manutenção 02', 'MNT', 'Equipe de manutenção 02'),
('MNT 03', 'Manutenção 03', 'MNT', 'Equipe de manutenção 03'),
('MNT 04', 'Manutenção 04', 'MNT', 'Equipe de manutenção 04'),
('MNT 05', 'Manutenção 05', 'MNT', 'Equipe de manutenção 05'),
('MNT 06', 'Manutenção 06', 'MNT', 'Equipe de manutenção 06'),
-- LV - Linha Viva
('LV 01 CJZ', 'Linha Viva 01 Cajazeiras', 'LV', 'Equipe de linha viva em Cajazeiras'),
('LV 02 PTS', 'Linha Viva 02 Patos', 'LV', 'Equipe de linha viva em Patos'),
('LV 03 JR PTS', 'Linha Viva 03 João Pessoa', 'LV', 'Equipe de linha viva em João Pessoa')
ON CONFLICT (codigo) DO NOTHING;

-- 5. CRIAR TRIGGER PARA ATUALIZAR updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_equipes_updated_at ON equipes;
CREATE TRIGGER update_equipes_updated_at
  BEFORE UPDATE ON equipes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_usuarios_app_updated_at ON usuarios_app;
CREATE TRIGGER update_usuarios_app_updated_at
  BEFORE UPDATE ON usuarios_app
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. HABILITAR ROW LEVEL SECURITY
ALTER TABLE equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_app ENABLE ROW LEVEL SECURITY;

-- 7. CRIAR POLÍTICAS RLS

-- Equipes: Todos autenticados podem ler
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'equipes'
    AND policyname = 'Authenticated users can view equipes'
  ) THEN
    CREATE POLICY "Authenticated users can view equipes"
      ON equipes FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Usuários App: Podem ver apenas seu próprio registro
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'usuarios_app'
    AND policyname = 'Users can view their own profile'
  ) THEN
    CREATE POLICY "Users can view their own profile"
      ON usuarios_app FOR SELECT
      TO authenticated
      USING (supabase_user_id = auth.uid());
  END IF;
END $$;

-- Admin pode ver tudo (painel web usa service_role para gestão)
-- Não precisa criar policies para service_role pois bypassa RLS

-- 8. COMENTÁRIOS PARA DOCUMENTAÇÃO
COMMENT ON TABLE equipes IS 'Equipes de trabalho (CNT, MNT, LV)';
COMMENT ON TABLE usuarios_app IS 'Usuários do aplicativo mobile com matrícula';

COMMENT ON COLUMN equipes.codigo IS 'Código único da equipe (ex: CNT 01)';
COMMENT ON COLUMN equipes.tipo IS 'Tipo da equipe: CNT (Construção), MNT (Manutenção) ou LV (Linha Viva)';

COMMENT ON COLUMN usuarios_app.matricula IS 'Matrícula única do usuário (usada para login)';
COMMENT ON COLUMN usuarios_app.supabase_user_id IS 'Referência ao usuário no auth.users do Supabase';

-- 9. VERIFICAÇÃO FINAL
DO $$
DECLARE
  total_equipes INTEGER;
  total_usuarios INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_equipes FROM equipes;
  SELECT COUNT(*) INTO total_usuarios FROM usuarios_app;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ Migration executada com sucesso!';
  RAISE NOTICE '✓ Tabela equipes criada';
  RAISE NOTICE '✓ Tabela usuarios_app criada';
  RAISE NOTICE '✓ Total de equipes cadastradas: %', total_equipes;
  RAISE NOTICE '✓ Total de usuários: %', total_usuarios;
  RAISE NOTICE '✓ Índices criados';
  RAISE NOTICE '✓ Triggers criados';
  RAISE NOTICE '✓ RLS habilitado';
  RAISE NOTICE '========================================';
END $$;
