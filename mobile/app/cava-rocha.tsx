import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { backupPhoto } from '../lib/photo-backup';
import { addToUploadQueue, processObraPhotos } from '../lib/photo-queue';

const EQUIPES_DISPONIVEIS = [
  'CNT 01', 'CNT 02', 'CNT 03', 'CNT 04', 'CNT 06', 'CNT 07', 'CNT 10', 'CNT 11', 'CNT 12',
  'MNT 01', 'MNT 02', 'MNT 03', 'MNT 04', 'MNT 05', 'MNT 06',
  'LV 01 CJZ', 'LV 02 PTS', 'LV 03 JR PTS',
  'APG 01', 'APG 02', 'APG 03',
];

type FotoData = {
  uri: string;
  latitude: number | null;
  longitude: number | null;
  photoId?: string;
};

export default function CavaRocha() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Dados do formulário
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [obra, setObra] = useState('');
  const [equipeExecutora, setEquipeExecutora] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [observacao, setObservacao] = useState('');

  // Fotos
  const [fotosAntes, setFotosAntes] = useState<FotoData[]>([]);
  const [fotosDepois, setFotosDepois] = useState<FotoData[]>([]);

  // Modal
  const [showEquipeModal, setShowEquipeModal] = useState(false);

  useEffect(() => {
    // Verificar se é COMP logado
    checkCompLogin();
  }, []);

  const checkCompLogin = async () => {
    const role = await AsyncStorage.getItem('@user_role');
    if (role !== 'compressor') {
      Alert.alert('Acesso Negado', 'Esta tela é exclusiva para o perfil COMP.');
      router.replace('/login');
    }
  };

  const tirarFoto = async (tipo: 'antes' | 'depois') => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        exif: true,
      });

      if (!result.canceled && result.assets[0]) {
        const photo = result.assets[0];

        // Obter localização
        const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
        let latitude = null;
        let longitude = null;

        if (locationStatus === 'granted') {
          try {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            latitude = location.coords.latitude;
            longitude = location.coords.longitude;
          } catch (err) {
            console.warn('Erro ao obter localização:', err);
          }
        }

        // Fazer backup da foto
        const photoId = await backupPhoto(photo.uri, latitude, longitude);

        const fotoData: FotoData = {
          uri: photo.uri,
          latitude,
          longitude,
          photoId,
        };

        if (tipo === 'antes') {
          setFotosAntes([...fotosAntes, fotoData]);
        } else {
          setFotosDepois([...fotosDepois, fotoData]);
        }
      }
    } catch (error) {
      console.error('Erro ao tirar foto:', error);
      Alert.alert('Erro', 'Não foi possível tirar a foto.');
    }
  };

  const handleSalvar = async () => {
    // Validações
    if (!data || !obra || !equipeExecutora || !responsavel) {
      Alert.alert('Erro', 'Preencha todos os campos obrigatórios');
      return;
    }

    if (!/^\d{8,10}$/.test(obra.trim())) {
      Alert.alert(
        'Número da Obra Inválido',
        'O número da obra deve conter entre 8 e 10 dígitos numéricos.'
      );
      return;
    }

    // Fotos são opcionais - pode salvar sem fotos

    setLoading(true);

    try {
      const createdBy = await AsyncStorage.getItem('@user_logado') || 'COMP';
      const obraId = `comp_${Date.now()}`;

      // Obter IDs das fotos
      const photoIds = {
        antes: fotosAntes.map(f => f.photoId).filter(Boolean) as string[],
        depois: fotosDepois.map(f => f.photoId).filter(Boolean) as string[],
      };

      // Adicionar à fila de upload
      for (const photoId of [...photoIds.antes, ...photoIds.depois]) {
        await addToUploadQueue(photoId, obraId);
      }

      // Processar uploads
      const uploadResult = await processObraPhotos(obraId);

      if (uploadResult.failed > 0) {
        Alert.alert(
          'Aviso',
          `${uploadResult.failed} foto(s) falharam no upload. Tente novamente.`
        );
        setLoading(false);
        return;
      }

      // Obter URLs das fotos uploadadas
      const { getAllPhotoMetadata } = await import('../lib/photo-backup');
      const allPhotos = await getAllPhotoMetadata();

      const fotosAntesUploaded = allPhotos
        .filter(p => photoIds.antes.includes(p.id) && p.uploaded)
        .map(p => ({
          url: p.uploadUrl!,
          latitude: p.latitude,
          longitude: p.longitude,
        }));

      const fotosDepoisUploaded = allPhotos
        .filter(p => photoIds.depois.includes(p.id) && p.uploaded)
        .map(p => ({
          url: p.uploadUrl!,
          latitude: p.latitude,
          longitude: p.longitude,
        }));

      // Salvar no banco
      const { error } = await supabase.from('obras').insert([
        {
          data,
          obra,
          responsavel,
          equipe: equipeExecutora,
          tipo_servico: 'Cava em Rocha',
          fotos_antes: fotosAntesUploaded,
          fotos_depois: fotosDepoisUploaded,
          created_by: createdBy,
          creator_role: 'compressor',
          created_at: new Date().toISOString(),
          status: 'finalizada',
          user_id: null,
        },
      ]);

      if (error) {
        console.error('Erro ao salvar:', error);
        Alert.alert('Erro', 'Não foi possível salvar o registro.');
        return;
      }

      Alert.alert(
        'Sucesso!',
        `Cava em Rocha registrada para a equipe ${equipeExecutora}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Limpar form
              setObra('');
              setEquipeExecutora('');
              setResponsavel('');
              setObservacao('');
              setFotosAntes([]);
              setFotosDepois([]);
            },
          },
        ]
      );
    } catch (err) {
      console.error('Erro inesperado:', err);
      Alert.alert('Erro', 'Ocorreu um erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sair', 'Deseja realmente sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        onPress: async () => {
          await AsyncStorage.multiRemove([
            '@equipe_logada',
            '@user_logado',
            '@user_role',
            '@login_timestamp',
          ]);
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Cava em Rocha</Text>
            <Text style={styles.headerSubtitle}>Perfil: COMP (Compressor)</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#dc3545" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Data */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Data *</Text>
            <TextInput
              style={styles.input}
              value={data}
              onChangeText={setData}
              editable={false}
            />
          </View>

          {/* Obra */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Número da Obra *</Text>
            <TextInput
              style={styles.input}
              value={obra}
              onChangeText={(text) => {
                const numericText = text.replace(/[^0-9]/g, '').slice(0, 10);
                setObra(numericText);
              }}
              placeholder="Ex: 0032401637"
              keyboardType="numeric"
              maxLength={10}
              editable={!loading}
            />
            <Text style={styles.hint}>
              {obra.length > 0 ? `${obra.length}/10 dígitos` : 'Digite entre 8 e 10 dígitos'}
            </Text>
          </View>

          {/* Equipe Executora */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Equipe Executora *</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowEquipeModal(true)}
              disabled={loading}
            >
              <Text style={[styles.dropdownButtonText, !equipeExecutora && styles.placeholder]}>
                {equipeExecutora || 'Selecione a equipe'}
              </Text>
              <Text style={styles.dropdownIcon}>▼</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>Selecione a equipe que está executando o serviço</Text>
          </View>

          {/* Encarregado */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Encarregado *</Text>
            <TextInput
              style={styles.input}
              value={responsavel}
              onChangeText={setResponsavel}
              placeholder="Nome do encarregado"
              editable={!loading}
            />
          </View>

          {/* Observação */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Observação</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={observacao}
              onChangeText={setObservacao}
              placeholder="Observações sobre o serviço (opcional)"
              multiline
              numberOfLines={4}
              editable={!loading}
            />
          </View>

          {/* Fotos Antes */}
          <View style={styles.photoSection}>
            <Text style={styles.photoSectionTitle}>Fotos ANTES</Text>
            <TouchableOpacity
              style={styles.addPhotoButton}
              onPress={() => tirarFoto('antes')}
              disabled={loading}
            >
              <Ionicons name="camera" size={24} color="#007bff" />
              <Text style={styles.addPhotoText}>Tirar Foto ANTES</Text>
            </TouchableOpacity>
            <Text style={styles.photoCount}>{fotosAntes.length} foto(s)</Text>
          </View>

          {/* Fotos Depois */}
          <View style={styles.photoSection}>
            <Text style={styles.photoSectionTitle}>Fotos DEPOIS</Text>
            <TouchableOpacity
              style={styles.addPhotoButton}
              onPress={() => tirarFoto('depois')}
              disabled={loading}
            >
              <Ionicons name="camera" size={24} color="#28a745" />
              <Text style={styles.addPhotoText}>Tirar Foto DEPOIS</Text>
            </TouchableOpacity>
            <Text style={styles.photoCount}>{fotosDepois.length} foto(s)</Text>
          </View>

          {/* Botão Salvar */}
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSalvar}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Salvar Registro</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal Seleção de Equipe */}
      <Modal
        visible={showEquipeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEquipeModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowEquipeModal(false)}>
          <View style={styles.modalContent}>
            <Pressable>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Selecione a Equipe</Text>
                <TouchableOpacity onPress={() => setShowEquipeModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalList}>
                {EQUIPES_DISPONIVEIS.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.modalItem,
                      equipeExecutora === item && styles.modalItemSelected,
                    ]}
                    onPress={() => {
                      setEquipeExecutora(item);
                      setShowEquipeModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        equipeExecutora === item && styles.modalItemTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                    {equipeExecutora === item && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a1a1a',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  dropdownButton: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  placeholder: {
    color: '#999',
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#999',
  },
  photoSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  photoSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#ddd',
  },
  addPhotoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  photoCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#dc3545',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  saveButtonDisabled: {
    backgroundColor: '#f5a3aa',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  modalClose: {
    fontSize: 24,
    color: '#666',
    fontWeight: '300',
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalItemSelected: {
    backgroundColor: '#fff5f5',
  },
  modalItemText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  modalItemTextSelected: {
    color: '#dc3545',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: '#dc3545',
    fontWeight: 'bold',
  },
});
