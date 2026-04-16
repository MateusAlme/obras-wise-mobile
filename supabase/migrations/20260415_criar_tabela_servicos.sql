-- Criar tabela de serviços para arquitetura 1:N obras → serviços
-- Cada obra pode ter múltiplos serviços, cada um com fotos independentes
-- Data: 15/04/2026

BEGIN;

-- Tabela principal de serviços
CREATE TABLE IF NOT EXISTS servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  tipo_servico VARCHAR(100) NOT NULL,
  responsavel VARCHAR(255),
  status VARCHAR(20) DEFAULT 'rascunho', -- rascunho | em_progresso | completo
  sync_status VARCHAR(20) DEFAULT 'offline', -- offline | syncing | synced | error
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Fotos genéricas
  fotos_antes JSONB DEFAULT '[]'::jsonb,
  fotos_durante JSONB DEFAULT '[]'::jsonb,
  fotos_depois JSONB DEFAULT '[]'::jsonb,

  -- Fotos específicas de Abertura/Fechamento
  fotos_abertura JSONB DEFAULT '[]'::jsonb,
  fotos_fechamento JSONB DEFAULT '[]'::jsonb,

  -- Fotos específicas de Ditais
  fotos_ditais_abertura JSONB DEFAULT '[]'::jsonb,
  fotos_ditais_impedir JSONB DEFAULT '[]'::jsonb,
  fotos_ditais_testar JSONB DEFAULT '[]'::jsonb,
  fotos_ditais_aterrar JSONB DEFAULT '[]'::jsonb,
  fotos_ditais_sinalizar JSONB DEFAULT '[]'::jsonb,

  -- Fotos específicas de Book de Aterramento
  fotos_aterramento_vala_aberta JSONB DEFAULT '[]'::jsonb,
  fotos_aterramento_hastes JSONB DEFAULT '[]'::jsonb,
  fotos_aterramento_vala_fechada JSONB DEFAULT '[]'::jsonb,
  fotos_aterramento_medicao JSONB DEFAULT '[]'::jsonb,

  -- Fotos específicas de Transformador
  fotos_transformador_laudo JSONB DEFAULT '[]'::jsonb,
  fotos_transformador_componente_instalado JSONB DEFAULT '[]'::jsonb,
  fotos_transformador_tombamento_instalado JSONB DEFAULT '[]'::jsonb,
  fotos_transformador_tape JSONB DEFAULT '[]'::jsonb,
  fotos_transformador_placa_instalado JSONB DEFAULT '[]'::jsonb,
  fotos_transformador_instalado JSONB DEFAULT '[]'::jsonb,
  fotos_transformador_antes_retirar JSONB DEFAULT '[]'::jsonb,
  fotos_transformador_laudo_retirado JSONB DEFAULT '[]'::jsonb,
  fotos_transformador_tombamento_retirado JSONB DEFAULT '[]'::jsonb,
  fotos_transformador_placa_retirado JSONB DEFAULT '[]'::jsonb,
  fotos_transformador_conexoes_primarias_instalado JSONB DEFAULT '[]'::jsonb,
  fotos_transformador_conexoes_secundarias_instalado JSONB DEFAULT '[]'::jsonb,
  fotos_transformador_conexoes_primarias_retirado JSONB DEFAULT '[]'::jsonb,
  fotos_transformador_conexoes_secundarias_retirado JSONB DEFAULT '[]'::jsonb,

  -- Fotos específicas de Medidor
  fotos_medidor_padrao JSONB DEFAULT '[]'::jsonb,
  fotos_medidor_leitura JSONB DEFAULT '[]'::jsonb,
  fotos_medidor_selo_born JSONB DEFAULT '[]'::jsonb,
  fotos_medidor_selo_caixa JSONB DEFAULT '[]'::jsonb,
  fotos_medidor_identificador_fase JSONB DEFAULT '[]'::jsonb,

  -- Fotos específicas de Checklist de Fiscalização
  fotos_checklist_croqui JSONB DEFAULT '[]'::jsonb,
  fotos_checklist_panoramica_inicial JSONB DEFAULT '[]'::jsonb,
  fotos_checklist_chede JSONB DEFAULT '[]'::jsonb,
  fotos_checklist_aterramento_cerca JSONB DEFAULT '[]'::jsonb,
  fotos_checklist_padrao_geral JSONB DEFAULT '[]'::jsonb,
  fotos_checklist_padrao_interno JSONB DEFAULT '[]'::jsonb,
  fotos_checklist_panoramica_final JSONB DEFAULT '[]'::jsonb,
  fotos_checklist_postes JSONB DEFAULT '[]'::jsonb,
  fotos_checklist_seccionamentos JSONB DEFAULT '[]'::jsonb,
  fotos_checklist_frying JSONB DEFAULT '[]'::jsonb,
  fotos_checklist_abertura_fechamento_pulo JSONB DEFAULT '[]'::jsonb,

  -- Dados estruturados (postes, seccionamentos, aterramentos, etc)
  checklist_postes_data JSONB DEFAULT '[]'::jsonb,
  checklist_seccionamentos_data JSONB DEFAULT '[]'::jsonb,
  checklist_aterramentos_cerca_data JSONB DEFAULT '[]'::jsonb,
  checklist_hastes_termometros_data JSONB DEFAULT '[]'::jsonb,
  postes_data JSONB DEFAULT '[]'::jsonb,

  -- Fotos específicas de Altimetria
  fotos_altimetria_lado_fonte JSONB DEFAULT '[]'::jsonb,
  fotos_altimetria_medicao_fonte JSONB DEFAULT '[]'::jsonb,
  fotos_altimetria_lado_carga JSONB DEFAULT '[]'::jsonb,
  fotos_altimetria_medicao_carga JSONB DEFAULT '[]'::jsonb,

  -- Fotos específicas de Vazamento e Limpeza
  fotos_vazamento_evidencia JSONB DEFAULT '[]'::jsonb,
  fotos_vazamento_equipamentos_limpeza JSONB DEFAULT '[]'::jsonb,
  fotos_vazamento_tombamento_retirado JSONB DEFAULT '[]'::jsonb,
  fotos_vazamento_placa_retirado JSONB DEFAULT '[]'::jsonb,
  fotos_vazamento_tombamento_instalado JSONB DEFAULT '[]'::jsonb,
  fotos_vazamento_placa_instalado JSONB DEFAULT '[]'::jsonb,
  fotos_vazamento_instalacao JSONB DEFAULT '[]'::jsonb,

  -- Documentos (PDFs)
  doc_cadastro_medidor JSONB DEFAULT '[]'::jsonb,
  doc_laudo_transformador JSONB DEFAULT '[]'::jsonb,
  doc_laudo_regulador JSONB DEFAULT '[]'::jsonb,
  doc_laudo_religador JSONB DEFAULT '[]'::jsonb,
  doc_apr JSONB DEFAULT '[]'::jsonb,
  doc_fvbt JSONB DEFAULT '[]'::jsonb,
  doc_termo_desistencia_lpt JSONB DEFAULT '[]'::jsonb,
  doc_autorizacao_passagem JSONB DEFAULT '[]'::jsonb,
  doc_materiais_previsto JSONB DEFAULT '[]'::jsonb,
  doc_materiais_realizado JSONB DEFAULT '[]'::jsonb
);

-- Índices para performance (IF NOT EXISTS para ser idempotente)
CREATE INDEX IF NOT EXISTS idx_servicos_obra_id ON servicos(obra_id);
CREATE INDEX IF NOT EXISTS idx_servicos_sync_status ON servicos(sync_status);
CREATE INDEX IF NOT EXISTS idx_servicos_tipo_servico ON servicos(tipo_servico);
CREATE INDEX IF NOT EXISTS idx_servicos_created_at ON servicos(created_at);

-- RLS usando o mesmo padrão da tabela obras (session token)
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas se existirem (idempotente)
DROP POLICY IF EXISTS servicos_select_policy ON public.servicos;
DROP POLICY IF EXISTS servicos_insert_policy ON public.servicos;
DROP POLICY IF EXISTS servicos_update_policy ON public.servicos;
DROP POLICY IF EXISTS servicos_delete_policy ON public.servicos;

-- SELECT: admin vê tudo, equipe vê serviços das suas obras, sem sessão vê tudo (web dashboard)
CREATE POLICY servicos_select_policy ON public.servicos
FOR SELECT TO anon, authenticated
USING (
  (public.get_session_role() = 'admin')
  OR (public.get_session_role() IS NULL)
  OR (
    public.get_session_role() = 'equipe'
    AND public.get_session_equipe() IS NOT NULL
    AND obra_id IN (
      SELECT id FROM public.obras
      WHERE equipe = public.get_session_equipe()
    )
  )
  OR (
    public.get_session_role() = 'compressor'
    AND public.get_session_equipe() IS NOT NULL
    AND tipo_servico = 'Cava em Rocha'
    AND obra_id IN (
      SELECT id FROM public.obras
      WHERE equipe = public.get_session_equipe()
    )
  )
);

-- INSERT: admin e equipe podem inserir serviços nas suas obras
CREATE POLICY servicos_insert_policy ON public.servicos
FOR INSERT TO anon, authenticated
WITH CHECK (
  (public.get_session_role() = 'admin')
  OR (public.get_session_role() IS NULL)
  OR (
    public.get_session_role() = 'equipe'
    AND public.get_session_equipe() IS NOT NULL
    AND obra_id IN (
      SELECT id FROM public.obras
      WHERE equipe = public.get_session_equipe()
    )
  )
  OR (
    public.get_session_role() = 'compressor'
    AND public.get_session_equipe() IS NOT NULL
    AND tipo_servico = 'Cava em Rocha'
    AND obra_id IN (
      SELECT id FROM public.obras
      WHERE equipe = public.get_session_equipe()
    )
  )
);

-- UPDATE: mesmo critério do INSERT
CREATE POLICY servicos_update_policy ON public.servicos
FOR UPDATE TO anon, authenticated
USING (
  (public.get_session_role() = 'admin')
  OR (public.get_session_role() IS NULL)
  OR (
    public.get_session_role() = 'equipe'
    AND public.get_session_equipe() IS NOT NULL
    AND obra_id IN (
      SELECT id FROM public.obras
      WHERE equipe = public.get_session_equipe()
    )
  )
  OR (
    public.get_session_role() = 'compressor'
    AND public.get_session_equipe() IS NOT NULL
    AND tipo_servico = 'Cava em Rocha'
    AND obra_id IN (
      SELECT id FROM public.obras
      WHERE equipe = public.get_session_equipe()
    )
  )
)
WITH CHECK (
  (public.get_session_role() = 'admin')
  OR (public.get_session_role() IS NULL)
  OR (
    public.get_session_role() = 'equipe'
    AND public.get_session_equipe() IS NOT NULL
    AND obra_id IN (
      SELECT id FROM public.obras
      WHERE equipe = public.get_session_equipe()
    )
  )
  OR (
    public.get_session_role() = 'compressor'
    AND public.get_session_equipe() IS NOT NULL
    AND tipo_servico = 'Cava em Rocha'
    AND obra_id IN (
      SELECT id FROM public.obras
      WHERE equipe = public.get_session_equipe()
    )
  )
);

-- DELETE: apenas admin (mesmo padrão de obras)
CREATE POLICY servicos_delete_policy ON public.servicos
FOR DELETE TO anon, authenticated
USING (
  public.get_session_role() = 'admin'
  OR public.get_session_role() IS NULL
);

-- Trigger para atualizar updated_at automaticamente (função já existe desde 20250112)
DROP TRIGGER IF EXISTS update_servicos_updated_at ON servicos;
CREATE TRIGGER update_servicos_updated_at
  BEFORE UPDATE ON servicos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE servicos IS 'Serviços dentro de uma obra. Arquitetura 1:N - múltiplos serviços por obra.';
COMMENT ON COLUMN servicos.sync_status IS 'Estado de sincronização: offline | syncing | synced | error';
COMMENT ON COLUMN servicos.status IS 'Estado do serviço: rascunho | em_progresso | completo';

COMMIT;
