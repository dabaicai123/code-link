import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt, isEncryptionKeySet, setEncryptionKey } from '../src/crypto/aes.js';

describe('AES-256-GCM Crypto', () => {
  const testKey = 'test-encryption-key-32-bytes!!!!!';

  beforeEach(() => {
    setEncryptionKey(testKey);
  });

  it('should encrypt and decrypt correctly', () => {
    const plaintext = '{"env":{"ANTHROPIC_AUTH_TOKEN":"sk-test"}}';
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('should throw if key not set', () => {
    setEncryptionKey('');
    expect(() => encrypt('test')).toThrow('Encryption key not set');
  });

  it('should throw on invalid ciphertext', () => {
    expect(() => decrypt('invalid')).toThrow();
  });

  it('should isEncryptionKeySet return correct status', () => {
    expect(isEncryptionKeySet()).toBe(true);
    setEncryptionKey('short');
    expect(isEncryptionKeySet()).toBe(false);
    setEncryptionKey('');
    expect(isEncryptionKeySet()).toBe(false);
  });
});