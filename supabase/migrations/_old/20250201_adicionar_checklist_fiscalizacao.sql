-- Adicionar colunas para Checklist de Fiscalização na tabela obras

-- Fotos fixas (campos simples)
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS fotos_checklist_croqui JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS fotos_checklist_panoramica_inicial JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS fotos_checklist_chede JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS fotos_checklist_aterramento_cerca JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS fotos_checklist_padrao_geral JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS fotos_checklist_padrao_interno JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS fotos_checklist_panoramica_final JSONB DEFAULT '[]';

-- Fotos dinâmicas (arrays complexos)
-- Postes: cada poste tem 4 tipos de fotos (poste_inteiro, engaste, conexao1, conexao2)
-- Estrutura: array de objetos onde cada objeto representa um poste
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS fotos_checklist_postes JSONB DEFAULT '[]';

-- Seccionamentos: array de arrays de fotos
-- Estrutura: array onde cada elemento é um array de fotos de um ponto de seccionamento
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS fotos_checklist_seccionamentos JSONB DEFAULT '[]';

-- Comentários para documentação
COMMENT ON COLUMN public.obras.fotos_checklist_croqui IS 'Fotos do Croqui da Obra (1 foto obrigatória)';
COMMENT ON COLUMN public.obras.fotos_checklist_panoramica_inicial IS 'Fotos Panorâmicas Iniciais (2 fotos obrigatórias)';
COMMENT ON COLUMN public.obras.fotos_checklist_chede IS 'Fotos da Chede/Material Recebido (1 foto obrigatória)';
COMMENT ON COLUMN public.obras.fotos_checklist_aterramento_cerca IS 'Fotos do Aterramento de Cerca (1 foto obrigatória)';
COMMENT ON COLUMN public.obras.fotos_checklist_padrao_geral IS 'Foto do Padrão de Ligação - Vista Geral (1 foto obrigatória)';
COMMENT ON COLUMN public.obras.fotos_checklist_padrao_interno IS 'Foto do Padrão de Ligação - Interno (1 foto obrigatória)';
COMMENT ON COLUMN public.obras.fotos_checklist_panoramica_final IS 'Fotos Panorâmicas Finais (2 fotos obrigatórias)';
COMMENT ON COLUMN public.obras.fotos_checklist_postes IS 'Array de fotos de postes. Cada poste tem 4 tipos: poste_inteiro, engaste, conexao1, conexao2. Estrutura: [{poste_inteiro: [...], engaste: [...], conexao1: [...], conexao2: [...]}]';
COMMENT ON COLUMN public.obras.fotos_checklist_seccionamentos IS 'Array de arrays com fotos de pontos de seccionamento de cerca. Cada elemento é um array de fotos de um ponto. Estrutura: [[foto1, foto2], [foto3], ...]';
