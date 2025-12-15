-- =====================================================
-- Migration: Adicionar colunas de Conexões do Transformador
-- Data: 2025-02-17
-- Descrição: Adiciona campos para fotos de conexões primárias e secundárias
--            do transformador (instalado e retirado)
-- =====================================================

-- Adicionar colunas para Transformador Instalado
ALTER TABLE obras
ADD COLUMN IF NOT EXISTS transformador_conexoes_primarias_instalado jsonb DEFAULT '[]'::jsonb;

ALTER TABLE obras
ADD COLUMN IF NOT EXISTS transformador_conexoes_secundarias_instalado jsonb DEFAULT '[]'::jsonb;

-- Adicionar colunas para Transformador Retirado
ALTER TABLE obras
ADD COLUMN IF NOT EXISTS transformador_conexoes_primarias_retirado jsonb DEFAULT '[]'::jsonb;

ALTER TABLE obras
ADD COLUMN IF NOT EXISTS transformador_conexoes_secundarias_retirado jsonb DEFAULT '[]'::jsonb;

-- Adicionar comentários para documentação
COMMENT ON COLUMN obras.transformador_conexoes_primarias_instalado IS 'Array JSONB com URLs de 2 fotos obrigatórias das conexões primárias do transformador instalado';
COMMENT ON COLUMN obras.transformador_conexoes_secundarias_instalado IS 'Array JSONB com URLs de 2 fotos obrigatórias das conexões secundárias do transformador instalado';
COMMENT ON COLUMN obras.transformador_conexoes_primarias_retirado IS 'Array JSONB com URLs de 2 fotos obrigatórias das conexões primárias do transformador retirado';
COMMENT ON COLUMN obras.transformador_conexoes_secundarias_retirado IS 'Array JSONB com URLs de 2 fotos obrigatórias das conexões secundárias do transformador retirado';

-- Verificar se as colunas foram criadas
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'obras'
    AND column_name = 'transformador_conexoes_primarias_instalado'
  ) THEN
    RAISE NOTICE '✅ Coluna transformador_conexoes_primarias_instalado criada com sucesso!';
  ELSE
    RAISE EXCEPTION '❌ Falha ao criar coluna transformador_conexoes_primarias_instalado';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'obras'
    AND column_name = 'transformador_conexoes_secundarias_instalado'
  ) THEN
    RAISE NOTICE '✅ Coluna transformador_conexoes_secundarias_instalado criada com sucesso!';
  ELSE
    RAISE EXCEPTION '❌ Falha ao criar coluna transformador_conexoes_secundarias_instalado';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'obras'
    AND column_name = 'transformador_conexoes_primarias_retirado'
  ) THEN
    RAISE NOTICE '✅ Coluna transformador_conexoes_primarias_retirado criada com sucesso!';
  ELSE
    RAISE EXCEPTION '❌ Falha ao criar coluna transformador_conexoes_primarias_retirado';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'obras'
    AND column_name = 'transformador_conexoes_secundarias_retirado'
  ) THEN
    RAISE NOTICE '✅ Coluna transformador_conexoes_secundarias_retirado criada com sucesso!';
  ELSE
    RAISE EXCEPTION '❌ Falha ao criar coluna transformador_conexoes_secundarias_retirado';
  END IF;
END $$;
