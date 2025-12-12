-- Migration: Sistema de Login por Equipe
-- Data: 2025-02-11
-- Descrição:
-- Implementar sistema de autenticação onde cada equipe tem usuário e senha
-- Exemplo: CNT 01 / senha: Teccel2025

-- 1. Criar tabela de credenciais de equipes
CREATE TABLE IF NOT EXISTS equipe_credenciais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipe_codigo VARCHAR(20) NOT NULL UNIQUE, -- Ex: 'CNT 01', 'MNT 02'
  senha_hash TEXT NOT NULL, -- Senha criptografada
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar índice para busca rápida por equipe
CREATE INDEX IF NOT EXISTS idx_equipe_credenciais_codigo ON equipe_credenciais(equipe_codigo);
CREATE INDEX IF NOT EXISTS idx_equipe_credenciais_ativo ON equipe_credenciais(ativo);

-- 3. Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_equipe_credenciais_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar trigger para atualizar updated_at
DROP TRIGGER IF EXISTS trigger_equipe_credenciais_updated_at ON equipe_credenciais;
CREATE TRIGGER trigger_equipe_credenciais_updated_at
  BEFORE UPDATE ON equipe_credenciais
  FOR EACH ROW
  EXECUTE FUNCTION update_equipe_credenciais_updated_at();

-- 5. Inserir credenciais padrão para todas as equipes
-- Senha padrão: Teccel2025 (hash usando crypt do pgcrypto)
-- IMPORTANTE: Em produção, altere essas senhas!

-- Habilitar extensão pgcrypto se ainda não estiver
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Inserir equipes CNT (Construção)
INSERT INTO equipe_credenciais (equipe_codigo, senha_hash) VALUES
  ('CNT 01', crypt('Teccel2025', gen_salt('bf'))),
  ('CNT 02', crypt('Teccel2025', gen_salt('bf'))),
  ('CNT 03', crypt('Teccel2025', gen_salt('bf'))),
  ('CNT 04', crypt('Teccel2025', gen_salt('bf'))),
  ('CNT 06', crypt('Teccel2025', gen_salt('bf'))),
  ('CNT 07', crypt('Teccel2025', gen_salt('bf'))),
  ('CNT 10', crypt('Teccel2025', gen_salt('bf'))),
  ('CNT 11', crypt('Teccel2025', gen_salt('bf'))),
  ('CNT 12', crypt('Teccel2025', gen_salt('bf')))
ON CONFLICT (equipe_codigo) DO NOTHING;

-- Inserir equipes MNT (Manutenção)
INSERT INTO equipe_credenciais (equipe_codigo, senha_hash) VALUES
  ('MNT 01', crypt('Teccel2025', gen_salt('bf'))),
  ('MNT 02', crypt('Teccel2025', gen_salt('bf'))),
  ('MNT 03', crypt('Teccel2025', gen_salt('bf'))),
  ('MNT 04', crypt('Teccel2025', gen_salt('bf'))),
  ('MNT 05', crypt('Teccel2025', gen_salt('bf'))),
  ('MNT 06', crypt('Teccel2025', gen_salt('bf')))
ON CONFLICT (equipe_codigo) DO NOTHING;

-- Inserir equipes LV (Linha Viva)
INSERT INTO equipe_credenciais (equipe_codigo, senha_hash) VALUES
  ('LV 01 CJZ', crypt('Teccel2025', gen_salt('bf'))),
  ('LV 02 PTS', crypt('Teccel2025', gen_salt('bf'))),
  ('LV 03 JR PTS', crypt('Teccel2025', gen_salt('bf')))
ON CONFLICT (equipe_codigo) DO NOTHING;

-- 6. Criar função para validar login de equipe
CREATE OR REPLACE FUNCTION validar_login_equipe(
  p_equipe_codigo VARCHAR(20),
  p_senha TEXT
)
RETURNS TABLE(
  valido BOOLEAN,
  equipe_id UUID,
  equipe_codigo VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (ec.senha_hash = crypt(p_senha, ec.senha_hash)) AS valido,
    ec.id AS equipe_id,
    ec.equipe_codigo
  FROM equipe_credenciais ec
  WHERE ec.equipe_codigo = p_equipe_codigo
    AND ec.ativo = true
  LIMIT 1;

  -- Se não encontrou a equipe, retorna inválido
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::VARCHAR(20);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Criar função para alterar senha de equipe
CREATE OR REPLACE FUNCTION alterar_senha_equipe(
  p_equipe_codigo VARCHAR(20),
  p_senha_atual TEXT,
  p_senha_nova TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_senha_correta BOOLEAN;
BEGIN
  -- Verificar se a senha atual está correta
  SELECT (senha_hash = crypt(p_senha_atual, senha_hash))
  INTO v_senha_correta
  FROM equipe_credenciais
  WHERE equipe_codigo = p_equipe_codigo AND ativo = true;

  IF NOT v_senha_correta THEN
    RETURN false;
  END IF;

  -- Atualizar para a nova senha
  UPDATE equipe_credenciais
  SET senha_hash = crypt(p_senha_nova, gen_salt('bf'))
  WHERE equipe_codigo = p_equipe_codigo AND ativo = true;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Criar tabela de sessões de login (para rastrear quem está logado)
CREATE TABLE IF NOT EXISTS equipe_sessoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipe_codigo VARCHAR(20) NOT NULL,
  device_id TEXT, -- ID do dispositivo (para mobile)
  ip_address INET,
  user_agent TEXT,
  login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ultimo_acesso TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ativo BOOLEAN DEFAULT true
);

-- Índices para sessões
CREATE INDEX IF NOT EXISTS idx_equipe_sessoes_equipe ON equipe_sessoes(equipe_codigo);
CREATE INDEX IF NOT EXISTS idx_equipe_sessoes_ativo ON equipe_sessoes(ativo);
CREATE INDEX IF NOT EXISTS idx_equipe_sessoes_device ON equipe_sessoes(device_id);

-- 9. Comentários nas tabelas
COMMENT ON TABLE equipe_credenciais IS 'Credenciais de login por equipe - cada equipe tem usuário e senha';
COMMENT ON TABLE equipe_sessoes IS 'Sessões ativas de login das equipes';
COMMENT ON COLUMN equipe_credenciais.equipe_codigo IS 'Código da equipe usado como nome de usuário (ex: CNT 01)';
COMMENT ON COLUMN equipe_credenciais.senha_hash IS 'Senha criptografada usando bcrypt';

-- 10. Grants de permissões (se necessário)
-- As funções são SECURITY DEFINER, então executam com permissões do criador
GRANT EXECUTE ON FUNCTION validar_login_equipe(VARCHAR, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION alterar_senha_equipe(VARCHAR, TEXT, TEXT) TO authenticated;
