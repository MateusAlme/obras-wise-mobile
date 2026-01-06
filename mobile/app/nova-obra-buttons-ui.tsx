// Nova UI dos botões para substituir em nova-obra.tsx
// Substituir a seção {/* Botões */} (linhas 5734-5758)

          {/* Botões */}
          <View style={styles.buttonContainer}>
            {/* Botão Pausar - SEMPRE VISÍVEL */}
            <TouchableOpacity
              style={[styles.pauseButton, loading && styles.buttonDisabled]}
              onPress={handlePausar}
              disabled={loading}
            >
              <Text style={styles.pauseButtonText}>
                {loading ? 'Salvando...' : 'Pausar'}
              </Text>
            </TouchableOpacity>

            {/* Botão Finalizar - CONDICIONAL (só aparece quando online + completo) */}
            {calcularPodeFinalizar() && (
              <TouchableOpacity
                style={[styles.finalizarButton, loading && styles.buttonDisabled]}
                onPress={handleSalvarObra}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Finalizando...' : 'Finalizar'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Botão Cancelar - SEMPRE VISÍVEL */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)');
                }
              }}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
