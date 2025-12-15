# 🐛 DEBUG: Fotos Desaparecem Após Sincronização

## Problema Relatado

Quando uma obra é criada **offline** e depois sincronizada **online**, as fotos desaparecem da visualização.

## Fluxo Atual (COM PROBLEMA)

### 1. Criar Obra Offline ✅
```
- Usuário tira 3 fotos: foto1, foto2, foto3
- Fotos são salvas no device: /obra_photos_backup/
- Metadata salvo no AsyncStorage com:
  - obraId: "offline_123456"
  - uploaded: false
  - uploadUrl: null
```

### 2. Sincronizar ⚠️
```
- Fotos são uploaded para Supabase Storage
- Metadata atualizado:
  - uploaded: true
  - uploadUrl: "https://supabase.co/storage/..."
- Obra inserida no banco com as URLs
- obraId atualizado: "offline_123456" → "uuid-real-do-servidor"
```

### 3. Visualizar Obra Sincronizada ❌ PROBLEMA AQUI
```typescript
// obra-detalhe.tsx - linha 283-285
if (parsed.id && parsed.origem === 'offline') {
  loadLocalPhotos(parsed.id);  // ← Não carrega pois origem = 'online'
}
```

**O QUE ACONTECE:**
1. Obra agora tem `origem: 'online'` (não é mais 'offline')
2. Código NÃO carrega fotos locais para obras online
3. **MAS** as fotos no banco de dados SIM existem!

### 4. Função `getPhotosForSection` (linha 339-342)
```typescript
// Se a obra é online, usar apenas fotos do banco (já sincronizadas)
if (obra.origem === 'online') {
  return validDbPhotos;  // ← RETORNA AS FOTOS DO BANCO!
}
```

## 🔍 Análise do Problema Real

O problema NÃO é que as fotos somem. Elas estão no banco de dados!

### O Problema Pode Ser:

1. **As fotos não estão sendo retornadas do Supabase**
   - Verificar se o SELECT está trazendo os campos de fotos

2. **As URLs estão quebradas/incorretas**
   - Verificar se as URLs do Storage estão acessíveis

3. **Formato dos dados está errado**
   - Verificar se o JSON está sendo parseado corretamente

## 🧪 Como Debugar

### Passo 1: Verificar se as fotos foram salvas no banco

Execute no SQL Editor do Supabase:

```sql
SELECT
  id,
  obra,
  json_array_length(fotos_antes) as qtd_antes,
  json_array_length(fotos_durante) as qtd_durante,
  json_array_length(fotos_depois) as qtd_depois,
  fotos_antes,
  fotos_durante,
  fotos_depois
FROM obras
ORDER BY created_at DESC
LIMIT 5;
```

✅ **SE AS FOTOS APARECEREM**: O problema é na exibição
❌ **SE AS FOTOS NÃO APARECEREM**: O problema é na sincronização

### Passo 2: Verificar o formato dos dados

As fotos devem estar assim no banco:

```json
[
  {
    "url": "https://hiuagpzaelcocyxutgdt.supabase.co/storage/v1/object/public/obra-photos/uuid/foto.jpg",
    "latitude": -23.550520,
    "longitude": -46.633308,
    "utm_x": 334567.23,
    "utm_y": 7456789.45,
    "utm_zone": "23K"
  }
]
```

### Passo 3: Adicionar Logs de Debug

Adicione logs temporários em `obra-detalhe.tsx`:

```typescript
const getPhotosForSection = (sectionKey: string): FotoInfo[] => {
  if (!obra) return [];

  const dbPhotos = (obra as any)[sectionKey] as FotoInfo[] | undefined;
  const validDbPhotos = (dbPhotos || []).filter(f => f.url || f.uri);

  console.log(`📸 Section: ${sectionKey}`);
  console.log(`📸 DB Photos:`, dbPhotos);
  console.log(`📸 Valid Photos:`, validDbPhotos);
  console.log(`📸 Obra origem:`, obra.origem);

  if (obra.origem === 'online') {
    return validDbPhotos;
  }

  // ... resto do código
};
```

## 🔧 Possíveis Soluções

### Solução 1: Verificar se SELECT traz todos os campos

Em `(tabs)/obras.tsx` ou onde busca as obras do banco:

```typescript
const { data: obrasData, error } = await supabase
  .from('obras')
  .select('*')  // ← Verificar se está selecionando TODOS os campos
  .eq('equipe', equipe)
  .order('created_at', { ascending: false });
```

### Solução 2: Garantir que URLs sejam públicas

Verificar RLS policies do Storage:

```sql
-- Deve existir uma policy assim:
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'obra-photos');
```

### Solução 3: Fallback para fotos locais mesmo em obras online

Se as fotos do banco não carregarem, tentar buscar localmente:

```typescript
const getPhotosForSection = (sectionKey: string): FotoInfo[] => {
  if (!obra) return [];

  const dbPhotos = (obra as any)[sectionKey] as FotoInfo[] | undefined;
  const validDbPhotos = (dbPhotos || []).filter(f => f.url || f.uri);

  // Se obra é online MAS não tem fotos do banco, tentar local
  if (obra.origem === 'online') {
    if (validDbPhotos.length > 0) {
      return validDbPhotos;  // Usar fotos do banco
    } else {
      // Fallback: tentar buscar fotos locais
      console.warn(`⚠️ Obra online sem fotos no banco, tentando local...`);
      // Continuar com lógica de fotos locais...
    }
  }

  // ... resto do código para obras offline
};
```

## 📋 Checklist de Verificação

- [ ] 1. Aplicar migração `doc_autorizacao_passagem` no Supabase
- [ ] 2. Executar query SQL para verificar se fotos estão no banco
- [ ] 3. Verificar formato do JSON (deve ter campo `url`)
- [ ] 4. Testar se URLs do Storage são acessíveis
- [ ] 5. Adicionar logs de debug temporários
- [ ] 6. Testar fluxo completo: criar offline → sincronizar → visualizar

## 🎯 Próximos Passos

1. **PRIMEIRO**: Aplicar a migração SQL do `doc_autorizacao_passagem`
2. **SEGUNDO**: Executar a query SQL para verificar se as fotos estão no banco
3. **TERCEIRO**: Baseado no resultado, aplicar a solução correta

---

**Criado em**: 2025-02-14
**Última atualização**: 2025-02-14
