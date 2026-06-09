# Migração: Unificar Materiais Previsto/Realizado

## O que esta migração faz?

Unifica os campos `doc_materiais_previsto` e `doc_materiais_realizado` em um único campo `doc_materiais_previsto`.

**Motivo:** Simplificação da UI mobile - agora há apenas um campo de anexo para materiais.

## Precisa aplicar?

**SIM**, se você tem obras com documentos em `doc_materiais_realizado`.

A migração vai:
1. ✅ Mesclar todos os documentos de `doc_materiais_realizado` em `doc_materiais_previsto`
2. ✅ Limpar a coluna `doc_materiais_realizado` (mas não remove por compatibilidade)
3. ✅ Marcar a coluna como DEPRECATED

## Como aplicar

### Opção 1: Via Supabase Dashboard (Recomendado)

1. Acesse: https://supabase.com/dashboard/project/hiuagpzaelcocyxutgdt/sql/new
2. Copie e cole o conteúdo do arquivo: `supabase/migrations/20260122_unificar_materiais.sql`
3. Clique em **Run**
4. Verifique os logs no output

### Opção 2: Via Supabase CLI

```bash
cd mobile
supabase db push
```

**Nota:** Vai pedir a senha do banco. Use a senha do projeto.

### Opção 3: Via script batch (Windows)

```bash
scripts\database\aplicar-unificar-materiais.bat
```

## Verificação

Após aplicar, verifique no SQL Editor:

```sql
-- Ver quantas obras têm materiais unificados
SELECT COUNT(*)
FROM obras
WHERE jsonb_array_length(doc_materiais_previsto) > 0;

-- Ver se doc_materiais_realizado está vazio
SELECT COUNT(*)
FROM obras
WHERE jsonb_array_length(doc_materiais_realizado) > 0;
```

## Rollback (se necessário)

**⚠️ ATENÇÃO:** Esta migração é irreversível sem backup!

Se precisar reverter:
1. Restaure backup do banco de dados
2. Ou recrie manualmente separando os documentos

## Compatibilidade

- ✅ App mobile versão 1.2.0+ (já adaptado)
- ⚠️ Apps antigos continuam funcionando (coluna não foi removida)
- ✅ Web dashboard (não usa doc_materiais_realizado)

## Remoção futura da coluna

Em versão futura (quando todos os apps estiverem atualizados):

```sql
ALTER TABLE obras DROP COLUMN doc_materiais_realizado;
```

Por enquanto mantemos por compatibilidade.
