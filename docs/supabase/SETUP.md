# Configuração do Supabase - Obras Teccel

## Passo 1: Criar Tabela de Obras

Execute o SQL abaixo no SQL Editor do Supabase:

```sql
-- Criar tabela de obras (com suporte a múltiplas fotos)
CREATE TABLE obras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  obra TEXT NOT NULL,
  responsavel TEXT NOT NULL,
  equipe TEXT NOT NULL,
  tipo_servico TEXT[] NOT NULL,
  tem_atipicidade BOOLEAN NOT NULL,
  atipicidades INTEGER[],
  descricao_atipicidade TEXT,
  fotos_antes JSONB DEFAULT '[]'::jsonb,
  fotos_durante JSONB DEFAULT '[]'::jsonb,
  fotos_depois JSONB DEFAULT '[]'::jsonb,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índice para melhor performance
CREATE INDEX obras_user_id_idx ON obras(user_id);
CREATE INDEX obras_created_at_idx ON obras(created_at DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;

-- Política: Usuários só podem ver suas próprias obras
CREATE POLICY "Users can view their own obras"
  ON obras
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Usuários podem criar suas próprias obras
CREATE POLICY "Users can create their own obras"
  ON obras
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem atualizar suas próprias obras
CREATE POLICY "Users can update their own obras"
  ON obras
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem deletar suas próprias obras
CREATE POLICY "Users can delete their own obras"
  ON obras
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_obras_updated_at
  BEFORE UPDATE ON obras
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Passo 2: Habilitar Storage (para fotos - opcional por enquanto)

Execute no SQL Editor:

```sql
-- Criar bucket para fotos de obras
INSERT INTO storage.buckets (id, name, public)
VALUES ('obra-photos', 'obra-photos', true);

-- Política: Usuários podem fazer upload de suas próprias fotos
CREATE POLICY "Users can upload obra photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'obra-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Política: Todos podem ver as fotos (público)
CREATE POLICY "Public can view obra photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'obra-photos');

-- Política: Usuários podem deletar suas próprias fotos
CREATE POLICY "Users can delete their own photos"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'obra-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

## Passo 3: Verificar

Após executar os comandos SQL, verifique:

1. ✅ Tabela `obras` foi criada
2. ✅ RLS (Row Level Security) está habilitado
3. ✅ Políticas foram criadas
4. ✅ Bucket `obra-photos` foi criado (se executou o passo 2)

## Como acessar o SQL Editor no Supabase

1. Acesse [https://supabase.com](https://supabase.com)
2. Entre no seu projeto
3. No menu lateral, clique em **SQL Editor**
4. Clique em **New Query**
5. Cole o SQL acima
6. Clique em **Run** ou pressione `Ctrl + Enter`

## Estrutura dos Dados

### Tabela: obras

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | ID único da obra |
| data | DATE | Data da obra |
| obra | TEXT | Código da obra (ex: 0032401637) |
| responsavel | TEXT | Nome do responsável |
| equipe | TEXT | Nome da equipe |
| tipo_servico | TEXT[] | Array com tipos de serviço (Emenda, Bandolamento, etc) |
| tem_atipicidade | BOOLEAN | Se teve atipicidades |
| atipicidades | INTEGER[] | Array com IDs das atipicidades |
| descricao_atipicidade | TEXT | Descrição das atipicidades |
| fotos_antes | JSONB | Array de fotos antes (url, latitude, longitude) |
| fotos_durante | JSONB | Array de fotos durante (url, latitude, longitude) |
| fotos_depois | JSONB | Array de fotos depois (url, latitude, longitude) |
| user_id | UUID | ID do usuário (relação com auth.users) |
| created_at | TIMESTAMPTZ | Data de criação |
| updated_at | TIMESTAMPTZ | Data de atualização |

## Atipicidades Disponíveis

As atipicidades são identificadas pelos seguintes IDs:

- **3**: Obra em locais sem acesso que necessitam de transporte especial
- **4**: Obra em ilhas, terrenos alagados, arenosos, etc
- **5**: Obra com travessia de condutores
- **6**: Obra de expansão e construção de rede
- **8**: Obra com participação de linha viva
- **9**: Obra com utilização de linha viva somente na conexão
- **10**: Obra com atendimento alternativo de cargas
- **11**: Obra de conversão de Rede convencional para REDE COMPACTA
- **12**: Obra exclusiva de recondutoramento
- **13**: Obra MISTA com RECONDUTORAMENTO PARCIAL
- **17**: Outros (EMENDAS DE CONDUTOR PARTIDO, ESPAÇADOR, etc)

## Próximos Passos

Após configurar o Supabase:

1. ✅ Recarregue o app no celular
2. ✅ Faça login
3. ✅ Clique em "Iniciar Nova Obra" no Dashboard
4. ✅ Preencha o formulário
5. ✅ Salve a obra
6. ✅ Veja no histórico de obras

---

## Estrutura das Fotos (JSONB)

Cada campo de fotos (`fotos_antes`, `fotos_durante`, `fotos_depois`) armazena um array JSON com objetos contendo:

```json
[
  {
    "url": "https://...",
    "latitude": -23.550520,
    "longitude": -46.633308
  },
  {
    "url": "https://...",
    "latitude": -23.551234,
    "longitude": -46.634567
  }
]
```

**Nota**: A funcionalidade de múltiplas fotos com GPS está implementada! Você pode tirar quantas fotos quiser em cada etapa (antes, durante, depois).
