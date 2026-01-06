# Botão de Sincronização Manual - Guia de Uso

## 📍 Localização

O botão de sincronização está localizado na tela principal de obras:

```
┌─────────────────────────────────────────┐
│  Histórico de Obras                     │
│                    [🔄] [☁️] [+]        │
│                     ↑    ↑   ↑          │
│                  Refresh Sync Nova      │
└─────────────────────────────────────────┘
```

- **🔄 Verde**: Atualizar lista
- **☁️ Azul**: Sincronizar com nuvem (NOVO!)
- **+ Vermelho**: Nova obra

## 🎯 Como Funciona

### 1. Quando o Botão Está Ativo (Azul)

**Condições**:
- ✅ Há conexão com internet
- ✅ Existem obras não sincronizadas

**Ao clicar**:
1. Sistema conta quantas obras precisam ser sincronizadas
2. Mostra confirmação: "Deseja enviar X obra(s) para a nuvem?"
3. Avisa sobre consumo de dados móveis
4. Aguarda sua confirmação

### 2. Quando o Botão Está Desabilitado (Cinza)

**Condições**:
- ❌ Sem conexão com internet
- OU: Já está sincronizando (mostra spinner)

**Mensagem**: "Sem Conexão - Conecte-se à internet para sincronizar as obras."

### 3. Se Todas as Obras Já Estão Sincronizadas

**Mensagem**: "✅ Tudo Sincronizado - Todas as obras já estão sincronizadas com a nuvem."

## 🔄 Fluxo de Sincronização

```
┌─────────────────────────────────────────────────────────┐
│            USUÁRIO CLICA NO BOTÃO ☁️                    │
│                         ↓                                │
│              Verifica conexão com internet               │
│                         ↓                                │
│         ┌───────────────┴───────────────┐                │
│         │ SEM INTERNET                  │ COM INTERNET  │
│         ↓                               ↓                │
│  "Sem Conexão"              Conta obras não sincronizadas│
│  (Alerta)                              ↓                 │
│                        ┌───────────────┴──────────────┐  │
│                        │ 0 obras                      │>0│
│                        ↓                              ↓  │
│                  "Tudo Sincronizado"      Confirma com   │
│                  (Alerta)                  usuário       │
│                                                ↓         │
│                                    "Deseja enviar X      │
│                                     obra(s)?"            │
│                                         ↓                │
│                            ┌────────────┴────────────┐   │
│                            │ Cancelar               OK│  │
│                            ↓                         ↓   │
│                        (Nada)              syncAllLocalObras()
│                                                      ↓   │
│                                        Para cada obra:   │
│                                        1. Comprime fotos │
│                                        2. Upload Storage │
│                                        3. Insert/Update  │
│                                        4. Marca synced   │
│                                                      ↓   │
│                                        Resultado:        │
│                                        - X sucesso       │
│                                        - Y falhas        │
│                                                      ↓   │
│                                    Atualiza lista        │
│                                    Mostra resultado      │
└─────────────────────────────────────────────────────────┘
```

## 💡 Exemplos de Uso

### Exemplo 1: Sincronização Bem-Sucedida

```bash
# 1. Você criou 3 obras offline
# 2. Conecta WiFi/dados móveis
# 3. Botão ☁️ fica azul
# 4. Clica no botão
   → Alerta: "Deseja enviar 3 obra(s) para a nuvem?"
# 5. Clica "Sincronizar"
   → Console: "🔄 Iniciando sincronização de 3 obra(s)..."
   → Mostra spinner no botão
   → Comprime e envia fotos
   → Salva no Supabase
   → Alerta: "✅ Sincronização Completa - 3 obra(s) enviada(s) para a nuvem!"
# 6. Obras agora têm synced=true
# 7. Próximo clique: "✅ Tudo Sincronizado"
```

### Exemplo 2: Sincronização Parcial

```bash
# 1. Você tem 5 obras não sincronizadas
# 2. Conexão instável
# 3. Clica no botão ☁️
   → "Deseja enviar 5 obra(s)?"
# 4. Sincroniza
   → 3 obras enviadas com sucesso
   → 2 obras falharam (conexão caiu)
   → Alerta: "Sincronização Parcial
              ✅ 3 obra(s) sincronizada(s)
              ❌ 2 falha(s)
              Tente novamente para enviar as obras restantes."
# 5. Clica novamente quando conexão melhorar
   → Envia apenas as 2 obras restantes
```

### Exemplo 3: Sem Conexão

```bash
# 1. WiFi/dados móveis desligados
# 2. Botão ☁️ fica cinza (desabilitado)
# 3. Tenta clicar
   → Nada acontece (botão disabled)
# 4. Se forçar clique interno (não deveria ser possível na UI):
   → Alerta: "Sem Conexão - Conecte-se à internet"
```

## 📊 O Que É Sincronizado

Para cada obra não sincronizada (`synced: false` ou `locallyModified: true`):

### 1. Fotos
- **Compressão**: Fotos são comprimidas antes do upload
- **Upload**: Enviadas para Supabase Storage
- **Caminho**: Organizado por pasta da equipe e ID da obra
- **Formato**: JPEG comprimido

### 2. Dados da Obra
- **Metadata**: Número, responsável, equipe, tipo de serviço, etc.
- **Coordenadas**: Latitude/longitude de cada foto
- **Status**: Data de criação, modificação, finalização
- **Referências**: URLs das fotos no Storage

### 3. Atualização Local
- Marca `synced: true` no AsyncStorage
- Marca `locallyModified: false`
- Mantém backup local das fotos (nunca deleta)

## ⚙️ Configurações e Comportamentos

### Estados Internos

```typescript
// Estado do botão
syncingLocal: boolean  // true = mostrando spinner
isOnline: boolean      // true = botão azul, false = cinza

// Verificação de obras
const localObras = await getLocalObras();
const obrasNaoSincronizadas = localObras.filter(
  o => !o.synced || o.locallyModified
);
```

### Mensagens de Console

```bash
# Início
🔄 Iniciando sincronização de N obra(s)...

# Por obra
🔄 Sincronizando obra local: local_123...
✅ Obra marcada como sincronizada: local_123

# Fim
✅ Sync completo: X sucesso, Y falhas
```

### Alertas ao Usuário

| Situação | Título | Mensagem |
|----------|--------|----------|
| Sem internet | Sem Conexão | Conecte-se à internet para sincronizar |
| Tudo sincronizado | ✅ Tudo Sincronizado | Todas as obras já estão sincronizadas |
| Confirmação | ☁️ Sincronizar com Nuvem | Deseja enviar X obra(s)? Isso pode consumir dados |
| Sucesso total | ✅ Sincronização Completa | X obra(s) enviada(s) com sucesso |
| Sucesso parcial | Sincronização Parcial | ✅ X sucesso, ❌ Y falhas |
| Erro | Erro | Falha na sincronização. Tente novamente |

## 🔒 Segurança

### Confirmação Obrigatória
- Sistema SEMPRE pede confirmação antes de sincronizar
- Informa quantas obras serão enviadas
- Avisa sobre consumo de dados móveis
- Usuário pode cancelar a qualquer momento

### Proteção de Dados
- Fotos nunca são deletadas localmente após sync
- Se sync falhar, dados permanecem seguros no dispositivo
- Pode tentar sincronizar quantas vezes quiser
- Não há perda de dados em caso de falha

## 🐛 Solução de Problemas

### Botão Não Aparece
- Verifique se `syncButton` está nos estilos
- Verifique se importou `syncAllLocalObras` do offline-sync.ts

### Botão Sempre Cinza
- Verifique conexão com internet
- Console deve mostrar: `isOnline: true`
- Tente função `checkInternetConnection()`

### Sincronização Falha Sempre
- Verifique credenciais do Supabase
- Verifique se Storage Bucket existe
- Console mostrará erro específico
- Tente obra por obra manualmente

### "Tudo Sincronizado" Mas Obras Não Aparecem no Supabase
- Verifique se `synced: true` está correto no AsyncStorage
- Pode ser que sync marcou como true mas upload falhou
- Solução: Marcar manualmente `synced: false` e tentar novamente

## 🎨 Customização

### Cores do Botão

```typescript
// Arquivo: obras.tsx
syncButton: {
  backgroundColor: '#3b82f6',  // Azul quando ativo
  // ...
},
syncButtonDisabled: {
  backgroundColor: '#94a3b8',  // Cinza quando desabilitado
  opacity: 0.6,
}
```

### Ícone do Botão

```typescript
// Trocar emoji ☁️ por ícone do Ionicons
import { Ionicons } from '@expo/vector-icons';

<Ionicons name="cloud-upload" size={24} color="#fff" />
```

### Mensagens de Confirmação

```typescript
// Editar em handleSyncLocalObras():
Alert.alert(
  '☁️ Sincronizar com Nuvem',
  `Deseja enviar ${obrasNaoSincronizadas.length} obra(s)?...`,
  // ...
);
```

## 📝 Código-Fonte

### Função Principal

**Arquivo**: [mobile/app/(tabs)/obras.tsx:451-510](../mobile/app/(tabs)/obras.tsx#L451-L510)

```typescript
const handleSyncLocalObras = async () => {
  // Verificar conexão
  const online = await checkInternetConnection();
  if (!online) {
    Alert.alert('Sem Conexão', 'Conecte-se à internet...');
    return;
  }

  // Contar obras não sincronizadas
  const localObras = await getLocalObras();
  const obrasNaoSincronizadas = localObras.filter(
    o => !o.synced || o.locallyModified
  );

  if (obrasNaoSincronizadas.length === 0) {
    Alert.alert('✅ Tudo Sincronizado', '...');
    return;
  }

  // Confirmar
  Alert.alert(
    '☁️ Sincronizar com Nuvem',
    `Deseja enviar ${obrasNaoSincronizadas.length} obra(s)?`,
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sincronizar',
        onPress: async () => {
          setSyncingLocal(true);
          try {
            const result = await syncAllLocalObras();
            // Mostrar resultado
          } finally {
            setSyncingLocal(false);
          }
        }
      }
    ]
  );
};
```

### Botão na UI

**Arquivo**: [mobile/app/(tabs)/obras.tsx:584-594](../mobile/app/(tabs)/obras.tsx#L584-L594)

```typescript
<TouchableOpacity
  style={[
    styles.syncButton,
    (!isOnline || syncingLocal) && styles.syncButtonDisabled
  ]}
  onPress={handleSyncLocalObras}
  disabled={!isOnline || syncingLocal}
>
  {syncingLocal ? (
    <ActivityIndicator size="small" color="#fff" />
  ) : (
    <Text style={styles.syncButtonText}>☁️</Text>
  )}
</TouchableOpacity>
```

---

**Criado em**: Janeiro 2026
**Status**: ✅ Implementado e Testado
**Arquivos modificados**: `mobile/app/(tabs)/obras.tsx`
