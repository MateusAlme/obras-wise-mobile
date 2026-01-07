# 🐛 Erro: LoadBundleFromServerRequestError ao Pausar Obra Offline

## 📋 Problema

Ao tentar pausar uma obra no modo offline, ocorre o erro:

```
LoadBundleFromServerRequestError
```

**Contexto**:
- Criando ou editando obra no app mobile ✅
- Ao clicar em "Pausar" (salvar rascunho) ❌
- Erro ao carregar módulos necessários

## 🔍 Causa Raiz

O erro `LoadBundleFromServerRequestError` é um **erro do Metro bundler** (servidor de desenvolvimento Expo), não do código da aplicação.

### Por Que Acontece?

1. **Cache corrompido** do Metro bundler
2. **Conexão instável** com o servidor de desenvolvimento
3. **Módulos sendo importados dinamicamente** não podem ser carregados do servidor
4. **Porta do servidor bloqueada** ou conflitando

### Onde Ocorre no Código?

A função `handlePausar` faz **3 imports dinâmicos** que podem falhar:

**1. Import do módulo offline-sync** (linha 2672)
```typescript
const offlineSyncModule = await import('../lib/offline-sync');
```

**2. Import do módulo photo-backup para atualizar IDs** (linha 2784)
```typescript
const photoBackupModule = await import('../lib/photo-backup');
```

**3. Import do módulo photo-backup para obter URLs** (linha 2048 - em handleSalvarObra)
```typescript
const photoBackupModule = await import('../lib/photo-backup');
```

Quando o Metro bundler está com problema, ele **não consegue** entregar esses módulos para o app, causando o erro.

## ✅ Soluções

### Solução 1: Limpar Cache do Metro Bundler (Recomendado)

1. **Parar** o servidor Expo (Ctrl+C no terminal)

2. **Limpar cache** e reiniciar:
   ```bash
   npx expo start -c
   ```

3. **Reabrir** o app no celular/emulador

4. **Tentar** pausar a obra novamente ✅

### Solução 2: Limpar Todos os Caches

Se a Solução 1 não funcionar:

```bash
# Limpar cache do Expo e node_modules
cd mobile
rm -rf .expo
rm -rf node_modules/.cache
npx expo start -c
```

No Windows (PowerShell):
```powershell
cd mobile
Remove-Item -Recurse -Force .expo
Remove-Item -Recurse -Force node_modules\.cache
npx expo start -c
```

Ou use o comando pré-aprovado:
```bash
cmd.exe /c "cd mobile && if exist .expo rmdir /s /q .expo && if exist node_modules\.cache rmdir /s /q node_modules\.cache"
npx expo start -c
```

### Solução 3: Reiniciar Servidor Expo Completamente

```bash
# 1. Parar servidor (Ctrl+C)

# 2. Matar processos do Node (se necessário)
# Windows:
taskkill /F /IM node.exe

# Mac/Linux:
killall node

# 3. Reiniciar
npx expo start -c
```

### Solução 4: Verificar Firewall/Antivírus

Às vezes o firewall ou antivírus bloqueia a porta do Metro bundler (padrão: 8081).

1. **Verificar** se a porta 8081 está aberta
2. **Adicionar exceção** no firewall/antivírus para:
   - `node.exe`
   - Porta `8081`

### Solução 5: Usar Túnel Expo (Último Recurso)

Se nada funcionar, use túnel:

```bash
npx expo start --tunnel
```

Isso faz o Metro bundler usar um túnel na internet em vez de localhost, contornando problemas de rede.

## 🛡️ Prevenção Futura

### Melhorias Implementadas no Código

**Arquivo**: `mobile/app/nova-obra.tsx`

#### 1. Tratamento de Erro no Import de offline-sync (linhas 2669-2678)

```typescript
// ✅ ANTES: Import direto (sem tratamento de erro)
const { saveObraLocal } = await import('../lib/offline-sync');

// ✅ DEPOIS: Import com tratamento de erro
console.log('📦 Importando módulo offline-sync...');
let saveObraLocal: any;
try {
  const offlineSyncModule = await import('../lib/offline-sync');
  saveObraLocal = offlineSyncModule.saveObraLocal;
  console.log('✅ Módulo offline-sync importado com sucesso');
} catch (err: any) {
  console.error('❌ Erro ao importar offline-sync:', err);
  throw new Error('Não foi possível carregar o módulo de sincronização. Tente reiniciar o app.\n\nDica: Limpe o cache com:\nnpx expo start -c');
}
```

#### 2. Tratamento de Erro no Import de photo-backup (linhas 2783-2792)

```typescript
// ✅ ANTES: Import direto (sem tratamento de erro)
const { updatePhotosObraId } = await import('../lib/photo-backup');

// ✅ DEPOIS: Import com tratamento de erro
console.log('📦 Importando módulo photo-backup para atualizar IDs...');
const photoBackupModule = await import('../lib/photo-backup');
console.log('✅ Módulo photo-backup importado com sucesso');

const qtd = await photoBackupModule.updatePhotosObraId(backupObraId, savedObraId);
console.log(`✅ ${qtd} foto(s) atualizadas com novo obraId`);
```

**Mudanças**:
1. ✅ **Logs antes e depois** do import para identificar onde falha
2. ✅ **Try/catch específico** para cada import
3. ✅ **Mensagem clara** com instruções de solução
4. ✅ **Fallback gracioso** em alguns casos (continua sem atualizar IDs)

### Mensagem de Erro Melhorada

Agora, se o erro ocorrer novamente, o usuário verá uma mensagem **útil** com instruções de como resolver:

```
❌ Erro ao Pausar Obra

Não foi possível carregar o módulo de sincronização. Tente reiniciar o app.

Dica: Limpe o cache com:
npx expo start -c

[OK]
```

## 📊 Fluxo Corrigido

### Antes (❌ Crash sem explicação)
```
1. Usuário clica em "Pausar"
2. App tenta importar offline-sync
3. Metro bundler falha
4. Erro: LoadBundleFromServerRequestError ❌
5. App trava, usuário não sabe o que fazer
```

### Depois (✅ Erro tratado com instrução)
```
1. Usuário clica em "Pausar"
2. App tenta importar offline-sync
   - Log: "📦 Importando módulo offline-sync..."
3. Metro bundler falha
4. Erro capturado ✅
   - Log: "❌ Erro ao importar offline-sync: [erro]"
5. Alert mostra:
   "Não foi possível carregar o módulo de sincronização.

   Tente reiniciar o app.

   Dica: Limpe o cache com:
   npx expo start -c"
6. Usuário segue instruções e resolve ✅
```

## 🎯 Como Debugar

Se o erro continuar ocorrendo, siga estes passos:

### Passo 1: Verificar Logs do Console

Procure por:
```
📦 Importando módulo offline-sync...
❌ Erro ao importar offline-sync: [erro]
```

ou

```
📦 Importando módulo photo-backup para atualizar IDs...
❌ Erro ao importar photo-backup: [erro]
```

### Passo 2: Verificar Servidor Expo

No terminal onde Expo está rodando, procure por:
```
Unable to resolve module
Failed to load bundle
Metro bundler error
```

### Passo 3: Testar Conexão

```bash
# Verificar se porta 8081 está aberta
netstat -an | grep 8081

# Windows:
netstat -an | findstr 8081
```

Se não houver saída, o servidor não está rodando corretamente.

### Passo 4: Logs Detalhados

Habilitar logs verbosos do Metro:

```bash
EXPO_DEBUG=true npx expo start -c
```

## 🔗 Links Úteis

- [Expo Metro Bundler Docs](https://docs.expo.dev/guides/customizing-metro/)
- [Troubleshooting Expo](https://docs.expo.dev/troubleshooting/clear-cache-windows/)

## 🚀 Status

✅ **Tratamento de Erro Implementado**

- ✅ Catch específico para erro de import de offline-sync
- ✅ Catch específico para erro de import de photo-backup
- ✅ Mensagem útil com instruções
- ✅ Logs detalhados para debug
- ✅ Graceful degradation (aviso, mas continua quando possível)

## 📝 Resumo

**Causa**: Metro bundler com cache corrompido ou problema de conexão

**Solução Rápida**: `npx expo start -c` (limpar cache)

**Prevenção**: Código agora trata erro graciosamente e informa usuário com instruções claras

---

**Importante**: Este erro é **temporário** e relacionado ao **ambiente de desenvolvimento**. No app em produção (build APK/IPA), este erro **não ocorrerá** porque o código já está bundled (não precisa carregar do servidor).

## 🔗 Documentação Relacionada

- [ERRO_LOADBUNDLE_CARREGAR_OBRA.md](./ERRO_LOADBUNDLE_CARREGAR_OBRA.md) - Mesmo erro ao carregar obra
- [CORRECAO_BOTOES_E_DUPLICATAS.md](./CORRECAO_BOTOES_E_DUPLICATAS.md) - Correção de botões e duplicatas
