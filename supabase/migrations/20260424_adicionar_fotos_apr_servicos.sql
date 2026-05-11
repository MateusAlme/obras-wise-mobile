-- Adiciona colunas faltantes à tabela servicos
-- fotos_apr: definida no TypeScript mas esquecida na criação da tabela
-- fotos_impedimento: novo serviço "Registro de Impedimento" (impedimentos atípicos no início da obra)
-- Data: 24/04/2026

BEGIN;

ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS fotos_apr JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fotos_impedimento JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN servicos.fotos_apr IS
  'Fotos do serviço APR (Análise Preliminar de Riscos). Sem limite, adicionadas diariamente.';

COMMENT ON COLUMN servicos.fotos_impedimento IS
  'Fotos de evidências do impedimento (acesso ruim, área bloqueada, etc.) — serviço Registro de Impedimento.';

COMMIT;
