# 💻 Código Pronto: Criando Serviço "Teste"

Este documento contém **snippets de código prontos** para copiar e colar em seus arquivos.

---

## 1️⃣ Adicionar ao `mobile/types/servico.ts`

### Adicione o tipo à union TipoServico

**Local**: Procure por `export type TipoServico =` (por volta da linha 1-20)

```typescript
export type TipoServico =
  | 'APR'
  | 'Abertura e Fechamento de Chave'
  | 'Altimetria'
  | 'Bandolamento'
  | 'Book de Aterramento'
  | 'Cava em Rocha'
  | 'Checklist de Fiscalização'
  | 'Ditais'
  | 'Documentação'
  | 'Emenda'
  | 'Fundação Especial'
  | 'Instalação do Medidor'
  | 'Linha Viva'
  | 'Poda'
  | 'Registro de Impedimento'
  | 'Teste'           // ✅ NOVO
  | 'Transformador'
  | 'Vazamento e Limpeza de Transformador';
```

### Adicione campos à interface Servico

**Local**: Procure por `export interface Servico {` (por volta da linha 123)

Procure pela seção de fotos específicas (procure por `fotos_transformador_`) e adicione antes da seção de Documentos:

```typescript
  fotos_transformador_conexoes_secundarias_retirado?: FotoInfo[];

  // ✅ NOVO - Fotos do serviço Teste
  fotos_teste_observacao?: FotoInfo[];
  fotos_teste_comprovacao?: FotoInfo[];

  fotos_medidor_padrao?: FotoInfo[];
```

### Adicione campos à interface ServicoLocal

**Local**: Procure por `export interface ServicoLocal {` (por volta da linha 229)

Procure pela mesma seção de fotos transformador e adicione:

```typescript
  fotos_transformador_conexoes_secundarias_retirado?: string[];

  // ✅ NOVO - Fotos do serviço Teste
  fotos_teste_observacao?: string[];
  fotos_teste_comprovacao?: string[];

  fotos_medidor_padrao?: string[];
```

### Adicione ao mapa SERVICO_PHOTO_MAP

**Local**: Procure por `export const SERVICO_PHOTO_MAP` (por volta da linha 325)

Procure pela seção `'Transformador':` e adicione logo antes ou depois (antes é melhor alfabeticamente):

```typescript
  'Transformador': [
    // ... campos existentes
  ],
  'Teste': [                                    // ✅ NOVO
    { field: 'fotos_teste_observacao', label: 'Foto de Observação' },
    { field: 'fotos_teste_comprovacao', label: 'Foto de Comprovação' },
  ],
  'Vazamento e Limpeza de Transformador': [
    // ... campos existentes
  ],
```

---

## 2️⃣ Adicionar ao `mobile/lib/servico-sync.ts`

### Importar tipos (se não estiverem já)

**Local**: Topo do arquivo (linhas 1-15)

```typescript
import { supabase } from './supabase';
import { Servico, ServicoLocal, SyncStatusServico, SERVICO_PHOTO_MAP, TipoServico } from '../types/servico';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { captureError } from './sentry';
// ... outros imports existentes
```

### Adicionar funções para o serviço Teste

**Local**: Final do arquivo (antes do último `export` se houver)

```typescript
/**
 * ========== SERVIÇO TESTE ==========
 * Funções específicas para gerenciar o tipo de serviço "Teste"
 */

/**
 * Cria um novo serviço do tipo Teste
 * Armazenado localmente com status 'rascunho'
 */
export const createTesteServico = async (obraId: string): Promise<Servico> => {
  const now = new Date().toISOString();
  const servicoId = `temp_teste_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  const novoServico: ServicoLocal = {
    id: servicoId,
    obra_id: obraId,
    tipo_servico: 'Teste',
    status: 'rascunho',
    sync_status: 'offline',
    created_at: now,
    updated_at: now,
    fotos_antes: [],
    fotos_durante: [],
    fotos_depois: [],
    fotos_teste_observacao: [],
    fotos_teste_comprovacao: [],
  };

  // Armazena localmente no AsyncStorage
  const pendingServicos = await AsyncStorage.getItem(PENDING_SERVICOS_KEY);
  const list: ServicoLocal[] = pendingServicos ? JSON.parse(pendingServicos) : [];
  list.push(novoServico);
  
  await AsyncStorage.setItem(PENDING_SERVICOS_KEY, JSON.stringify(list));
  
  // Log para debug
  console.log(`✅ Serviço Teste criado: ${servicoId}`);
  
  return novoServico as Servico;
};

/**
 * Marca o serviço Teste como completo
 */
export const markTesteServicoComplete = async (servico: ServicoLocal): Promise<ServicoLocal> => {
  servico.status = 'completo';
  servico.updated_at = new Date().toISOString();
  servico.sync_status = 'offline';
  
  await saveServicoLocal(servico);
  console.log(`✅ Serviço Teste marcado como completo: ${servico.id}`);
  
  return servico;
};

/**
 * Obtém a count de fotos do serviço Teste
 */
export const getTesteServicoPhotoCount = (servico: Servico): number => {
  const count1 = Array.isArray(servico.fotos_teste_observacao) 
    ? servico.fotos_teste_observacao.length 
    : 0;
  const count2 = Array.isArray(servico.fotos_teste_comprovacao) 
    ? servico.fotos_teste_comprovacao.length 
    : 0;
  return count1 + count2;
};
```

---

## 3️⃣ Usar em `mobile/app/servico-detalhe.tsx`

### Adicionar imports no topo do arquivo

**Local**: Linhas 1-30 (onde estão os outros imports)

```typescript
import { supabase } from '../lib/supabase';
import { type Servico, type FotoInfo } from '../types/servico';
import { 
  appendPhotoToServicoLocal, 
  fetchServicosForObra, 
  markServicoComplete, 
  saveServicoLocal, 
  syncAllPendingServicos,
  createTesteServico,  // ✅ NOVO
  markTesteServicoComplete,  // ✅ NOVO
  getTesteServicoPhotoCount,  // ✅ NOVO
} from '../lib/servico-sync';
import { backupPhoto, getPhotoMetadatasByIds } from '../lib/photo-backup';
import { processObraPhotos } from '../lib/photo-queue';
import { getVisiblePhotoCategories, validateServicoCompletion } from '../lib/servico-rules';
```

### Adicionar função para criar novo serviço Teste

**Local**: Dentro do componente, procure por outras funções de criação (ex: `handleCreateServico`)

```typescript
const handleCreateTesteServico = async () => {
  try {
    const obraId = params.obraId || '';
    if (!obraId) {
      Alert.alert('Erro', 'Obra não encontrada');
      return;
    }

    const novoServico = await createTesteServico(obraId);
    
    // Recarrega lista de serviços
    const updated = await fetchServicosForObra(obraId);
    setServicos(updated);
    
    // Abre o novo serviço
    router.push({
      pathname: '/servico-detalhe',
      params: { 
        data: encodeURIComponent(JSON.stringify(novoServico))
      }
    });

    Alert.alert('Sucesso', 'Serviço Teste criado com sucesso!');
  } catch (error) {
    captureError(error, 'handleCreateTesteServico');
    Alert.alert('Erro', 'Não foi possível criar o serviço Teste');
  }
};
```

### Adicionar botão na UI

**Local**: Na parte de renderização/JSX, procure por botões (section de `<TouchableOpacity>`)

```typescript
<TouchableOpacity 
  onPress={handleCreateTesteServico}
  style={[styles.button, { backgroundColor: '#007AFF' }]}
>
  <Text style={{ color: 'white', fontWeight: 'bold' }}>
    ➕ Novo Serviço Teste
  </Text>
</TouchableOpacity>
```

### Adicionar renderização de fotos do Teste

**Local**: Procure por `getVisiblePhotoCategories(servico)` e adicione um bloco para renderizar as fotos:

```typescript
{servico.tipo_servico === 'Teste' && (
  <View style={styles.sectionContainer}>
    <Text style={styles.sectionTitle}>Fotos do Teste</Text>
    
    {/* Observação */}
    <View style={styles.categoryContainer}>
      <Text style={styles.categoryLabel}>Foto de Observação</Text>
      <ScrollView horizontal>
        {(servico.fotos_teste_observacao || []).map((foto, idx) => (
          <View key={idx} style={styles.photoContainer}>
            <Image 
              source={{ uri: foto.url || foto.uri }}
              style={styles.photoThumbnail}
            />
          </View>
        ))}
      </ScrollView>
      <TouchableOpacity 
        onPress={() => handleAddPhoto('fotos_teste_observacao')}
        style={styles.photoButton}
      >
        <Text>📷 Adicionar Foto</Text>
      </TouchableOpacity>
    </View>

    {/* Comprovação */}
    <View style={styles.categoryContainer}>
      <Text style={styles.categoryLabel}>Foto de Comprovação</Text>
      <ScrollView horizontal>
        {(servico.fotos_teste_comprovacao || []).map((foto, idx) => (
          <View key={idx} style={styles.photoContainer}>
            <Image 
              source={{ uri: foto.url || foto.uri }}
              style={styles.photoThumbnail}
            />
          </View>
        ))}
      </ScrollView>
      <TouchableOpacity 
        onPress={() => handleAddPhoto('fotos_teste_comprovacao')}
        style={styles.photoButton}
      >
        <Text>📷 Adicionar Foto</Text>
      </TouchableOpacity>
    </View>
  </View>
)}
```

---

## 4️⃣ Adicionar ao `mobile/contexts/AuthContext.tsx` (Sincronização Automática)

**Local**: Procure por `useEffect` que trata de conexão de rede

Se não existir, adicione dentro do seu AuthProvider:

```typescript
import { syncAllPendingServicos } from '../lib/servico-sync';
import NetInfo from '@react-native-community/netinfo';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // ... código existente

  // ✅ NOVO - Sincroniza quando volta online
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected === true) {
        console.log('📡 Conexão restaurada, sincronizando serviços...');
        syncAllPendingServicos()
          .then(() => console.log('✅ Sincronização completa'))
          .catch(err => {
            console.error('❌ Erro ao sincronizar:', err);
            captureError(err, 'syncOnConnect');
          });
      }
    });
    
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ /* ... */ }}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

## 5️⃣ Testar a Implementação

### Na tela do app:

1. **Criar**: Toque em "➕ Novo Serviço Teste"
2. **Adicionar Fotos**: Clique em "📷 Adicionar Foto" e tire fotos
3. **Visualizar**: As fotos devem aparecer na lista
4. **Sincronizar**: Quando online, as fotos são enviadas para o Supabase
5. **Verificar**: Vá ao Supabase Console → `servicos` table → veja se `fotos_teste_*` foram preenchidas

### No console do React Native:

```
✅ Serviço Teste criado: temp_teste_1704067200000_abc123
📡 Conexão restaurada, sincronizando serviços...
✅ Sincronização completa
```

---

## 📋 Checklist de Implementação

- [ ] Tipo `'Teste'` adicionado em `TipoServico`
- [ ] Campos `fotos_teste_*` adicionados em `Servico`
- [ ] Campos `fotos_teste_*` adicionados em `ServicoLocal`
- [ ] Mapeamento adicionado em `SERVICO_PHOTO_MAP`
- [ ] Funções adicionadas em `servico-sync.ts`
- [ ] Imports adicionados em `servico-detalhe.tsx`
- [ ] Botão de criação renderizando
- [ ] Fotos sendo capturadas e exibidas
- [ ] Sincronização automática funcionando
- [ ] Dados persistindo no Supabase

---

## 🐛 Debugging

### Ver dados salvos localmente:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const debugServicos = async () => {
  const pending = await AsyncStorage.getItem('@servicos_pending_sync');
  console.log('Serviços offline:', pending ? JSON.parse(pending) : []);
};

debugServicos();
```

### Ver dados no Supabase:

```bash
# Terminal - abra o Supabase Console
# Vá para: Database → servicos
# Filtre por: tipo_servico = 'Teste'
```

### Ver logs de sincronização:

Procure por `✅ Serviço Teste criado` ou `📡 Conexão restaurada` no console

---

## 🎯 Estrutura Final

```
mobile/
├── types/
│   └── servico.ts (contém Teste)
├── lib/
│   └── servico-sync.ts (contém createTesteServico)
├── app/
│   ├── servico-detalhe.tsx (mostra Teste)
│   └── _layout.tsx (sincroniza Teste)
└── contexts/
    └── AuthContext.tsx (escuta conexão)

Supabase Cloud:
└── servicos table
    ├── id: uuid
    ├── tipo_servico: 'Teste'
    ├── fotos_teste_observacao: storage urls
    └── fotos_teste_comprovacao: storage urls
```

