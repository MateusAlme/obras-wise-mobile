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
import { saveObraLocal } from '../lib/offline-sync';

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

type Poste = {
  id: string;
  numero: number;
  fotosAntes: FotoData[];
  fotosDurante: FotoData[];
  fotosDepois: FotoData[];
  observacao: string;
  expandido: boolean;
};

export default function CavaRocha() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Dados do formulário
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [obra, setObra] = useState('');
  const [equipeExecutora, setEquipeExecutora] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [observacaoGeral, setObservacaoGeral] = useState('');

  // Postes
  const [postes, setPostes] = useState<Poste[]>([]);
  const [proximoNumero, setProximoNumero] = useState(1);
  const [tempObraId] = useState(`local_cava_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`);

  // Modal
  const [showEquipeModal, setShowEquipeModal] = useState(false);

  useEffect(() => {
    checkCompLogin();
    // Adicionar primeiro poste automaticamente
    adicionarPoste();
  }, []);

  const checkCompLogin = async () => {
    const role = await AsyncStorage.getItem('@user_role');
    if (role !== 'compressor') {
      Alert.alert('Acesso Negado', 'Esta tela é exclusiva para o perfil COMP.');
      router.replace('/login');
    }
  };

  const adicionarPoste = () => {
    const novoPoste: Poste = {
      id: `P${proximoNumero}`,
      numero: proximoNumero,
      fotosAntes: [],
      fotosDurante: [],
      fotosDepois: [],
      observacao: '',
      expandido: true,
    };
    setPostes([...postes, novoPoste]);
    setProximoNumero(proximoNumero + 1);
  };

  const removerPoste = (posteId: string) => {
    if (postes.length === 1) {
      Alert.alert('Atenção', 'É necessário ter pelo menos um poste no checklist.');
      return;
    }

    Alert.alert(
      'Remover Poste',
      `Deseja realmente remover o poste ${posteId}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => {
            setPostes(postes.filter(p => p.id !== posteId));
          },
        },
      ]
    );
  };

  const togglePosteExpandido = (posteId: string) => {
    setPostes(postes.map(p =>
      p.id === posteId ? { ...p, expandido: !p.expandido } : p
    ));
  };

  const tirarFoto = async (posteId: string, tipo: 'antes' | 'durante' | 'depois') => {
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
        const posteAtual = postes.find(p => p.id === posteId);
        const indexFoto = posteAtual
          ? (tipo === 'antes'
              ? posteAtual.fotosAntes.length
              : tipo === 'durante'
                ? posteAtual.fotosDurante.length
                : posteAtual.fotosDepois.length)
          : 0;
        const backupObraId = obra?.trim() ? `cava_${obra.trim()}` : tempObraId;
        const photoMetadata = await backupPhoto(
          photo.uri,
          backupObraId,
          tipo,
          indexFoto,
          latitude,
          longitude
        );

        const fotoData: FotoData = {
          uri: photo.uri,
          latitude,
          longitude,
          photoId: photoMetadata.id,
        };

        // Adicionar foto ao poste específico
        setPostes(postes.map(p => {
          if (p.id === posteId) {
            if (tipo === 'antes') {
              return { ...p, fotosAntes: [...p.fotosAntes, fotoData] };
            } else if (tipo === 'durante') {
              return { ...p, fotosDurante: [...p.fotosDurante, fotoData] };
            } else {
              return { ...p, fotosDepois: [...p.fotosDepois, fotoData] };
            }
          }
          return p;
        }));
      }
    } catch (error) {
      console.error('Erro ao tirar foto:', error);
      Alert.alert('Erro', 'Não foi possível tirar a foto.');
    }
  };

  const getPosteStatus = (poste: Poste) => {
    const temAntes = poste.fotosAntes.length > 0;
    const temDurante = poste.fotosDurante.length > 0;
    const temDepois = poste.fotosDepois.length > 0;

    if (temAntes && temDurante && temDepois) return 'completo';
    if (temAntes || temDurante || temDepois) return 'parcial';
    return 'pendente';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'completo') return '✓';
    if (status === 'parcial') return '◐';
    return '○';
  };

  const getStatusColor = (status: string) => {
    if (status === 'completo') return '#28a745';
    if (status === 'parcial') return '#ffc107';
    return '#6c757d';
  };

  const handleSalvar = async () => {
    // Validações
    if (!data || !obra || !equipeExecutora || !responsavel) {
      Alert.alert('Erro', 'Preencha todos os campos obrigatórios (Data, Obra, Equipe e Encarregado)');
      return;
    }

    if (!/^\d{8,10}$/.test(obra.trim())) {
      Alert.alert(
        'Número da Obra Inválido',
        'O número da obra deve conter entre 8 e 10 dígitos numéricos.'
      );
      return;
    }

    if (postes.length === 0) {
      Alert.alert('Erro', 'Adicione pelo menos um poste ao checklist');
      return;
    }

    // Verificar se todos os postes têm pelo menos uma foto em cada seção
    const postesIncompletos = postes.filter(p =>
      p.fotosAntes.length === 0 || p.fotosDurante.length === 0 || p.fotosDepois.length === 0
    );

    if (postesIncompletos.length > 0) {
      const ids = postesIncompletos.map(p => p.id).join(', ');
      Alert.alert(
        'Checklist Incompleto',
        `Os seguintes postes precisam de fotos ANTES, DURANTE e DEPOIS: ${ids}\n\nCada poste deve ter pelo menos 1 foto em cada seção.`
      );
      return;
    }

    setLoading(true);

    try {
      const createdBy = await AsyncStorage.getItem('@user_logado') || 'COMP';
      const obraId = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Montar estrutura de postes com photoIds (para sincronização posterior)
      const postesData = postes.map(poste => ({
        id: poste.id,
        numero: poste.numero,
        fotos_antes: poste.fotosAntes.map(f => f.photoId).filter(Boolean),
        fotos_durante: poste.fotosDurante.map(f => f.photoId).filter(Boolean),
        fotos_depois: poste.fotosDepois.map(f => f.photoId).filter(Boolean),
        observacao: poste.observacao,
      }));

      // Montar dados da obra para salvar localmente (offline-first)
      const obraData: any = {
        id: obraId,
        data,
        obra,
        responsavel,
        equipe: equipeExecutora,
        tipo_servico: 'Cava em Rocha',
        postes_data: postesData,
        observacoes: observacaoGeral,
        created_by: createdBy,
        creator_role: 'compressor',
        created_at: new Date().toISOString(),
        status: 'em_aberto', // Será 'finalizada' quando sincronizar
        origem: 'offline',
        sync_status: 'pending',
        photos_uploaded: false,
        // Campos vazios obrigatórios para o tipo PendingObra
        fotos_antes: [],
        fotos_durante: [],
        fotos_depois: [],
        fotos_abertura: [],
        fotos_fechamento: [],
        fotos_ditais_abertura: [],
        fotos_ditais_impedir: [],
        fotos_ditais_testar: [],
        fotos_ditais_aterrar: [],
        fotos_ditais_sinalizar: [],
        fotos_aterramento_vala_aberta: [],
        fotos_aterramento_hastes: [],
        fotos_aterramento_vala_fechada: [],
        fotos_aterramento_medicao: [],
        fotos_transformador_laudo: [],
        fotos_transformador_componente_instalado: [],
        fotos_transformador_tombamento_instalado: [],
        fotos_transformador_tape: [],
        fotos_transformador_placa_instalado: [],
        fotos_transformador_instalado: [],
        fotos_transformador_antes_retirar: [],
        fotos_transformador_tombamento_retirado: [],
        fotos_transformador_placa_retirado: [],
        fotos_transformador_conexoes_primarias_instalado: [],
        fotos_transformador_conexoes_secundarias_instalado: [],
        fotos_transformador_conexoes_primarias_retirado: [],
        fotos_transformador_conexoes_secundarias_retirado: [],
        fotos_medidor_padrao: [],
        fotos_medidor_leitura: [],
        fotos_medidor_selo_born: [],
        fotos_medidor_selo_caixa: [],
        fotos_medidor_identificador_fase: [],
        fotos_checklist_croqui: [],
        fotos_checklist_panoramica_inicial: [],
        fotos_checklist_chede: [],
        fotos_checklist_aterramento_cerca: [],
        fotos_checklist_padrao_geral: [],
        fotos_checklist_padrao_interno: [],
        fotos_checklist_panoramica_final: [],
        fotos_checklist_postes: [],
        fotos_checklist_seccionamentos: [],
        doc_cadastro_medidor: [],
        doc_laudo_transformador: [],
        doc_laudo_regulador: [],
        doc_laudo_religador: [],
        doc_apr: [],
        doc_fvbt: [],
        doc_termo_desistencia_lpt: [],
        doc_autorizacao_passagem: [],
        fotos_altimetria_lado_fonte: [],
        fotos_altimetria_medicao_fonte: [],
        fotos_altimetria_lado_carga: [],
        fotos_altimetria_medicao_carga: [],
        fotos_vazamento_evidencia: [],
        fotos_vazamento_equipamentos_limpeza: [],
        fotos_vazamento_tombamento_retirado: [],
        fotos_vazamento_placa_retirado: [],
        fotos_vazamento_tombamento_instalado: [],
        fotos_vazamento_placa_instalado: [],
        fotos_vazamento_instalacao: [],
      };

      // Salvar localmente (offline-first)
      const savedObraId = await saveObraLocal(obraData);
      console.log(`✅ [Cava em Rocha] Obra salva localmente: ${savedObraId}`);

      Alert.alert(
        'Sucesso!',
        `Book de Cava em Rocha salvo para a equipe ${equipeExecutora}\n\n${postes.length} poste(s) registrados.\n\nA obra será sincronizada automaticamente quando houver internet.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Limpar form
              setObra('');
              setEquipeExecutora('');
              setResponsavel('');
              setObservacaoGeral('');
              setPostes([]);
              setProximoNumero(1);
              adicionarPoste(); // Adicionar um poste novo
              // Navegar para o histórico
              router.push('/(comp)');
            },
          },
        ]
      );
    } catch (err) {
      console.error('Erro inesperado:', err);
      Alert.alert('Erro', 'Ocorreu um erro inesperado ao salvar.');
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
            <Text style={styles.headerTitle}>📋 Book de Cava em Rocha</Text>
            <Text style={styles.headerSubtitle}>Checklist de Fiscalização - Perfil COMP</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#dc3545" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Dados Gerais */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Dados Gerais</Text>

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

            {/* Observação Geral */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Observações Gerais</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={observacaoGeral}
                onChangeText={setObservacaoGeral}
                placeholder="Observações sobre a obra (opcional)"
                multiline
                numberOfLines={3}
                editable={!loading}
              />
            </View>
          </View>

          {/* Checklist de Postes */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>⚡ Checklist de Postes</Text>
              <Text style={styles.sectionSubtitle}>
                {postes.length} poste(s) • {postes.filter(p => getPosteStatus(p) === 'completo').length} completo(s)
              </Text>
            </View>

            {postes.map((poste, index) => {
              const status = getPosteStatus(poste);
              const statusIcon = getStatusIcon(status);
              const statusColor = getStatusColor(status);

              return (
                <View key={poste.id} style={styles.posteCard}>
                  {/* Header do Poste */}
                  <TouchableOpacity
                    style={styles.posteHeader}
                    onPress={() => togglePosteExpandido(poste.id)}
                  >
                    <View style={styles.posteHeaderLeft}>
                      <View style={[styles.posteStatusBadge, { backgroundColor: statusColor }]}>
                        <Text style={styles.posteStatusIcon}>{statusIcon}</Text>
                      </View>
                      <View>
                        <Text style={styles.posteId}>{poste.id}</Text>
                        <Text style={styles.posteStatus}>
                          {status === 'completo' ? 'Completo' : status === 'parcial' ? 'Em andamento' : 'Pendente'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.posteHeaderRight}>
                      {postes.length > 1 && (
                        <TouchableOpacity
                          onPress={() => removerPoste(poste.id)}
                          style={styles.removeButton}
                        >
                          <Ionicons name="trash-outline" size={20} color="#dc3545" />
                        </TouchableOpacity>
                      )}
                      <Ionicons
                        name={poste.expandido ? 'chevron-up' : 'chevron-down'}
                        size={24}
                        color="#666"
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Conteúdo Expandido */}
                  {poste.expandido && (
                    <View style={styles.posteContent}>
                      {/* Fotos ANTES */}
                      <View style={styles.photoSection}>
                        <View style={styles.photoHeader}>
                          <Text style={styles.photoLabel}>📷 Fotos ANTES</Text>
                          <Text style={[styles.photoCount, poste.fotosAntes.length === 0 && styles.photoCountRequired]}>
                            {poste.fotosAntes.length} {poste.fotosAntes.length === 0 && '(Obrigatório)'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.addPhotoButton}
                          onPress={() => tirarFoto(poste.id, 'antes')}
                          disabled={loading}
                        >
                          <Ionicons name="camera" size={20} color="#007bff" />
                          <Text style={styles.addPhotoText}>Adicionar Foto</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Fotos DURANTE */}
                      <View style={styles.photoSection}>
                        <View style={styles.photoHeader}>
                          <Text style={styles.photoLabel}>📷 Fotos DURANTE</Text>
                          <Text style={[styles.photoCount, poste.fotosDurante.length === 0 && styles.photoCountRequired]}>
                            {poste.fotosDurante.length} {poste.fotosDurante.length === 0 && '(Obrigatório)'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.addPhotoButton}
                          onPress={() => tirarFoto(poste.id, 'durante')}
                          disabled={loading}
                        >
                          <Ionicons name="camera" size={20} color="#ffc107" />
                          <Text style={styles.addPhotoText}>Adicionar Foto</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Fotos DEPOIS */}
                      <View style={styles.photoSection}>
                        <View style={styles.photoHeader}>
                          <Text style={styles.photoLabel}>📷 Fotos DEPOIS</Text>
                          <Text style={[styles.photoCount, poste.fotosDepois.length === 0 && styles.photoCountRequired]}>
                            {poste.fotosDepois.length} {poste.fotosDepois.length === 0 && '(Obrigatório)'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.addPhotoButton}
                          onPress={() => tirarFoto(poste.id, 'depois')}
                          disabled={loading}
                        >
                          <Ionicons name="camera" size={20} color="#28a745" />
                          <Text style={styles.addPhotoText}>Adicionar Foto</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Observação do Poste */}
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>Observações</Text>
                        <TextInput
                          style={[styles.input, styles.textAreaSmall]}
                          value={poste.observacao}
                          onChangeText={(text) => {
                            setPostes(postes.map(p =>
                              p.id === poste.id ? { ...p, observacao: text } : p
                            ));
                          }}
                          placeholder="Observações sobre este poste (opcional)"
                          multiline
                          numberOfLines={2}
                          editable={!loading}
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {/* Botão Adicionar Poste */}
            <TouchableOpacity
              style={styles.addPosteButton}
              onPress={adicionarPoste}
              disabled={loading}
            >
              <Ionicons name="add-circle" size={24} color="#007bff" />
              <Text style={styles.addPosteText}>Adicionar Poste (P{proximoNumero})</Text>
            </TouchableOpacity>
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
                <Text style={styles.saveButtonText}>Finalizar e Salvar Book</Text>
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
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    gap: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1a1a1a',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  textAreaSmall: {
    minHeight: 60,
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
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownButtonText: {
    fontSize: 15,
    color: '#1a1a1a',
  },
  placeholder: {
    color: '#999',
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#999',
  },
  posteCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  posteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  posteHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  posteHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  posteStatusBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posteStatusIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  posteId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  posteStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  removeButton: {
    padding: 4,
  },
  posteContent: {
    padding: 16,
    paddingTop: 8,
    gap: 12,
  },
  photoSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  photoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  photoCount: {
    fontSize: 13,
    color: '#666',
  },
  photoCountRequired: {
    color: '#dc3545',
    fontWeight: '600',
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#ddd',
  },
  addPhotoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  addPosteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#007bff',
    marginTop: 8,
  },
  addPosteText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007bff',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#dc3545',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
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
