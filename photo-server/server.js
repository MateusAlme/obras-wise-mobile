/**
 * Servidor local para adicionar placa em fotos
 * Roda em http://localhost:3000
 *
 * Uso: POST /add-placa
 * Body: { imageBase64, placaData }
 * Retorna: { imageBase64WithPlaca }
 */

const express = require('express');
const { createCanvas, loadImage } = require('canvas');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Rota de health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Servidor de placa de fotos rodando',
    endpoint: '/add-placa'
  });
});

// Rota para adicionar placa
app.post('/add-placa', async (req, res) => {
  try {
    console.log('📸 Recebendo requisição para adicionar placa...');

    const { imageBase64, placaData } = req.body;

    if (!imageBase64 || !placaData) {
      return res.status(400).json({ error: 'imageBase64 e placaData são obrigatórios' });
    }

    // Converter base64 para buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    // Carregar imagem
    console.log('📸 Carregando imagem...');
    const img = await loadImage(imageBuffer);
    console.log(`📸 Imagem carregada: ${img.width}x${img.height}`);

    // Criar canvas
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');

    // Desenhar imagem original
    ctx.drawImage(img, 0, 0);

    // Configurar placa
    const placaPadding = 16;
    const lineHeight = 28;
    const fontSize = 20;
    const fontSizeSmall = 16;

    let numLines = 4; // Obra, Data, Serviço, Equipe
    if (placaData.utm) numLines++;
    if (placaData.endereco) numLines++;

    const placaWidth = Math.min(img.width * 0.4, 480);
    const placaHeight = placaPadding * 2 + numLines * lineHeight + 20;
    const placaX = 20;
    const placaY = img.height - placaHeight - 20;

    console.log(`📸 Desenhando placa: ${placaWidth}x${placaHeight} em (${placaX}, ${placaY})`);

    // Fundo preto semi-transparente
    ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
    ctx.fillRect(placaX, placaY, placaWidth, placaHeight);

    // Borda azul
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.7)';
    ctx.lineWidth = 3;
    ctx.strokeRect(placaX, placaY, placaWidth, placaHeight);

    // Desenhar textos
    let textY = placaY + placaPadding + fontSize;

    const drawTextLine = (label, value, isBold = false, isGreen = false) => {
      // Label (cinza)
      ctx.font = `600 ${fontSizeSmall}px sans-serif`;
      ctx.fillStyle = '#9ca3af';
      ctx.fillText(label, placaX + placaPadding, textY);

      // Value (branco ou verde)
      ctx.font = `${isBold ? 'bold' : 'normal'} ${fontSize}px sans-serif`;
      ctx.fillStyle = isGreen ? '#34d399' : '#ffffff';
      ctx.fillText(value, placaX + placaPadding + 80, textY);

      textY += lineHeight;
    };

    // Desenhar cada linha
    drawTextLine('Obra:', placaData.obraNumero, true, false);
    drawTextLine('Data:', placaData.dataHora, false, false);

    const servicoTrunc = placaData.tipoServico.length > 20
      ? placaData.tipoServico.substring(0, 20) + '...'
      : placaData.tipoServico;
    drawTextLine('Serviço:', servicoTrunc, false, false);

    drawTextLine('Equipe:', placaData.equipe, true, false);

    if (placaData.utm) {
      drawTextLine('UTM:', placaData.utm, false, true);
    }

    if (placaData.endereco) {
      const enderecoTrunc = placaData.endereco.length > 30
        ? placaData.endereco.substring(0, 30) + '...'
        : placaData.endereco;
      drawTextLine('Local:', enderecoTrunc, false, false);
    }

    // Converter para base64
    console.log('📸 Convertendo para base64...');
    const resultBuffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
    const resultBase64 = resultBuffer.toString('base64');

    console.log('✅ Placa adicionada com sucesso!');

    res.json({
      success: true,
      imageBase64WithPlaca: resultBase64,
      size: resultBase64.length
    });

  } catch (error) {
    console.error('❌ Erro ao processar imagem:', error);
    res.status(500).json({
      error: 'Erro ao processar imagem',
      details: error.message
    });
  }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor de placa rodando em http://localhost:${PORT}`);
  console.log(`🌐 Acessível na rede em http://10.0.0.116:${PORT}`);
  console.log(`\n📸 Endpoint: POST /add-placa`);
  console.log(`   Body: { imageBase64: string, placaData: object }`);
});
