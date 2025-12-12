-- Migration: Adicionar colunas de fotos para serviço Transformador
-- Created: 2025-01-26

-- Adicionar coluna para status do transformador (Instalado ou Retirado)
ALTER TABLE obras ADD COLUMN IF NOT EXISTS transformador_status VARCHAR(50);

-- Fotos para Transformador Instalado
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_transformador_laudo JSONB DEFAULT '[]'::jsonb;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_transformador_componente_instalado JSONB DEFAULT '[]'::jsonb;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_transformador_tombamento_instalado JSONB DEFAULT '[]'::jsonb;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_transformador_tape JSONB DEFAULT '[]'::jsonb;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_transformador_placa_instalado JSONB DEFAULT '[]'::jsonb;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_transformador_instalado JSONB DEFAULT '[]'::jsonb;

-- Fotos para Transformador Retirado
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_transformador_antes_retirar JSONB DEFAULT '[]'::jsonb;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_transformador_tombamento_retirado JSONB DEFAULT '[]'::jsonb;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_transformador_placa_retirado JSONB DEFAULT '[]'::jsonb;

-- Comentários para documentação
COMMENT ON COLUMN obras.transformador_status IS 'Status do transformador: Instalado ou Retirado';
COMMENT ON COLUMN obras.fotos_transformador_laudo IS 'Fotos do laudo do transformador (Instalado)';
COMMENT ON COLUMN obras.fotos_transformador_componente_instalado IS 'Fotos do componente instalado (Instalado)';
COMMENT ON COLUMN obras.fotos_transformador_tombamento_instalado IS 'Fotos do tombamento do transformador (Instalado)';
COMMENT ON COLUMN obras.fotos_transformador_tape IS 'Fotos do tape do transformador (Instalado)';
COMMENT ON COLUMN obras.fotos_transformador_placa_instalado IS 'Fotos da placa do transformador (Instalado)';
COMMENT ON COLUMN obras.fotos_transformador_instalado IS 'Fotos do transformador instalado - duas fotos (Instalado)';
COMMENT ON COLUMN obras.fotos_transformador_antes_retirar IS 'Fotos do transformador antes de ser retirado (Retirado)';
COMMENT ON COLUMN obras.fotos_transformador_tombamento_retirado IS 'Fotos do tombamento do transformador (Retirado)';
COMMENT ON COLUMN obras.fotos_transformador_placa_retirado IS 'Fotos da placa do transformador (Retirado)';
