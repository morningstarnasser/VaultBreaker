/**
 * wallet.dat Parser
 *
 * Parses Bitcoin Core (and fork) wallet.dat files to extract
 * the encrypted master key data needed for password recovery.
 *
 * Bitcoin Core wallet.dat uses Berkeley DB (BDB) format.
 * The master key entry (mkey) contains:
 *   - Encrypted master key (48 bytes = 32-byte key + 16-byte PKCS7 padding)
 *   - Salt (8 bytes)
 *   - Derivation method (0 = EVP_BytesToKey/SHA-512)
 *   - Iteration count
 */
import type { MasterKeyData, WalletInfo } from '../types';

/**
 * Search for a byte pattern in a Uint8Array.
 */
function indexOf(data: Uint8Array, pattern: number[], startFrom: number = 0): number {
  outer:
  for (let i = startFrom; i <= data.length - pattern.length; i++) {
    for (let j = 0; j < pattern.length; j++) {
      if (data[i + j] !== pattern[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * Read a uint32 (little-endian) from a Uint8Array at offset.
 */
function readUint32LE(data: Uint8Array, offset: number): number {
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  ) >>> 0;
}

/**
 * Try to parse a CMasterKey structure at the given offset.
 *
 * CMasterKey serialization:
 *   - compact_size(n) + n bytes encrypted key (expect n=48)
 *   - compact_size(m) + m bytes salt (expect m=8)
 *   - uint32_le derivation method
 *   - uint32_le iterations
 *   - compact_size(k) + k bytes other params (usually k=0)
 */
function tryParseMasterKey(data: Uint8Array, offset: number): MasterKeyData | null {
  if (offset + 67 > data.length) return null; // minimum size check

  // Encrypted key: expect compact_size = 48 (0x30)
  const encKeyLen = data[offset];
  if (encKeyLen !== 48) return null;
  offset += 1;

  const encryptedKey = new Uint8Array(data.slice(offset, offset + 48));
  offset += 48;

  // Salt: expect compact_size = 8 (0x08)
  const saltLen = data[offset];
  if (saltLen !== 8) return null;
  offset += 1;

  const salt = new Uint8Array(data.slice(offset, offset + 8));
  offset += 8;

  // Derivation method (uint32_le) - should be 0 (EVP_BytesToKey) or 1 (scrypt)
  const method = readUint32LE(data, offset);
  if (method > 1) return null;
  offset += 4;

  // Iterations (uint32_le) - should be reasonable (1 to 10,000,000)
  const iterations = readUint32LE(data, offset);
  if (iterations < 1 || iterations > 10_000_000) return null;

  return { encryptedKey, salt, method, iterations };
}

/**
 * Detect wallet file format.
 */
function detectFormat(data: Uint8Array): 'bdb' | 'sqlite' | 'unknown' {
  // SQLite: starts with "SQLite format 3\0"
  const sqliteHeader = [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74];
  if (indexOf(data, sqliteHeader) === 0) return 'sqlite';

  // BDB: has specific magic bytes at offset 12 (0x00053162 for btree)
  if (data.length > 16) {
    const magic = readUint32LE(data, 12);
    if (magic === 0x00053162 || magic === 0x61536200) return 'bdb';
  }

  // Also check for 'mkey' anywhere - if present, likely BDB wallet
  const mkeyPattern = [0x6d, 0x6b, 0x65, 0x79]; // "mkey"
  if (indexOf(data, mkeyPattern) !== -1) return 'bdb';

  return 'unknown';
}

/**
 * Parse a wallet.dat file and extract the encrypted master key.
 */
export function parseWalletDat(buffer: ArrayBuffer, fileName: string): WalletInfo {
  const data = new Uint8Array(buffer);
  const format = detectFormat(data);

  const result: WalletInfo = {
    fileName,
    fileSize: buffer.byteLength,
    isEncrypted: false,
    masterKey: null,
    format,
  };

  if (format === 'sqlite') {
    // Newer Bitcoin Core wallets use SQLite - different parsing needed
    // For now, try the raw scan approach which can still work
  }

  // Strategy 1: Search for \x04mkey pattern and parse nearby
  const mkeyPrefix = [0x04, 0x6d, 0x6b, 0x65, 0x79]; // \x04mkey
  let pos = 0;

  while (pos < data.length) {
    pos = indexOf(data, mkeyPrefix, pos);
    if (pos === -1) break;

    // After \x04mkey, there's typically a key_id (uint32_le)
    // Then the value follows (possibly with BDB page structure in between)
    // Scan ahead up to 200 bytes to find the CMasterKey value
    for (let offset = 5; offset < 200 && pos + offset < data.length - 67; offset++) {
      const masterKey = tryParseMasterKey(data, pos + offset);
      if (masterKey) {
        result.isEncrypted = true;
        result.masterKey = masterKey;
        return result;
      }
    }

    pos += 5;
  }

  // Strategy 2: Raw scan for CMasterKey pattern (0x30 + 48 bytes + 0x08 + 8 bytes)
  // This works even if BDB page structure separates key from value
  for (let i = 0; i < data.length - 67; i++) {
    if (data[i] === 0x30) { // 48 in decimal = potential encrypted key length
      const masterKey = tryParseMasterKey(data, i);
      if (masterKey) {
        // Additional validation: check if this looks like real crypto data
        // The encrypted key should have high entropy (not all zeros)
        const allZero = masterKey.encryptedKey.every(b => b === 0);
        const allSame = masterKey.encryptedKey.every(b => b === masterKey.encryptedKey[0]);
        if (!allZero && !allSame) {
          result.isEncrypted = true;
          result.masterKey = masterKey;
          return result;
        }
      }
    }
  }

  return result;
}

/**
 * Format bytes as hex string.
 */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Format file size.
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
