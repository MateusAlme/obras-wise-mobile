-- ============================================================
-- MIGRATION: Adicionar campos de fotos para DITAIS e BOOK ATERRAMENTO
-- Data: 2025-01-17
-- ============================================================

-- Adicionar novos campos de fotos JSONB à tabela obras
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_ditais_abertura JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_ditais_impedir JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_ditais_testar JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_ditais_aterrar JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_ditais_sinalizar JSONB DEFAULT '[]';

ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_aterramento_vala_aberta JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_aterramento_hastes JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_aterramento_vala_fechada JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_aterramento_medicao JSONB DEFAULT '[]';

-- Comentários explicativos
COMMENT ON COLUMN obras.fotos_ditais_abertura IS 'Fotos DITAIS - Abertura (serviço tipo DITAIS)';
COMMENT ON COLUMN obras.fotos_ditais_impedir IS 'Fotos DITAIS - Impedir (serviço tipo DITAIS)';
COMMENT ON COLUMN obras.fotos_ditais_testar IS 'Fotos DITAIS - Testar (serviço tipo DITAIS)';
COMMENT ON COLUMN obras.fotos_ditais_aterrar IS 'Fotos DITAIS - Aterrar (serviço tipo DITAIS)';
COMMENT ON COLUMN obras.fotos_ditais_sinalizar IS 'Fotos DITAIS - Sinalizar (serviço tipo DITAIS)';

COMMENT ON COLUMN obras.fotos_aterramento_vala_aberta IS 'Fotos BOOK ATERRAMENTO - Vala Aberta';
COMMENT ON COLUMN obras.fotos_aterramento_hastes IS 'Fotos BOOK ATERRAMENTO - Hastes Aplicadas';
COMMENT ON COLUMN obras.fotos_aterramento_vala_fechada IS 'Fotos BOOK ATERRAMENTO - Vala Fechada';
COMMENT ON COLUMN obras.fotos_aterramento_medicao IS 'Fotos BOOK ATERRAMENTO - Medição Terrômetro';

-- Verificação
DO $$
BEGIN
    RAISE NOTICE '✓ Campos de fotos DITAIS adicionados';
    RAISE NOTICE '✓ Campos de fotos BOOK ATERRAMENTO adicionados';
    RAISE NOTICE '✓ Total de novos campos: 9';
END $$;
