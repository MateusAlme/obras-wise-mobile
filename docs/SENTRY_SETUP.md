# 🔍 Configuração do Sentry - Monitoramento de Erros

Este guia explica como configurar o Sentry para monitorar erros e crashes no app mobile.

## 📦 Passo 1: Instalar Dependências

Execute no diretório `mobile/`:

```bash
npm install --save @sentry/react-native
npx @sentry/wizard@latest -i reactNative -p ios android
```

O wizard vai:
- Configurar automaticamente o Sentry
- Adicionar plugins necessários
- Criar arquivos de configuração

## 🔑 Passo 2: Criar Projeto no Sentry

1. Acesse [sentry.io](https://sentry.io) e crie uma conta (grátis)
2. Crie um novo projeto:
   - **Platform:** React Native
   - **Project Name:** obras-wise-mobile
   - **Team:** Seu time/organização

3. Copie o **DSN** que aparecerá (formato: `https://xxx@xxx.ingest.sentry.io/xxx`)

## ⚙️ Passo 3: Configurar DSN

Edite o arquivo `mobile/lib/sentry.ts` e substitua a linha:

```typescript
const SENTRY_DSN = 'https://your-dsn@sentry.io/your-project-id';
```

Por:

```typescript
const SENTRY_DSN = 'SEU_DSN_AQUI';
```

**Alternativa (mais seguro):** Use variável de ambiente:

1. Crie arquivo `mobile/.env`:
```
SENTRY_DSN=sua-dsn-aqui
```

2. Instale dotenv:
```bash
npm install --save react-native-dotenv
```

3. No `sentry.ts`, importe:
```typescript
import { SENTRY_DSN } from '@env';
```

## 🚀 Passo 4: Inicializar no App

O Sentry já está configurado para inicializar automaticamente no `_layout.tsx`.

Verifique se contém:

```typescript
import { initSentry } from '../lib/sentry';

export default function RootLayout() {
  useEffect(() => {
    initSentry();
  }, []);

  // ... resto do código
}
```

## 📊 Passo 5: Build e Release

Para o Sentry mapear corretamente os erros, você precisa fazer upload dos source maps:

```bash
# Android
eas build --platform android --profile preview

# iOS
eas build --platform ios --profile preview
```

O plugin do Sentry vai automaticamente:
- Fazer upload dos source maps
- Associar a versão do app com a release no Sentry

## ✅ Passo 6: Testar

### Teste Local (Development)

Em dev, o Sentry está **desabilitado** para não poluir os logs. Os erros apenas aparecem no console.

### Teste em Produção/Preview

1. Instale o build no dispositivo
2. Force um erro de teste (adicione em qualquer tela):

```typescript
import { captureError } from '../lib/sentry';

// Botão de teste
<Button
  title="Testar Sentry"
  onPress={() => {
    try {
      throw new Error('Teste de erro do Sentry!');
    } catch (error) {
      captureError(error as Error, {
        type: 'other',
        metadata: { teste: true }
      });
    }
  }}
/>
```

3. Acesse o dashboard do Sentry em alguns minutos
4. Verifique se o erro apareceu com:
   - Stack trace completo
   - Informações do dispositivo
   - Breadcrumbs (ações do usuário antes do erro)

## 🎯 O Que o Sentry Monitora

### ✅ Já Configurado Automaticamente:

1. **Crashes de JavaScript**
   - Erros não tratados
   - Promise rejections
   - Exceções de runtime

2. **Crashes Nativos**
   - Crashes do Android/iOS
   - Out of memory
   - Segmentation faults

3. **Performance**
   - Tempo de carregamento de telas
   - Requisições de rede lentas
   - Operações pesadas

4. **Breadcrumbs (Rastro)**
   - Navegação entre telas
   - Ações do usuário (cliques, inputs)
   - Requisições de rede
   - Console logs

### 📍 Integrado nos Principais Módulos:

O Sentry já foi integrado em:
- ✅ Photo Backup (`mobile/lib/photo-backup.ts`)
- ✅ Photo Upload Queue (`mobile/lib/photo-queue.ts`)
- ✅ Offline Sync (`mobile/lib/offline-sync.ts`)
- ✅ Nova Obra (`mobile/app/nova-obra.tsx`)

## 📈 Dashboard do Sentry

Após configurado, você poderá ver no dashboard:

### Issues (Erros)
- Lista de todos os erros
- Frequência de ocorrência
- Dispositivos afetados
- Versões do app afetadas
- Stack traces completos

### Performance
- Transações mais lentas
- Tempo médio de operações
- Gráficos de performance

### Releases
- Quantos erros por versão do app
- Comparação entre versões
- Rastreamento de novos erros

### Usuários
- Quantos usuários afetados
- Equipes com mais problemas
- Dispositivos problemáticos

## 🔔 Alertas (Opcional)

Configure alertas para ser notificado:

1. Acesse **Alerts** no Sentry
2. Crie regra:
   - **When:** "An issue is first seen"
   - **Then:** "Send email" ou "Send Slack message"
3. Você será notificado em tempo real de novos erros

## 💰 Planos

- **Free:** 5,000 erros/mês (suficiente para começar)
- **Team:** $26/mês - 50,000 erros/mês
- **Business:** $80/mês - 150,000 erros/mês

Comece com o plano gratuito e upgrade conforme necessário.

## 🐛 Troubleshooting

### Erros não aparecem no Sentry:

1. **Verifique se está em produção:** Em dev, Sentry está desabilitado
2. **Confirme o DSN:** Verifique se colocou o DSN correto
3. **Aguarde alguns minutos:** Pode levar 1-2 minutos para aparecer
4. **Verifique internet:** O app precisa estar online para enviar erros

### Source maps não carregam:

1. Execute `eas build` (não `expo build`)
2. Verifique se o plugin do Sentry está no `app.json`
3. Confirme que o `auth token` do Sentry está configurado

## 📚 Documentação Oficial

- [Sentry React Native Docs](https://docs.sentry.io/platforms/react-native/)
- [Sentry Performance Monitoring](https://docs.sentry.io/platforms/react-native/performance/)
- [Sentry Release Health](https://docs.sentry.io/product/releases/health/)

## 🎓 Exemplos de Uso no Código

### Capturar erro simples:
```typescript
import { captureError } from '../lib/sentry';

try {
  await uploadPhoto();
} catch (error) {
  captureError(error as Error, {
    type: 'photo',
    photoId: photo.id
  });
}
```

### Adicionar breadcrumb (rastro):
```typescript
import { addBreadcrumb } from '../lib/sentry';

addBreadcrumb('Usuário tirou foto', 'user_action', {
  tipo: 'inteiro',
  obraId: '123'
});
```

### Medir performance:
```typescript
import { startTransaction } from '../lib/sentry';

const transaction = startTransaction('Upload de Fotos', 'photo.upload');
await processObraPhotos(obraId);
transaction.finish();
```

---

**Dúvidas?** Consulte a documentação oficial ou abra uma issue no projeto.
