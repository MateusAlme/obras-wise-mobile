# ⚠️ MIGRAÇÃO PENDENTE - APLICAR AGORA

## Passo 1: Aplicar Migração no Banco de Dados

Execute **UM** dos métodos abaixo:

### Método 1: Via Script Batch (Recomendado)
```bash
scripts\database\aplicar-status-obra.bat
```

### Método 2: Via Supabase CLI
```bash
cd "C:\Users\Mateus Almeida\obras-wise-mobile"
supabase db push
```

### Método 3: Manual no Supabase Dashboard
1. Acesse: https://supabase.com/dashboard
2. Vá em: SQL Editor
3. Copie todo o conteúdo de: `supabase/migrations/20250227_adicionar_status_obra.sql`
4. Cole e execute

---

## O que a migração faz:

✅ Adiciona coluna `data_abertura` (quando a obra foi iniciada)
✅ Adiciona coluna `data_fechamento` (quando a obra foi finalizada)
✅ Para obras existentes: `data_abertura = created_at`
✅ Cria índices para melhor performance

---

## Após aplicar a migração:

A página de **Acompanhamento** vai mostrar:
- ✅ Data de Abertura (quando iniciou)
- ✅ Data de Fechamento (quando finalizou ou "Aguardando")
- ✅ Dias em Aberto (com cores de alerta)

---

## Status Atual:

❌ Migração NÃO aplicada
❌ Colunas `data_abertura` e `data_fechamento` NÃO existem no banco
❌ Página de Acompanhamento mostrando "-" nas datas

## Após aplicar:

✅ Migração aplicada
✅ Colunas criadas no banco
✅ Datas aparecendo corretamente
✅ Sistema funcionando 100%

---

**IMPORTANTE:** Após aplicar a migração, delete este arquivo.
