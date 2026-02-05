-- =====================================================
-- Migration: Adicionar role 'viewer' ao sistema
-- Data: 2026-02-05
-- Descrição: Permite criar usuários visualizadores
-- =====================================================

-- 1. Remover a constraint antiga que limita os valores de role
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Adicionar nova constraint que inclui 'viewer'
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin', 'user', 'viewer'));

-- 3. Definir valor default para a coluna role (evita erros no trigger)
ALTER TABLE public.profiles
ALTER COLUMN role SET DEFAULT 'user';

-- 4. Atualizar trigger handle_new_user para incluir role default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Adicionar comentário explicativo
COMMENT ON COLUMN public.profiles.role IS
'Papel do usuário no sistema:
- admin: Acesso total (criar/editar/excluir obras, usuários, equipes)
- user: Acesso padrão (criar/editar obras da própria equipe)
- viewer: Apenas visualização (dashboard, acompanhamento, relatórios)';

-- 6. Verificação
DO $$
DECLARE
  constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_role_check'
    AND table_name = 'profiles'
  ) INTO constraint_exists;

  IF constraint_exists THEN
    RAISE NOTICE '✅ Constraint profiles_role_check atualizada com sucesso!';
    RAISE NOTICE '✅ Roles permitidos: admin, user, viewer';
    RAISE NOTICE '✅ Trigger handle_new_user atualizado';
  ELSE
    RAISE WARNING '⚠️ Constraint não foi criada. Verifique manualmente.';
  END IF;
END $$;
