-- ========================================
-- Script: Criar obra de teste visível para o usuário 2025
-- Data: 2025-02-07
-- Descrição: Criar uma obra de teste para verificar se o usuário 2025
--            consegue visualizá-la após aplicar as políticas RLS compartilhadas
-- ========================================

DO $$
DECLARE
  v_user_id UUID;
  v_obra_id UUID;
BEGIN
  -- Buscar ID de um usuário existente (pode ser o próprio 2025 ou outro)
  SELECT id INTO v_user_id FROM auth.users WHERE email = '2025@obraswise.com';

  -- Se usuário 2025 não existe, usar o primeiro usuário disponível
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não há usuários cadastrados no sistema!';
  END IF;

  -- Criar obra de teste
  INSERT INTO obras (
    user_id,
    data,
    obra,
    responsavel,
    equipe,
    tipo_servico,
    tem_atipicidade,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    CURRENT_DATE,
    'Obra de Teste - Verificação de Compartilhamento',
    'Sistema de Testes',
    'CNT 01',
    ARRAY['Manutenção', 'Verificação'],
    false,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_obra_id;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ Obra de teste criada com sucesso!';
  RAISE NOTICE '  Obra ID: %', v_obra_id;
  RAISE NOTICE '  Criada por: %', (SELECT email FROM auth.users WHERE id = v_user_id);
  RAISE NOTICE '  Nome: Obra de Teste - Verificação de Compartilhamento';
  RAISE NOTICE '  Equipe: CNT 01';
  RAISE NOTICE '  Data: %', CURRENT_DATE;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PRÓXIMOS PASSOS:';
  RAISE NOTICE '1. Faça login no app mobile com matrícula 2025';
  RAISE NOTICE '2. Verifique se esta obra aparece na listagem';
  RAISE NOTICE '3. Se não aparecer, execute o diagnóstico:';
  RAISE NOTICE '   diagnostico_usuario_2025.sql';
  RAISE NOTICE '========================================';

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao criar obra de teste: %', SQLERRM;
END $$;

-- Verificar a obra criada
SELECT
  o.id,
  o.obra as nome,
  o.equipe,
  o.responsavel,
  u.email as criado_por,
  o.data,
  o.created_at
FROM obras o
LEFT JOIN auth.users u ON u.id = o.user_id
WHERE o.obra LIKE '%Obra de Teste%'
ORDER BY o.created_at DESC
LIMIT 1;
