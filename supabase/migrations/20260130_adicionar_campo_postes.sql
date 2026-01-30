-- Migration: Adicionar campo postes_data para suporte a múltiplos postes
-- Data: 2026-01-30
-- Descrição: Permite armazenar dados estruturados de múltiplos postes com fotos antes/durante/depois

-- Adicionar campo para armazenar dados dos postes
ALTER TABLE obras ADD COLUMN IF NOT EXISTS postes_data JSONB DEFAULT '[]';

-- Índice para busca por postes (usando GIN para JSONB)
CREATE INDEX IF NOT EXISTS idx_obras_postes_data ON obras USING gin (postes_data);

-- Comentário explicativo
COMMENT ON COLUMN obras.postes_data IS
'Armazena array de postes com identificação padronizada (P1, P2, P3...) e fotos antes/durante/depois.
Estrutura: [{id: "P1", numero: 1, fotos_antes: [...], fotos_durante: [...], fotos_depois: [...], observacao: "..."}]';

-- Verificar integridade dos dados (garantir que é sempre um array)
ALTER TABLE obras ADD CONSTRAINT check_postes_data_is_array
  CHECK (jsonb_typeof(postes_data) = 'array' OR postes_data IS NULL);
