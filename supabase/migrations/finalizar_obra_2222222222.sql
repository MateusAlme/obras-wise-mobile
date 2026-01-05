-- Finalizar a obra 2222222222 marcando data_fechamento
-- Esta obra estava como "Parcial" mas já foi finalizada no campo

UPDATE obras
SET data_fechamento = NOW()
WHERE obra = '2222222222'
  AND data_fechamento IS NULL;

-- Verificar resultado
SELECT
  obra,
  equipe,
  tipo_servico,
  data_abertura,
  data_fechamento,
  CASE
    WHEN data_fechamento IS NOT NULL THEN 'Concluída'
    ELSE 'Parcial'
  END as status
FROM obras
WHERE obra = '2222222222';
