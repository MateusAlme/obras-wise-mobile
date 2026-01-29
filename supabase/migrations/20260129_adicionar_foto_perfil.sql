-- Migration: Adicionar Foto de Perfil para Usuários
-- Data: 2026-01-29
-- Descrição: Adicionar campo avatar_url e configurar storage para fotos de perfil

-- =====================================================
-- 1. Adicionar campo avatar_url na tabela profiles
-- =====================================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.profiles.avatar_url IS 'URL da foto de perfil do usuário no Supabase Storage';

-- =====================================================
-- 2. Criar bucket para avatares (se não existir)
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 3. Políticas RLS para avatars bucket
-- =====================================================

-- Permitir que usuários autenticados vejam todos os avatares (público)
CREATE POLICY "Avatares são públicos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Permitir que usuários façam upload de seu próprio avatar
CREATE POLICY "Usuários podem fazer upload de seu próprio avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir que usuários atualizem seu próprio avatar
CREATE POLICY "Usuários podem atualizar seu próprio avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir que usuários excluam seu próprio avatar
CREATE POLICY "Usuários podem excluir seu próprio avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins podem gerenciar todos os avatares
CREATE POLICY "Admins podem gerenciar todos os avatares"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'avatars'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- =====================================================
-- 4. Atualizar view de usuários para incluir avatar
-- =====================================================
DROP VIEW IF EXISTS vw_usuarios_sistema;

CREATE OR REPLACE VIEW vw_usuarios_sistema AS
SELECT
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.avatar_url,
  p.created_at,
  p.updated_at,
  u.last_sign_in_at,
  u.email_confirmed_at
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.role IN ('admin', 'viewer')
ORDER BY p.created_at DESC;

GRANT SELECT ON vw_usuarios_sistema TO authenticated;
GRANT SELECT ON vw_usuarios_sistema TO service_role;

COMMENT ON VIEW vw_usuarios_sistema IS 'View para listar usuários admin e viewer do sistema web com foto de perfil';
