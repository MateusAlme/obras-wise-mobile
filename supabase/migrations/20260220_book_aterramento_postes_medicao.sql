-- Migration: Normalizar Book de Aterramento em postes_data com seção de medição
-- Data: 2026-02-20
-- Objetivo:
-- 1) Garantir que Book de Aterramento tenha estrutura de postes_data consistente
-- 2) Incluir chave fotos_medicao por poste (Medição Terrômetro)
-- 3) Migrar legados sem postes_data para 1 poste padrão, preservando fotos antigas

BEGIN;

-- 1) Para legados sem postes_data, criar estrutura mínima com 1 poste
UPDATE public.obras
SET postes_data = jsonb_build_array(
  jsonb_build_object(
    'id', 'P1',
    'numero', 1,
    'isAditivo', false,
    'fotos_antes',
      CASE
        WHEN jsonb_typeof(fotos_aterramento_vala_aberta) = 'array' THEN fotos_aterramento_vala_aberta
        ELSE '[]'::jsonb
      END,
    'fotos_durante',
      CASE
        WHEN jsonb_typeof(fotos_aterramento_hastes) = 'array' THEN fotos_aterramento_hastes
        ELSE '[]'::jsonb
      END,
    'fotos_depois',
      CASE
        WHEN jsonb_typeof(fotos_aterramento_vala_fechada) = 'array' THEN fotos_aterramento_vala_fechada
        ELSE '[]'::jsonb
      END,
    'fotos_medicao',
      CASE
        WHEN jsonb_typeof(fotos_aterramento_medicao) = 'array' THEN fotos_aterramento_medicao
        ELSE '[]'::jsonb
      END,
    'observacao', ''
  )
)
WHERE tipo_servico = 'Book de Aterramento'
  AND (
    postes_data IS NULL OR
    jsonb_typeof(postes_data) <> 'array' OR
    jsonb_array_length(
      CASE
        WHEN jsonb_typeof(postes_data) = 'array' THEN postes_data
        ELSE '[]'::jsonb
      END
    ) = 0
  )
  AND (
    jsonb_array_length(
      CASE
        WHEN jsonb_typeof(fotos_aterramento_vala_aberta) = 'array' THEN fotos_aterramento_vala_aberta
        ELSE '[]'::jsonb
      END
    ) > 0 OR
    jsonb_array_length(
      CASE
        WHEN jsonb_typeof(fotos_aterramento_hastes) = 'array' THEN fotos_aterramento_hastes
        ELSE '[]'::jsonb
      END
    ) > 0 OR
    jsonb_array_length(
      CASE
        WHEN jsonb_typeof(fotos_aterramento_vala_fechada) = 'array' THEN fotos_aterramento_vala_fechada
        ELSE '[]'::jsonb
      END
    ) > 0 OR
    jsonb_array_length(
      CASE
        WHEN jsonb_typeof(fotos_aterramento_medicao) = 'array' THEN fotos_aterramento_medicao
        ELSE '[]'::jsonb
      END
    ) > 0
  );

-- 2) Normalizar postes_data existentes: incluir fotos_medicao em todos os postes
WITH book_normalizado AS (
  SELECT
    o.id,
    COALESCE(
      jsonb_agg(
        (
          CASE
            WHEN jsonb_typeof(elem.poste) = 'object' THEN elem.poste
            ELSE '{}'::jsonb
          END
        ) || jsonb_build_object(
          'fotos_medicao',
          CASE
            WHEN jsonb_typeof(elem.poste->'fotos_medicao') = 'array' THEN elem.poste->'fotos_medicao'
            WHEN elem.ord = 1 AND jsonb_typeof(o.fotos_aterramento_medicao) = 'array' THEN o.fotos_aterramento_medicao
            ELSE '[]'::jsonb
          END
        )
        ORDER BY elem.ord
      ),
      '[]'::jsonb
    ) AS postes_data_normalizada
  FROM public.obras o
  LEFT JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(o.postes_data) = 'array' THEN o.postes_data
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS elem(poste, ord) ON true
  WHERE o.tipo_servico = 'Book de Aterramento'
  GROUP BY o.id, o.fotos_aterramento_medicao
)
UPDATE public.obras o
SET postes_data = bn.postes_data_normalizada
FROM book_normalizado bn
WHERE o.id = bn.id;

-- 3) Documentação da coluna para novo formato compartilhado
COMMENT ON COLUMN public.obras.postes_data IS
'Dados estruturados dos postes para serviços com múltiplos pontos (Linha Viva, Cava em Rocha, Book de Aterramento e Fundação Especial).
Formato base: [{"id":"P1","numero":1,"fotos_antes":[...],"fotos_durante":[...],"fotos_depois":[...],"observacao":""}]
Book de Aterramento também suporta: "fotos_medicao":[...].';

COMMIT;
