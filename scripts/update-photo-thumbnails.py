#!/usr/bin/env python3
"""
Script para atualizar todas as thumbnails de fotos para usar PhotoWithPlaca
e adicionar TouchableOpacity para ampliar
"""

import re

def update_thumbnails(content):
    """Atualiza thumbnails simples para PhotoWithPlaca com TouchableOpacity"""

    # Padrão 1: Image simples sem TouchableOpacity
    pattern1 = r'(<View key={index} style={styles\.photoCard}>\s*)<Image source={{ uri: foto\.uri }} style={styles\.photoThumbnail} />'
    replacement1 = r'''\1<TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isCompUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>'''

    content = re.sub(pattern1, replacement1, content, flags=re.MULTILINE)

    # Remover renderUtmBadge (não é mais necessário pois a placa já mostra UTM)
    content = re.sub(r'\s*{renderUtmBadge\(foto\)}', '', content)

    return content

# Ler arquivo
file_path = r'C:\Users\Mateus Almeida\obras-wise-mobile\mobile\app\nova-obra.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Atualizar
content = update_thumbnails(content)

# Salvar
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("[OK] Thumbnails atualizadas com sucesso!")
print("- Adicionado PhotoWithPlaca em todas as secoes")
print("- Adicionado TouchableOpacity para ampliar")
print("- Removido renderUtmBadge duplicado")
