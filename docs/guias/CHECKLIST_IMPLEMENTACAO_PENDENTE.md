# Checklist de Fiscalização - Implementação Pendente

## Status Atual ✅

### Concluído em [nova-obra.tsx](../mobile/app/nova-obra.tsx):
1. ✅ Adicionado "Checklist de Fiscalização" aos TIPOS_SERVICO
2. ✅ Criados todos os states necessários:
   - 7 estados fixos (croqui, panorâmicas, chede, aterramento, padrão, etc)
   - Estados dinâmicos para postes (array com 4 fotos cada)
   - Estados dinâmicos para seccionamentos (array)
3. ✅ Adicionado `isServicoChecklist` e atualizado `isServicoPadrao`
4. ✅ Implementada validação completa de todas as fotos obrigatórias
5. ✅ Adicionados campos ao `photoIds` object
6. ✅ Atualizado cálculo de `totalFotos`
7. ✅ Adicionados IDs ao array `allPhotoIds`
8. ✅ **Função `takePicture` atualizada**:
   - Adicionada assinatura com todos os tipos do checklist
   - Adicionados parâmetros opcionais `posteIndex` e `seccionamentoIndex`
   - Implementados todos os cases de índice para fotos fixas e dinâmicas
   - Implementados todos os setters para atualizar os states
9. ✅ **Função `removePhoto` atualizada**:
   - Adicionada assinatura com todos os tipos do checklist
   - Adicionados parâmetros opcionais para índices dinâmicos
   - Implementados todos os cases de remoção para fotos fixas e dinâmicas

### Concluído em [photo-backup.ts](../mobile/lib/photo-backup.ts):
1. ✅ Interface `PhotoMetadata` atualizada com todos os tipos do checklist
2. ✅ Função `backupPhoto` atualizada com tipos do checklist

## O Que Ainda Falta 🚧

### 1. Funções de Captura de Foto em [nova-obra.tsx](../mobile/app/nova-obra.tsx:line)

#### takePicture Function
Precisa adicionar casos para todos os tipos de foto do checklist:

```typescript
// Na assinatura da função, adicionar tipos:
type?: 'antes' | 'durante' | 'depois' | 'abertura' | 'fechamento' |
  'ditais_abertura' | ... | 'medidor_identificador_fase' |
  // ADICIONAR:
  'checklist_croqui' | 'checklist_panoramica_inicial' | 'checklist_chede' |
  'checklist_aterramento_cerca' | 'checklist_padrao_geral' | 'checklist_padrao_interno' |
  'checklist_panoramica_final' |
  // Postes dinâmicos
  'checklist_poste_inteiro' | 'checklist_poste_engaste' |
  'checklist_poste_conexao1' | 'checklist_poste_conexao2' |
  // Seccionamento dinâmico
  'checklist_seccionamento',
posteIndex?: number,  // Para fotos de postes
seccionamentoIndex?: number  // Para fotos de seccionamento
```

#### Adicionar Cases no Switch:
```typescript
case 'checklist_croqui':
  setFotosChecklistCroqui([...fotosChecklistCroqui, newPhoto]);
  break;
case 'checklist_panoramica_inicial':
  setFotosChecklistPanoramicaInicial([...fotosChecklistPanoramicaInicial, newPhoto]);
  break;
// ... etc para todos os tipos fixos

// Para postes (dinâmico):
case 'checklist_poste_inteiro':
  if (posteIndex !== undefined) {
    const updatedPostes = [...fotosPostes];
    updatedPostes[posteIndex] = {
      ...updatedPostes[posteIndex],
      posteInteiro: [...updatedPostes[posteIndex].posteInteiro, newPhoto]
    };
    setFotosPostes(updatedPostes);
  }
  break;
// ... casos para engaste, conexao1, conexao2

// Para seccionamento:
case 'checklist_seccionamento':
  if (seccionamentoIndex !== undefined) {
    const updatedSec = [...fotosSeccionamentos];
    updatedSec[seccionamentoIndex] = [...updatedSec[seccionamentoIndex], newPhoto];
    setFotosSeccionamentos(updatedSec);
  }
  break;
```

#### removePhoto Function
Adicionar mesmos casos para remoção de fotos.

### 2. UI - Interface do Usuário

#### Criar Seções de UI (após a seção do medidor):

```tsx
{isServicoChecklist && (
  <>
    {/* 1. Croqui da Obra */}
    <View style={styles.photoSection}>
      <View style={styles.photoHeader}>
        <Ionicons name="document-text-outline" size={24} color="#10b981" />
        <Text style={styles.photoLabel}>
          1️⃣ Croqui da Obra (1 foto) {fotosChecklistCroqui.length > 0 && '✓'}
        </Text>
      </View>
      <View style={styles.photoGrid}>
        {fotosChecklistCroqui.map((foto, index) => (
          <View key={index} style={styles.photoItem}>
            <Image source={{ uri: foto.uri }} style={styles.photo} />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removePhoto('checklist_croqui', index)}
            >
              <Ionicons name="close-circle" size={24} color="#ef4444" />
            </TouchableOpacity>
            {foto.latitude && foto.longitude && (
              <View style={styles.gpsIndicator}>
                <Ionicons name="location" size={12} color="#fff" />
              </View>
            )}
          </View>
        ))}
        {fotosChecklistCroqui.length < 1 && (
          <TouchableOpacity
            style={styles.addPhotoButton}
            onPress={() => takePicture('checklist_croqui')}
            disabled={uploadingPhoto}
          >
            <Ionicons name="camera" size={32} color="#666" />
            <Text style={styles.addPhotoText}>Adicionar Foto</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>

    {/* 2. Panorâmica Inicial */}
    <View style={styles.photoSection}>
      <View style={styles.photoHeader}>
        <Ionicons name="images-outline" size={24} color="#10b981" />
        <Text style={styles.photoLabel}>
          2️⃣ Panorâmica Inicial (2 fotos) {fotosChecklistPanoramicaInicial.length >= 2 && '✓'}
        </Text>
      </View>
      {/* Similar ao anterior, mas permitindo até 2 fotos */}
    </View>

    {/* 3. Material Recebido (Chede) */}
    {/* ... */}

    {/* 4. Postes - Seção Dinâmica */}
    <View style={styles.photoSection}>
      <View style={styles.photoHeader}>
        <Ionicons name="construct-outline" size={24} color="#10b981" />
        <Text style={styles.photoLabel}>
          4️⃣ Registro dos Postes (4 fotos por poste)
        </Text>
      </View>

      {/* Controles para adicionar/remover postes */}
      <View style={styles.posteControls}>
        <Text style={styles.posteCount}>Número de Postes: {numPostes}</Text>
        <View style={styles.posteButtons}>
          <TouchableOpacity
            style={styles.posteButton}
            onPress={() => {
              setNumPostes(numPostes + 1);
              setFotosPostes([...fotosPostes, {
                posteInteiro: [],
                engaste: [],
                conexao1: [],
                conexao2: [],
              }]);
            }}
          >
            <Ionicons name="add-circle" size={24} color="#10b981" />
            <Text>Adicionar Poste</Text>
          </TouchableOpacity>
          {numPostes > 1 && (
            <TouchableOpacity
              style={[styles.posteButton, styles.removePosteButton]}
              onPress={() => {
                setNumPostes(numPostes - 1);
                setFotosPostes(fotosPostes.slice(0, -1));
              }}
            >
              <Ionicons name="remove-circle" size={24} color="#ef4444" />
              <Text>Remover Poste</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Renderizar seções para cada poste */}
      {fotosPostes.map((poste, posteIndex) => (
        <View key={posteIndex} style={styles.posteSection}>
          <Text style={styles.postTitle}>Poste {posteIndex + 1}</Text>

          {/* Poste Inteiro */}
          <View style={styles.photoSubsection}>
            <Text style={styles.photoSubLabel}>
              📸 Poste Inteiro {poste.posteInteiro.length > 0 && '✓'}
            </Text>
            {/* Grid de fotos similar aos anteriores */}
          </View>

          {/* Engaste */}
          <View style={styles.photoSubsection}>
            <Text style={styles.photoSubLabel}>
              📸 Engaste e Descrição {poste.engaste.length > 0 && '✓'}
            </Text>
            {/* Grid de fotos */}
          </View>

          {/* Conexão 1 */}
          {/* Conexão 2 */}
        </View>
      ))}
    </View>

    {/* 5. Seccionamento de Cerca - Dinâmico */}
    <View style={styles.photoSection}>
      <View style={styles.photoHeader}>
        <Ionicons name="git-branch-outline" size={24} color="#10b981" />
        <Text style={styles.photoLabel}>
          5️⃣ Seccionamento de Cerca (opcional)
        </Text>
      </View>

      <View style={styles.posteControls}>
        <Text style={styles.posteCount}>Pontos de Seccionamento: {numSeccionamentos}</Text>
        <TouchableOpacity
          style={styles.posteButton}
          onPress={() => {
            setNumSeccionamentos(numSeccionamentos + 1);
            setFotosSeccionamentos([...fotosSeccionamentos, []]);
          }}
        >
          <Ionicons name="add-circle" size={24} color="#10b981" />
          <Text>Adicionar Ponto</Text>
        </TouchableOpacity>
      </View>

      {fotosSeccionamentos.map((sec, secIndex) => (
        <View key={secIndex} style={styles.seccionamentoSection}>
          <Text style={styles.seccionamentoTitle}>
            Seccionamento {secIndex + 1} {sec.length > 0 && '✓'}
          </Text>
          {/* Grid de fotos para este seccionamento */}
        </View>
      ))}
    </View>

    {/* 6. Aterramento de Cerca */}
    {/* 7. Padrão de Ligação - Geral */}
    {/* 8. Padrão de Ligação - Interno */}
    {/* 9. Panorâmica Final */}
  </>
)}
```

### 3. Adicionar Estilos CSS

No StyleSheet, adicionar:

```typescript
posteControls: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 16,
  padding: 12,
  backgroundColor: '#f3f4f6',
  borderRadius: 8,
},
posteCount: {
  fontSize: 16,
  fontWeight: '600',
  color: '#374151',
},
posteButtons: {
  flexDirection: 'row',
  gap: 8,
},
posteButton: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  paddingHorizontal: 12,
  paddingVertical: 8,
  backgroundColor: '#fff',
  borderRadius: 6,
  borderWidth: 1,
  borderColor: '#10b981',
},
removePosteButton: {
  borderColor: '#ef4444',
},
posteSection: {
  marginTop: 16,
  padding: 12,
  backgroundColor: '#fef3c7',
  borderRadius: 8,
  borderLeftWidth: 4,
  borderLeftColor: '#f59e0b',
},
posteTitle: {
  fontSize: 18,
  fontWeight: '700',
  color: '#92400e',
  marginBottom: 12,
},
photoSubsection: {
  marginTop: 12,
},
photoSubLabel: {
  fontSize: 14,
  fontWeight: '600',
  color: '#78350f',
  marginBottom: 8,
},
seccionamentoSection: {
  marginTop: 12,
  padding: 10,
  backgroundColor: '#e0f2fe',
  borderRadius: 6,
},
seccionamentoTitle: {
  fontSize: 16,
  fontWeight: '600',
  color: '#075985',
  marginBottom: 8,
},
```

### 4. Atualizar [offline-sync.ts](../mobile/lib/offline-sync.ts)

#### PendingObra Interface:
Adicionar campos para todas as fotos do checklist (similar aos campos do medidor).

#### PhotoGroupIds Type:
Adicionar campos do checklist.

#### saveObraOffline Function:
Adicionar os arrays de IDs das fotos do checklist.

#### syncObra Function:
- Buscar metadados das fotos do checklist
- Mapear para formato com URL + coordenadas
- Adicionar ao INSERT do Supabase

### 5. Atualizar [obra-detalhe.tsx](../mobile/app/obra-detalhe.tsx)

Adicionar ao PHOTO_SECTIONS array e aos tipos.

### 6. Atualizar [photo-backup.ts](../mobile/lib/photo-backup.ts)

Adicionar tipos de foto do checklist ao PhotoMetadata type e backupPhoto function.

### 7. Criar Migração do Supabase

Criar arquivo `supabase/migrations/20250201_adicionar_checklist_fiscalizacao.sql`:

```sql
-- Adicionar colunas para Checklist de Fiscalização na tabela obras

-- Fotos fixas
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS fotos_checklist_croqui JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS fotos_checklist_panoramica_inicial JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS fotos_checklist_chede JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS fotos_checklist_aterramento_cerca JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS fotos_checklist_padrao_geral JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS fotos_checklist_padrao_interno JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS fotos_checklist_panoramica_final JSONB DEFAULT '[]';

-- Fotos dinâmicas (arrays de objetos)
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS fotos_checklist_postes JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS fotos_checklist_seccionamentos JSONB DEFAULT '[]';

-- Comentários para documentação
COMMENT ON COLUMN public.obras.fotos_checklist_postes IS 'Array com fotos de postes. Cada poste tem 4 tipos de fotos: poste_inteiro, engaste, conexao1, conexao2';
COMMENT ON COLUMN public.obras.fotos_checklist_seccionamentos IS 'Array com fotos de pontos de seccionamento de cerca';
```

## Ordem de Implementação Recomendada

1. ✅ **CONCLUÍDO**: States, validação, photoIds
2. 🚧 **PRÓXIMO**: Funções takePicture e removePhoto
3. 🚧 **PRÓXIMO**: UI básica (começar com fotos fixas)
4. 🚧 UI dinâmica (postes e seccionamentos)
5. 🚧 offline-sync.ts
6. 🚧 obra-detalhe.tsx
7. 🚧 photo-backup.ts
8. 🚧 Migração do banco de dados

## Notas Importantes

- O arquivo nova-obra.tsx está muito grande (~3000+ linhas)
- Considerar refatoração futura para separar lógica em hooks customizados
- Fotos de postes e seccionamentos são armazenadas de forma diferente (dinâmica)
- Cada poste tem exatamente 4 fotos obrigatórias
- Seccionamentos são opcionais (pode ter 0 ou mais)
