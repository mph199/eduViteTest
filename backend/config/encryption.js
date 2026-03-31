import crypto from 'crypto';
import logger from './logger.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Derive the 32-byte encryption key from the OAUTH_ENCRYPTION_KEY env variable.
 * Accepts base64- or hex-encoded keys (must decode to 32 bytes).
 */
function getKey() {
    const raw = process.env.OAUTH_ENCRYPTION_KEY;
    if (!raw) {
        throw new Error('OAUTH_ENCRYPTION_KEY ist nicht gesetzt');
    }
    // Try base64 first, then hex
    let buf = Buffer.from(raw, 'base64');
    if (buf.length !== 32) {
        buf = Buffer.from(raw, 'hex');
    }
    if (buf.length !== 32) {
        throw new Error('OAUTH_ENCRYPTION_KEY muss 32 Bytes ergeben (base64 oder hex)');
    }
    return buf;
}

/**
 * Encrypt a plaintext string. Returns "iv:ciphertext:tag" (all hex).
 */
export function encrypt(plaintext) {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

/**
 * Decrypt a string produced by encrypt(). Input format: "iv:ciphertext:tag" (hex).
 */
export function decrypt(encryptedStr) {
    const key = getKey();
    const parts = encryptedStr.split(':');
    if (parts.length !== 3) {
        throw new Error('Ungueltiges Verschluesselungsformat');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
}

/**
 * Check if the encryption key is available (for conditional feature toggling).
 */
export function isEncryptionAvailable() {
    try {
        getKey();
        return true;
    } catch (err) {
        logger.debug({ err }, 'Encryption key not available');
        return false;
    }
}
