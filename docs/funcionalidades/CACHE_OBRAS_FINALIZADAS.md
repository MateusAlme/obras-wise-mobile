# 💾 Sistema de Cache de Obras Finalizadas

## 📋 Visão Geral

Sistema que permite **editar obras finalizadas offline** através de cache local das informações da obra, incluindo indicadores de fotos que existem no servidor mas não estão disponíveis localmente.

**Funcionalidades:**
- ✅ Cache automático de obras ao finalizar
- ✅ Edição de obras finalizadas offline
- ✅ Logs detalhados de fotos online não disponíveis
- ✅ Sincronização de mudanças quando voltar online

## 🎯 Problema Resolvido

### Antes (❌ Sem Cache)

```
1. Usuário cria obra ONLINE
2. Finaliza obra (salva no Supabase) ✅
3. Fica offline
4. Tenta editar obra finalizada
5. ERRO: Não consegue carregar do Supabase ❌
6. Não pode adicionar fotos offline ❌
```

### Depois (✅ Com Cache)

```
1. Usuário cria obra ONLINE
2. Finaliza obra (salva no Supabase) ✅
3. 💾 Obra salva automaticamente em cache local
4. Fica offline
5. Abre obra finalizada
6. Carrega do cache ✅
7. Vê indicador de fotos online não disponíveis ℹ️
8. Pode adicionar novas fotos offline ✅
9. Volta online → Sincroniza mudanças ✅
```

## 🔧 Implementação

### 1️⃣ Salvamento Automático em Cache

**Arquivo**: `mobile/app/nova-obra.tsx` (linhas 2603-2634)

```typescript
// ⭐ Salvar obra completa em cache para permitir edição offline futura
console.log('💾 Salvando obra completa no cache para permitir edição offline...');
try {
  const obraCompleta = {
    id: obraId || obraData.obra, // ID da obra
    ...obraData,
    fotos_antes: fotosAntesUploaded,
    fotos_durante: fotosDuranteUploaded,
    fotos_depois: fotosDepoisUploaded,
    fotos_abertura: fotosAberturaUploaded,
    fotos_fechamento: fotosFechamentoUploaded,
    status: 'finalizada',
    cached_at: new Date().toISOString(),
    has_online_photos: allPhotoIds.length > 0, // Flag indicando fotos no servidor
  };

  // Buscar cache atual
  const cacheKey = '@obras_finalizadas_cache';
  const cacheStr = await AsyncStorage.getItem(cacheKey);
  const cache = cacheStr ? JSON.parse(cacheStr) : {};

  // Adicionar/atualizar obra no cache
  cache[obraCompleta.id] = obraCompleta;

  // Salvar cache atualizado
  await AsyncStorage.setItem(cacheKey, JSON.stringify(cache));
  console.log(`📝 Obra ${obraCompleta.obra} adicionada ao cache (status: finalizada)`);
  console.log(`✅ Cache atualizado - obra pode ser editada offline futuramente`);
} catch (cacheError) {
  console.error('⚠️ Erro ao salvar cache da obra:', cacheError);
  // Não bloquear o fluxo se cache falhar
}
```

**Quando acontece:**
- ✅ Ao finalizar nova obra online
- ✅ Ao adicionar fotos a obra existente online
- ✅ Sempre que há upload bem-sucedido para Supabase

**O que é salvo:**
- Dados básicos da obra (data, responsável, equipe, etc.)
- **URLs das fotos** no Supabase Storage
- Metadata de cada foto (lat/long, UTM, etc.)
- Timestamp do cache (`cached_at`)
- Flag `has_online_photos` indicando se há fotos no servidor

### 2️⃣ Logs de Fotos Online Não Disponíveis

**Arquivo**: `mobile/app/nova-obra.tsx` (linhas 401-448)

```typescript
const mapPhotos = (photoIds: string[], fieldName: string = 'fotos') => {
  try {
    if (!Array.isArray(photoIds)) {
      console.warn(`⚠️ ${fieldName}: photoIds não é array, pulando...`);
      return [];
    }

    return photoIds.map(photoId => {
      try {
        const photo = localPhotos.find(p => p.id === photoId);
        if (photo) {
          // Verificar se URI existe e é válido
          const uri = photo.compressedPath || photo.originalPath;

          if (!uri) {
            console.warn(`⚠️ ${fieldName}: Foto ${photoId} sem URI válido, pulando...`);
            return null;
          }

          if (!uri.startsWith('file://')) {
            console.warn(`⚠️ ${fieldName}: URI inválido para foto ${photoId}: ${uri}`);
            return null;
          }

          // URI válido - retornar foto
          return {
            uri,
            latitude: photo.latitude,
            longitude: photo.longitude,
            utmX: photo.utmX,
            utmY: photo.utmY,
            utmZone: photo.utmZone,
            photoId: photo.id,
          };
        }

        // ⭐ INDICADOR: Foto existe no servidor mas não localmente
        console.warn(`⚠️ ${fieldName}: Foto com ID ${photoId} não encontrada no photo-backup`);
        return null;
      } catch (err) {
        console.error(`❌ ${fieldName}: Erro ao processar foto ${photoId}:`, err);
        return null;
      }
    }).filter(Boolean) as FotoData[];
  } catch (err) {
    console.error(`❌ Erro ao mapear ${fieldName}:`, err);
    return [];
  }
};
```

**Logs gerados:**

```
⚠️ fotos_antes: Foto photo_123 não encontrada no photo-backup
⚠️ fotos_durante: Foto photo_456 sem URI válido, pulando...
⚠️ fotos_transformador_laudo: URI inválido para foto photo_789: http://...
```

**Interpretação dos logs:**

| Log | Significado | Ação |
|-----|-------------|------|
| `não encontrada no photo-backup` | Foto existe no servidor mas não foi baixada localmente | Usuário pode adicionar nova foto offline |
| `sem URI válido` | Metadata da foto existe mas caminho do arquivo não | Reconectar para recarregar |
| `URI inválido para foto` | URI não começa com `file://` (não é arquivo local) | Foto só disponível online |

## 📊 Estrutura do Cache

### Chave do AsyncStorage

```
@obras_finalizadas_cache
```

### Formato dos Dados

```json
{
  "obra_123": {
    "id": "obra_123",
    "obra": "00012345",
    "data": "2025-01-07",
    "responsavel": "João Silva",
    "equipe": "CNT 01",
    "tipo_servico": "Transformador",
    "status": "finalizada",
    "cached_at": "2025-01-07T15:30:00.000Z",
    "has_online_photos": true,
    "fotos_antes": [
      {
        "url": "https://supabase.co/storage/v1/object/public/...",
        "latitude": -23.55,
        "longitude": -46.63
      }
    ],
    "fotos_durante": [...],
    "fotos_depois": [...]
  },
  "obra_456": {
    "id": "obra_456",
    ...
  }
}
```

## 🔄 Fluxo Completo

### Cenário 1: Criar Obra Online e Editar Offline

```
1. ONLINE: Criar nova obra
   - Adicionar 5 fotos
   - Finalizar obra
   → 💾 Obra salva no Supabase
   → 💾 Obra salva em cache local

Console:
💾 Salvando obra completa no cache para permitir edição offline...
📝 Obra 00012345 adicionada ao cache (status: finalizada)
✅ Cache atualizado - obra pode ser editada offline futuramente

2. OFFLINE: Editar obra finalizada
   - Abrir obra da lista
   - Sistema tenta carregar do Supabase (falha - offline)
   - Sistema carrega do cache ✅
   - Fotos do servidor NÃO aparecem (URI não é file://)

Console:
📸 Buscando fotos da obra: obra_123
✅ 0 foto(s) encontradas no photo-backup
⚠️ fotos_antes: Foto photo_1 não encontrada no photo-backup
⚠️ fotos_antes: Foto photo_2 não encontrada no photo-backup
⚠️ fotos_antes: Foto photo_3 não encontrada no photo-backup
⚠️ fotos_durante: Foto photo_4 não encontrada no photo-backup
⚠️ fotos_durante: Foto photo_5 não encontrada no photo-backup

3. OFFLINE: Adicionar novas fotos
   - Tirar 2 novas fotos offline
   - Salvar na galeria ✅
   - Fotos adicionadas ao photo-backup local

Console:
📸 Foto salva: file:///data/user/0/.../photo_new_1.jpg
📸 Foto salva: file:///data/user/0/.../photo_new_2.jpg

4. ONLINE: Sincronizar mudanças
   - Voltar online
   - Sincronizar obra
   - Upload das 2 novas fotos para Supabase
   - Atualizar obra no servidor

Console:
🔄 Sincronizando obra 00012345...
📤 Uploading 2 nova(s) foto(s)...
✅ Upload concluído
✅ Obra atualizada no Supabase
```

### Cenário 2: Cache Expirado ou Inválido

```
1. Tentar carregar obra offline
2. Cache não tem a obra OU cache corrompido
3. Sistema tenta carregar do Supabase (offline)
4. ERRO: Não consegue carregar

Console:
❌ Erro ao carregar obra: Network request failed
⚠️ Continuando sem fotos. Você pode adicionar novas fotos normalmente.

Alert para usuário:
"Aviso: Não foi possível carregar as fotos existentes.
Você pode continuar editando e adicionar novas fotos."
```

## 🎯 Boas Práticas

### 1. Limpar Cache Periodicamente

Cache pode crescer muito. Considere limpar obras antigas:

```typescript
const cleanOldCache = async () => {
  const cacheKey = '@obras_finalizadas_cache';
  const cacheStr = await AsyncStorage.getItem(cacheKey);
  if (!cacheStr) return;

  const cache = JSON.parse(cacheStr);
  const now = new Date();
  const MAX_AGE_DAYS = 30; // 30 dias

  Object.keys(cache).forEach(obraId => {
    const obra = cache[obraId];
    const cachedAt = new Date(obra.cached_at);
    const ageInDays = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (ageInDays > MAX_AGE_DAYS) {
      console.log(`🗑️ Removendo obra ${obraId} do cache (${ageInDays} dias)`);
      delete cache[obraId];
    }
  });

  await AsyncStorage.setItem(cacheKey, JSON.stringify(cache));
};
```

### 2. Verificar Tamanho do Cache

AsyncStorage tem limite de ~6MB. Monitore o tamanho:

```typescript
const getCacheSize = async () => {
  const cacheKey = '@obras_finalizadas_cache';
  const cacheStr = await AsyncStorage.getItem(cacheKey);
  if (!cacheStr) return 0;

  const sizeInBytes = new Blob([cacheStr]).size;
  const sizeInMB = sizeInBytes / (1024 * 1024);

  console.log(`📊 Tamanho do cache: ${sizeInMB.toFixed(2)} MB`);

  if (sizeInMB > 5) {
    console.warn('⚠️ Cache próximo do limite (6MB)');
  }

  return sizeInMB;
};
```

### 3. Invalidar Cache ao Sincronizar

Quando obra é sincronizada com sucesso, pode remover do cache:

```typescript
const removeCacheAfterSync = async (obraId: string) => {
  const cacheKey = '@obras_finalizadas_cache';
  const cacheStr = await AsyncStorage.getItem(cacheKey);
  if (!cacheStr) return;

  const cache = JSON.parse(cacheStr);
  delete cache[obraId];

  await AsyncStorage.setItem(cacheKey, JSON.stringify(cache));
  console.log(`✅ Obra ${obraId} removida do cache após sincronização`);
};
```

## 📝 Checklist de Uso

- [ ] Finalizar obra online → Verificar log "💾 Salvando obra completa no cache"
- [ ] Verificar log "📝 Obra XXX adicionada ao cache"
- [ ] Verificar log "✅ Cache atualizado"
- [ ] Ficar offline e tentar editar obra finalizada
- [ ] Observar logs "⚠️ fotos_antes: Foto photo_X não encontrada"
- [ ] Adicionar novas fotos offline
- [ ] Voltar online e sincronizar
- [ ] Verificar que novas fotos foram enviadas ao Supabase

## 🔒 Considerações

### Segurança

- ✅ Cache armazenado no sandbox do app (outros apps não acessam)
- ⚠️ Dados não são criptografados (AsyncStorage padrão)
- ✅ URLs de fotos são públicas (Supabase Storage público)

### Performance

- ✅ Cache acelera carregamento de obras offline
- ⚠️ Cache cresce com o tempo (limpar periodicamente)
- ✅ Salvamento em cache não bloqueia UI (async)

### Limitações

- ⚠️ AsyncStorage limitado a ~6MB
- ⚠️ Fotos do servidor NÃO são baixadas automaticamente (só URLs)
- ⚠️ Cache pode ficar desatualizado se obra for editada em outro dispositivo

## 🚀 Melhorias Futuras

1. **Download automático de fotos** para cache local
2. **Compressão do cache** (GZIP JSON)
3. **Limpeza automática** de cache antigo
4. **Indicador visual** de fotos online não disponíveis (componente `OnlinePhotoPlaceholder`)
5. **Sincronização bidirecional** (detectar conflitos)

## 🔗 Arquivos Relacionados

- `mobile/app/nova-obra.tsx` - Implementação do cache
- `mobile/components/OnlinePhotoPlaceholder.tsx` - Componente de indicador (criado)
- `mobile/lib/offline-sync.ts` - Sincronização de obras

---

**Criado em**: 2025-01-07
**Última atualização**: 2025-01-07
