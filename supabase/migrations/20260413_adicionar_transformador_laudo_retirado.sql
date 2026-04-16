-- Adicionar coluna fotos_transformador_laudo_retirado
-- Campo ausente que causava perda de fotos do laudo no fluxo de transformador retirado

ALTER TABLE obras
ADD COLUMN IF NOT EXISTS fotos_transformador_laudo_retirado JSONB DEFAULT '[]'::jsonb;
