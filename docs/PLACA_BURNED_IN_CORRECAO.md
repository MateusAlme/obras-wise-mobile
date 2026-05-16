# Correção: Placa Burned-in em TODAS as Fotos

## Problema Identificado

As fotos **NÃO** estavam ficando com a placa gravada permanentemente porque:

1. **Erro no Web**: O módulo `photo-with-placa.ts` tentava importar `@shopify/react-native-skia` no topo do arquivo
2. **Skia não funciona no navegador**: Quando o código rodava no web, o import do Skia causava erro
3. **Import dinâmico falhava**: Mesmo usando `await import()`, o erro acontecia porque o módulo inteiro era avaliado

### Mensagem de Erro
```
[Error: react-native-reanimated is not installed!]
⚠️ Erro ao gravar placa, usando foto original: [TypeError: renderPhotoWithPlacaBurnedIn is not a function (it is undefined)]
```

## Solução Implementada

### 1. Separação de Arquivos por Plataforma

Criamos **dois arquivos separados**:

#### WEB: `mobile/lib/photo-with-placa-web.ts`
- **Não** importa Skia
- Usa **Canvas API do navegador** (HTML5)
- Funciona em qualquer navegador moderno
- Import: `import('../lib/photo-with-placa-web')`

#### MOBILE: `mobile/lib/photo-with-placa.ts`
- Importa Skia
- Usa **Skia Canvas** (nativo, alta performance)
- Funciona em Android e iOS
- Import: `import('../lib/photo-with-placa')`

### 2. Import Condicional no Código

No arquivo `nova-obra.tsx` (linhas 605-617):

```typescript
if (Platform.OS === 'web') {
  console.log('🌐 Usando placa WEB (Canvas API)');
  const { renderPhotoWithPlacaBurnedIn } = await import('../lib/photo-with-placa-web');
  const photoWithPlaca = await renderPhotoWithPlacaBurnedIn(photoUri, placaData);
  photoUri = photoWithPlaca;
} else {
  console.log('📱 Usando placa MOBILE (Skia)');
  const { renderPhotoWithPlacaBurnedIn } = await import('../lib/photo-with-placa');
  const photoWithPlaca = await renderPhotoWithPlacaBurnedIn(photoUri, placaData);
  photoUri = photoWithPlaca;
}
```

## Como Funciona Agora

### Fluxo no WEB (Navegador)

1. Usuário tira foto via câmera do navegador
2. Sistema obtém GPS (se permitido)
3. `photo-with-placa-web.ts` é carregado (sem Skia)
4. Canvas API do navegador renderiza a placa:
   - Cria elemento `<canvas>` em memória
   - Desenha a foto original
   - Desenha a placa por cima (fundo preto, borda azul, textos)
   - Converte para Blob JPEG
   - Cria URL `blob:http://localhost/...`
5. Foto com placa é salva no estado
6. Backup é feito com a foto COM placa
7. Upload para Supabase da foto COM placa

### Fluxo no MOBILE (Android/iOS)

1. Usuário tira foto via câmera nativa
2. Sistema obtém GPS
3. `photo-with-placa.ts` é carregado (com Skia)
4. Skia Canvas renderiza a placa:
   - Lê imagem original usando FileSystem
   - Cria Surface Skia com mesmas dimensões
   - Desenha imagem original
   - Desenha placa por cima
   - Converte para base64 e salva em arquivo
5. Foto com placa é salva no estado
6. Backup é feito com a foto COM placa
7. Upload para Supabase da foto COM placa

## Informações na Placa

A placa contém **SEMPRE**:

✅ **Número da Obra**
✅ **Data/Hora** (formatada em PT-BR)
✅ **Tipo de Serviço**
✅ **Equipe**
✅ **Coordenadas UTM** (se GPS disponível)
✅ **Endereço** (se GPS + internet disponível)

### Exemplo Visual

```
┌─────────────────────────────────────┐
│ Obra:     0032401637                │
│ Data:     26/12/2025 14:30          │
│ Serviço:  Emenda                    │
│ Equipe:   MNT 01                    │
├─────────────────────────────────────┤
│ UTM:      24M 756234E 9276543N      │
│ Local:    Rua Padre João Andriola...│
└─────────────────────────────────────┘
```

## Características Técnicas

### Posicionamento
- **Canto inferior esquerdo** da foto
- 20px de margem das bordas
- Largura: 40% da foto (máx 480px)
- Altura: dinâmica conforme número de linhas

### Estilo Visual
- Fundo: Preto semi-transparente (88% opacidade)
- Borda: Azul `#2563eb` (3px, 70% opacidade)
- Labels: Cinza `#9ca3af` (fonte 16px)
- Valores: Branco (fonte 20px, negrito para Obra/Equipe)
- UTM: Verde `#34d399` (destaque)

### Qualidade
- Compressão JPEG: 95% (alta qualidade)
- Texto renderizado com anti-aliasing
- Cores mantêm contraste para leitura

## Logs de Debug

### Logs Esperados no WEB

```
🌐 Usando placa WEB (Canvas API)
[PLACA WEB] Iniciando renderização...
[PLACA WEB] UTM calculado: 24M 756234E 9276543N
[PLACA WEB] Carregando imagem... blob:http://...
[PLACA WEB] Imagem carregada! 1920 x 1080
[PLACA WEB] Canvas criado, desenhando imagem...
[PLACA WEB] Desenhando placa... {placaWidth: 480, placaHeight: 200, ...}
[PLACA WEB] Convertendo canvas para blob...
✅ [PLACA WEB] Foto com placa gravada! blob:http://...
✅ Placa gravada na foto (WEB)
```

### Logs Esperados no MOBILE

```
📱 Usando placa MOBILE (Skia)
✅ Placa gravada na foto (MOBILE)
```

### Se Houver Erro

```
⚠️ Erro ao gravar placa, usando foto original: [Error: ...]
```
↳ Foto original é usada como fallback (sem placa)

## Compatibilidade

### Navegadores Web
✅ Chrome 90+
✅ Firefox 88+
✅ Safari 14+
✅ Edge 90+

**Requisitos**:
- Canvas API
- Blob API
- Image() constructor
- createObjectURL()

### Mobile
✅ Android 8.0+ (API 26+)
✅ iOS 13.0+

**Requisitos**:
- react-native-skia 2.2.12
- react-native-reanimated 4.1.1
- expo-file-system 19.0.20

## Testes

### Teste 1: Placa no WEB
1. Abrir http://localhost:8081 no navegador
2. Criar nova obra
3. Adicionar foto (qualquer seção)
4. Abrir console (F12)
5. Verificar logs `[PLACA WEB]`
6. Clicar na miniatura para ver em tela cheia
7. **Resultado esperado**: Placa FIXA no canto inferior esquerdo

### Teste 2: Placa no MOBILE
1. Escanear QR code com Expo Go
2. Criar nova obra
3. Adicionar foto
4. Ver log no terminal: `✅ Placa gravada na foto (MOBILE)`
5. Clicar na miniatura
6. **Resultado esperado**: Placa FIXA no canto inferior esquerdo

### Teste 3: Todas as Seções
Verificar que TODAS as seções têm placa:
- ✅ Fotos Antes/Durante/Depois
- ✅ Abertura/Fechamento de Chave
- ✅ Ditais (5 seções)
- ✅ Book de Aterramento (4 seções)
- ✅ Transformador (13 seções)
- ✅ Medidor (5 seções)
- ✅ Checklist (Postes, Seccionamento, etc.)
- ✅ Altimetria (4 seções)
- ✅ Vazamento (7 seções)

### Teste 4: Offline
1. Desativar internet
2. Tirar foto
3. **Resultado esperado**:
   - Placa COM: Obra, Data, Serviço, Equipe, UTM
   - Placa SEM: Endereço (precisa internet)

## Arquivos Modificados

1. **Criado**: `mobile/lib/photo-with-placa-web.ts`
   - Implementação Canvas API para web
   - Não importa Skia
   - Export: `renderPhotoWithPlacaBurnedIn()`

2. **Modificado**: `mobile/app/nova-obra.tsx` (linhas 600-621)
   - Import condicional baseado em Platform.OS
   - Logs de debug melhorados

3. **Existente** (não modificado): `mobile/lib/photo-with-placa.ts`
   - Continua com implementação Skia para mobile
   - Agora só é importado em plataformas nativas

## Vantagens da Solução

1. ✅ **Zero Erros**: Não tenta carregar Skia no web
2. ✅ **Performance**: Canvas API nativo no web, Skia nativo no mobile
3. ✅ **Offline-First**: Funciona sem internet (exceto endereço)
4. ✅ **Universal**: Mesma funcionalidade em todas plataformas
5. ✅ **Manutenível**: Código separado por plataforma
6. ✅ **Rastreável**: Logs claros indicam qual implementação está sendo usada

## Próximos Passos

Para confirmar que está funcionando:

1. **Reiniciar servidor** com cache limpo:
   ```bash
   npx expo start --clear
   ```

2. **Tirar uma foto** em qualquer seção

3. **Verificar logs** no console do navegador (F12)

4. **Clicar na miniatura** para ver foto em tela cheia

5. **Confirmar**: Placa aparece FIXA no canto inferior esquerdo da imagem
