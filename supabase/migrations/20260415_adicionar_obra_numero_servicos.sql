-- Adiciona obra_numero em servicos para consultas offline
-- sem precisar fazer JOIN com obras (que pode estar indisponível offline)
-- Data: 15/04/2026

BEGIN;

ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS obra_numero VARCHAR(20);

-- Preencher retroativamente com os dados existentes
UPDATE public.servicos s
SET obra_numero = o.obra
FROM public.obras o
WHERE s.obra_id = o.id
  AND s.obra_numero IS NULL;

-- Índice para buscas por número de obra
CREATE INDEX IF NOT EXISTS idx_servicos_obra_numero
  ON public.servicos(obra_numero);

COMMENT ON COLUMN servicos.obra_numero IS
  'Número da obra (redundante com obras.obra) para consultas offline sem JOIN.';

COMMIT;
