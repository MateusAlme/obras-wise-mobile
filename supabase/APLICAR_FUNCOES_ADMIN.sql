-- =====================================================
-- 🚀 EXECUTAR ESTE SQL NO DASHBOARD DO SUPABASE
-- =====================================================
--
-- Acesse: https://supabase.com/dashboard/project/SEU_PROJECT_ID/sql/new
-- Cole este SQL completo e clique em "RUN"
--
-- Funcionalidades:
-- ✅ criar_equipe() - Criar novas equipes pelo web
-- ✅ admin_alterar_senha_equipe() - Alterar senhas sem senha atual
-- ✅ listar_equipes_com_estatisticas() - Ver equipes com estatísticas
--
-- =====================================================

-- Função para criar nova equipe (para uso do admin web)
CREATE OR REPLACE FUNCTION criar_equipe(
  p_equipe_codigo VARCHAR(20),
  p_senha TEXT
)
RETURNS UUID AS $$
DECLARE
  v_equipe_id UUID;
BEGIN
  -- Verificar se a equipe já existe
  IF EXISTS (SELECT 1 FROM equipe_credenciais WHERE equipe_codigo = p_equipe_codigo) THEN
    RAISE EXCEPTION 'Equipe com código % já existe', p_equipe_codigo;
  END IF;

  -- Criar nova equipe
  INSERT INTO equipe_credenciais (equipe_codigo, senha_hash, ativo)
  VALUES (
    p_equipe_codigo,
    crypt(p_senha, gen_salt('bf')),
    true
  )
  RETURNING id INTO v_equipe_id;

  RETURN v_equipe_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para admin alterar senha de equipe (sem precisar da senha atual)
CREATE OR REPLACE FUNCTION admin_alterar_senha_equipe(
  p_equipe_codigo VARCHAR(20),
  p_senha_nova TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_affected INT;
BEGIN
  -- Atualizar senha
  UPDATE equipe_credenciais
  SET senha_hash = crypt(p_senha_nova, gen_salt('bf')),
      updated_at = NOW()
  WHERE equipe_codigo = p_equipe_codigo;

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  IF v_affected = 0 THEN
    RAISE EXCEPTION 'Equipe % não encontrada', p_equipe_codigo;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para listar todas as equipes (com contagem de obras)
CREATE OR REPLACE FUNCTION listar_equipes_com_estatisticas()
RETURNS TABLE(
  id UUID,
  equipe_codigo VARCHAR(20),
  ativo BOOLEAN,
  total_obras BIGINT,
  obras_ultima_semana BIGINT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ec.id,
    ec.equipe_codigo,
    ec.ativo,
    COUNT(DISTINCT o.id) AS total_obras,
    COUNT(DISTINCT o.id) FILTER (WHERE o.created_at >= NOW() - INTERVAL '7 days') AS obras_ultima_semana,
    ec.created_at,
    ec.updated_at
  FROM equipe_credenciais ec
  LEFT JOIN obras o ON o.equipe = ec.equipe_codigo
  GROUP BY ec.id, ec.equipe_codigo, ec.ativo, ec.created_at, ec.updated_at
  ORDER BY ec.equipe_codigo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON FUNCTION criar_equipe(VARCHAR, TEXT) IS 'Cria nova equipe com código e senha (uso do admin web)';
COMMENT ON FUNCTION admin_alterar_senha_equipe(VARCHAR, TEXT) IS 'Permite admin alterar senha de equipe sem precisar da senha atual';
COMMENT ON FUNCTION listar_equipes_com_estatisticas() IS 'Lista todas as equipes com estatísticas de obras criadas';

-- Grants de permissões
GRANT EXECUTE ON FUNCTION criar_equipe(VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_alterar_senha_equipe(VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION listar_equipes_com_estatisticas() TO authenticated;

-- =====================================================
-- ✅ Se executou sem erros, as funções foram criadas!
-- =====================================================
--
-- Agora você pode:
-- 1. Criar equipes pelo sistema web
-- 2. Alterar senhas de qualquer equipe
-- 3. Ativar/Inativar equipes
-- 4. Visualizar estatísticas de obras por equipe
--
-- =====================================================
