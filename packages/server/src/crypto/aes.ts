import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let encryptionKey: string | null = null;

export function setEncryptionKey(key: string): void {
  encryptionKey = key || null;
}

export function isEncryptionKeySet(): boolean {
  return encryptionKey !== null && encryptionKey.length >= 32;
}

export function encrypt(plaintext: string): string {
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error('Encryption key not set or too short (min 32 chars)');
  }

  const key = crypto.createHash('sha256').update(encryptionKey).digest();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // 格式: iv(hex):authTag(hex):ciphertext(hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
}

export function decrypt(combined: string): string {
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error('Encryption key not set or too short (min 32 chars)');
  }

  const parts = combined.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format');
  }

  const [ivHex, authTagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid IV length');
  }

  const authTag = Buffer.from(authTagHex, 'hex');
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid auth tag length');
  }

  const key = crypto.createHash('sha256').update(encryptionKey).digest();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}
