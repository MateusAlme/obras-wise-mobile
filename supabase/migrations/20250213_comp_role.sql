-- Migration: COMP Role para Cava em Rocha
-- Cria role especial "compressor" com acesso restrito

-- 1. Criar coluna para identificar quem criou o registro
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS created_by TEXT;

-- 2. Criar coluna para role/perfil
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS creator_role TEXT;

-- 3. Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_obras_created_by ON public.obras(created_by);
CREATE INDEX IF NOT EXISTS idx_obras_creator_role ON public.obras(creator_role);

-- 4. RLS Policy: COMP pode inserir apenas serviços "Cava em Rocha"
DROP POLICY IF EXISTS "comp_insert_cava_rocha" ON public.obras;
CREATE POLICY "comp_insert_cava_rocha" ON public.obras
FOR INSERT TO anon, authenticated
WITH CHECK (
  -- Se o header x-role for 'compressor', só pode inserir Cava em Rocha
  CASE
    WHEN current_setting('request.headers', true)::json->>'x-role' = 'compressor'
    THEN tipo_servico = 'Cava em Rocha'
    ELSE true
  END
);

-- 5. RLS Policy: COMP pode ver apenas registros de Cava em Rocha
DROP POLICY IF EXISTS "comp_select_cava_rocha" ON public.obras;
CREATE POLICY "comp_select_cava_rocha" ON public.obras
FOR SELECT TO anon, authenticated
USING (
  -- Se o header x-role for 'compressor', só vê Cava em Rocha
  CASE
    WHEN current_setting('request.headers', true)::json->>'x-role' = 'compressor'
    THEN tipo_servico = 'Cava em Rocha'
    -- Se for equipe normal, aplica filtro por equipe
    WHEN current_setting('request.headers', true)::json->>'x-equipe' IS NOT NULL
    THEN equipe = current_setting('request.headers', true)::json->>'x-equipe'
    -- Caso contrário, permite ver tudo (para admin/debug)
    ELSE true
  END
);

-- 6. RLS Policy: COMP NÃO pode atualizar ou deletar
DROP POLICY IF EXISTS "comp_no_update" ON public.obras;
CREATE POLICY "comp_no_update" ON public.obras
FOR UPDATE TO anon, authenticated
USING (
  -- COMP não pode atualizar nada
  current_setting('request.headers', true)::json->>'x-role' != 'compressor'
);

DROP POLICY IF EXISTS "comp_no_delete" ON public.obras;
CREATE POLICY "comp_no_delete" ON public.obras
FOR DELETE TO anon, authenticated
USING (
  -- COMP não pode deletar nada
  current_setting('request.headers', true)::json->>'x-role' != 'compressor'
);

-- 7. Comentários para documentação
COMMENT ON COLUMN public.obras.created_by IS 'Usuário que criou o registro (COMP, equipe, etc)';
COMMENT ON COLUMN public.obras.creator_role IS 'Role do criador: compressor, equipe, admin';

-- 8. Garantir que RLS está habilitado
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
