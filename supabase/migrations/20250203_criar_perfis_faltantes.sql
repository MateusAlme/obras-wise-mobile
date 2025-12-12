-- Criar perfis para todos os usuários que não têm um perfil ainda
-- Isso resolve o erro PGRST116 (Cannot coerce the result to a single JSON object)

-- Inserir perfis faltantes para usuários existentes
INSERT INTO public.profiles (id, email, full_name, role)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email) as full_name,
  'user' as role
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- Garantir que o primeiro usuário seja admin (se ainda não houver nenhum admin)
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM public.profiles
  WHERE role != 'admin'
  ORDER BY created_at ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE role = 'admin'
);
