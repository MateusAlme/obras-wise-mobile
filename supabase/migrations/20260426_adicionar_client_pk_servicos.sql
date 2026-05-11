-- Chave estável de cliente para idempotência na criação/sincronização de serviços
-- Evita duplicação de registros por retries/sync concorrente
-- Data: 26/04/2026

BEGIN;

ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS client_pk TEXT;

ALTER TABLE public.servicos
  ALTER COLUMN client_pk SET DEFAULT gen_random_uuid()::text;

UPDATE public.servicos
SET client_pk = id::text
WHERE client_pk IS NULL OR btrim(client_pk) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_servicos_client_pk_unique
  ON public.servicos (client_pk);

ALTER TABLE public.servicos
  ALTER COLUMN client_pk SET NOT NULL;

COMMENT ON COLUMN public.servicos.client_pk IS
  'Identificador estável gerado no cliente para idempotência de criação/sync offline.';

COMMIT;

