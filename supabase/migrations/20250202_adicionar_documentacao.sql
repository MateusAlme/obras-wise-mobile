-- Migration: Adicionar campos para serviço de Documentação
-- Created: 2025-02-02
-- Description: Adiciona campos JSONB para armazenar documentos PDF do serviço de Documentação

ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS doc_cadastro_medidor JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS doc_laudo_transformador JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS doc_laudo_regulador JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS doc_laudo_religador JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS doc_apr JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS doc_fvbt JSONB DEFAULT '[]';

-- Comentários para documentação
COMMENT ON COLUMN public.obras.doc_cadastro_medidor IS 'Documentos PDF - Cadastro de Medidor';
COMMENT ON COLUMN public.obras.doc_laudo_transformador IS 'Documentos PDF - Laudo de Transformador';
COMMENT ON COLUMN public.obras.doc_laudo_regulador IS 'Documentos PDF - Laudo de Regulador';
COMMENT ON COLUMN public.obras.doc_laudo_religador IS 'Documentos PDF - Laudo de Religador';
COMMENT ON COLUMN public.obras.doc_apr IS 'Documentos PDF - Análise Preliminar de Risco (APR)';
COMMENT ON COLUMN public.obras.doc_fvbt IS 'Documentos PDF - Formulário de Vistoria de Baixa Tensão (FVBT)';
