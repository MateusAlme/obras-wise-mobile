-- Migration: Funções para Administrador Gerenciar Equipes
-- Data: 2025-02-26
-- Descrição: Funções para criar equipes e resetar senhas pelo admin

-- Garantir que a extensão pgcrypto está habilitada
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Função para criar equipe com senha (apenas admin)
CREATE OR REPLACE FUNCTION criar_equipe_com_senha(
  p_equipe_codigo VARCHAR(20),
  p_senha TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Inserir nova equipe com senha criptografada
  INSERT INTO equipe_credenciais (equipe_codigo, senha_hash, ativo)
  VALUES (
    UPPER(TRIM(p_equipe_codigo)),
    crypt(p_senha, gen_salt('bf')),
    true
  );

  RETURN true;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Equipe com código % já existe', p_equipe_codigo;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao criar equipe: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Função para administrador resetar senha de equipe
CREATE OR REPLACE FUNCTION admin_resetar_senha_equipe(
  p_equipe_codigo VARCHAR(20),
  p_senha_nova TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Atualizar senha da equipe (sem verificar senha antiga - admin override)
  UPDATE equipe_credenciais
  SET senha_hash = crypt(p_senha_nova, gen_salt('bf')),
      updated_at = NOW()
  WHERE equipe_codigo = UPPER(TRIM(p_equipe_codigo));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipe % não encontrada', p_equipe_codigo;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Comentários nas funções
COMMENT ON FUNCTION criar_equipe_com_senha(VARCHAR, TEXT) IS 'Cria uma nova equipe com código e senha - uso exclusivo do administrador';
COMMENT ON FUNCTION admin_resetar_senha_equipe(VARCHAR, TEXT) IS 'Permite ao administrador resetar a senha de uma equipe sem precisar da senha antiga';

-- 4. Grants de permissões
-- Apenas usuários autenticados (admin) podem executar essas funções
GRANT EXECUTE ON FUNCTION criar_equipe_com_senha(VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_resetar_senha_equipe(VARCHAR, TEXT) TO authenticated;
