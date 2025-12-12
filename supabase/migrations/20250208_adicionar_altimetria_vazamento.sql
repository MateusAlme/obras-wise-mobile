-- Migration: Adicionar serviços Altimetria e Vazamento/Limpeza de Transformador + Termo de Desistência LPT
-- Data: 2025-02-08

-- 1. Adicionar campo para documento TERMO DE DESISTÊNCIA - LPT
ALTER TABLE obras ADD COLUMN IF NOT EXISTS doc_termo_desistencia_lpt JSONB DEFAULT '[]';

COMMENT ON COLUMN obras.doc_termo_desistencia_lpt IS 'Documentação - Termo de Desistência LPT (PDF)';

-- 2. Adicionar campos de fotos para o serviço ALTIMETRIA
-- Descrição das fotos: Lado Fonte, Medição Fonte, Lado Carga, Medição Carga

ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_altimetria_lado_fonte JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_altimetria_medicao_fonte JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_altimetria_lado_carga JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_altimetria_medicao_carga JSONB DEFAULT '[]';

COMMENT ON COLUMN obras.fotos_altimetria_lado_fonte IS 'Fotos Altimetria - Lado Fonte';
COMMENT ON COLUMN obras.fotos_altimetria_medicao_fonte IS 'Fotos Altimetria - Medição Fonte';
COMMENT ON COLUMN obras.fotos_altimetria_lado_carga IS 'Fotos Altimetria - Lado Carga';
COMMENT ON COLUMN obras.fotos_altimetria_medicao_carga IS 'Fotos Altimetria - Medição Carga';

-- 3. Adicionar campos de fotos para o serviço VAZAMENTO E LIMPEZA DE TRANSFORMADOR
-- Descrição das fotos:
-- - Evidência do Vazamento de óleo
-- - Foto c/ equipamentos de limpeza (contendo o óleo)
-- - Foto Tombamento do Transformador Retirado
-- - Foto da placa Transformador retirado
-- - Foto Tombamento do Transformador Instalado
-- - Foto da placa do transformador Instalado
-- - Foto da instalação do transformador

ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_vazamento_evidencia JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_vazamento_equipamentos_limpeza JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_vazamento_tombamento_retirado JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_vazamento_placa_retirado JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_vazamento_tombamento_instalado JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_vazamento_placa_instalado JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_vazamento_instalacao JSONB DEFAULT '[]';

COMMENT ON COLUMN obras.fotos_vazamento_evidencia IS 'Fotos Vazamento - Evidência do Vazamento de óleo';
COMMENT ON COLUMN obras.fotos_vazamento_equipamentos_limpeza IS 'Fotos Vazamento - Equipamentos de limpeza (contendo o óleo)';
COMMENT ON COLUMN obras.fotos_vazamento_tombamento_retirado IS 'Fotos Vazamento - Tombamento do Transformador Retirado';
COMMENT ON COLUMN obras.fotos_vazamento_placa_retirado IS 'Fotos Vazamento - Placa Transformador Retirado';
COMMENT ON COLUMN obras.fotos_vazamento_tombamento_instalado IS 'Fotos Vazamento - Tombamento do Transformador Instalado';
COMMENT ON COLUMN obras.fotos_vazamento_placa_instalado IS 'Fotos Vazamento - Placa do Transformador Instalado';
COMMENT ON COLUMN obras.fotos_vazamento_instalacao IS 'Fotos Vazamento - Instalação do Transformador';
