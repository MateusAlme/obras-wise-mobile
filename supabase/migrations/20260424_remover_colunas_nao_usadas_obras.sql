-- Remove colunas não utilizadas da tabela obras
-- Nenhuma delas é referenciada no código mobile ou web
-- Data: 24/04/2026

BEGIN;

ALTER TABLE public.obras
  DROP COLUMN IF EXISTS municipio,
  DROP COLUMN IF EXISTS estado,
  DROP COLUMN IF EXISTS coordenadas_lat,
  DROP COLUMN IF EXISTS coordenadas_lng,
  DROP COLUMN IF EXISTS data_previsao_termino,
  DROP COLUMN IF EXISTS data_termino,
  DROP COLUMN IF EXISTS orcamento_previsto,
  DROP COLUMN IF EXISTS valor_executado,
  DROP COLUMN IF EXISTS progresso;

COMMIT;
