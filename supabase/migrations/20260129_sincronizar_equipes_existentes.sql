-- Sincronizar equipes que existem em equipe_credenciais mas não em equipes
-- Isso corrige equipes criadas anteriormente que só foram para equipe_credenciais

DO $$
DECLARE
  v_credencial RECORD;
  v_tipo VARCHAR(10);
  v_nome VARCHAR(100);
BEGIN
  -- Para cada credencial que não tem equipe correspondente
  FOR v_credencial IN
    SELECT ec.equipe_codigo
    FROM equipe_credenciais ec
    WHERE NOT EXISTS (
      SELECT 1 FROM equipes e WHERE e.codigo = ec.equipe_codigo
    )
  LOOP
    -- Determinar tipo baseado no prefixo
    IF v_credencial.equipe_codigo LIKE 'CNT%' THEN
      v_tipo := 'CNT';
      v_nome := 'Construção ' || SUBSTRING(v_credencial.equipe_codigo FROM 5);
    ELSIF v_credencial.equipe_codigo LIKE 'MNT%' THEN
      v_tipo := 'MNT';
      v_nome := 'Manutenção ' || SUBSTRING(v_credencial.equipe_codigo FROM 5);
    ELSIF v_credencial.equipe_codigo LIKE 'LV%' THEN
      v_tipo := 'LV';
      v_nome := 'Linha Viva ' || SUBSTRING(v_credencial.equipe_codigo FROM 4);
    ELSE
      v_tipo := 'CNT';
      v_nome := v_credencial.equipe_codigo;
    END IF;

    -- Inserir equipe
    INSERT INTO equipes (codigo, nome, tipo, ativa)
    VALUES (v_credencial.equipe_codigo, v_nome, v_tipo, true);

    RAISE NOTICE 'Equipe sincronizada: %', v_credencial.equipe_codigo;
  END LOOP;
END $$;
