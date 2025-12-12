-- ============================================================================
-- SCRIPT CONSOLIDADO PARA EXECUTAR NO SUPABASE DASHBOARD (SQL Editor)
-- ============================================================================
-- Data: 2025-02-09
-- Descrição: Adiciona serviços Altimetria, Vazamento, Termo LPT e
--            implementa melhorias de visualização por equipe e status
-- ============================================================================

-- IMPORTANTE: Execute este script no Supabase Dashboard > SQL Editor
-- URL: https://supabase.com/dashboard/project/SEU_PROJECT/sql

BEGIN;

-- ============================================================================
-- PARTE 1: ADICIONAR NOVOS SERVIÇOS E DOCUMENTO
-- ============================================================================

-- 1. Adicionar campo para documento TERMO DE DESISTÊNCIA - LPT
ALTER TABLE obras ADD COLUMN IF NOT EXISTS doc_termo_desistencia_lpt JSONB DEFAULT '[]';

COMMENT ON COLUMN obras.doc_termo_desistencia_lpt IS 'Documentação - Termo de Desistência LPT (PDF)';

-- 2. Adicionar campos de fotos para o serviço ALTIMETRIA
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_altimetria_lado_fonte JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_altimetria_medicao_fonte JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_altimetria_lado_carga JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_altimetria_medicao_carga JSONB DEFAULT '[]';

COMMENT ON COLUMN obras.fotos_altimetria_lado_fonte IS 'Fotos Altimetria - Lado Fonte';
COMMENT ON COLUMN obras.fotos_altimetria_medicao_fonte IS 'Fotos Altimetria - Medição Fonte';
COMMENT ON COLUMN obras.fotos_altimetria_lado_carga IS 'Fotos Altimetria - Lado Carga';
COMMENT ON COLUMN obras.fotos_altimetria_medicao_carga IS 'Fotos Altimetria - Medição Carga';

-- 3. Adicionar campos de fotos para o serviço VAZAMENTO E LIMPEZA DE TRANSFORMADOR
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_vazamento_evidencia JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_vazamento_equipamentos_limpeza JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_vazamento_tombamento_retirado JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_vazamento_placa_retirado JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_vazamento_tombamento_instalado JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_vazamento_placa_instalado JSONB DEFAULT '[]';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fotos_vazamento_instalacao JSONB DEFAULT '[]';

COMMENT ON COLUMN obras.fotos_vazamento_evidencia IS 'Fotos Vazamento - Evidência do Vazamento de óleo';
COMMENT ON COLUMN obras.fotos_vazamento_equipamentos_limpeza IS 'Fotos Vazamento - Equipamentos de limpeza (contendo o óleo)';
COMMENT ON COLUMN obras.fotos_vazamento_tombamento_retirado IS 'Fotos Vazamento - Tombamento do Transformador Retirado';
COMMENT ON COLUMN obras.fotos_vazamento_placa_retirado IS 'Fotos Vazamento - Placa Transformador Retirado';
COMMENT ON COLUMN obras.fotos_vazamento_tombamento_instalado IS 'Fotos Vazamento - Tombamento do Transformador Instalado';
COMMENT ON COLUMN obras.fotos_vazamento_placa_instalado IS 'Fotos Vazamento - Placa do Transformador Instalado';
COMMENT ON COLUMN obras.fotos_vazamento_instalacao IS 'Fotos Vazamento - Instalação do Transformador';

-- ============================================================================
-- PARTE 2: ADICIONAR CAMPOS DE STATUS E FINALIZAÇÃO
-- ============================================================================

ALTER TABLE obras ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'em_aberto';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS finalizada_em TIMESTAMPTZ;

COMMENT ON COLUMN obras.status IS 'Status da obra: em_aberto, finalizada';
COMMENT ON COLUMN obras.finalizada_em IS 'Data e hora em que a obra foi finalizada';

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_obras_status ON obras(status);
CREATE INDEX IF NOT EXISTS idx_obras_equipe ON obras(equipe);

-- ============================================================================
-- PARTE 3: IMPLEMENTAR ROW LEVEL SECURITY (RLS) POR USUÁRIO INDIVIDUAL
-- ============================================================================

-- Habilitar RLS na tabela obras
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Usuários podem ver suas próprias obras" ON obras;
DROP POLICY IF EXISTS "Usuários podem inserir suas próprias obras" ON obras;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias obras" ON obras;
DROP POLICY IF EXISTS "Usuários podem deletar suas próprias obras" ON obras;
DROP POLICY IF EXISTS "Usuários podem ver obras da sua equipe" ON obras;
DROP POLICY IF EXISTS "Usuários podem criar obras para sua equipe" ON obras;
DROP POLICY IF EXISTS "Usuários podem atualizar obras da sua equipe" ON obras;
DROP POLICY IF EXISTS "Usuários podem deletar obras da sua equipe" ON obras;

-- Criar políticas RLS baseadas em usuário individual
-- Cada usuário vê apenas suas próprias obras

-- Política para SELECT (visualização)
CREATE POLICY "Usuários podem ver suas próprias obras"
ON obras FOR SELECT
USING (auth.uid() = user_id);

-- Política para INSERT (criação)
CREATE POLICY "Usuários podem inserir suas próprias obras"
ON obras FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política para UPDATE (atualização)
CREATE POLICY "Usuários podem atualizar suas próprias obras"
ON obras FOR UPDATE
USING (auth.uid() = user_id);

-- Política para DELETE (exclusão)
CREATE POLICY "Usuários podem deletar suas próprias obras"
ON obras FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- PARTE 4: CRIAR FUNÇÃO PARA CALCULAR FOTOS PENDENTES
-- ============================================================================

CREATE OR REPLACE FUNCTION calcular_fotos_pendentes(obra_row obras)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB := '{}';
  tipos_servico TEXT[];
  tipo TEXT;
  total_pendentes INT := 0;
  campos_necessarios TEXT[];
  campo TEXT;
  fotos JSONB;
BEGIN
  -- Converter tipo_servico de string para array
  tipos_servico := string_to_array(obra_row.tipo_servico, ',');

  -- Fotos padrão (sempre necessárias)
  campos_necessarios := ARRAY['fotos_antes', 'fotos_durante', 'fotos_depois'];

  -- Verificar cada tipo de serviço e adicionar campos necessários
  FOREACH tipo IN ARRAY tipos_servico
  LOOP
    tipo := TRIM(tipo);

    CASE tipo
      WHEN 'Abertura e Fechamento de Chave' THEN
        campos_necessarios := campos_necessarios || ARRAY['fotos_abertura', 'fotos_fechamento'];

      WHEN 'Ditais' THEN
        campos_necessarios := campos_necessarios || ARRAY[
          'fotos_ditais_abertura', 'fotos_ditais_impedir', 'fotos_ditais_testar',
          'fotos_ditais_aterrar', 'fotos_ditais_sinalizar'
        ];

      WHEN 'Book de Aterramento' THEN
        campos_necessarios := campos_necessarios || ARRAY[
          'fotos_aterramento_vala_aberta', 'fotos_aterramento_hastes',
          'fotos_aterramento_vala_fechada', 'fotos_aterramento_medicao'
        ];

      WHEN 'Transformador' THEN
        IF obra_row.transformador_status = 'Instalado' THEN
          campos_necessarios := campos_necessarios || ARRAY[
            'fotos_transformador_laudo', 'fotos_transformador_componente_instalado',
            'fotos_transformador_tombamento_instalado', 'fotos_transformador_tape',
            'fotos_transformador_placa_instalado', 'fotos_transformador_instalado'
          ];
        ELSIF obra_row.transformador_status = 'Retirado' THEN
          campos_necessarios := campos_necessarios || ARRAY[
            'fotos_transformador_antes_retirar', 'fotos_transformador_tombamento_retirado',
            'fotos_transformador_placa_retirado'
          ];
        END IF;

      WHEN 'Instalação do Medidor' THEN
        campos_necessarios := campos_necessarios || ARRAY[
          'fotos_medidor_padrao', 'fotos_medidor_leitura', 'fotos_medidor_selo_born',
          'fotos_medidor_selo_caixa', 'fotos_medidor_identificador_fase'
        ];

      WHEN 'Checklist de Fiscalização' THEN
        campos_necessarios := campos_necessarios || ARRAY[
          'fotos_checklist_croqui', 'fotos_checklist_panoramica_inicial',
          'fotos_checklist_chede', 'fotos_checklist_aterramento_cerca',
          'fotos_checklist_padrao_geral', 'fotos_checklist_padrao_interno',
          'fotos_checklist_panoramica_final'
        ];

      WHEN 'Altimetria' THEN
        campos_necessarios := campos_necessarios || ARRAY[
          'fotos_altimetria_lado_fonte', 'fotos_altimetria_medicao_fonte',
          'fotos_altimetria_lado_carga', 'fotos_altimetria_medicao_carga'
        ];

      WHEN 'Vazamento e Limpeza de Transformador' THEN
        campos_necessarios := campos_necessarios || ARRAY[
          'fotos_vazamento_evidencia', 'fotos_vazamento_equipamentos_limpeza',
          'fotos_vazamento_tombamento_retirado', 'fotos_vazamento_placa_retirado',
          'fotos_vazamento_tombamento_instalado', 'fotos_vazamento_placa_instalado',
          'fotos_vazamento_instalacao'
        ];

      ELSE
        -- Outros tipos de serviço não requerem fotos específicas adicionais
        NULL;
    END CASE;
  END LOOP;

  -- Verificar cada campo necessário
  FOREACH campo IN ARRAY campos_necessarios
  LOOP
    -- Obter o valor do campo usando jsonb_extract_path
    EXECUTE format('SELECT to_jsonb($1.%I)', campo) INTO fotos USING obra_row;

    -- Se o campo é NULL ou array vazio, incrementar contador
    IF fotos IS NULL OR fotos = '[]'::jsonb OR jsonb_array_length(fotos) = 0 THEN
      total_pendentes := total_pendentes + 1;
      result := jsonb_set(result, ARRAY[campo], 'true'::jsonb);
    END IF;
  END LOOP;

  -- Adicionar total de pendentes
  result := jsonb_set(result, ARRAY['total'], to_jsonb(total_pendentes));

  RETURN result;
END;
$$;

COMMENT ON FUNCTION calcular_fotos_pendentes IS 'Calcula quantas fotos ainda faltam anexar em uma obra baseado no tipo de serviço';

-- ============================================================================
-- PARTE 5: ATUALIZAR OBRAS EXISTENTES
-- ============================================================================

-- Atualizar obras existentes para status 'em_aberto'
UPDATE obras SET status = 'em_aberto' WHERE status IS NULL;

COMMIT;

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================

-- Verificar se tudo foi criado corretamente:
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'obras'
  AND column_name IN (
    'status',
    'finalizada_em',
    'doc_termo_desistencia_lpt',
    'fotos_altimetria_lado_fonte',
    'fotos_vazamento_evidencia'
  )
ORDER BY column_name;

-- Verificar políticas RLS:
SELECT
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'obras';

-- Verificar função:
SELECT
  proname,
  prosrc
FROM pg_proc
WHERE proname = 'calcular_fotos_pendentes';
