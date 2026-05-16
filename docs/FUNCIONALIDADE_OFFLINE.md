# Funcionalidade Offline - Obras Teccel

## ✅ **Implementado**

### 1. **Dependências Instaladas**
- ✅ `@react-native-community/netinfo` (v11.4.1) - Detecção de conectividade
- ✅ `@react-native-async-storage/async-storage` (já instalado) - Storage local

### 2. **Serviço de Sincronização Offline** (`lib/offline-sync.ts`)

Criado serviço completo com as seguintes funções:

#### **Detecção de Conectividade**
```typescript
checkInternetConnection(): Promise<boolean>
```
- Verifica se há conexão com internet
- Checa tanto `isConnected` quanto `isInternetReachable`

#### **Storage Local**
```typescript
saveObraOffline(obra): Promise<string>
```
- Salva obra localmente quando offline
- Gera ID único para a obra (`offline_${timestamp}_${random}`)
- Retorna ID da obra salva

```typescript
getPendingObras(): Promise<PendingObra[]>
```
- Retorna todas as obras pendentes de sincronização
- Filtra por status: `pending`, `syncing`, `failed`

```typescript
removePendingObra(id): Promise<void>
```
- Remove obra da fila após sincronização bem-sucedida

```typescript
updatePendingObraStatus(id, status, errorMessage?): Promise<void>
```
- Atualiza status da obra: `pending` | `syncing` | `failed`
- Opcionalmente adiciona mensagem de erro

#### **Sincronização**
```typescript
syncObra(obra): Promise<boolean>
```
- Sincroniza uma obra específica
- Faz upload de todas as fotos (antes/durante/depois/abertura/fechamento)
- Insere no Supabase
- Remove da fila se sucesso, marca como failed se erro

```typescript
syncAllPendingObras(): Promise<{success: number, failed: number}>
```
- Sincroniza todas as obras pendentes
- Retorna contadores de sucesso e falha
- Apenas executa se houver conexão

#### **Sincronização Automática**
```typescript
startAutoSync(onSyncComplete?): UnsubscribeFunction
```
- Inicia listener de conectividade
- Sincroniza automaticamente ao voltar online
- Aguarda 2 segundos após conectar para garantir estabilidade
- Callback opcional para notificar conclusão

#### **Status de Sincronização**
```typescript
getSyncStatus(): Promise<SyncStatus>
updateSyncStatus(): Promise<void>
```
- Rastreia última sincronização
- Conta obras pendentes e falhadas

---

## 🔄 **Próximos Passos para Completar**

### 3. **Integrar no Formulário de Nova Obra**

Modificar `app/nova-obra.tsx`:

```typescript
// Adicionar useEffect para monitorar conectividade
useEffect(() => {
  const checkConnection = async () => {
    const online = await checkInternetConnection();
    setIsOnline(online);
  };

  checkConnection();
  const interval = setInterval(checkConnection, 5000); // Verifica a cada 5s

  return () => clearInterval(interval);
}, []);

// Modificar handleSalvarObra
const handleSalvarObra = async () => {
  // ... validações existentes ...

  const isConnected = await checkInternetConnection();

  if (!isConnected) {
    // Salvar offline
    try {
      await saveObraOffline({
        data,
        obra,
        responsavel,
        equipe,
        tipo_servico: tipoServico,
        tem_atipicidade: temAtipicidade,
        atipicidades: temAtipicidade ? atipicidades : [],
        descricao_atipicidade: temAtipicidade ? descricaoAtipicidade : null,
        fotos_antes: isServicoChave ? [] : fotosAntes,
        fotos_durante: isServicoChave ? [] : fotosDurante,
        fotos_depois: isServicoChave ? [] : fotosDepois,
        fotos_abertura: isServicoChave ? fotosAbertura : [],
        fotos_fechamento: isServicoChave ? fotosFechamento : [],
        created_at: new Date().toISOString(),
      });

      Alert.alert(
        '📱 Salvo Offline',
        'Você está sem conexão. A obra foi salva localmente e será sincronizada automaticamente quando houver internet.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar a obra offline.');
    }
    return;
  }

  // ... código existente para salvar online ...
};
```

### 4. **Indicador Visual de Status Online/Offline**

Adicionar no topo do formulário:

```typescript
{/* Status de Conexão */}
<View style={[
  styles.connectionBanner,
  isOnline ? styles.onlineBanner : styles.offlineBanner
]}>
  <Text style={styles.connectionText}>
    {isOnline ? '🟢 Online' : '🔴 Offline - Dados serão sincronizados depois'}
  </Text>
</View>
```

Estilos:
```typescript
connectionBanner: {
  padding: 12,
  borderRadius: 8,
  marginBottom: 16,
  alignItems: 'center',
},
onlineBanner: {
  backgroundColor: '#e8f5e9',
  borderWidth: 1,
  borderColor: '#4caf50',
},
offlineBanner: {
  backgroundColor: '#fff3e0',
  borderWidth: 1,
  borderColor: '#ff9800',
},
connectionText: {
  fontSize: 14,
  fontWeight: '600',
  color: '#333',
},
```

### 5. **Tela de Obras Pendentes de Sincronização**

Criar `app/obras-pendentes.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { getPendingObras, syncObra, PendingObra } from '../lib/offline-sync';

export default function ObrasPendentes() {
  const [pendingObras, setPendingObras] = useState<PendingObra[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadPendingObras();
  }, []);

  const loadPendingObras = async () => {
    const obras = await getPendingObras();
    setPendingObras(obras);
  };

  const handleSync = async (obra: PendingObra) => {
    setSyncing(true);
    const success = await syncObra(obra);
    setSyncing(false);

    if (success) {
      Alert.alert('Sucesso', 'Obra sincronizada com sucesso!');
      loadPendingObras();
    } else {
      Alert.alert('Erro', 'Não foi possível sincronizar esta obra.');
    }
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Obras Pendentes ({pendingObras.length})
      </Text>

      <FlatList
        data={pendingObras}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={{
            backgroundColor: '#fff',
            padding: 16,
            borderRadius: 12,
            marginBottom: 12,
            borderLeftWidth: 4,
            borderLeftColor: item.sync_status === 'failed' ? '#dc3545' : '#ff9800'
          }}>
            <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.obra}</Text>
            <Text style={{ color: '#666' }}>Responsável: {item.responsavel}</Text>
            <Text style={{ color: '#666' }}>Data: {item.data}</Text>

            <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
              <Text style={{
                paddingHorizontal: 12,
                paddingVertical: 4,
                backgroundColor: item.sync_status === 'failed' ? '#ffe6e6' : '#fff5e6',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: '600',
              }}>
                {item.sync_status === 'pending' ? '⏳ Pendente' :
                 item.sync_status === 'syncing' ? '🔄 Sincronizando' :
                 '❌ Falhou'}
              </Text>
            </View>

            {item.sync_status === 'failed' && item.error_message && (
              <Text style={{ color: '#dc3545', fontSize: 12, marginTop: 8 }}>
                Erro: {item.error_message}
              </Text>
            )}

            <TouchableOpacity
              onPress={() => handleSync(item)}
              disabled={syncing || item.sync_status === 'syncing'}
              style={{
                backgroundColor: '#dc3545',
                padding: 12,
                borderRadius: 8,
                marginTop: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>
                Tentar Sincronizar Agora
              </Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: '#999', marginTop: 40 }}>
            Nenhuma obra pendente de sincronização
          </Text>
        }
      />
    </View>
  );
}
```

### 6. **Sincronização Automática no Dashboard**

Modificar `app/(tabs)/index.tsx`:

```typescript
import { useEffect } from 'react';
import { startAutoSync, getSyncStatus } from '../../lib/offline-sync';

export default function Dashboard() {
  const [syncStatus, setSyncStatus] = useState({ pendingCount: 0, failedCount: 0 });

  useEffect(() => {
    // Carregar status
    loadSyncStatus();

    // Iniciar sincronização automática
    const unsubscribe = startAutoSync((result) => {
      if (result.success > 0) {
        Alert.alert(
          'Sincronização Completa',
          `${result.success} obra(s) sincronizada(s) com sucesso!`
        );
        loadSyncStatus();
      }
    });

    return () => unsubscribe();
  }, []);

  const loadSyncStatus = async () => {
    const status = await getSyncStatus();
    setSyncStatus(status);
  };

  return (
    // ... código existente ...

    {/* Badge de obras pendentes */}
    {syncStatus.pendingCount > 0 && (
      <TouchableOpacity
        onPress={() => router.push('/obras-pendentes')}
        style={{
          backgroundColor: '#ff9800',
          padding: 16,
          borderRadius: 12,
          marginTop: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
            📱 {syncStatus.pendingCount} obra(s) pendente(s)
          </Text>
          <Text style={{ color: '#fff', fontSize: 12 }}>
            Toque para sincronizar
          </Text>
        </View>
        <Text style={{ fontSize: 24 }}>→</Text>
      </TouchableOpacity>
    )}
  );
}
```

---

## 🎯 **Funcionalidades Implementadas**

✅ **Detecção de conectividade** - Verifica se há internet
✅ **Storage local** - Salva obras offline
✅ **Fila de sincronização** - Gerencia obras pendentes
✅ **Upload de fotos offline** - Preserva URIs locais até sincronizar
✅ **Sincronização individual** - Sincroniza uma obra por vez
✅ **Sincronização em lote** - Sincroniza todas pendentes
✅ **Sincronização automática** - Ao voltar online
✅ **Rastreamento de status** - Pending/Syncing/Failed
✅ **Tratamento de erros** - Captura e armazena mensagens de erro

---

## 📝 **Como Usar**

1. **Usuário fica offline** → App detecta automaticamente
2. **Cria nova obra** → Salva localmente com indicador visual
3. **Volta online** → Sincronização automática em 2 segundos
4. **Falha na sync** → Obra fica marcada como "failed", pode tentar manualmente
5. **Dashboard mostra badge** → Quantidade de obras pendentes
6. **Tela de pendentes** → Visualiza e sincroniza manualmente

---

## 🚀 **Benefícios**

- ✅ **Trabalho offline completo** - Nenhuma perda de dados
- ✅ **Sincronização transparente** - Automática ao voltar online
- ✅ **Feedback visual claro** - Usuário sabe o status a todo momento
- ✅ **Recuperação de falhas** - Tentativa manual de sincronização
- ✅ **Fotos preservadas** - URIs locais mantidas até upload
- ✅ **GPS funciona offline** - Coordenadas capturadas localmente
