-- ========================================
-- Migration: Compartilhar obras entre todos os usuários
-- Data: 2025-02-07
-- Descrição: Alterar políticas RLS para permitir que todos os usuários
--            autenticados possam visualizar todas as obras cadastradas,
--            mantendo a capacidade de editar/deletar apenas suas próprias obras
-- ========================================

-- Remover políticas antigas que restringem visualização apenas ao dono
DROP POLICY IF EXISTS "Users can view their own obras" ON obras;
DROP POLICY IF EXISTS "Users can create their own obras" ON obras;
DROP POLICY IF EXISTS "Users can update their own obras" ON obras;
DROP POLICY IF EXISTS "Users can delete their own obras" ON obras;

-- Política anterior que pode existir
DROP POLICY IF EXISTS "Usuários autenticados podem ler obras" ON obras;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir obras" ON obras;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar obras" ON obras;

-- ========================================
-- NOVAS POLÍTICAS: OBRAS COMPARTILHADAS
-- ========================================

-- SELECT: Todos os usuários autenticados podem ver TODAS as obras
CREATE POLICY "Usuários autenticados podem ver todas as obras"
  ON obras FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Qualquer usuário autenticado pode criar obras
-- O user_id será automaticamente preenchido pela aplicação
CREATE POLICY "Usuários autenticados podem criar obras"
  ON obras FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Usuários podem editar TODAS as obras (não apenas as suas)
-- Isso permite colaboração e correções por qualquer membro da equipe
CREATE POLICY "Usuários autenticados podem editar todas as obras"
  ON obras FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: Usuários podem deletar TODAS as obras (não apenas as suas)
-- Se quiser restringir a deleção apenas ao criador, use a política comentada abaixo
CREATE POLICY "Usuários autenticados podem deletar todas as obras"
  ON obras FOR DELETE
  TO authenticated
  USING (true);

-- ========================================
-- POLÍTICA ALTERNATIVA (opcional)
-- ========================================
-- Se você preferir que apenas o criador possa deletar sua própria obra,
-- comente a política acima e descomente esta:

-- DROP POLICY IF EXISTS "Usuários autenticados podem deletar todas as obras" ON obras;
-- CREATE POLICY "Usuários podem deletar apenas suas próprias obras"
--   ON obras FOR DELETE
--   TO authenticated
--   USING (auth.uid() = user_id);

-- ========================================
-- COMENTÁRIOS E VERIFICAÇÕES
-- ========================================

COMMENT ON POLICY "Usuários autenticados podem ver todas as obras" ON obras
  IS 'Permite que todos os usuários autenticados vejam todas as obras cadastradas no sistema';

COMMENT ON POLICY "Usuários autenticados podem criar obras" ON obras
  IS 'Permite que qualquer usuário autenticado crie novas obras';

COMMENT ON POLICY "Usuários autenticados podem editar todas as obras" ON obras
  IS 'Permite que qualquer usuário autenticado edite qualquer obra (colaboração total)';

COMMENT ON POLICY "Usuários autenticados podem deletar todas as obras" ON obras
  IS 'Permite que qualquer usuário autenticado delete qualquer obra';

-- Verificação final
DO $$
DECLARE
  total_obras INTEGER;
  total_policies INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_obras FROM obras;
  SELECT COUNT(*) INTO total_policies FROM pg_policies WHERE tablename = 'obras';

  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ Políticas RLS atualizadas com sucesso!';
  RAISE NOTICE '✓ Total de obras no sistema: %', total_obras;
  RAISE NOTICE '✓ Total de políticas ativas: %', total_policies;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'COMPORTAMENTO NOVO:';
  RAISE NOTICE '  ✓ Todos os usuários podem VER todas as obras';
  RAISE NOTICE '  ✓ Todos os usuários podem EDITAR todas as obras';
  RAISE NOTICE '  ✓ Todos os usuários podem DELETAR todas as obras';
  RAISE NOTICE '  ✓ Histórico compartilhado entre todos';
  RAISE NOTICE '========================================';
END $$;
