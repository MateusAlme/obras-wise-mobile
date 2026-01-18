# ⚡ Quick Reference: Anti-Crash System

## 🚀 Uso Rápido

### 1. Executar Operação Assíncrona com Segurança

```typescript
import { safeAsync } from '../lib/safe-operations';

const data = await safeAsync(
  async () => await fetchData(),
  {
    errorMessage: 'Erro ao carregar dados',
    defaultValue: [],
    showAlert: true
  }
);
```

### 2. Executar com Retry Automático

```typescript
import { safeRetry } from '../lib/safe-operations';

const result = await safeRetry(
  async () => await syncData(),
  3, // tentativas
  2000, // delay (ms)
  { errorMessage: 'Falha ao sincronizar' }
);
```

### 3. Validar Campo Obrigatório

```typescript
import { validateRequired, validateNotBlank } from '../lib/safe-operations';

validateRequired(userId, 'ID do usuário');
validateNotBlank(nomeObra, 'Nome da obra');
```

### 4. Proteger Componente com Error Boundary

```typescript
import { ErrorBoundary } from '../components/ErrorBoundary';

<ErrorBoundary>
  <SeuComponente />
</ErrorBoundary>
```

### 5. Try-Catch com Finally Seguro

```typescript
try {
  setLoading(true);
  await operation();
} catch (error: any) {
  console.error('🚨 Erro:', error);
  Alert.alert('Erro', 'Mensagem amigável');
} finally {
  try {
    setLoading(false);
  } catch (err) {
    console.error('❌ Erro ao resetar:', err);
  }
}
```

---

## 🎯 Padrões de Código

### ✅ BOM

```typescript
// Operação com proteção
const result = await safeAsync(
  async () => await fetchData(),
  { defaultValue: [] }
);

// Validação antes de usar
if (!data?.items?.length) {
  return [];
}

// Timeout para operações longas
const result = await Promise.race([
  longOperation(),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), 10000)
  )
]);

// Finally sempre reseta estado
finally {
  try {
    setLoading(false);
  } catch (err) {
    console.error(err);
  }
}
```

### ❌ EVITAR

```typescript
// Sem proteção
const data = await fetchData(); // Pode crashar!

// Sem validação
const lat = location.coords.latitude; // Pode crashar!

// Sem timeout
const result = await longOperation(); // Pode travar!

// Finally sem try-catch
finally {
  setLoading(false); // Pode crashar no finally!
}
```

---

## 🛡️ Checklist de Segurança

Ao adicionar nova funcionalidade, verificar:

- [ ] Operação assíncrona tem try-catch?
- [ ] Estado é resetado no finally?
- [ ] Dados são validados antes de usar?
- [ ] Operação longa tem timeout?
- [ ] Valor padrão definido para fallback?
- [ ] Mensagem de erro amigável?
- [ ] Logs de erro implementados?
- [ ] Testado sem internet?
- [ ] Testado sem permissões?
- [ ] Testado com armazenamento cheio?

---

## 📊 Mensagens de Erro Padrão

### Estrutura Recomendada

```typescript
catch (error: any) {
  // 1. LOG DETALHADO
  console.error('🚨 Erro CRÍTICO em [operação]:', error);
  console.error('📊 Stack:', error?.stack || 'N/A');
  console.error('📍 Contexto:', { dados relevantes });

  // 2. MENSAGEM AMIGÁVEL
  let errorMessage = 'Mensagem padrão';
  let errorTitle = 'Erro';

  if (error?.message?.includes('network')) {
    errorMessage = 'Problema de conexão...';
    errorTitle = 'Sem Internet';
  }

  // 3. ALERT COM OPÇÃO DE RETRY
  Alert.alert(
    errorTitle,
    `${errorMessage}\n\nDeseja tentar novamente?`,
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Tentar Novamente', onPress: () => retry() }
    ]
  );
}
```

---

## 🔍 Debug

### Ver Logs de Erro Salvos

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Ver logs
const logs = await AsyncStorage.getItem('@error_logs');
console.log(JSON.parse(logs));

// Limpar logs
await AsyncStorage.removeItem('@error_logs');
```

### Console Logs em Desenvolvimento

```typescript
// iOS
npx react-native log-ios

// Android
npx react-native log-android
```

---

## 🆘 Troubleshooting

### App fechando sozinho?

1. ✅ ErrorBoundary está no _layout.tsx?
2. ✅ Operação crítica tem try-catch?
3. ✅ Finally reseta estado com try-catch?

### GPS travando?

1. ✅ getCurrentLocation tem timeout de 10s?
2. ✅ Retorna `{ latitude: null, longitude: null }` no catch?

### Erro ao salvar?

1. ✅ prosseguirSalvamento tem try-catch robusto?
2. ✅ Oferece opção de retry?
3. ✅ Dados salvos no backup local?

---

## 📚 Arquivos Importantes

| Arquivo | Descrição |
|---------|-----------|
| `mobile/components/ErrorBoundary.tsx` | Error Boundary global |
| `mobile/lib/safe-operations.ts` | Funções helper seguras |
| `mobile/app/_layout.tsx` | Layout com ErrorBoundary |
| `mobile/app/nova-obra.tsx` | Formulário protegido |
| `docs/PROTECAO_CONTRA_CRASHES.md` | Documentação completa |
| `docs/RESUMO_ANTI_CRASH.md` | Resumo executivo |

---

## ✅ Status de Proteção

| Operação | Protegida | Timeout | Retry | Fallback |
|----------|-----------|---------|-------|----------|
| takePicture | ✅ | - | - | - |
| getCurrentLocation | ✅ | ✅ 10s | - | ✅ null |
| prosseguirSalvamento | ✅ | - | ✅ | ✅ offline |
| handleSalvarObra | ✅ | - | ✅ | - |
| renderPhotoWithPlaca | ✅ | - | - | ✅ original |
| backupPhoto | ✅ | - | - | - |

---

**Última atualização:** 2026-01-18
**Status:** ✅ Produção Ready
