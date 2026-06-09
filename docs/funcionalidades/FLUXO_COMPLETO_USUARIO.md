# Fluxo Completo do Usuário - Sistema de Obras

## 🎯 Visão Geral

Este documento explica **como o usuário realmente usa o app** para criar, gerenciar e enviar obras para o banco de dados.

## 📱 Interface Principal

```
┌─────────────────────────────────────────────┐
│  CNT 01                         [Sair]      │ ← Banner da equipe
├─────────────────────────────────────────────┤
│  Obras                                      │ ← Título
│  5 de 5 obra(s) cadastrada(s)               │ ← Contador
│  📴 Modo Offline  ← Se sem internet         │
├─────────────────────────────────────────────┤
│  ┌───────────┬──────────────┬─────────┐    │
│  │    ➕     │      ☁️      │   🔄    │    │ ← Barra de ações
│  │   Nova    │ Sincronizar  │Atualizar│    │
│  │   Obra    │              │         │    │
│  └───────────┴──────────────┴─────────┘    │
├─────────────────────────────────────────────┤
│  [Buscar obra, responsável, equipe...]     │ ← Busca
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐   │
│  │ Obra 12345  [📤 Aguardando] 05/01  │   │ ← Card de obra
│  │ [⏸️ Rascunho]                       │   │
│  │ João • CNT 01 • Emenda              │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## 🔄 Fluxo Completo: Do Início ao Banco de Dados

### 📝 CENÁRIO 1: Criar Obra e Finalizar no Mesmo Dia

```
🕐 08:00 - CHEGADA NO LOCAL DA OBRA
│
├─ 1️⃣ ABRIR APP
│   └─ Login com usuário CNT 01
│
├─ 2️⃣ CRIAR NOVA OBRA
│   ├─ Clicar botão "➕ Nova Obra"
│   ├─ Preencher formulário:
│   │   ├─ Data: 05/01/2026
│   │   ├─ Número: 12345678
│   │   ├─ Responsável: João Silva
│   │   ├─ Tipo: Emenda
│   │   └─ Outros campos específicos
│   │
│   ├─ Tirar fotos obrigatórias:
│   │   ├─ 📷 Foto Antes (2 fotos)
│   │   ├─ 📷 Foto Durante (2 fotos)
│   │   └─ 📷 Foto Depois (2 fotos)
│   │
│   └─ Clicar "✅ Finalizar"
│       ├─ Validações completas ✅
│       ├─ Alerta: "✅ Obra Finalizada
│       │           Obra com 6 foto(s) protegida(s)
│       │           ✅ Backup permanente no dispositivo"
│       └─ Salva NO DISPOSITIVO (AsyncStorage)
│
├─ 3️⃣ VER NA LISTA
│   ├─ Volta para lista automaticamente
│   ├─ Obra aparece no topo:
│   │   ┌─────────────────────────────────────┐
│   │   │ Obra 12345  [📤 Aguardando] 05/01  │
│   │   │ [✓ Finalizada]                      │
│   │   └─────────────────────────────────────┘
│   │
│   └─ ⚠️ IMPORTANTE:
│       - Badge [📤 Aguardando sync] = NÃO está no banco ainda
│       - Obra está APENAS no dispositivo
│       - Precisa sincronizar!
│
└─ 4️⃣ SINCRONIZAR COM BANCO DE DADOS
    ├─ Verificar conexão:
    │   ✅ WiFi ou dados móveis ligados
    │   ✅ Sem badge "📴 Modo Offline"
    │
    ├─ Clicar botão "☁️ Sincronizar"
    │   ├─ Alerta: "Sincronizar 1 obra(s) pendente(s)?"
    │   └─ Confirmar "Sincronizar"
    │
    ├─ Processamento:
    │   ├─ Spinner aparece no botão
    │   ├─ Envia dados para Supabase
    │   ├─ Faz upload das 6 fotos
    │   └─ Marca synced = true
    │
    ├─ Sucesso:
    │   └─ Alerta: "✅ 1 obra(s) sincronizada(s)"
    │
    └─ Ver resultado na lista:
        ┌─────────────────────────────────────┐
        │ Obra 12345  [☁️ Sincronizada] 05/01│
        │ [✓ Finalizada]                      │
        └─────────────────────────────────────┘

        ✅ Badge mudou: [📤] → [☁️]
        ✅ Obra agora está no banco de dados!
        ✅ Pode ser acessada de qualquer dispositivo
```

**Tempo total**: ~15 minutos (criação + fotos + sincronização)

---

### ⏸️ CENÁRIO 2: Pausar e Continuar Outro Dia

```
🕐 DIA 1 - 16:00 (FIM DO EXPEDIENTE)
│
├─ 1️⃣ INICIAR OBRA
│   ├─ Clicar "➕ Nova Obra"
│   ├─ Preencher dados básicos:
│   │   ├─ Data: 05/01/2026
│   │   ├─ Número: 87654321
│   │   ├─ Responsável: Maria Santos
│   │   └─ Tipo: Transformador
│   │
│   ├─ Tirar algumas fotos:
│   │   └─ 📷 Foto Antes (2 de 2 ✅)
│   │       (faltam Durante e Depois)
│   │
│   └─ ⚠️ PRECISA PARAR (fim do expediente)
│
├─ 2️⃣ PAUSAR OBRA
│   ├─ Clicar "⏸️ Pausar"
│   │   ├─ Validações mínimas ✅
│   │   │   (apenas data, número, responsável, tipo)
│   │   └─ Alerta: "Salvar como rascunho?"
│   │
│   ├─ Confirmar "Pausar"
│   │   ├─ Alerta: "⏸️ Rascunho Salvo
│   │   │           Obra com 2 foto(s) protegida(s)
│   │   │           📝 Continue mais tarde"
│   │   └─ Salva NO DISPOSITIVO
│   │       Status: 'rascunho'
│   │       Synced: false
│   │
│   └─ Ver na lista:
│       ┌─────────────────────────────────────┐
│       │ Obra 87654  [📤 Aguardando] 05/01  │
│       │ [⏸️ Rascunho]  ← Borda laranja      │
│       └─────────────────────────────────────┘
│
│   🏠 Usuário vai embora
│   💾 Obra salva com segurança no dispositivo
│
│
🕐 DIA 2 - 08:00 (VOLTA AO TRABALHO)
│
├─ 3️⃣ ABRIR OBRA PAUSADA
│   ├─ Abrir app
│   ├─ Ver obra na lista (ainda [⏸️ Rascunho])
│   ├─ Clicar na obra
│   │   └─ Abre tela de detalhes
│   │
│   └─ Botões aparecem:
│       ├─ [📷 Adicionar Fotos]
│       └─ [Faltam 4 foto(s) para finalizar]
│
├─ 4️⃣ CONTINUAR DE ONDE PAROU
│   ├─ Clicar "Adicionar Fotos"
│   ├─ Abre tela de edição
│   │   ├─ ✅ Dados anteriores preservados
│   │   ├─ ✅ 2 fotos "Antes" aparecem
│   │   └─ Pode adicionar mais fotos
│   │
│   ├─ Tirar fotos faltantes:
│   │   ├─ 📷 Foto Durante (2 fotos)
│   │   └─ 📷 Foto Depois (2 fotos)
│   │
│   └─ Clicar "✅ Finalizar"
│       ├─ Validações completas ✅
│       ├─ Status muda: 'rascunho' → 'finalizada'
│       └─ Badge muda: [⏸️] → [✓]
│
├─ 5️⃣ VER NA LISTA
│   └─ Obra atualizada:
│       ┌─────────────────────────────────────┐
│       │ Obra 87654  [📤 Aguardando] 05/01  │
│       │ [✓ Finalizada]  ← Mudou!            │
│       └─────────────────────────────────────┘
│
│       ⚠️ Ainda [📤 Aguardando sync]
│       (precisa sincronizar)
│
└─ 6️⃣ SINCRONIZAR
    ├─ Clicar "☁️ Sincronizar"
    ├─ Confirmar
    ├─ Processamento...
    └─ ✅ Sucesso!
        ┌─────────────────────────────────────┐
        │ Obra 87654  [☁️ Sincronizada] 05/01│
        │ [✓ Finalizada]                      │
        └─────────────────────────────────────┘
```

**Tempo total**: Dividido em 2 dias, obra preservada com segurança

---

### 📴 CENÁRIO 3: Trabalhar Offline e Sincronizar Depois

```
🕐 08:00 - LOCAL SEM SINAL
│
├─ 1️⃣ ABRIR APP (OFFLINE)
│   ├─ App funciona normalmente
│   ├─ Badge "📴 Modo Offline" aparece
│   └─ Botão "☁️ Sincronizar" fica cinza (desabilitado)
│
├─ 2️⃣ CRIAR OBRAS OFFLINE
│   ├─ Obra 1:
│   │   ├─ Preencher dados
│   │   ├─ Tirar fotos
│   │   ├─ Finalizar ✅
│   │   └─ Salva LOCALMENTE
│   │       [📤 Aguardando sync] 🟡
│   │
│   ├─ Obra 2:
│   │   ├─ Preencher dados
│   │   ├─ Pausar (precisa continuar depois)
│   │   └─ Salva LOCALMENTE
│   │       [⏸️ Rascunho] [📤 Aguardando sync]
│   │
│   └─ Obra 3:
│       ├─ Preencher dados
│       ├─ Tirar fotos
│       ├─ Finalizar ✅
│       └─ Salva LOCALMENTE
│           [📤 Aguardando sync] 🟡
│
├─ 3️⃣ VER LISTA (OFFLINE)
│   ├─ 3 obras criadas
│   ├─ TODAS com [📤 Aguardando sync]
│   └─ Botão "Sincronizar" continua cinza
│       (não pode sincronizar sem internet)
│
│
🕐 12:00 - VOLTA PARA LOCAL COM SINAL
│
├─ 4️⃣ CONECTAR À INTERNET
│   ├─ WiFi ou dados ligam automaticamente
│   ├─ Badge "📴 Modo Offline" desaparece
│   └─ Botão "☁️ Sincronizar" fica ativo!
│
└─ 5️⃣ SINCRONIZAR TUDO
    ├─ Clicar "☁️ Sincronizar"
    │   └─ Alerta: "Sincronizar 3 obra(s) pendente(s)?"
    │
    ├─ Confirmar "Sincronizar"
    │   ├─ Spinner aparece
    │   └─ Processa cada obra:
    │       ├─ Obra 1: ✅ Sincronizada
    │       ├─ Obra 2: ✅ Sincronizada (rascunho!)
    │       └─ Obra 3: ✅ Sincronizada
    │
    ├─ Alerta: "✅ 3 obra(s) sincronizada(s)"
    │
    └─ Ver resultado:
        ┌─────────────────────────────────────┐
        │ Obra 1  [☁️ Sincronizada] 05/01    │
        │ [✓ Finalizada]                      │
        ├─────────────────────────────────────┤
        │ Obra 2  [☁️ Sincronizada] 05/01    │
        │ [⏸️ Rascunho] ← Pode continuar!     │
        ├─────────────────────────────────────┤
        │ Obra 3  [☁️ Sincronizada] 05/01    │
        │ [✓ Finalizada]                      │
        └─────────────────────────────────────┘

        ✅ Todas no banco de dados!
        ✅ Seguras na nuvem
```

---

## 🎨 Visual dos Botões e Badges

### Barra de Ações (Topo)

```
┌───────────┬──────────────┬─────────┐
│    ➕     │      ☁️      │   🔄    │
│   Nova    │ Sincronizar  │Atualizar│
│   Obra    │              │         │
└───────────┴──────────────┴─────────┘
```

**1. ➕ Nova Obra**
- **Função**: Criar uma nova obra
- **Cor**: Branco com borda cinza
- **Estado**: Sempre ativo

**2. ☁️ Sincronizar**
- **Função**: Enviar obras para banco de dados
- **Cor**: Branco (ativo) / Cinza (desabilitado)
- **Estados**:
  - ✅ Ativo: Com internet + obras pendentes
  - 🔄 Sincronizando: Mostra spinner
  - ❌ Desabilitado: Sem internet OU tudo sincronizado

**3. 🔄 Atualizar**
- **Função**: Recarregar lista de obras
- **Cor**: Branco com borda cinza
- **Estado**: Sempre ativo

### Botões de Ação (Nova Obra)

```
┌──────────┬─────────────┐
│ ⏸️ Pausar │ ✅ Finalizar│
│ (Laranja)│   (Verde)   │
└──────────┴─────────────┘
```

**1. ⏸️ Pausar**
- **Função**: Salvar rascunho para continuar depois
- **Cor**: Laranja (#f59e0b)
- **Validações**: Mínimas (data, número, responsável, tipo)
- **Resultado**: Status 'rascunho', pode editar depois

**2. ✅ Finalizar**
- **Função**: Finalizar obra completa
- **Cor**: Verde (#10b981)
- **Validações**: Completas (fotos obrigatórias, etc)
- **Resultado**: Status 'finalizada', não pode editar

### Badges de Status da Obra

```
[⏸️ Rascunho]    ← Laranja (pode continuar)
[✓ Finalizada]   ← Verde (completa)
```

### Badges de Sincronização

```
[☁️ Sincronizada]      ← Verde (está no banco)
[📤 Aguardando sync]   ← Amarelo (precisa sincronizar)
```

---

## 🔍 Como Saber o Status de Cada Obra

### Lendo os Badges

```
EXEMPLO 1:
┌─────────────────────────────────────────────┐
│ Obra 12345  [📤 Aguardando sync] 05/01     │
│ [⏸️ Rascunho]                               │
└─────────────────────────────────────────────┘

📖 Significado:
├─ [⏸️ Rascunho] = Obra parcial, faltam fotos
├─ [📤 Aguardando sync] = NÃO está no banco
└─ Ação: Pode continuar obra E precisa sincronizar


EXEMPLO 2:
┌─────────────────────────────────────────────┐
│ Obra 67890  [☁️ Sincronizada] 05/01        │
│ [✓ Finalizada]                              │
└─────────────────────────────────────────────┘

📖 Significado:
├─ [✓ Finalizada] = Obra completa, pronta
├─ [☁️ Sincronizada] = JÁ está no banco
└─ Ação: Nenhuma, está tudo certo! ✅


EXEMPLO 3:
┌─────────────────────────────────────────────┐
│ Obra 11111  [📤 Aguardando sync] 05/01     │
│ [✓ Finalizada]                              │
└─────────────────────────────────────────────┘

📖 Significado:
├─ [✓ Finalizada] = Obra completa
├─ [📤 Aguardando sync] = NÃO está no banco
└─ Ação: PRECISA sincronizar urgente! ⚠️


EXEMPLO 4:
┌─────────────────────────────────────────────┐
│ Obra 22222  [☁️ Sincronizada] 05/01        │
│ [⏸️ Rascunho]                               │
└─────────────────────────────────────────────┘

📖 Significado:
├─ [⏸️ Rascunho] = Obra parcial (foi pausada)
├─ [☁️ Sincronizada] = JÁ está no banco como rascunho
└─ Ação: Pode continuar obra, depois sincroniza de novo
```

---

## ⚠️ Perguntas Frequentes (FAQ)

### 1. As obras ficam salvas no meu celular?

✅ **SIM!** Todas as obras são salvas PRIMEIRO no dispositivo (AsyncStorage).

- ✅ Backup permanente no celular
- ✅ Funciona sem internet
- ✅ Fotos armazenadas localmente
- ✅ Não perde dados mesmo se fechar o app

### 2. Quando a obra vai para o banco de dados?

📤 **Apenas quando você clicar "☁️ Sincronizar"!**

- ❌ NÃO sincroniza automaticamente
- ❌ NÃO sincroniza ao criar obra
- ❌ NÃO sincroniza ao finalizar
- ✅ Sincroniza APENAS quando você clicar no botão

### 3. Posso criar obras sem internet?

✅ **SIM!** O app funciona 100% offline.

- ✅ Criar obras
- ✅ Tirar fotos
- ✅ Pausar/Finalizar
- ✅ Editar obras
- ❌ Sincronizar (precisa internet)

### 4. O que acontece se eu não sincronizar?

⚠️ **Obras ficam APENAS no seu celular!**

- ❌ Não aparecem no Dashboard web
- ❌ Não aparecem em outros dispositivos
- ❌ Gestor não vê as obras
- ⚠️ Se perder o celular, perde as obras

**Recomendação**: Sincronize sempre que possível!

### 5. Posso editar obra depois de sincronizar?

✅ **Depende do status:**

- [⏸️ Rascunho] + [☁️ Sincronizada]:
  - ✅ Pode editar
  - ✅ Adicionar fotos
  - ✅ Sincronizar novamente

- [✓ Finalizada] + [☁️ Sincronizada]:
  - ❌ NÃO pode editar
  - ✅ Pode visualizar
  - ❌ Obra está "trancada"

### 6. Quanto tempo demora para sincronizar?

⏱️ **Depende do número de fotos:**

- 1 obra com 6 fotos: ~5-10 segundos
- 5 obras com 30 fotos: ~30-60 segundos
- 10 obras com 60 fotos: ~1-2 minutos

**Dica**: Sincronize regularmente para não acumular muitas obras!

### 7. O que fazer se sincronização falhar?

🔄 **Tentar novamente:**

1. Verificar internet
2. Tentar "☁️ Sincronizar" de novo
3. Se persistir, clicar "🔄 Atualizar"
4. Tentar sincronizar novamente

**Obras não sincronizadas**:
- Mantêm badge [📤 Aguardando sync]
- Pode tentar quantas vezes quiser
- Dados não são perdidos

---

## 📊 Resumo Visual: Jornada Completa

```
┌─────────────────────────────────────────────┐
│  1. CRIAR OBRA                              │
│  ├─ Clicar "➕ Nova Obra"                   │
│  ├─ Preencher dados + fotos                 │
│  └─ "⏸️ Pausar" OU "✅ Finalizar"          │
│                                              │
│       ↓ Salva LOCALMENTE                    │
│                                              │
│  2. VER NA LISTA                            │
│  ├─ Obra aparece com [📤 Aguardando sync]  │
│  └─ Dados seguros no dispositivo            │
│                                              │
│       ↓                                      │
│                                              │
│  3. SINCRONIZAR                             │
│  ├─ Ter internet                            │
│  ├─ Clicar "☁️ Sincronizar"                │
│  └─ Confirmar                               │
│                                              │
│       ↓ Upload para Supabase                │
│                                              │
│  4. RESULTADO                               │
│  ├─ Badge muda: [📤] → [☁️]                │
│  ├─ Obra no banco de dados                  │
│  └─ Visível no Dashboard web                │
└─────────────────────────────────────────────┘
```

---

## 🎯 Checklist: Como Garantir que Obra Foi Enviada

✅ **Antes de ir embora do local:**

1. [ ] Criar ou finalizar todas as obras do dia
2. [ ] Verificar conexão com internet
3. [ ] Clicar botão "☁️ Sincronizar"
4. [ ] Aguardar mensagem "✅ X obra(s) sincronizada(s)"
5. [ ] Verificar que TODAS as obras têm badge [☁️ Sincronizada]
6. [ ] Se alguma ficou [📤 Aguardando], sincronizar de novo

✅ **Obra está segura quando:**
- Badge [☁️ Sincronizada] aparece
- Cor do badge é verde
- Nenhuma obra com [📤 Aguardando sync] amarelo

---

**Implementado em**: Janeiro 2026
**Status**: ✅ SISTEMA COMPLETO E FUNCIONAL
**Fluxo**: Criar → Pausar/Finalizar → Sincronizar → Banco de Dados
