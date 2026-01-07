# 🔧 Como Corrigir Obra com Erro de Finalização

## 🐛 Problema

Ao tentar finalizar uma obra (ex: 00022211), ocorreu o seguinte erro:

```
Erro ao finalizar obra: {
  "code": "22P02",
  "message": "invalid input syntax for type uuid: \"local_1767731163050_fu2myh5u7\""
}
```

**Causa**: A obra tem ID local (`local_...`) mas o Supabase espera UUID válido.

**Resultado**:
- Botão "Finalizar" sumiu
- Obra ficou marcada como "rascunho"
- Não consegue mais finalizar

## ✅ Solução Rápida (Recomendada)

### Passo 1: Ir para Lista de Obras

Na tela principal do app, vá para a aba "Obras" (lista de todas as obras).

### Passo 2: Clicar em "Corrigir"

No topo da lista, você verá dois botões:
- 🔄 **Sincronizar**
- 🔧 **Corrigir** ← CLICAR AQUI

### Passo 3: Confirmar

Aparecerá um alerta:

```
🔧 Corrigir e Limpar Obras

Deseja corrigir automaticamente o status das obras?

✅ Remove duplicatas
✅ Atualiza status do Supabase
✅ Corrige origem das obras

[Cancelar] [Corrigir]
```

Clique em **"Corrigir"**.

### Passo 4: Resultado

Você verá uma mensagem como:

```
✅ Correção Concluída

Obras antes: 25
Duplicatas removidas: 3
Obras únicas: 22
Status corrigidos: 5
Erros: 0
```

### Passo 5: Verificar

- Abra a obra 00022211 novamente
- O botão "Finalizar" deve ter voltado
- O status deve estar correto

## 🔍 O Que a Função "Corrigir" Faz

A função `fixObraOrigemStatus()` executa 3 etapas:

### 1. Remove Duplicatas
```typescript
// Se existem múltiplas versões da mesma obra
// Mantém apenas a mais recente
```

### 2. Corrige Status e IDs
Para cada obra:
- Busca no Supabase
- Se encontrou:
  - ✅ Atualiza `status` com valor do Supabase
  - ✅ Atualiza `origem` para `'online'`
  - ✅ Corrige ID `local_...` → UUID do Supabase
  - ✅ Marca `synced = true`
- Se não encontrou:
  - Obra nunca sincronizada → mantém offline
  - Obra já sincronizada → **REMOVE** (foi deletada)

### 3. Salva Correções
```typescript
await AsyncStorage.setItem('@obras_local', JSON.stringify(obrasCorrigidas));
```

## 📋 Detalhes Técnicos

### Arquivo Modificado
`mobile/lib/fix-origem-status.ts` (linha 157)

### Mudança Feita
```typescript
// ANTES
if (obra.id.startsWith('temp_') && supabaseObra.id) {
  obra.id = supabaseObra.id;
  // ...
}

// DEPOIS
if ((obra.id.startsWith('temp_') || obra.id.startsWith('local_')) && supabaseObra.id) {
  obra.id = supabaseObra.id;
  obra.serverId = supabaseObra.id;
  modificada = true;
}
```

### Logs Gerados

Ao clicar "Corrigir", você verá logs como:

```
🔧 Iniciando correção de obras...
📊 Total de obras locais (antes): 25

🧹 PASSO 1: Removendo duplicatas...
  🔍 Obra 00022211: 2 cópias encontradas
    ✅ Mantendo versão de 2025-01-05
    ❌ Removendo 1 duplicata(s)

📊 Duplicatas removidas: 3
📊 Obras únicas restantes: 22

🔧 PASSO 2: Corrigindo status e removendo obras deletadas...

🔍 Verificando obra 15/22: 00022211
  🔍 Buscando obra 00022211 no Supabase...
  ✅ Encontrada por número: 00022211
  📝 Corrigindo obra 00022211:
    - origem: 'offline' → 'online'
    - status: 'rascunho' → 'em_aberto'
    - ID: local_1767731163050_fu2myh5u7 → a1b2c3d4-e5f6-7890-abcd-ef1234567890
    - synced: false → true
  ✅ Obra 00022211 corrigida!

✅ Correção concluída
📊 Resultado:
  - Total: 22
  - Corrigidas: 5
  - Erros: 0
  - Duplicatas removidas: 3
```

## ⚠️ Cenários Especiais

### Cenário 1: Obra Foi Deletada do Banco
Se você deletou a obra do Supabase:

```
🗑️ REMOVENDO: Obra 00022211 foi deletada do Supabase
  - ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
  - Synced: true
  - Origem: online
```

**Resultado**: Obra removida do app.

### Cenário 2: Obra Nunca Sincronizou
Se a obra nunca foi enviada ao Supabase:

```
📝 Mantendo obra offline: 00022211
  - origem: offline
  - status: em_aberto
```

**Resultado**: Obra mantida como offline.

### Cenário 3: Obra Tem Erro no Supabase
Se houver erro ao buscar:

```
❌ Erro ao corrigir obra 00022211: [erro]
```

**Resultado**: Obra mantida sem alterações (segurança).

## 🎯 Prevenção Futura

### Para Evitar Este Problema:

**Rascunhos Locais NÃO PODEM ser finalizados diretamente.**

O fluxo correto é:

1. **Criar Rascunho**
   ```
   Nova Obra → Pausar
   Status: rascunho
   ID: local_...
   ```

2. **Completar Rascunho**
   ```
   Adicionar Fotos → Criar Obra
   Status: em_aberto
   ID: UUID do Supabase
   ```

3. **Finalizar Obra**
   ```
   Finalizar Obra
   Status: finalizada
   ```

### Botões Corretos:

**Tela Nova Obra (rascunho local completo)**:
```
[Pausar] [Criar Obra] [Cancelar]
         ↑ Clicar aqui para criar no Supabase
```

**Tela Detalhes (obra online)**:
```
[Adicionar Fotos] [Finalizar Obra]
                  ↑ Agora pode finalizar
```

**Tela Detalhes (rascunho local)**:
```
[Adicionar Fotos]
(sem botão Finalizar - precisa criar primeiro)
```

## 📝 Resumo

1. ❌ **Problema**: Obra com ID local tentou ser finalizada → erro → ficou como rascunho
2. ✅ **Solução**: Clicar em "Corrigir" na lista de obras
3. 🔄 **Resultado**: Status corrigido, ID atualizado, botão "Finalizar" volta
4. 🛡️ **Prevenção**: Usar botão "Criar Obra" antes de "Finalizar" para rascunhos locais

## 🔗 Arquivos Relacionados

- [mobile/lib/fix-origem-status.ts](../mobile/lib/fix-origem-status.ts) - Função de correção
- [mobile/app/(tabs)/obras.tsx](../mobile/app/(tabs)/obras.tsx) - Botão "Corrigir"
- [mobile/app/obra-detalhe.tsx](../mobile/app/obra-detalhe.tsx) - Tela de detalhes
- [mobile/app/nova-obra.tsx](../mobile/app/nova-obra.tsx) - Tela de criação/edição
