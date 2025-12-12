-- ========================================
-- Limpeza do banco de dados
-- Remove tabelas desnecessárias: registros_servico e tipos_servico
-- Data: 2025-01-18
-- ========================================

-- 1. Dropar tabela registros_servico (se existir)
DROP TABLE IF EXISTS registros_servico CASCADE;

-- 2. Dropar tabela tipos_servico (se existir)
DROP TABLE IF EXISTS tipos_servico CASCADE;

-- 3. Dropar tabela registros_servico_fotos (se existir)
DROP TABLE IF EXISTS registros_servico_fotos CASCADE;

-- 4. Dropar ENUM tipo_servico_enum (se existir)
DROP TYPE IF EXISTS tipo_servico_enum CASCADE;

-- 5. Verificar tabelas restantes
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
