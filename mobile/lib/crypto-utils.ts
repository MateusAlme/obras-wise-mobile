import * as Crypto from 'expo-crypto';

/**
 * Gera hash SHA-256 de uma senha
 * @param password - Senha em texto puro
 * @returns Hash da senha em formato hexadecimal
 */
export const hashPassword = async (password: string): Promise<string> => {
  try {
    // Adiciona um salt fixo (em produção, considere salt único por usuário)
    const saltedPassword = `${password}_obras_wise_salt_2025`;

    // Gera hash SHA-256
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      saltedPassword
    );

    return hash;
  } catch (error) {
    console.error('Erro ao gerar hash de senha:', error);
    throw new Error('Falha ao processar senha');
  }
};

/**
 * Verifica se uma senha corresponde ao hash armazenado
 * @param password - Senha em texto puro
 * @param hash - Hash armazenado
 * @returns true se a senha corresponde ao hash
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    const newHash = await hashPassword(password);
    return newHash === hash;
  } catch (error) {
    console.error('Erro ao verificar senha:', error);
    return false;
  }
};
