-- Corrigir função de criação de equipes para criar tanto na tabela equipes quanto equipe_credenciais
-- Antes: criava apenas em equipe_credenciais (login)
-- Depois: cria também em equipes (listagem)

CREATE OR REPLACE FUNCTION criar_equipe_com_senha(
  p_equipe_codigo VARCHAR(20),
  p_senha TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_equipe_codigo VARCHAR(20);
  v_tipo VARCHAR(10);
  v_nome VARCHAR(100);
BEGIN
  -- Normalizar código da equipe
  v_equipe_codigo := UPPER(TRIM(p_equipe_codigo));

  -- Determinar tipo baseado no prefixo
  IF v_equipe_codigo LIKE 'CNT%' THEN
    v_tipo := 'CNT';
    v_nome := 'Construção ' || SUBSTRING(v_equipe_codigo FROM 5);
  ELSIF v_equipe_codigo LIKE 'MNT%' THEN
    v_tipo := 'MNT';
    v_nome := 'Manutenção ' || SUBSTRING(v_equipe_codigo FROM 5);
  ELSIF v_equipe_codigo LIKE 'LV%' THEN
    v_tipo := 'LV';
    v_nome := 'Linha Viva ' || SUBSTRING(v_equipe_codigo FROM 4);
  ELSE
    -- Se não seguir padrão, usar tipo genérico
    v_tipo := 'CNT';
    v_nome := v_equipe_codigo;
  END IF;

  -- Inserir na tabela equipes (se não existir)
  INSERT INTO equipes (codigo, nome, tipo, ativa)
  VALUES (v_equipe_codigo, v_nome, v_tipo, true)
  ON CONFLICT (codigo) DO NOTHING;

  -- Inserir credenciais
  INSERT INTO equipe_credenciais (equipe_codigo, senha_hash, ativo)
  VALUES (
    v_equipe_codigo,
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

COMMENT ON FUNCTION criar_equipe_com_senha(VARCHAR, TEXT) IS
'Cria uma nova equipe com código e senha em ambas as tabelas (equipes e equipe_credenciais)';
