import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { parsePlacaText, PlacaInfo, isValidPlacaInfo } from '../lib/placa-parser';

interface PlacaScannerProps {
  visible: boolean;
  onClose: () => void;
  onPlacaDetected: (info: PlacaInfo) => void;
}

export const PlacaScanner: React.FC<PlacaScannerProps> = ({
  visible,
  onClose,
  onPlacaDetected
}) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [manualText, setManualText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permissão negada', 'É necessário permitir acesso à câmera.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        // Por enquanto, não temos OCR real no Expo Go
        setShowManualInput(true);
      }
    } catch (error) {
      console.error('Erro ao tirar foto:', error);
      Alert.alert('Erro', 'Não foi possível tirar a foto. Tente novamente.');
    }
  };

  const handleSelectImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permissão negada', 'É necessário permitir acesso à galeria.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setShowManualInput(true);
      }
    } catch (error) {
      console.error('Erro ao selecionar imagem:', error);
      Alert.alert('Erro', 'Não foi possível selecionar a imagem. Tente novamente.');
    }
  };

  const handleProcessText = () => {
    if (!manualText.trim()) {
      Alert.alert('Atenção', 'Digite o texto da placa.');
      return;
    }

    setProcessing(true);

    // Processar texto
    const placaInfo = parsePlacaText(manualText);

    setProcessing(false);

    if (placaInfo && isValidPlacaInfo(placaInfo)) {
      onPlacaDetected(placaInfo);
      handleReset();
    } else {
      Alert.alert(
        'Não foi possível processar',
        'Verifique se o texto está no formato correto:\n\n' +
        'DD.MM.YYYY\n' +
        '24M 561817-9243785\n' +
        '190 Sitio Almas\n' +
        'Cajazeiras\n' +
        'Paraiba'
      );
    }
  };

  const handleReset = () => {
    setImageUri(null);
    setManualText('');
    setShowManualInput(false);
    onClose();
  };

  const handleManualEntry = () => {
    setShowManualInput(true);
    setImageUri(null);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Escanear Placa da Obra</Text>
          <TouchableOpacity onPress={handleReset} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {!showManualInput && !imageUri && (
            <View style={styles.actionsContainer}>
              <Text style={styles.instructions}>
                Escolha uma opção para capturar as informações da placa:
              </Text>

              <TouchableOpacity style={styles.actionButton} onPress={handleTakePhoto}>
                <Text style={styles.actionButtonIcon}>📷</Text>
                <Text style={styles.actionButtonText}>Tirar Foto</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={handleSelectImage}>
                <Text style={styles.actionButtonIcon}>🖼️</Text>
                <Text style={styles.actionButtonText}>Escolher da Galeria</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButtonSecondary} onPress={handleManualEntry}>
                <Text style={styles.actionButtonIcon}>⌨️</Text>
                <Text style={styles.actionButtonTextSecondary}>Digitar Manualmente</Text>
              </TouchableOpacity>

              <View style={styles.exampleContainer}>
                <Text style={styles.exampleTitle}>Formato esperado:</Text>
                <Text style={styles.exampleText}>22.10.2025</Text>
                <Text style={styles.exampleText}>24M 561817-9243785</Text>
                <Text style={styles.exampleText}>190 Sitio Almas</Text>
                <Text style={styles.exampleText}>Cajazeiras</Text>
                <Text style={styles.exampleText}>Paraiba</Text>
              </View>
            </View>
          )}

          {imageUri && (
            <View style={styles.imageContainer}>
              <Image source={{ uri: imageUri }} style={styles.image} />
              <TouchableOpacity
                style={styles.changeImageButton}
                onPress={() => {
                  setImageUri(null);
                  setShowManualInput(false);
                }}
              >
                <Text style={styles.changeImageButtonText}>📷 Tirar Outra Foto</Text>
              </TouchableOpacity>
            </View>
          )}

          {showManualInput && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                Digite o texto da placa (uma linha por campo):
              </Text>
              <TextInput
                style={styles.textInput}
                multiline
                numberOfLines={6}
                placeholder={'22.10.2025\n24M 561817-9243785\n190 Sitio Almas\nCajazeiras\nParaiba'}
                value={manualText}
                onChangeText={setManualText}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setManualText('');
                    setShowManualInput(false);
                    setImageUri(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.processButton, processing && styles.processButtonDisabled]}
                  onPress={handleProcessText}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.processButtonText}>Processar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2563eb',
    borderBottomWidth: 1,
    borderBottomColor: '#1e40af',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  actionsContainer: {
    gap: 16,
  },
  instructions: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  actionButton: {
    backgroundColor: '#2563eb',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  actionButtonIcon: {
    fontSize: 24,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  actionButtonSecondary: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  actionButtonTextSecondary: {
    color: '#2563eb',
    fontSize: 18,
    fontWeight: '600',
  },
  exampleContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginTop: 16,
  },
  exampleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
  },
  exampleText: {
    fontSize: 16,
    color: '#374151',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  imageContainer: {
    gap: 16,
  },
  image: {
    width: '100%',
    height: 400,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  changeImageButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  changeImageButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  inputContainer: {
    gap: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 180,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  processButton: {
    flex: 1,
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  processButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  processButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
