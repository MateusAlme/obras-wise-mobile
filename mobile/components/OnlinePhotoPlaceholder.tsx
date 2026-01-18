import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface OnlinePhotoPlaceholderProps {
  count: number; // Quantidade de fotos no servidor
  style?: any;
}

/**
 * Componente que mostra um placeholder indicando que existem fotos
 * salvas no servidor mas que não puderam ser carregadas offline.
 *
 * Útil quando:
 * - Obra foi criada online
 * - Usuário editou offline
 * - Fotos do servidor não têm URI local válido
 */
export function OnlinePhotoPlaceholder({ count, style }: OnlinePhotoPlaceholderProps) {
  if (count === 0) return null;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>☁️</Text>
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>
          {count} foto{count > 1 ? 's' : ''} no servidor
        </Text>
        <Text style={styles.subtitle}>
          Disponível{count > 1 ? 's' : ''} online
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff', // Azul claro
    borderWidth: 2,
    borderColor: '#3b82f6', // Azul
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af', // Azul escuro
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#60a5fa', // Azul médio
  },
});
