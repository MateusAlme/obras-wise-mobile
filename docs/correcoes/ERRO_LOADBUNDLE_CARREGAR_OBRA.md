# 🐛 Erro: LoadBundleFromServerRequestError ao Carregar Obra Offline

## 📋 Problema

Ao tentar continuar editando uma obra offline já criada, ocorre o erro:

```
LoadBundleFromServerRequestError
```

**Contexto**:
- Obra foi criada e pausada anteriormente ✅
- Ao clicar na obra para continuar editando ❌
- Erro ao carregar fotos da obra

## 🔍 Causa Raiz

O erro `LoadBundleFromServerRequestError` é um **erro do Metro bundler** (servidor de desenvolvimento Expo), não do código da aplicação.

### Por Que Acontece?

1. **Cache corrompido** do Metro bundler
2. **Conexão instável** com o servidor de desenvolvimento
3. **Módulo sendo importado dinamicamente** não pode ser carregado do servidor
4. **Porta do servidor bloqueada** ou conflitando

### Onde Ocorre no Código?

**Arquivo**: `mobile/app/nova-obra.tsx` (linha 377)

```typescript
// Import dinâmico que pode falhar se Metro bundler estiver com problema
const photoBackupModule = await import('../lib/photo-backup');
```

Quando o Metro bundler está com problema, ele **não consegue** entregar o módulo `photo-backup` para o app, causando o erro.

## ✅ Soluções

### Solução 1: Limpar Cache do Metro Bundler (Recomendado)

1. **Parar** o servidor Expo (Ctrl+C no terminal)

2. **Limpar cache** e reiniciar:
   ```bash
   npx expo start -c
   ```

3. **Reabrir** o app no celular/emulador

4. **Tentar** abrir a obra novamente ✅

### Solução 2: Limpar Todos os Caches

Se a Solução 1 não funcionar:

```bash
# Limpar cache do Expo
rm -rf .expo

# Limpar cache do node_modules
rm -rf node_modules/.cache

# Limpar cache do Metro
npx expo start -c
```

No Windows (PowerShell):
```powershell
# Limpar cache do Expo
Remove-Item -Recurse -Force .expo

# Limpar cache do node_modules
Remove-Item -Recurse -Force node_modules\.cache

# Limpar cache do Metro
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

**Arquivo**: `mobile/app/nova-obra.tsx` (linhas 377-386)

```typescript
// ✅ ANTES: Import direto (sem tratamento de erro)
const { getPhotosByObra } = await import('../lib/photo-backup');

// ✅ DEPOIS: Import com tratamento de erro
const photoBackupModule = await import('../lib/photo-backup').catch(err => {
  console.error('❌ Erro ao importar photo-backup:', err);
  throw new Error('Não foi possível carregar o módulo de fotos. Tente reiniciar o app.');
});

const localPhotos = await photoBackupModule.getPhotosByObra(obraData.id).catch(err => {
  console.error('❌ Erro ao buscar fotos:', err);
  return []; // Retorna array vazio em caso de erro (graceful degradation)
});
```

**Mudanças**:
1. ✅ **Tratamento específico** de erro no import dinâmico
2. ✅ **Mensagem clara** para o usuário
3. ✅ **Graceful degradation**: Se fotos não carregam, retorna array vazio (permite continuar editando)
4. ✅ **Logs detalhados** para debug

### Mensagem de Erro Melhorada

**Arquivo**: `mobile/app/nova-obra.tsx` (linhas 491-499)

```typescript
// Mensagem específica dependendo do erro
let errorMessage = 'Não foi possível carregar os dados da obra.';
if (error.message?.includes('módulo de fotos')) {
  errorMessage = error.message + '\n\nDica: Limpe o cache com:\n1. Feche o app\n2. No terminal: npx expo start -c';
} else if (error.message?.includes('LoadBundle')) {
  errorMessage = 'Erro ao carregar módulos do servidor.\n\nTente:\n1. Reiniciar o servidor Expo\n2. Limpar cache: npx expo start -c';
}

Alert.alert('Erro ao Carregar Obra', errorMessage);
```

Agora, se o erro ocorrer novamente, o usuário verá uma mensagem **útil** com instruções de como resolver.

## 📊 Fluxo Corrigido

### Antes (❌ Crash sem explicação)
```
1. Usuário clica em obra pausada
2. App tenta importar photo-backup
3. Metro bundler falha
4. Erro: LoadBundleFromServerRequestError ❌
5. App trava, usuário não sabe o que fazer
```

### Depois (✅ Erro tratado com instrução)
```
1. Usuário clica em obra pausada
2. App tenta importar photo-backup
3. Metro bundler falha
4. Erro capturado ✅
5. Alert mostra:
   "Erro ao carregar módulos do servidor.

   Tente:
   1. Reiniciar o servidor Expo
   2. Limpar cache: npx expo start -c"
6. Usuário segue instruções e resolve ✅
```

## 🎯 Como Debugar

Se o erro continuar ocorrendo, siga estes passos:

### Passo 1: Verificar Logs do Console

Procure por:
```
📦 Importando módulo photo-backup...
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

- ✅ Catch específico para erro de import
- ✅ Mensagem útil com instruções
- ✅ Graceful degradation (app não trava)
- ✅ Logs detalhados para debug

## 📝 Resumo

**Causa**: Metro bundler com cache corrompido ou problema de conexão

**Solução Rápida**: `npx expo start -c` (limpar cache)

**Prevenção**: Código agora trata erro graciosamente e informa usuário

---

**Importante**: Este erro é **temporário** e relacionado ao **ambiente de desenvolvimento**. No app em produção (build APK/IPA), este erro **não ocorrerá** porque o código já está bundled (não precisa carregar do servidor).
