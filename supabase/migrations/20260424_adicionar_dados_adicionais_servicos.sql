-- Adiciona campo generico para metadados complementares de servicos
-- Ex.: referencia de poste (inicio/fim), identificador de emenda, observacoes
-- Data: 24/04/2026

BEGIN;

ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS dados_adicionais JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.servicos.dados_adicionais IS
  'Metadados textuais complementares do servico (referencias, identificadores, observacoes).';

COMMIT;
