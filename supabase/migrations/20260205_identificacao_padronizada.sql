-- =====================================================
-- Migration: Identificação Padronizada (Postes Aditivos e Numeração)
-- Data: 2026-02-05
-- Descrição: Adiciona suporte para:
--            - Postes aditivos (não previstos no croqui): AD-P1, AD-P2...
--            - Numeração automática de seccionamentos: S1, S2, S3...
--            - Numeração automática de aterramentos: A1, A2, A3...
-- =====================================================

-- NOTA: As colunas JSONB já existem (criadas pela migration anterior)
-- Esta migration apenas documenta o novo formato dos dados

-- 1. Formato atualizado para checklist_postes_data
COMMENT ON COLUMN public.obras.checklist_postes_data IS
'Dados estruturados dos postes no Checklist de Fiscalização. Formato JSON:
[{
  "id": "poste_1",
  "numero": "5",
  "status": "instalado" | "retirado" | "existente",
  "isAditivo": true | false,  // Se true, exibir como AD-P5 (poste aditivo)
  "posteInteiro": ["foto_id1", ...],
  "engaste": ["foto_id2", ...],    // Apenas para "instalado"
  "conexao1": [...],                // Para "instalado" e "existente"
  "conexao2": [...],                // Para "instalado" e "existente"
  "maiorEsforco": [...],            // Apenas para "instalado"
  "menorEsforco": [...]             // Apenas para "instalado"
}]

Status dos postes:
- "instalado": Poste novo instalado (requer: posteInteiro, engaste, conexao1, conexao2, maiorEsforco, menorEsforco)
- "retirado": Poste removido (requer: 2 fotos de posteInteiro)
- "existente": Poste já existente no local (requer: posteInteiro, conexao1, conexao2)

Prefixos de identificação:
- Postes normais: P5, P7, P12...
- Postes aditivos: AD-P5, AD-P7, AD-P12...
';

-- 2. Formato atualizado para checklist_seccionamentos_data
COMMENT ON COLUMN public.obras.checklist_seccionamentos_data IS
'Dados estruturados dos seccionamentos de cerca. Formato JSON:
[{
  "id": "seccionamento_1",
  "numero": 1,  // Número do seccionamento para exibição como S1, S2, S3...
  "fotos": ["foto_id1", "foto_id2", ...]
}]

Identificação padronizada: S1, S2, S3...
';

-- 3. Formato atualizado para checklist_aterramentos_cerca_data
COMMENT ON COLUMN public.obras.checklist_aterramentos_cerca_data IS
'Dados estruturados dos aterramentos de cerca. Formato JSON:
[{
  "id": "aterramento_1",
  "numero": 1,  // Número do aterramento para exibição como A1, A2, A3...
  "fotos": ["foto_id1", "foto_id2", ...]
}]

Identificação padronizada: A1, A2, A3...
';

-- 4. Verificação
DO $$
BEGIN
  RAISE NOTICE '✅ Migration aplicada com sucesso!';
  RAISE NOTICE '   Identificação Padronizada configurada:';
  RAISE NOTICE '   - Postes: P5 ou AD-P5 (aditivos)';
  RAISE NOTICE '   - Status dos postes: instalado, retirado, existente';
  RAISE NOTICE '   - Seccionamentos: S1, S2, S3...';
  RAISE NOTICE '   - Aterramentos: A1, A2, A3...';
END $$;
