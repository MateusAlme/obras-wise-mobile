# ⚡ Guia Rápido: Sincronização Manual de Fotos

## 🎯 Como Usar

### 1️⃣ Durante o Dia (Offline)

```
✅ Criar obras
✅ Tirar fotos (salvas automaticamente no cache do app)
✅ Pausar obras
✅ Continuar trabalhando

→ Fotos ficam em cache aguardando sincronização
```

### 2️⃣ No Final do Dia (Online - WiFi)

```
1. Ir para aba "Perfil"
2. Ver seção "Sincronização e Cache"
3. Verificar quantas fotos pendentes
4. Clicar "Sincronizar X foto(s)"
5. Aguardar conclusão
6. Clicar "Limpar Cache (X MB)" para liberar espaço
```

## 📊 Estatísticas

Na tela de Perfil você verá:

```
┌─────────────────────────────────────┐
│ Fotos em Cache              45      │
│ Pendentes de Sincronização  12  🟠  │
│ Já Sincronizadas            33  🟢  │
│ Tamanho do Cache         15 MB      │
└─────────────────────────────────────┘
```

## 🔘 Botões

### Sincronizar Agora

**Quando usar:** No final do dia, quando tiver internet

**O que faz:**
- Envia obras pendentes para o Supabase
- Faz upload das fotos para o servidor
- Marca fotos como sincronizadas

**Status:**
- ✅ Habilitado: "Sincronizar X foto(s)" - quando há fotos pendentes
- ⏳ Sincronizando: Mostra spinner
- ❌ Desabilitado: "Nenhuma foto pendente" - quando tudo já foi sincronizado

### Limpar Cache

**Quando usar:** APÓS sincronizar com sucesso

**O que faz:**
- Remove fotos JÁ sincronizadas do cache local
- Libera espaço no celular
- **NUNCA** deleta fotos pendentes

**Status:**
- ✅ Habilitado: "Limpar Cache (X MB)" - quando há fotos sincronizadas
- ⏳ Limpando: Mostra spinner
- ❌ Desabilitado: "Nenhuma foto para limpar" - quando cache vazio
- ❌ **BLOQUEADO**: Se houver fotos pendentes (segurança!)

## ⚠️ Proteções de Segurança

### 1. Não Pode Limpar com Fotos Pendentes

Se tentar limpar cache com fotos não sincronizadas:

```
⚠️ Atenção
Ainda existem 12 foto(s) pendentes de sincronização.

Sincronize antes de limpar o cache para não perder dados.

[OK]  [Sincronizar Agora]
```

### 2. Confirmação Antes de Limpar

Mesmo com todas as fotos sincronizadas:

```
Limpar Cache
Isso irá remover 33 foto(s) já sincronizada(s) (10 MB).

Tem certeza?

[Cancelar]  [Limpar]
```

### 3. Aviso Visual Permanente

Enquanto houver fotos pendentes, verá:

```
⚠️ Sincronize antes de limpar o cache para não perder dados!
```

## ✅ Workflow Recomendado

```
📱 DURANTE O DIA (Offline)
├─ Criar obras
├─ Tirar fotos → Cache: 25 fotos, 8.5 MB
└─ Pausar obras

📱 MEIO DO DIA (Offline)
├─ Criar mais obras
├─ Mais fotos → Cache: 50 fotos, 17.2 MB
└─ Continuar trabalhando

🏢 FIM DO DIA (Online - WiFi)
├─ Ir para "Perfil"
├─ Clicar "Sincronizar 50 foto(s)"
├─ Aguardar ✅ Sincronização Concluída
├─ Clicar "Limpar Cache (17.2 MB)"
├─ Confirmar
└─ ✅ Cache vazio, espaço liberado!

📱 PRÓXIMO DIA (Offline)
└─ Recomeçar ciclo
```

## 🔍 Resolução de Problemas

### "Sem Internet"

**Problema:** Tentou sincronizar sem conexão

**Solução:**
- Conectar ao WiFi
- Ou usar dados móveis
- Tentar novamente

### "X obra(s) falharam"

**Problema:** Algumas obras não sincronizaram

**Solução:**
- Verificar internet
- Clicar "Sincronizar" novamente
- Sistema retenta automaticamente

### "Botão Limpar desabilitado"

**Problema:** Ainda há fotos pendentes

**Solução:**
- Verificar "Pendentes de Sincronização"
- Se > 0: Sincronizar primeiro
- Se = 0: Botão fica habilitado automaticamente

## 📱 Onde Ficam as Fotos?

### Antes de Sincronizar

```
📱 Celular (Cache do App)
└─ obra_photos_backup/
   ├─ obra_1_antes_0_xxx.jpg
   ├─ obra_1_durante_0_xxx.jpg
   └─ ...
```

**Não está na galeria do celular!**

### Depois de Sincronizar

```
☁️ Supabase (Nuvem)
└─ Storage Bucket: photos/
   ├─ obra_1_antes_0_xxx.jpg
   ├─ obra_1_durante_0_xxx.jpg
   └─ ...

📱 Celular (Cache do App)
└─ obra_photos_backup/
   ├─ obra_1_antes_0_xxx.jpg  ← Ainda no cache
   ├─ obra_1_durante_0_xxx.jpg
   └─ ...
```

### Depois de Limpar Cache

```
☁️ Supabase (Nuvem)
└─ Storage Bucket: photos/
   ├─ obra_1_antes_0_xxx.jpg  ← MANTÉM na nuvem
   ├─ obra_1_durante_0_xxx.jpg
   └─ ...

📱 Celular (Cache do App)
└─ obra_photos_backup/
   (vazio - espaço liberado!)
```

## 💡 Dicas

1. **Sincronize diariamente** - Evita acúmulo de fotos no cache
2. **Use WiFi** - Economiza dados móveis
3. **Limpe após sincronizar** - Libera espaço no celular
4. **Verifique estatísticas** - Atualizam automaticamente a cada 5s
5. **Não force fechar app** - Durante sincronização

## 🆘 Ajuda Rápida

**Quanto espaço tenho em cache?**
→ Ver "Tamanho do Cache" nas estatísticas

**Quantas fotos ainda não enviei?**
→ Ver "Pendentes de Sincronização" (número laranja)

**Posso limpar o cache?**
→ Somente se "Pendentes de Sincronização" = 0

**As fotos somem do celular?**
→ Não! Ficam na nuvem (Supabase) mesmo após limpar cache

**E se perder conexão durante sincronização?**
→ Sistema retenta automaticamente, pode sincronizar novamente depois

---

**Documentação completa:** [SISTEMA_CACHE_FOTOS_SINCRONIZACAO.md](./SISTEMA_CACHE_FOTOS_SINCRONIZACAO.md)
