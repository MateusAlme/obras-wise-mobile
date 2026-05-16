# Guia Supabase CLI - Migrações

## ✅ Status Atual
- ✅ Supabase CLI instalado (v2.51.0)
- ✅ Projeto inicializado (`supabase init`)
- ✅ Migração criada: `20250112_multiplas_fotos.sql`

## 📋 Próximos Passos

### 1. Obter Project Reference ID

Acesse seu projeto no Supabase:
1. Vá em [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto "Obras Teccel"
3. Vá em **Settings** > **General**
4. Copie o **Reference ID** (aparece como `Project ID` ou `Reference ID`)
   - Formato: `abcdefghijklmnopqrst` (20 caracteres)

### 2. Vincular Projeto Local com Remoto

No terminal, execute:

```bash
cd "c:\Users\Mateus Almeida\obras-wise-mobile"
supabase link --project-ref SEU_PROJECT_ID_AQUI
```

Quando solicitar, forneça:
- **Database password**: A senha do banco (você definiu ao criar o projeto)

### 3. Aplicar Migrações

Depois de vincular, execute:

```bash
supabase db push
```

Este comando vai:
- ✅ Enviar a migração `20250112_multiplas_fotos.sql` para o banco remoto
- ✅ Criar/atualizar a tabela `obras` com todas as colunas
- ✅ Configurar RLS e políticas de segurança

### 4. Verificar Status

Para ver quais migrações foram aplicadas:

```bash
supabase migration list
```

## 🔧 Comandos Úteis

### Ver diferenças entre local e remoto
```bash
supabase db diff
```

### Criar nova migração
```bash
supabase migration new nome_da_migracao
```

### Aplicar migrações específicas
```bash
supabase db push --include-all
```

### Reverter migração (cuidado!)
```bash
supabase db reset
```

## 📁 Estrutura de Arquivos

```
obras-wise-mobile/
├── supabase/
│   ├── config.toml              # Configuração do Supabase CLI
│   ├── migrations/              # Pasta de migrações
│   │   └── 20250112_multiplas_fotos.sql  # Sua migração
│   ├── CLI_GUIDE.md            # Este guia
│   ├── README.md               # Documentação geral
│   └── SETUP.md                # Setup manual (alternativa ao CLI)
```

## ⚠️ Importante

- **Sempre faça backup** antes de aplicar migrações em produção
- As migrações são **irreversíveis** por padrão
- Use `supabase db diff` para revisar mudanças antes de aplicar
- O arquivo `.env` será criado automaticamente ao vincular (não commite!)

## 🆘 Problemas Comuns

### "Invalid project ref format"
- Certifique-se de copiar o Reference ID correto (20 caracteres)
- Formato: apenas letras minúsculas, sem espaços

### "Authentication failed"
- Verifique se a senha do banco está correta
- Tente fazer login novamente: `supabase login`

### "Migration already applied"
- A migração já foi executada
- Use `supabase migration list` para ver o status

## 🔗 Links Úteis

- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Managing Database Migrations](https://supabase.com/docs/guides/cli/managing-environments)
- [Local Development](https://supabase.com/docs/guides/cli/local-development)
