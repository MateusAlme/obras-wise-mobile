-- ========================================
-- Script RÁPIDO: Criar 3 Obras de Teste
-- Data: 2025-02-07
-- Descrição: Cria 3 obras de teste imediatamente para verificar
--            se o app mobile está mostrando corretamente
-- ========================================

DO $$
DECLARE
  v_user_2025_id UUID;
  v_user_admin_id UUID;
BEGIN
  -- Buscar IDs dos usuários
  SELECT id INTO v_user_2025_id FROM auth.users WHERE email = '2025@obraswise.com';
  SELECT id INTO v_user_admin_id FROM auth.users WHERE email != '2025@obraswise.com' LIMIT 1;

  -- Se não encontrou usuário 2025, usar o primeiro disponível
  IF v_user_2025_id IS NULL THEN
    SELECT id INTO v_user_2025_id FROM auth.users LIMIT 1;
  END IF;

  -- Se não há nenhum usuário admin, usar o mesmo
  IF v_user_admin_id IS NULL THEN
    v_user_admin_id := v_user_2025_id;
  END IF;

  -- Obra 1: Criada pelo usuário 2025
  INSERT INTO obras (
    user_id, data, obra, responsavel, equipe,
    tipo_servico, tem_atipicidade, created_at, updated_at
  ) VALUES (
    v_user_2025_id,
    CURRENT_DATE,
    'Teste 001 - Obra do Usuário 2025',
    'Usuário 2025',
    'CNT 01',
    ARRAY['Manutenção Preventiva', 'Instalação'],
    false,
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '2 hours'
  );

  -- Obra 2: Criada por outro usuário (para testar compartilhamento)
  INSERT INTO obras (
    user_id, data, obra, responsavel, equipe,
    tipo_servico, tem_atipicidade, created_at, updated_at
  ) VALUES (
    v_user_admin_id,
    CURRENT_DATE - INTERVAL '1 day',
    'Teste 002 - Obra Compartilhada',
    'Admin do Sistema',
    'CNT 02',
    ARRAY['Instalação de Poste', 'Troca de Transformador'],
    false,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  );

  -- Obra 3: Mais uma obra para teste
  INSERT INTO obras (
    user_id, data, obra, responsavel, equipe,
    tipo_servico, tem_atipicidade, created_at, updated_at
  ) VALUES (
    v_user_2025_id,
    CURRENT_DATE - INTERVAL '2 days',
    'Teste 003 - Manutenção Linha Viva',
    'Equipe LV 01',
    'LV 01 CJZ',
    ARRAY['Linha Viva', 'Manutenção'],
    false,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  );

  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ 3 OBRAS DE TESTE CRIADAS!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Obras criadas:';
  RAISE NOTICE '  1. Teste 001 - Obra do Usuário 2025';
  RAISE NOTICE '  2. Teste 002 - Obra Compartilhada';
  RAISE NOTICE '  3. Teste 003 - Manutenção Linha Viva';
  RAISE NOTICE '';
  RAISE NOTICE 'AGORA TESTE O APP:';
  RAISE NOTICE '  1. Abra o app mobile';
  RAISE NOTICE '  2. Faça login com matrícula 2025';
  RAISE NOTICE '  3. Puxe para baixo (refresh) na tela de obras';
  RAISE NOTICE '  4. Você deve ver 3 obras';
  RAISE NOTICE '========================================';

END $$;

-- Verificar as obras criadas
SELECT
  '=== OBRAS DE TESTE ===' as info,
  o.id,
  o.obra as nome,
  o.equipe,
  o.responsavel,
  u.email as criado_por,
  o.data,
  o.created_at as cadastrado_em
FROM obras o
LEFT JOIN auth.users u ON u.id = o.user_id
WHERE o.obra LIKE '%Teste%'
ORDER BY o.created_at DESC;

-- Mostrar total de obras agora
SELECT
  '=== TOTAL NO BANCO ===' as info,
  COUNT(*) as total_obras
FROM obras;
