# 📸 Como Usar: Recuperar Fotos

## 🎯 Para Que Serve

O botão **"Recuperar Fotos"** permite recuperar dados de uma obra que foram sincronizados com o Supabase, mas que por algum motivo não estão aparecendo corretamente no mobile.

## 📍 Onde Está

Na tela de **detalhes da obra** (ao clicar em uma obra da lista), ao lado do botão de atualizar.

## 🔴 Quando Usar

Use o botão "Recuperar Fotos" quando:

1. ✅ As fotos aparecem no **sistema web** (Supabase)
2. ❌ As fotos **NÃO aparecem** no mobile
3. ❌ A obra mostra **"Aguardando sincronização"** mesmo após ter sido sincronizada
4. ❌ O botão **"Finalizar Obra"** aparece mesmo com a obra já finalizada

### Exemplos de Situações:

- Obra foi sincronizada mas as fotos sumiram do preview
- Obra foi editada (offline → online ou online → offline) e fotos anteriores se perderam
- Obra aparece como "não sincronizada" mas já foi sincronizada

## 🚀 Como Usar

### Passo a Passo:

1. **Abrir a obra** que está com problemas
2. **Clicar no botão vermelho** "🔧 Recuperar Fotos" (ao lado do botão de atualizar)
3. **Escolher uma opção**:

   - **☁️ Supabase (Recomendado)**: Busca dados diretamente do servidor
     - Use quando a obra foi sincronizada com sucesso
     - Recupera o estado exato do servidor

   - **📱 Backup Local**: Busca do backup local de fotos
     - Use quando a obra não foi sincronizada ainda
     - Recupera fotos que estão apenas no dispositivo

4. **Aguardar confirmação**:
   ```
   ✅ Sucesso
   Obra atualizada do Supabase! Atualizando tela...
   ```

5. **Verificar resultado**:
   - ✅ Fotos aparecem no preview
   - ✅ Badge "Sincronizada ✓" aparece (se usou opção Supabase)
   - ✅ Indicador "Aguardando sincronização" desaparece
   - ✅ Botão "Finalizar Obra" desaparece (se obra já estava finalizada)

## 🔍 Diferença Entre as Opções

### ☁️ Supabase (Recomendado)

```
✅ Quando usar:
- Obra foi sincronizada com sucesso
- Fotos aparecem no sistema web
- Quer garantir que está com a versão mais atualizada

✅ O que faz:
1. Busca obra no Supabase pelo número da obra
2. Baixa TODOS os dados (fotos, status, campos, etc.)
3. Substitui dados locais pelos do servidor
4. Marca obra como 'origem: online'
5. Remove indicador de "Aguardando sincronização"

✅ Resultado:
- Dados 100% iguais ao servidor
- Obra marcada como sincronizada
- Status preservado (finalizada, em aberto, etc.)
```

### 📱 Backup Local

```
✅ Quando usar:
- Obra ainda não foi sincronizada
- Fotos estão apenas no dispositivo
- Não tem acesso à internet

✅ O que faz:
1. Busca fotos no backup local (AsyncStorage de fotos)
2. Restaura referências de fotos na obra
3. NÃO muda status de sincronização

✅ Resultado:
- Fotos locais restauradas
- Status de sincronização NÃO muda
- Útil para recuperar fotos que estavam no dispositivo
```

## 🧪 Como Testar

### Teste 1: Recuperar Obra Sincronizada

1. Criar uma obra offline
2. Adicionar fotos
3. Finalizar obra
4. Sincronizar com Supabase
5. **Simular problema**: Fechar e reabrir app
6. Se obra aparecer como "Aguardando sincronização":
   - Clicar em "Recuperar Fotos" → "☁️ Supabase"
7. ✅ Verificar que:
   - Badge "Sincronizada ✓" aparece
   - Botão "Finalizar Obra" desaparece
   - Fotos aparecem

### Teste 2: Recuperar Fotos Locais

1. Criar obra offline
2. Adicionar fotos
3. NÃO sincronizar
4. **Simular problema**: Editar obra e perder fotos
5. Clicar em "Recuperar Fotos" → "📱 Backup Local"
6. ✅ Verificar que:
   - Fotos locais aparecem novamente
   - Obra continua como "Aguardando sincronização"

## 🐛 Solução de Problemas

### Problema: "Obra não encontrada no Supabase"

**Causa:** Obra não foi sincronizada ainda

**Solução:**
1. Usar opção "📱 Backup Local" ao invés de "☁️ Supabase"
2. Ou sincronizar a obra primeiro

### Problema: "Erro ao buscar obra"

**Causa:** Sem conexão com internet

**Solução:**
1. Conectar à internet
2. Ou usar opção "📱 Backup Local"

### Problema: Fotos não aparecem mesmo após recuperação

**Causa:** Fotos podem não existir no Supabase

**Solução:**
1. Verificar no sistema web se as fotos realmente existem
2. Se não existem, usar "📱 Backup Local"
3. Se backup local também não tem, fotos foram perdidas

## 📊 Logs de Debug

Após clicar em "Recuperar Fotos", verifique o console para logs:

### ✅ Sucesso (Supabase):
```
🔄 Forçando atualização da obra temp_XXXXX do Supabase...
📋 Buscando obra 99998888 da equipe EQUIPE_X no Supabase...
📊 Obra encontrada: 99998888 (ID: uuid-xxxxx)
   - fotos_antes: 3 item(s)
📊 Atualizando obra no AsyncStorage:
   - ID: uuid-xxxxx
   - Status: finalizada
   - Origem: online
   - Synced: true
✅ Obra atualizada com sucesso no AsyncStorage
```

### ✅ Sucesso (Backup Local):
```
🔍 Tentando recuperar fotos para obra: temp_XXXXX
🔍 Buscando fotos para IDs: temp_XXXXX, uuid-xxxxx
📸 Encontradas X fotos no backup
✅ Fotos recuperadas com sucesso!
```

### ❌ Erro:
```
❌ Obra temp_XXXXX não encontrada no AsyncStorage local
❌ Erro ao buscar obra por número: [mensagem de erro]
```

## 🔗 Relacionado

- [CORRECAO_STATUS_APOS_RECUPERACAO.md](./CORRECAO_STATUS_APOS_RECUPERACAO.md) - Detalhes técnicos da correção
- [BUG_FOTOS_SUMEM_APOS_SYNC.md](./BUG_FOTOS_SUMEM_APOS_SYNC.md) - Bug de fotos sumindo
- [OFFLINE_FIRST_IMPLEMENTACAO.md](./OFFLINE_FIRST_IMPLEMENTACAO.md) - Arquitetura offline-first

## ✅ Resultado Esperado

Após usar "Recuperar Fotos" com sucesso:

| Campo | Antes | Depois |
|-------|-------|--------|
| **ID** | `temp_1234567` | `uuid-xxxxx` (do Supabase) |
| **Origem** | `offline` | `online` |
| **Synced** | `false` | `true` |
| **Sync Status** | `pending` | `undefined` |
| **Status** | `em_aberto` | `finalizada` (se estava finalizada) |
| **Fotos** | ❌ Não aparecem | ✅ Aparecem |
| **UI - Badge** | "Aguardando sincronização" | "Sincronizada ✓" |
| **UI - Botão** | "Finalizar Obra" visível | Não aparece (se finalizada) |
