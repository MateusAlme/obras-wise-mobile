# Supabase - Banco de Dados

Esta pasta contém toda a configuração e migrações do banco de dados Supabase.

## Estrutura

```
supabase/
├── README.md              # Este arquivo
├── SETUP.md              # Configuração inicial do banco (primeira vez)
└── migrations/           # Migrações do banco de dados
    └── 20250112_multiplas_fotos.sql  # Adiciona suporte a múltiplas fotos
```

## Como Usar

### Primeira Vez (Novo Projeto)
1. Leia e execute o SQL em [SETUP.md](./SETUP.md)
2. Isso cria a tabela `obras`, políticas RLS e bucket de storage

### Migrações (Atualizar Banco Existente)
1. Vá em `migrations/`
2. Execute os arquivos SQL em ordem cronológica no Supabase SQL Editor

## Como Executar SQL no Supabase

1. Acesse [https://supabase.com](https://supabase.com)
2. Entre no seu projeto
3. Menu lateral: **SQL Editor**
4. Clique em **New Query**
5. Cole o SQL do arquivo
6. Clique em **Run** ou `Ctrl + Enter`

## Histórico de Migrações

| Data | Arquivo | Descrição |
|------|---------|-----------|
| 2025-01-12 | `20250112_multiplas_fotos.sql` | Adiciona suporte a múltiplas fotos por etapa (antes/durante/depois) com GPS |

## Convenção de Nomenclatura

Formato: `YYYYMMDD_descricao_curta.sql`

Exemplo: `20250112_multiplas_fotos.sql`
- `20250112` = Data (12 de janeiro de 2025)
- `multiplas_fotos` = Descrição curta da migração
