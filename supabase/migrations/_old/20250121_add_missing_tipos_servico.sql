-- Adicionar tipos de serviço faltantes
-- Data: 2025-01-18

-- 1. Adicionar novos valores ao ENUM tipo_servico_enum
ALTER TYPE tipo_servico_enum ADD VALUE IF NOT EXISTS 'ABERTURA_FECHAMENTO_CHAVE';
ALTER TYPE tipo_servico_enum ADD VALUE IF NOT EXISTS 'DITAIS';
ALTER TYPE tipo_servico_enum ADD VALUE IF NOT EXISTS 'BOOK_ATERRAMENTO';

-- 2. Inserir tipos de serviço que estão faltando
INSERT INTO tipos_servico (tipo, nome, descricao, requer_foto_antes, requer_foto_durante, requer_foto_depois, ordem, ativo) VALUES
('ABERTURA_FECHAMENTO_CHAVE'::tipo_servico_enum, 'Abertura e Fechamento de Chave', 'Serviço de abertura e fechamento de chaves elétricas com registro fotográfico', false, false, false, 5, true),
('DITAIS'::tipo_servico_enum, 'Ditais', 'Serviço com aplicação dos DITAIS (Desligar, Impedir, Testar, Aterrar, Sinalizar)', false, false, false, 6, true),
('BOOK_ATERRAMENTO'::tipo_servico_enum, 'Book de Aterramento', 'Documentação fotográfica completa do sistema de aterramento', false, false, false, 7, true)
ON CONFLICT (tipo) DO NOTHING;

-- 3. Verificar resultado
SELECT id, tipo, nome, ativo FROM tipos_servico ORDER BY ordem;
