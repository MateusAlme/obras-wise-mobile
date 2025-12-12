-- Migration: Adicionar coordenadas UTM aos objetos de fotos
-- Created: 2025-02-02
-- Description: Documenta a adição de campos utm_x, utm_y e utm_zone aos objetos JSON de fotos
--
-- IMPORTANTE: Esta migração é apenas documentação. Os campos JSONB existentes já suportam
-- os novos campos utm_x, utm_y e utm_zone nos objetos de fotos sem necessidade de alteração
-- de estrutura. Cada foto agora terá:
-- {
--   url: string,
--   latitude: number | null,
--   longitude: number | null,
--   utm_x: number | null,      -- Coordenada X no sistema UTM
--   utm_y: number | null,      -- Coordenada Y no sistema UTM
--   utm_zone: string | null    -- Zona UTM (ex: "23K")
-- }

-- Adicionar comentários para documentação
COMMENT ON TABLE public.obras IS
'Tabela de obras. Todos os campos JSONB de fotos (fotos_antes, fotos_durante, etc.)
contêm arrays de objetos com: url, latitude, longitude, utm_x, utm_y, utm_zone';

-- Exemplo de consulta para extrair coordenadas UTM de fotos:
-- SELECT
--   id,
--   obra,
--   jsonb_array_elements(fotos_antes) as foto,
--   (jsonb_array_elements(fotos_antes)->>'utm_x')::numeric as utm_x,
--   (jsonb_array_elements(fotos_antes)->>'utm_y')::numeric as utm_y,
--   jsonb_array_elements(fotos_antes)->>'utm_zone' as utm_zone
-- FROM obras
-- WHERE fotos_antes IS NOT NULL AND jsonb_array_length(fotos_antes) > 0;
