# 🔍 Diagnóstico: Obra Criada Hoje Sumiu

## Problema Reportado

Obra criada hoje desapareceu da listagem.

## Causas Possíveis

### 1. Obra Salva em Local Diferente

O sistema tem **3 locais** onde obras podem ser armazenadas:

```
📦 AsyncStorage
├─ @obras_pending_sync    → Obras pendentes de sincronização (finalizadas offline)
├─ @obras_local           → Rascunhos locais (botão "Pausar")
└─ @obras_list            → Lista de obras (pode estar aqui se foi carregada)
```

### 2. Filtro de Equipe

A tela de obras só mostra obras da **equipe logada**. Se a obra foi criada com equipe diferente, não aparece.

### 3. Problema de Sincronização

Se você clicou em "Finalizar" mas:
- Perdeu conexão durante upload
- Ocorreu erro no Supabase
- App foi fechado antes de completar

A obra pode estar em estado inconsistente.

### 4. Cache do AsyncStorage

Em raras ocasiões, o AsyncStorage pode não persistir os dados se:
- Memória do celular está cheia
- App foi forçado a fechar
- Erro de permissão

## 🔧 Como Diagnosticar

### Passo 1: Adicionar Script de Debug

1. Abra `mobile/app/(tabs)/obras.tsx`

2. Adicione o import no topo:
```typescript
import { debugObras, obrasDeHoje } from '../../utils/debug-obras';
```

3. Adicione um botão temporário na UI (após a linha ~220, antes do return):
```typescript
{/* 🔍 DEBUG TEMPORÁRIO - REMOVER DEPOIS */}
<TouchableOpacity
  style={{
    position: 'absolute',
    top: 100,
    right: 20,
    backgroundColor: '#ff9800',
    padding: 10,
    borderRadius: 8,
    zIndex: 9999
  }}
  onPress={async () => {
    console.log('🔍 Iniciando diagnóstico...');
    await debugObras();
    const hoje = await obrasDeHoje();
    Alert.alert(
      'Diagnóstico',
      `Obras de hoje: ${hoje.length}\nVeja o console para detalhes.`
    );
  }}
>
  <Text style={{ color: '#fff', fontWeight: 'bold' }}>🔍 DEBUG</Text>
</TouchableOpacity>
```

4. Recarregue o app

5. Clique no botão "🔍 DEBUG"

6. Abra o console do Metro Bundler e veja a saída

### Passo 2: Interpretar Resultados

#### Se aparecer em `@obras_pending_sync`:
✅ **Obra existe!** Está aguardando sincronização.

**Solução:**
- Vá para aba "Perfil"
- Clique em "Sincronizar X foto(s)"
- Obra aparecerá na listagem após sync

#### Se aparecer em `@obras_local`:
✅ **Obra existe como rascunho!**

**Solução:**
- Verifique se você clicou em "Pausar" ao invés de "Finalizar"
- Abra a obra na listagem de rascunhos
- Clique em "Criar Obra" para finalizar

#### Se aparecer em `@obras_list`:
✅ **Obra existe na lista local!**

**Problema:** Por que não aparece na tela?

**Possíveis causas:**
1. **Filtro de equipe:** Obra foi criada com equipe diferente da logada
2. **Filtro de busca:** Campo de busca está preenchido
3. **Bug de renderização:** Recarregue o app

**Solução:**
- Limpe o campo de busca (se houver)
- Force refresh puxando a tela para baixo
- Saia e entre novamente no app

#### Se NÃO aparecer em lugar nenhum:
❌ **Obra perdida!**

**Causas prováveis:**
1. App fechou antes de salvar
2. Erro de AsyncStorage
3. Memória do celular cheia

**Solução:**
- Dados foram perdidos, precisa criar novamente
- Veja "Prevenção" abaixo

### Passo 3: Verificar Fotos Órfãs

Se a obra sumiu mas você tirou fotos, elas podem estar salvas:

```typescript
// No console do debug, procure por:
📸 Metadados de Fotos: X
   Obras com fotos:
   - Obra local_123456: 5 foto(s)  ← ESTA É SUA OBRA!
```

Se houver fotos com um `obraId` que não está em nenhuma lista, **suas fotos existem** mas a obra sumiu.

**Solução:** Não é possível recuperar automaticamente, mas as fotos estão em:
```
FileSystem.documentDirectory + 'obra_photos_backup/'
```

Você pode criar uma nova obra e as fotos antigas não serão perdidas (mas ficarão órfãs no cache).

## 🛡️ Prevenção

### 1. Use o Botão "Pausar" Frequentemente

```
Durante criação da obra:
├─ Preencher campos
├─ 👉 CLICAR "PAUSAR" (salva rascunho)
├─ Tirar mais fotos
├─ 👉 CLICAR "PAUSAR" novamente
├─ Continuar preenchendo
└─ 👉 CLICAR "FINALIZAR" quando terminar
```

O botão "Pausar" salva imediatamente no AsyncStorage. Se o app fechar, você não perde nada.

### 2. Sincronize Diariamente

```
No final do dia:
1. Aba "Perfil"
2. Botão "Sincronizar X foto(s)"
3. Aguardar conclusão
4. Botão "Limpar Cache" (opcional)
```

Obras sincronizadas ficam seguras no Supabase.

### 3. Não Force Fechar o App Durante Salvamento

Quando clicar em "Finalizar":
- Aguarde a mensagem de sucesso
- Não feche o app imediatamente
- Não force fechar (swipe up no Android)

### 4. Mantenha Espaço em Disco

AsyncStorage precisa de espaço:
- Mínimo: 500 MB livres
- Recomendado: 1 GB livres

## 🔧 Código de Recuperação Manual

Se você identificou que a obra existe mas não aparece, pode tentar recuperar manualmente:

### Recuperar de `@obras_pending_sync`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncAllPendingObras } from './lib/offline-sync';

// Executar no console ou em um botão temporário
const recuperarPendentes = async () => {
  const result = await syncAllPendingObras();
  console.log(`Sincronizadas: ${result.success}`);
  console.log(`Falharam: ${result.failed}`);
};
```

### Recuperar de `@obras_local`:

```typescript
import { getLocalObras } from './lib/offline-sync';

const listarRascunhos = async () => {
  const rascunhos = await getLocalObras();
  console.log(`Rascunhos encontrados: ${rascunhos.length}`);
  rascunhos.forEach((obra, i) => {
    console.log(`${i + 1}. ${obra.obra} - ${obra.data}`);
  });
};
```

### Forçar Reload da Lista:

```typescript
// No arquivo obras.tsx, adicione um botão:
<TouchableOpacity onPress={async () => {
  setLoading(true);
  await loadPendingObras();
  await carregarObras();
  setRefreshing(true);
  setRefreshing(false);
  setLoading(false);
  Alert.alert('Sucesso', 'Lista recarregada!');
}}>
  <Text>🔄 Forçar Reload</Text>
</TouchableOpacity>
```

## 📝 Checklist de Diagnóstico

- [ ] Executei `debugObras()` e vi o console
- [ ] Verifiquei se obra está em `@obras_pending_sync`
- [ ] Verifiquei se obra está em `@obras_local`
- [ ] Verifiquei se obra está em `@obras_list`
- [ ] Verifiquei se há fotos órfãs com o obraId
- [ ] Tentei limpar o filtro de busca
- [ ] Tentei fazer pull-to-refresh
- [ ] Tentei sincronizar obras pendentes
- [ ] Verifiquei se estou na equipe correta
- [ ] Reiniciei o app

## 🆘 Se Nada Funcionar

Se após todo o diagnóstico a obra realmente desapareceu:

1. **Capture logs do console** (screenshot da saída de `debugObras()`)
2. **Anote:**
   - Número da obra
   - Data/hora aproximada da criação
   - Qual botão clicou ("Pausar" ou "Finalizar")
   - Se tinha internet na hora
   - Se o app fechou/travou
3. **Verifique espaço em disco** do celular
4. **Crie a obra novamente** (dados foram perdidos)

## 💡 Melhorias Futuras (Opcional)

Para evitar esse problema no futuro, considere implementar:

### 1. Auto-Save a Cada 30 Segundos

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    if (obra && responsavel && tipoServico) {
      handlePausarObra(); // Salva automaticamente
    }
  }, 30000); // 30 segundos

  return () => clearInterval(interval);
}, [obra, responsavel, tipoServico]);
```

### 2. Confirmação Antes de Sair

```typescript
useEffect(() => {
  const unsubscribe = router.beforeRemove((e) => {
    if (hasPendingChanges) {
      e.preventDefault();
      Alert.alert(
        'Atenção',
        'Você tem alterações não salvas. Deseja sair mesmo assim?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sair sem Salvar', onPress: () => router.back() },
          { text: 'Pausar e Sair', onPress: async () => {
            await handlePausarObra();
            router.back();
          }}
        ]
      );
    }
  });

  return unsubscribe;
}, [hasPendingChanges]);
```

### 3. Indicador Visual de Salvamento

```typescript
{savedAt && (
  <Text style={{ color: '#4caf50', fontSize: 12 }}>
    ✅ Salvo às {new Date(savedAt).toLocaleTimeString()}
  </Text>
)}
```

---

**Criado em:** 2025-01-08
**Última atualização:** 2025-01-08
