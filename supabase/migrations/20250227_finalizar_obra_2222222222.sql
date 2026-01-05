-- Finalizar a obra 2222222222 marcando data_fechamento
UPDATE obras
SET data_fechamento = NOW()
WHERE obra = '2222222222'
  AND data_fechamento IS NULL;
