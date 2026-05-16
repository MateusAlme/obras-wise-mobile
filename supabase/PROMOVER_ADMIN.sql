-- =====================================================
-- 🔐 PROMOVER USUÁRIO PARA ADMINISTRADOR
-- =====================================================
--
-- Execute no Supabase SQL Editor:
-- https://supabase.com/dashboard/project/SEU_PROJECT_ID/sql/new
--
-- =====================================================

-- Promover usuário mateusalmeidacz@gmail.com para admin
UPDATE profiles
SET role = 'admin'
WHERE email = 'mateusalmeidacz@gmail.com';

-- Verificar se foi atualizado
SELECT
  id,
  email,
  full_name,
  role,
  created_at
FROM profiles
WHERE email = 'mateusalmeidacz@gmail.com';

-- =====================================================
-- ✅ Se retornou role = 'admin', está correto!
--
-- Agora:
-- 1. Faça logout no sistema web (botão "Sair")
-- 2. Faça login novamente
-- 3. O menu "Usuários" deve aparecer na sidebar
-- =====================================================
