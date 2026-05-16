# 🎯 Sentry - Guia Rápido

## ✅ O que já foi feito

### 1. Dependência Instalada
- ✅ `@sentry/react-native` já está em `package.json`

### 2. Arquivos Criados
- ✅ [`mobile/lib/sentry.ts`](mobile/lib/sentry.ts) - Configuração principal
- ✅ [`SENTRY_SETUP.md`](SENTRY_SETUP.md) - Documentação completa
- ✅ Integração em pontos críticos do código

### 3. Integração Completa
- ✅ [`_layout.tsx`](mobile/app/_layout.tsx) - Inicialização automática
- ✅ [`ErrorBoundary.tsx`](mobile/components/ErrorBoundary.tsx) - Captura erros de UI
- ✅ [`photo-backup.ts`](mobile/lib/photo-backup.ts) - Erros de backup
- ✅ [`photo-queue.ts`](mobile/lib/photo-queue.ts) - Erros de upload
- ✅ [`offline-sync.ts`](mobile/lib/offline-sync.ts) - Erros de sincronização

## 🚀 Próximos Passos (IMPORTANTE)

### 1. Obter DSN do Sentry

1. Acesse https://sentry.io e crie conta gratuita
2. Crie projeto:
   - Platform: **React Native**
   - Nome: **obras-wise-mobile**
3. Copie o **DSN** (formato: `https://xxx@xxx.ingest.sentry.io/xxx`)

### 2. Configurar DSN no Código

Edite [`mobile/lib/sentry.ts`](mobile/lib/sentry.ts) linha 11:

```typescript
// ANTES:
const SENTRY_DSN = 'https://your-dsn@sentry.io/your-project-id';

// DEPOIS:
const SENTRY_DSN = 'SUA_DSN_AQUI';
```

### 3. Configurar Sentry no app.json

Adicione no [`mobile/app.json`](mobile/app.json) dentro de `"plugins"`:

```json
{
  "expo": {
    "plugins": [
      "expo-router",
      "@sentry/react-native/expo"
    ]
  }
}
```

### 4. Gerar Build

```bash
cd mobile
eas build --platform android --profile preview
```

O Sentry vai automaticamente:
- Fazer upload dos source maps
- Permitir ver código fonte nos erros
- Associar versão do app

## 📊 O que será Monitorado

### Erros Automáticos
- ✅ Crashes de JavaScript
- ✅ Crashes nativos (Android)
- ✅ Erros não tratados
- ✅ Promise rejections

### Erros Específicos Capturados
- ✅ Falhas ao fazer backup de fotos
- ✅ Falhas no upload de fotos
- ✅ Falhas na sincronização de obras
- ✅ Erros de UI (ErrorBoundary)

### Informações Coletadas
- ✅ Stack trace completo
- ✅ Dispositivo (modelo, OS, versão)
- ✅ Breadcrumbs (ações do usuário antes do erro)
- ✅ Contexto (obraId, photoId, tipo de erro)
- ✅ Performance (tempo de operações)

## 🔍 Como Ver os Erros

1. Acesse dashboard do Sentry: https://sentry.io
2. Clique em **Issues** para ver erros
3. Clique em um erro para ver:
   - Stack trace completo
   - Informações do dispositivo
   - Breadcrumbs (o que o usuário fez antes)
   - Quantos usuários foram afetados
   - Frequência do erro

## 📱 Testar o Sentry

### Em Development (Local)
- ❌ Sentry está **DESABILITADO** (para não poluir logs)
- Erros aparecem apenas no console

### Em Production/Preview
1. Instale o APK gerado
2. Teste funções críticas:
   - Tirar foto
   - Fazer upload
   - Sincronizar obra
3. Aguarde 1-2 minutos
4. Verifique dashboard do Sentry

### Forçar um Erro de Teste
Adicione botão temporário em qualquer tela:

```typescript
import { captureError } from '../lib/sentry';

<Button
  title="🧪 Testar Sentry"
  onPress={() => {
    throw new Error('Teste do Sentry!');
  }}
/>
```

## 🔔 Configurar Alertas (Opcional)

No dashboard do Sentry:
1. **Alerts** → **Create Alert**
2. **When:** "An issue is first seen"
3. **Then:** "Send email"
4. Você receberá email em tempo real de novos erros

## 💰 Plano Gratuito

- **5,000 erros/mês** (suficiente para começar)
- Sem limite de projetos
- Retenção de 90 dias
- Alertas ilimitados

Se precisar mais, upgrade para:
- **Team:** $26/mês - 50k erros
- **Business:** $80/mês - 150k erros

## 🐛 Exemplo de Erro no Sentry

Quando um erro acontecer, você verá:

```
Error: Falha ao salvar arquivo comprimido
  at backupPhoto (photo-backup.ts:192)
  at handleTirarFoto (nova-obra.tsx:1543)

Device Info:
  Platform: Android 12
  Model: Samsung Galaxy A52
  App Version: 1.2.2

Tags:
  error_type: photo
  obra_id: 12345678
  photo_type: inteiro

Breadcrumbs:
  [11:23:45] User Action: Usuário tirou foto (tipo: inteiro)
  [11:23:46] Photo: Comprimindo foto...
  [11:23:47] Error: Compressão falhou
```

## 📚 Documentação Completa

Consulte [`SENTRY_SETUP.md`](SENTRY_SETUP.md) para:
- Configuração avançada
- Variáveis de ambiente
- Troubleshooting
- Exemplos de uso

## ✨ Resumo

1. ✅ Código já está integrado
2. ⏳ **Falta:** Obter DSN do Sentry
3. ⏳ **Falta:** Adicionar plugin no app.json
4. ⏳ **Falta:** Gerar novo build

Depois disso, todos os erros serão automaticamente reportados ao Sentry! 🎉
