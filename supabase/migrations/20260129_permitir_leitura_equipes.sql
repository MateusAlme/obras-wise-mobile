-- Permitir leitura pública das equipes ativas
-- Necessário para o app mobile carregar a lista de equipes no login

-- Habilitar RLS na tabela equipes (se ainda não estiver)
ALTER TABLE equipes ENABLE ROW LEVEL SECURITY;

-- Remover política antiga se existir
DROP POLICY IF EXISTS "Permitir leitura de equipes ativas" ON equipes;

-- Criar política que permite leitura de equipes ativas por qualquer pessoa
CREATE POLICY "Permitir leitura de equipes ativas"
ON equipes
FOR SELECT
TO anon, authenticated
USING (ativa = true);

-- Comentário explicativo
COMMENT ON POLICY "Permitir leitura de equipes ativas" ON equipes IS
'Permite que usuários não autenticados vejam equipes ativas para seleção no login do app mobile';
