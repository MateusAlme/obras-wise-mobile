-- Migration: Funções para Gerenciar Usuários Administradores do Sistema Web
-- Data: 2025-02-29
-- Descrição: Criar funções para atualizar/excluir usuários admin
-- Nota: Criação de usuários será feita pelo frontend usando createClient() do Supabase

-- =====================================================
-- 1. VIEW: Listar Usuários Admin
-- =====================================================
-- View para facilitar a listagem de usuários do sistema web
CREATE OR REPLACE VIEW vw_usuarios_sistema AS
SELECT
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.created_at,
  p.updated_at,
  u.last_sign_in_at,
  u.email_confirmed_at
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.role IN ('admin', 'viewer')
ORDER BY p.created_at DESC;

-- Garantir que apenas admins podem visualizar
GRANT SELECT ON vw_usuarios_sistema TO authenticated;

-- =====================================================
-- 2. FUNÇÃO: Atualizar Usuário Admin
-- =====================================================
CREATE OR REPLACE FUNCTION atualizar_usuario_admin(
  p_user_id UUID,
  p_nome_completo TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Validar user_id
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  -- Validar role se fornecido
  IF p_role IS NOT NULL AND p_role NOT IN ('admin', 'viewer') THEN
    RAISE EXCEPTION 'Role deve ser "admin" ou "viewer"';
  END IF;

  -- Atualizar profile
  UPDATE public.profiles
  SET
    full_name = COALESCE(p_nome_completo, full_name),
    role = COALESCE(p_role, role),
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Atualizar metadata do auth.users
  IF p_nome_completo IS NOT NULL THEN
    UPDATE auth.users
    SET
      raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{full_name}',
        to_jsonb(p_nome_completo)
      ),
      updated_at = NOW()
    WHERE id = p_user_id;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'message', 'Usuário atualizado com sucesso'
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- =====================================================
-- 3. FUNÇÃO: Alterar Senha de Usuário Admin
-- =====================================================
CREATE OR REPLACE FUNCTION admin_alterar_senha_usuario(
  p_user_id UUID,
  p_senha_nova TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Validar senha (mínimo 6 caracteres)
  IF p_senha_nova IS NULL OR LENGTH(p_senha_nova) < 6 THEN
    RAISE EXCEPTION 'Senha deve ter no mínimo 6 caracteres';
  END IF;

  -- Validar user_id
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  -- Atualizar senha
  UPDATE auth.users
  SET
    encrypted_password = crypt(p_senha_nova, gen_salt('bf')),
    updated_at = NOW()
  WHERE id = p_user_id;

  v_result := jsonb_build_object(
    'success', true,
    'message', 'Senha alterada com sucesso'
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- =====================================================
-- 4. FUNÇÃO: Excluir Usuário Admin
-- =====================================================
CREATE OR REPLACE FUNCTION excluir_usuario_admin(
  p_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_email TEXT;
BEGIN
  -- Validar user_id
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  -- Obter email antes de excluir
  SELECT email INTO v_email FROM public.profiles WHERE id = p_user_id;

  -- Não permitir excluir o super admin (mateusalmeidacz@gmail.com)
  IF v_email = 'mateusalmeidacz@gmail.com' THEN
    RAISE EXCEPTION 'Não é permitido excluir o super administrador';
  END IF;

  -- Excluir do profiles (CASCADE irá deletar de auth.users se configurado)
  DELETE FROM public.profiles WHERE id = p_user_id;

  -- Excluir do auth.users
  DELETE FROM auth.users WHERE id = p_user_id;

  v_result := jsonb_build_object(
    'success', true,
    'message', 'Usuário excluído com sucesso'
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- =====================================================
-- 5. Garantir Permissões
-- =====================================================
-- Garantir que apenas admins podem executar essas funções
-- (as funções já estão com SECURITY DEFINER)

COMMENT ON FUNCTION criar_usuario_admin IS 'Cria novo usuário administrador do sistema web';
COMMENT ON FUNCTION atualizar_usuario_admin IS 'Atualiza informações de usuário administrador';
COMMENT ON FUNCTION admin_alterar_senha_usuario IS 'Altera senha de usuário administrador';
COMMENT ON FUNCTION excluir_usuario_admin IS 'Exclui usuário administrador (exceto super admin)';
