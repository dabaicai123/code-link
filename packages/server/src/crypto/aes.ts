import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let encryptionKey: string | null = null;
let derivedKey: Buffer | null = null;

export function setEncryptionKey(key: string): void {
  encryptionKey = key || null;
  derivedKey = encryptionKey && encryptionKey.length >= 32
    ? crypto.createHash('sha256').update(encryptionKey).digest()
    : null;
}

export function isEncryptionKeySet(): boolean {
  return derivedKey !== null;
}

export function encrypt(plaintext: string): string {
  if (!derivedKey) {
    throw new Error('Encryption key not set or too short (min 32 chars)');
  }

  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
}

export function decrypt(combined: string): string {
  if (!derivedKey) {
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

  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}