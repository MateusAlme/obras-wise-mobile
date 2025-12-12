-- Adicionar colunas para fotos de Instalação do Medidor na tabela obras

ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS fotos_medidor_padrao JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS fotos_medidor_leitura JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS fotos_medidor_selo_born JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS fotos_medidor_selo_caixa JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS fotos_medidor_identificador_fase JSONB DEFAULT '[]';

-- Comentários para documentação
COMMENT ON COLUMN public.obras.fotos_medidor_padrao IS 'Fotos do Padrão c/ Medidor Instalado';
COMMENT ON COLUMN public.obras.fotos_medidor_leitura IS 'Fotos da Leitura c/ Medidor Instalado';
COMMENT ON COLUMN public.obras.fotos_medidor_selo_born IS 'Fotos do Selo do Born do Medidor';
COMMENT ON COLUMN public.obras.fotos_medidor_selo_caixa IS 'Fotos do Selo da Caixa';
COMMENT ON COLUMN public.obras.fotos_medidor_identificador_fase IS 'Fotos do Identificador de Fase';
