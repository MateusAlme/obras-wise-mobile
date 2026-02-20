-- Migration: Padronizar Linha Viva em postes_data (multi-poste com fotos)
-- Data: 2026-02-20
-- Objetivo:
-- 1) Normalizar registros antigos de Linha Viva em formato de array JSONB
-- 2) Garantir estrutura compatível com múltiplos postes (antes/durante/depois)
-- 3) Atualizar documentação da coluna postes_data

BEGIN;

-- 1) Garantir array válido para Linha Viva
UPDATE public.obras
SET postes_data = '[]'::jsonb
WHERE tipo_servico = 'Linha Viva'
  AND (postes_data IS NULL OR jsonb_typeof(postes_data) <> 'array');

-- 2) Normalizar estrutura dos itens de postes_data para Linha Viva
WITH linha_viva_normalizada AS (
  SELECT
    o.id,
    COALESCE(
      jsonb_agg(
        (
          jsonb_build_object(
            'id',
            COALESCE(
              NULLIF(btrim(elem.poste->>'id'), ''),
              'P' || COALESCE(
                NULLIF(regexp_replace(COALESCE(elem.poste->>'numero', ''), '\D', '', 'g'), '')::int,
                elem.ord::int
              )::text
            ),
            'numero',
            COALESCE(
              NULLIF(
                regexp_replace(
                  COALESCE(elem.poste->>'numero', elem.poste->>'id', ''),
                  '\D',
                  '',
                  'g'
                ),
                ''
              )::int,
              elem.ord::int
            ),
            'fotos_antes',
            CASE
              WHEN jsonb_typeof(elem.poste->'fotos_antes') = 'array' THEN elem.poste->'fotos_antes'
              ELSE '[]'::jsonb
            END,
            'fotos_durante',
            CASE
              WHEN jsonb_typeof(elem.poste->'fotos_durante') = 'array' THEN elem.poste->'fotos_durante'
              ELSE '[]'::jsonb
            END,
            'fotos_depois',
            CASE
              WHEN jsonb_typeof(elem.poste->'fotos_depois') = 'array' THEN elem.poste->'fotos_depois'
              ELSE '[]'::jsonb
            END,
            'observacao',
            COALESCE(elem.poste->>'observacao', '')
          ) ||
          CASE
            WHEN jsonb_typeof(elem.poste) = 'object' AND elem.poste ? 'isAditivo'
              THEN jsonb_build_object('isAditivo', elem.poste->'isAditivo')
            ELSE '{}'::jsonb
          END
        )
        ORDER BY elem.ord
      ),
      '[]'::jsonb
    ) AS postes_data_normalizada
  FROM public.obras o
  LEFT JOIN LATERAL jsonb_array_elements(COALESCE(o.postes_data, '[]'::jsonb)) WITH ORDINALITY AS elem(poste, ord) ON true
  WHERE o.tipo_servico = 'Linha Viva'
  GROUP BY o.id
)
UPDATE public.obras o
SET postes_data = lvn.postes_data_normalizada
FROM linha_viva_normalizada lvn
WHERE o.id = lvn.id;

-- 3) Atualizar comentário para documentar o uso compartilhado de Cava e Linha Viva
COMMENT ON COLUMN public.obras.postes_data IS
'Dados estruturados dos postes para serviços com múltiplos pontos (Linha Viva e Cava em Rocha).
Formato: [{"id":"P1","numero":1,"fotos_antes":[...],"fotos_durante":[...],"fotos_depois":[...],"observacao":""}]';

COMMIT;
