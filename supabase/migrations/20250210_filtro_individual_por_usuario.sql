-- Migration: Alterar RLS para filtro individual por usuário
-- Data: 2025-02-10
-- Descrição:
-- Modificar políticas RLS para que usuários vejam apenas suas próprias obras
-- (ao invés de obras compartilhadas por equipe)

-- 1. Remover políticas baseadas em equipe
DROP POLICY IF EXISTS "Usuários podem ver obras da sua equipe" ON obras;
DROP POLICY IF EXISTS "Usuários podem criar obras para sua equipe" ON obras;
DROP POLICY IF EXISTS "Usuários podem atualizar obras da sua equipe" ON obras;
DROP POLICY IF EXISTS "Usuários podem deletar obras da sua equipe" ON obras;

-- 2. Criar políticas RLS baseadas em usuário individual
-- Apenas o usuário que criou a obra pode vê-la

-- Política para SELECT (visualização)
CREATE POLICY "Usuários podem ver suas próprias obras"
ON obras FOR SELECT
USING (auth.uid() = user_id);

-- Política para INSERT (criação)
CREATE POLICY "Usuários podem inserir suas próprias obras"
ON obras FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política para UPDATE (atualização)
CREATE POLICY "Usuários podem atualizar suas próprias obras"
ON obras FOR UPDATE
USING (auth.uid() = user_id);

-- Política para DELETE (exclusão)
CREATE POLICY "Usuários podem deletar suas próprias obras"
ON obras FOR DELETE
USING (auth.uid() = user_id);

COMMENT ON TABLE obras IS 'Tabela de obras com RLS individual por usuário - cada usuário vê apenas suas próprias obras';
