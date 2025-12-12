-- Migration: Melhorias de visualização por equipe e status de obras
-- Data: 2025-02-09
-- Descrição:
-- 1. Adicionar campos de status e finalização de obra
-- 2. Implementar RLS para filtrar obras por equipe
-- 3. Remover visualização de obras de outras equipes

-- 1. Adicionar campos de status na tabela obras
ALTER TABLE obras ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'em_aberto';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS finalizada_em TIMESTAMPTZ;

COMMENT ON COLUMN obras.status IS 'Status da obra: em_aberto, finalizada';
COMMENT ON COLUMN obras.finalizada_em IS 'Data e hora em que a obra foi finalizada';

-- Criar índice para melhor performance nas consultas por status
CREATE INDEX IF NOT EXISTS idx_obras_status ON obras(status);
CREATE INDEX IF NOT EXISTS idx_obras_equipe ON obras(equipe);

-- 2. Habilitar Row Level Security (RLS) na tabela obras
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;

-- 3. Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Usuários podem ver suas próprias obras" ON obras;
DROP POLICY IF EXISTS "Usuários podem inserir suas próprias obras" ON obras;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias obras" ON obras;

-- 4. Criar políticas RLS baseadas em equipe
-- Os usuários só podem ver obras da sua própria equipe

-- Política para SELECT (visualização)
CREATE POLICY "Usuários podem ver obras da sua equipe"
ON obras FOR SELECT
USING (
  equipe IN (
    SELECT e.codigo
    FROM usuarios_app ua
    JOIN equipes e ON e.id = ua.equipe_id
    WHERE ua.supabase_user_id = auth.uid()
  )
);

-- Política para INSERT (criação)
CREATE POLICY "Usuários podem criar obras para sua equipe"
ON obras FOR INSERT
WITH CHECK (
  equipe IN (
    SELECT e.codigo
    FROM usuarios_app ua
    JOIN equipes e ON e.id = ua.equipe_id
    WHERE ua.supabase_user_id = auth.uid()
  )
);

-- Política para UPDATE (atualização)
CREATE POLICY "Usuários podem atualizar obras da sua equipe"
ON obras FOR UPDATE
USING (
  equipe IN (
    SELECT e.codigo
    FROM usuarios_app ua
    JOIN equipes e ON e.id = ua.equipe_id
    WHERE ua.supabase_user_id = auth.uid()
  )
);

-- Política para DELETE (exclusão) - apenas obras da própria equipe
CREATE POLICY "Usuários podem deletar obras da sua equipe"
ON obras FOR DELETE
USING (
  equipe IN (
    SELECT e.codigo
    FROM usuarios_app ua
    JOIN equipes e ON e.id = ua.equipe_id
    WHERE ua.supabase_user_id = auth.uid()
  )
);

-- 5. Criar função para calcular fotos pendentes por tipo de serviço
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

-- 6. Atualizar obras existentes para status 'em_aberto'
UPDATE obras SET status = 'em_aberto' WHERE status IS NULL;
