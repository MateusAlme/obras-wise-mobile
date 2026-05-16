# Guia de Publicação - Google Play Store

## Obras Teccel Mobile App

---

## ✅ Pré-requisitos

1. **Conta Google Play Console**
   - Acesse: https://play.google.com/console
   - Taxa única de inscrição: $25 USD
   - Necessário cartão de crédito internacional

2. **Conta Expo** (gratuita)
   - Crie em: https://expo.dev/signup
   - Necessária para build na nuvem

---

## 📋 Passo 1: Login no Expo

```bash
cd mobile
eas login
```

Se não tiver conta, crie com:
```bash
eas register
```

---

## 🔧 Passo 2: Configurar o projeto EAS

```bash
eas build:configure
```

Isso criará o arquivo `eas.json` com as configurações de build.

---

## 🔑 Passo 3: Criar Build de Produção (AAB)

O formato **AAB (Android App Bundle)** é obrigatório para a Play Store.

```bash
eas build --platform android --profile production
```

**Importante:** Durante o build, você será questionado sobre:

1. **Gerar novo keystore?** → Responda `Yes` (primeira vez)
2. O EAS gerará automaticamente as credenciais de assinatura
3. O build será feito na nuvem (grátis para projetos pequenos)

⏱️ O build pode levar **10-20 minutos**

Quando concluir, você receberá um link para download do AAB.

---

## 📱 Passo 4: Criar Conta Google Play Console

1. Acesse: https://play.google.com/console
2. Pague a taxa única de $25 USD
3. Preencha informações da conta de desenvolvedor
4. Aceite os termos e condições

---

## 🚀 Passo 5: Criar Novo App na Play Console

1. Clique em **"Criar app"**
2. Preencha:
   - **Nome do app:** Obras Teccel
   - **Idioma padrão:** Português (Brasil)
   - **Tipo:** App
   - **Gratuito ou pago:** Gratuito
3. Aceite declarações

---

## 📝 Passo 6: Preencher Ficha da Loja

### 6.1 Detalhes do App

- **Título:** Obras Teccel
- **Descrição curta:** App para registro de obras e serviços técnicos com fotos georreferenciadas
- **Descrição completa:**
```
Obras Teccel é um aplicativo profissional para registro e documentação de obras e serviços técnicos.

RECURSOS:
• Registro de obras com fotos georreferenciadas
• Múltiplos tipos de serviços (Emenda, Bandolamento, Aterramento, etc.)
• Fotos com localização GPS automática
• Sistema offline com sincronização automática
• Backup permanente de fotos
• Registro de atipicidades

TIPOS DE SERVIÇO:
- Emenda
- Bandolamento
- Aterramento
- Linha Viva
- Abertura e Fechamento de Chave
- Ditais (5 fotos específicas)
- Book de Aterramento (4 fotos específicas)

IDEAL PARA:
Profissionais e empresas que precisam documentar obras técnicas com precisão e rastreabilidade.
```

### 6.2 Assets Visuais Necessários

Você precisará preparar:

1. **Ícone do app:** 512x512 px (PNG)
2. **Imagem de destaque:** 1024x500 px
3. **Screenshots:** Mínimo 2, máximo 8
   - Tamanho: 320-3840 px (largura ou altura)
   - Formato: PNG ou JPEG
   - Capture telas do app em funcionamento

### 6.3 Categorização

- **Categoria:** Produtividade ou Ferramentas
- **Tags:** obras, construção, documentação, fotos

### 6.4 Informações de Contato

- Email de contato
- Política de privacidade (URL) - pode criar uma simples
- Site (opcional)

---

## 🔐 Passo 7: Política de Privacidade

Crie um documento simples de política de privacidade. Exemplo básico:

```markdown
# Política de Privacidade - Obras Teccel

Última atualização: [DATA]

## Coleta de Dados
O app coleta:
- Fotos tiradas pelo usuário
- Localização GPS das fotos
- Dados de obras (número, data, responsável, equipe)

## Uso dos Dados
Os dados são usados exclusivamente para documentação de obras.
As fotos e dados são armazenados de forma segura no Supabase.

## Compartilhamento
Não compartilhamos dados com terceiros.

## Contato
[SEU EMAIL]
```

Hospede em GitHub Pages ou em algum site.

---

## 📦 Passo 8: Upload do AAB

1. No Play Console, vá em **"Produção"**
2. Clique em **"Criar nova versão"**
3. Faça upload do arquivo `.aab` baixado do EAS
4. Preencha **"Notas da versão"**:
   ```
   Versão inicial
   - Registro de obras com fotos
   - Sistema offline
   - Múltiplos tipos de serviço
   ```

---

## ✅ Passo 9: Classificação de Conteúdo

1. Complete o questionário de classificação
2. Para este app:
   - Não contém violência
   - Não contém conteúdo sexual
   - Não é jogo
   - Público-alvo: Todos

---

## 🎯 Passo 10: Público-alvo e Conteúdo

1. Defina faixa etária alvo: **18+** (app profissional)
2. Não é app infantil
3. Não contém anúncios

---

## 📋 Passo 11: Revisar e Publicar

1. Revise todas as seções
2. O Google verificará:
   - ✅ Ficha da loja completa
   - ✅ Classificação de conteúdo
   - ✅ Público-alvo
   - ✅ Política de privacidade
   - ✅ AAB válido

3. Clique em **"Enviar para análise"**

---

## ⏰ Passo 12: Aguardar Aprovação

- **Tempo de análise:** 1-7 dias
- Você receberá email quando for aprovado
- Se rejeitado, corrija os problemas indicados

---

## 🔄 Atualizações Futuras

Para atualizar o app:

1. Incremente `versionCode` e `version` no `app.json`:
   ```json
   "version": "1.0.1",
   "android": {
     "versionCode": 2
   }
   ```

2. Gere novo build:
   ```bash
   eas build --platform android --profile production
   ```

3. Faça upload do novo AAB na Play Console

---

## 💡 Dicas Importantes

### ✅ Boas Práticas

- **Screenshots de qualidade:** Mostre as principais funcionalidades
- **Descrição clara:** Explique o que o app faz
- **Ícone atrativo:** Use o logo da empresa
- **Atualizações regulares:** Mantenha o app atualizado

### ⚠️ Evite

- Não use palavras proibidas (grátis, melhor, etc.)
- Não faça promessas falsas
- Não copie descrições de outros apps
- Não use screenshots genéricos

### 🎨 Assets Necessários

Crie as seguintes imagens:

1. **Icon.png** (512x512)
2. **Adaptive-icon.png** (1024x1024)
3. **Feature Graphic** (1024x500)
4. **Screenshots** (mínimo 2):
   - Tela de login
   - Tela de nova obra
   - Tela com fotos

---

## 🆘 Problemas Comuns

### Build falhando?
```bash
# Limpar cache e tentar novamente
cd mobile
rm -rf node_modules
npm install
eas build --platform android --profile production --clear-cache
```

### Esqueceu credenciais de assinatura?
```bash
# EAS gerencia automaticamente
# Não precisa se preocupar com keystores
```

### App rejeitado?
- Leia o email do Google com atenção
- Corrija os problemas específicos mencionados
- Reenvie para análise

---

## 📞 Suporte

- **Expo EAS:** https://docs.expo.dev/build/introduction/
- **Play Console:** https://support.google.com/googleplay/android-developer
- **Documentação Expo:** https://docs.expo.dev/

---

## 🎉 Pronto!

Após aprovação, seu app estará disponível na Play Store em:
`https://play.google.com/store/apps/details?id=com.obraswise.mobile`

Você poderá compartilhar esse link com usuários!
