-- Migration: Adicionar campo observacoes na tabela obras
-- Data: 2026-02-03
-- Descrição: Permite salvar observações gerais da obra (texto livre)

ALTER TABLE obras
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

COMMENT ON COLUMN obras.observacoes IS
'Observações gerais da obra (texto livre).';
