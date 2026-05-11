/**
 * Exemplo de integração dos componentes de Serviços na tela de obras
 * Este arquivo mostra como usar ObraContainer, ServiceCard e ServiceTypeSelector
 *
 * INSTRUÇÕES: Adapte este código conforme necessário para sua tela obras.tsx
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../lib/supabase';
import {
  ObraContainer,
  ServiceCard,
  ServiceTypeSelector,
} from '../components/ServicosComponents';
import {
  createServico,
  fetchServicosForObra,
  markServicoComplete,
  syncServico,
  getLocalServicos,
} from '../lib/servico-sync';
import { Servico, TipoServico, ServicoLocal } from '../types/servico';

// ==================== TIPOS ====================
interface ObraWithServicos {
  id: string;
  data: string;
  obra: string;
  responsavel: string;
  equipe: string;
  status: 'em_aberto' | 'rascunho' | 'finalizada';
  servicos: Servico[];
}

// ==================== COMPONENTE ====================
/**
 * Exemplo de tela com lista de obras expandíveis com serviços aninhados
 */
export default function ObrasComServicosScreen() {
  const [obras, setObras] = useState<ObraWithServicos[]>([]);
  const [expandedObraId, setExpandedObraId] = useState<string | null>(null);
  const [expandedServicoId, setExpandedServicoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingServicoId, setSyncingServicoId] = useState<string | null>(null);

  // Service Type Selector state
  const [serviceSelectorVisible, setServiceSelectorVisible] = useState(false);
  const [selectedObraIdForService, setSelectedObraIdForService] = useState<string | null>(null);

  // ==================== EFEITOS ====================
  useEffect(() => {
    loadObrasWithServicos();
  }, []);

  // ==================== FUNÇÕES ====================

  /**
   * Carrega todas as obras com seus serviços
   */
  async function loadObrasWithServicos() {
    try {
      setLoading(true);

      // Busca obras do Supabase
      const { data: obrasData, error: obrasError } = await supabase
        .from('obras')
        .select('id,data,obra,responsavel,equipe,status')
        .order('data', { ascending: false });

      if (obrasError) throw obrasError;

      // Para cada obra, busca seus serviços
      const obrasComServicos: ObraWithServicos[] = [];
      for (const obra of obrasData || []) {
        const servicos = await fetchServicosForObra(obra.id);
        obrasComServicos.push({
          ...obra,
          servicos: servicos || [],
        });
      }

      setObras(obrasComServicos);
    } catch (error) {
      console.error('Erro ao carregar obras:', error);
      // Mostra toast/alert com erro
    } finally {
      setLoading(false);
    }
  }

  /**
   * Abre modal de seleção de tipo de serviço
   */
  const handleAddService = (obraId: string) => {
    setSelectedObraIdForService(obraId);
    setServiceSelectorVisible(true);
  };

  /**
   * Callback quando tipo de serviço é selecionado
   */
  const handleServiceTypeSelected = async (tipoServico: TipoServico) => {
    if (!selectedObraIdForService) return;

    try {
      const result = await createServico(selectedObraIdForService, tipoServico);

      if (result.success) {
        // Recarrega a obra para pegar o novo serviço
        const obraIndex = obras.findIndex((o) => o.id === selectedObraIdForService);
        if (obraIndex >= 0) {
          const servicos = await fetchServicosForObra(selectedObraIdForService);
          const updated = [...obras];
          updated[obraIndex].servicos = servicos;
          setObras(updated);

          // Expande a obra automaticamente
          setExpandedObraId(selectedObraIdForService);
        }
      }
    } catch (error) {
      console.error('Erro ao criar serviço:', error);
    }
  };

  /**
   * Toggle expand/collapse de obra
   */
  const handleToggleObraExpand = (obraId: string) => {
    if (expandedObraId === obraId) {
      setExpandedObraId(null);
      setExpandedServicoId(null);
    } else {
      setExpandedObraId(obraId);
    }
  };

  /**
   * Toggle expand/collapse de serviço
   */
  const handleToggleServicoExpand = (servicoId: string) => {
    if (expandedServicoId === servicoId) {
      setExpandedServicoId(null);
    } else {
      setExpandedServicoId(servicoId);
    }
  };

  /**
   * Captura foto para um serviço
   */
  const handleCapturePhoto = (servicoId: string, category: keyof Servico) => {
    // TODO: Implementar fluxo de captura de foto
    // - Abre câmera/galeria
    // - Processa foto
    // - Adiciona ao serviço
    // - Sincroniza
    console.log('Capturar foto para serviço:', servicoId, 'categoria:', category);
  };

  /**
   * Marca serviço como completo
   */
  const handleMarkComplete = async (servicoId: string) => {
    const obraWithServico = obras.find((o) =>
      o.servicos.find((s) => s.id === servicoId)
    );

    if (!obraWithServico) return;

    try {
      const success = await markServicoComplete(servicoId, obraWithServico.id);

      if (success) {
        // Atualiza estado local
        const updated = [...obras];
        const obraIdx = updated.findIndex((o) => o.id === obraWithServico.id);
        const servicoIdx = updated[obraIdx].servicos.findIndex((s) => s.id === servicoId);

        updated[obraIdx].servicos[servicoIdx].status = 'completo';
        setObras(updated);
      }
    } catch (error) {
      console.error('Erro ao marcar serviço como completo:', error);
    }
  };

  /**
   * Renderiza lista de serviços de uma obra (quando expandida)
   */
  const renderExpandedServicos = (obra: ObraWithServicos) => {
    if (expandedObraId !== obra.id) return null;

    return (
      <View style={styles.expandedServicosContainer}>
        <Text style={styles.servicosHeaderText}>Serviços ({obra.servicos.length})</Text>

        {obra.servicos.map((servico) => (
          <ServiceCard
            key={servico.id}
            service={servico}
            isExpanded={expandedServicoId === servico.id}
            onToggleExpand={() => handleToggleServicoExpand(servico.id)}
            onCapturePhoto={handleCapturePhoto}
            onMarkComplete={handleMarkComplete}
          />
        ))}
      </View>
    );
  };

  /**
   * Renderiza item da lista (Obra)
   */
  const renderObraItem = ({ item: obra }: { item: ObraWithServicos }) => (
    <View>
      <ObraContainer
        obraId={obra.id}
        obraData={obra.data}
        obraTitle={obra.obra}
        responsavel={obra.responsavel}
        equipe={obra.equipe}
        status={obra.status}
        servicos={obra.servicos}
        isExpanded={expandedObraId === obra.id}
        onToggleExpand={handleToggleObraExpand}
        onAddService={handleAddService}
      />

      {renderExpandedServicos(obra)}
    </View>
  );

  // ==================== RENDER ====================
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066CC" />
          <Text style={styles.loadingText}>Carregando obras...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Obras</Text>
        <TouchableOpacity>
          <Ionicons name="settings" size={24} color="#0066CC" />
        </TouchableOpacity>
      </View>

      {/* Lista de obras */}
      <FlatList
        data={obras}
        keyExtractor={(item) => item.id}
        renderItem={renderObraItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>Nenhuma obra encontrada</Text>
          </View>
        }
      />

      {/* Service Type Selector Modal */}
      <ServiceTypeSelector
        visible={serviceSelectorVisible}
        onClose={() => setServiceSelectorVisible(false)}
        onSelect={handleServiceTypeSelected}
        loading={syncingServicoId !== null}
      />

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    minHeight: 300,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  expandedServicosContainer: {
    marginTop: 12,
    marginBottom: 12,
  },
  servicosHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    marginLeft: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0066CC',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
