import { singleton } from 'tsyringe';
import { encrypt, decrypt, isEncryptionKeySet, setEncryptionKey } from '../../crypto/aes.js';

@singleton()
export class EncryptionService {
  encrypt(plaintext: string): string {
    return encrypt(plaintext);
  }

  decrypt(ciphertext: string): string {
    return decrypt(ciphertext);
  }

  isAvailable(): boolean {
    return isEncryptionKeySet();
  }

  setKey(key: string): void {
    setEncryptionKey(key);
  }
}