-- Criar tabela de perfis de usuários
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem ver todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem inserir perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem atualizar perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem deletar perfis" ON public.profiles;

CREATE POLICY "Usuários podem ver seu próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins podem ver todos os perfis"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins podem inserir perfis"
  ON public.profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins podem atualizar perfis"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins podem deletar perfis"
  ON public.profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Função para criar perfil automaticamente quando um usuário é criado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Atualizar políticas RLS da tabela obras para considerar autenticação
DROP POLICY IF EXISTS "Qualquer usuário autenticado pode ler obras" ON public.obras;
DROP POLICY IF EXISTS "Usuários autenticados podem ler obras" ON public.obras;
CREATE POLICY "Usuários autenticados podem ler obras"
  ON public.obras FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Qualquer usuário autenticado pode inserir obras" ON public.obras;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir obras" ON public.obras;
CREATE POLICY "Usuários autenticados podem inserir obras"
  ON public.obras FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Qualquer usuário autenticado pode atualizar obras" ON public.obras;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar obras" ON public.obras;
CREATE POLICY "Usuários autenticados podem atualizar obras"
  ON public.obras FOR UPDATE
  USING (auth.uid() IS NOT NULL);
