/**
 * OPTIMIZED Password Recovery Web Worker
 *
 * Pure synchronous SHA-512 + AES-256-CBC implementation.
 * NO async/await, NO crypto.subtle overhead.
 * ~5-10x faster than the async version.
 */

// ============================================================
// SHA-512 - Pure synchronous (inline, no imports)
// ============================================================

const K = new BigInt64Array([
  0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbbcn,
  0x3956c25bf348b538n, 0x59f111f1b605d019n, 0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n,
  0xd807aa98a3030242n, 0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n,
  0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n, 0xc19bf174cf692694n,
  0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n, 0x0fc19dc68b8cd5b5n, 0x240ca1cc77ac9c65n,
  0x2de92c6f592b0275n, 0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
  0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn, 0xbf597fc7beef0ee4n,
  0xc6e00bf33da88fc2n, 0xd5a79147930aa725n, 0x06ca6351e003826fn, 0x142929670a0e6e70n,
  0x27b70a8546d22ffcn, 0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn,
  0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n, 0x92722c851482353bn,
  0xa2bfe8a14cf10364n, 0xa81a664bbc423001n, 0xc24b8b70d0f89791n, 0xc76c51a30654be30n,
  0xd192e819d6ef5218n, 0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
  0x19a4c116b8d2d0c8n, 0x1e376c085141ab53n, 0x2748774cdf8eeb99n, 0x34b0bcb5e19b48a8n,
  0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn, 0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n,
  0x748f82ee5defb2fcn, 0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn,
  0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n, 0xc67178f2e372532bn,
  0xca273eceea26619cn, 0xd186b8c721c0c207n, 0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n,
  0x06f067aa72176fban, 0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
  0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn, 0x431d67c49c100d4cn,
  0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an, 0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n,
]);

const H_INIT = [
  0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn,
  0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
  0x510e527fade682d1n, 0x9b05688c2b3e6c1fn,
  0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n,
];

const MASK64 = 0xFFFFFFFFFFFFFFFFn;
const W = new BigInt64Array(80);

function rotr64(x: bigint, n: bigint): bigint {
  return ((x >> n) | (x << (64n - n))) & MASK64;
}

function sha512(msg: Uint8Array): Uint8Array {
  const msgLen = msg.length;
  const bitLen = BigInt(msgLen) * 8n;

  // Padding: msg + 0x80 + zeros + 16-byte big-endian length
  const padLen = (128 - ((msgLen + 17) % 128)) % 128;
  const totalLen = msgLen + 1 + padLen + 16;
  const padded = new Uint8Array(totalLen);
  padded.set(msg);
  padded[msgLen] = 0x80;

  const dv = new DataView(padded.buffer);
  dv.setBigUint64(totalLen - 8, bitLen, false);

  let h0 = H_INIT[0], h1 = H_INIT[1], h2 = H_INIT[2], h3 = H_INIT[3];
  let h4 = H_INIT[4], h5 = H_INIT[5], h6 = H_INIT[6], h7 = H_INIT[7];

  for (let off = 0; off < totalLen; off += 128) {
    // Prepare message schedule
    for (let t = 0; t < 16; t++) {
      W[t] = dv.getBigUint64(off + t * 8, false);
    }
    for (let t = 16; t < 80; t++) {
      const w2 = W[t - 2], w15 = W[t - 15];
      const s1 = rotr64(w2, 19n) ^ rotr64(w2, 61n) ^ ((w2 >> 6n) & MASK64);
      const s0 = rotr64(w15, 1n) ^ rotr64(w15, 8n) ^ ((w15 >> 7n) & MASK64);
      W[t] = (s1 + W[t - 7] + s0 + W[t - 16]) & MASK64;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let t = 0; t < 80; t++) {
      const S1 = rotr64(e, 14n) ^ rotr64(e, 18n) ^ rotr64(e, 41n);
      const ch = (e & f) ^ ((~e & MASK64) & g);
      const T1 = (h + S1 + ch + K[t] + W[t]) & MASK64;
      const S0 = rotr64(a, 28n) ^ rotr64(a, 34n) ^ rotr64(a, 39n);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const T2 = (S0 + maj) & MASK64;

      h = g; g = f; f = e;
      e = (d + T1) & MASK64;
      d = c; c = b; b = a;
      a = (T1 + T2) & MASK64;
    }

    h0 = (h0 + a) & MASK64; h1 = (h1 + b) & MASK64;
    h2 = (h2 + c) & MASK64; h3 = (h3 + d) & MASK64;
    h4 = (h4 + e) & MASK64; h5 = (h5 + f) & MASK64;
    h6 = (h6 + g) & MASK64; h7 = (h7 + h) & MASK64;
  }

  const result = new Uint8Array(64);
  const rv = new DataView(result.buffer);
  rv.setBigUint64(0, h0, false);  rv.setBigUint64(8, h1, false);
  rv.setBigUint64(16, h2, false); rv.setBigUint64(24, h3, false);
  rv.setBigUint64(32, h4, false); rv.setBigUint64(40, h5, false);
  rv.setBigUint64(48, h6, false); rv.setBigUint64(56, h7, false);
  return result;
}

// ============================================================
// AES-256-CBC Decryption - Pure synchronous
// ============================================================

const SBOX = new Uint8Array([
  0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
  0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
  0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
  0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
  0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
  0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
  0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
  0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
  0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
  0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
  0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
  0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
  0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
  0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
  0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
  0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16,
]);

const INV_SBOX = new Uint8Array(256);
for (let i = 0; i < 256; i++) INV_SBOX[SBOX[i]] = i;

const RCON = [0x00,0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36];

function galoisMul(a: number, b: number): number {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>= 1;
  }
  return p;
}

// Precomputed inverse MixColumns lookup tables
const GM9  = new Uint8Array(256);
const GM11 = new Uint8Array(256);
const GM13 = new Uint8Array(256);
const GM14 = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  GM9[i]  = galoisMul(i, 9);
  GM11[i] = galoisMul(i, 11);
  GM13[i] = galoisMul(i, 13);
  GM14[i] = galoisMul(i, 14);
}

function aesExpandKey(key: Uint8Array): Uint8Array {
  const expanded = new Uint8Array(240); // 15 round keys * 16 bytes
  expanded.set(key);

  let i = 8; // AES-256 has 8 x 32-bit words in key
  while (i < 60) {
    let t0 = expanded[(i - 1) * 4];
    let t1 = expanded[(i - 1) * 4 + 1];
    let t2 = expanded[(i - 1) * 4 + 2];
    let t3 = expanded[(i - 1) * 4 + 3];

    if (i % 8 === 0) {
      const tmp = t0;
      t0 = SBOX[t1] ^ RCON[i / 8];
      t1 = SBOX[t2];
      t2 = SBOX[t3];
      t3 = SBOX[tmp];
    } else if (i % 8 === 4) {
      t0 = SBOX[t0]; t1 = SBOX[t1]; t2 = SBOX[t2]; t3 = SBOX[t3];
    }

    const prev = (i - 8) * 4;
    expanded[i * 4]     = expanded[prev]     ^ t0;
    expanded[i * 4 + 1] = expanded[prev + 1] ^ t1;
    expanded[i * 4 + 2] = expanded[prev + 2] ^ t2;
    expanded[i * 4 + 3] = expanded[prev + 3] ^ t3;
    i++;
  }

  return expanded;
}

function aesDecryptBlock(state: Uint8Array, expandedKey: Uint8Array): void {
  // AddRoundKey (round 14)
  for (let i = 0; i < 16; i++) state[i] ^= expandedKey[224 + i];

  for (let round = 13; round >= 1; round--) {
    // InvShiftRows
    let t = state[13]; state[13] = state[9]; state[9] = state[5]; state[5] = state[1]; state[1] = t;
    t = state[2]; state[2] = state[10]; state[10] = t;
    t = state[6]; state[6] = state[14]; state[14] = t;
    t = state[3]; state[3] = state[7]; state[7] = state[11]; state[11] = state[15]; state[15] = t;

    // InvSubBytes
    for (let i = 0; i < 16; i++) state[i] = INV_SBOX[state[i]];

    // AddRoundKey
    const off = round * 16;
    for (let i = 0; i < 16; i++) state[i] ^= expandedKey[off + i];

    // InvMixColumns
    for (let col = 0; col < 4; col++) {
      const j = col * 4;
      const a = state[j], b = state[j + 1], c = state[j + 2], d = state[j + 3];
      state[j]     = GM14[a] ^ GM11[b] ^ GM13[c] ^ GM9[d];
      state[j + 1] = GM9[a]  ^ GM14[b] ^ GM11[c] ^ GM13[d];
      state[j + 2] = GM13[a] ^ GM9[b]  ^ GM14[c] ^ GM11[d];
      state[j + 3] = GM11[a] ^ GM13[b] ^ GM9[c]  ^ GM14[d];
    }
  }

  // Final round (no InvMixColumns)
  let t = state[13]; state[13] = state[9]; state[9] = state[5]; state[5] = state[1]; state[1] = t;
  t = state[2]; state[2] = state[10]; state[10] = t;
  t = state[6]; state[6] = state[14]; state[14] = t;
  t = state[3]; state[3] = state[7]; state[7] = state[11]; state[11] = state[15]; state[15] = t;

  for (let i = 0; i < 16; i++) state[i] = INV_SBOX[state[i]];
  for (let i = 0; i < 16; i++) state[i] ^= expandedKey[i];
}

/**
 * AES-256-CBC decryption with PKCS7 padding validation.
 * Returns null if padding is invalid (wrong password).
 */
function aesCbcDecrypt(ciphertext: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array | null {
  if (ciphertext.length === 0 || ciphertext.length % 16 !== 0) return null;

  const expandedKey = aesExpandKey(key);
  const numBlocks = ciphertext.length / 16;
  const plaintext = new Uint8Array(ciphertext.length);
  const block = new Uint8Array(16);

  for (let b = 0; b < numBlocks; b++) {
    const offset = b * 16;

    // Copy ciphertext block
    for (let i = 0; i < 16; i++) block[i] = ciphertext[offset + i];

    // Decrypt block
    aesDecryptBlock(block, expandedKey);

    // XOR with previous ciphertext block (or IV for first block)
    const xorSrc = b === 0 ? iv : ciphertext;
    const xorOff = b === 0 ? 0 : (b - 1) * 16;
    for (let i = 0; i < 16; i++) {
      plaintext[offset + i] = block[i] ^ xorSrc[xorOff + i];
    }
  }

  // Validate PKCS7 padding
  const padByte = plaintext[plaintext.length - 1];
  if (padByte === 0 || padByte > 16) return null;
  for (let i = plaintext.length - padByte; i < plaintext.length; i++) {
    if (plaintext[i] !== padByte) return null;
  }

  return plaintext.slice(0, plaintext.length - padByte);
}

// ============================================================
// Password Test - Fully synchronous
// ============================================================

const textEncoder = new TextEncoder();

function testPassword(
  password: string,
  encryptedKey: Uint8Array,
  salt: Uint8Array,
  iterations: number,
): boolean {
  // EVP_BytesToKey: SHA-512(password || salt), then iterate
  const passBytes = textEncoder.encode(password);
  const combined = new Uint8Array(passBytes.length + salt.length);
  combined.set(passBytes);
  combined.set(salt, passBytes.length);

  let hash = sha512(combined);
  for (let i = 1; i < iterations; i++) {
    hash = sha512(hash);
  }

  // key = hash[0:32], iv = hash[32:48]
  const decrypted = aesCbcDecrypt(encryptedKey, hash.slice(0, 32), hash.slice(32, 48));

  // Valid decryption + 32-byte master key = correct password
  return decrypted !== null && decrypted.length === 32;
}

// ============================================================
// Worker State & Message Handler
// ============================================================

let encKey: Uint8Array | null = null;
let wSalt: Uint8Array | null = null;
let wIterations = 0;
let stopped = false;
let totalTested = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx: any = self;

ctx.onmessage = (e: MessageEvent) => {
  const msg = e.data;

  if (msg.type === 'INIT') {
    encKey = new Uint8Array(msg.masterKey.encryptedKey);
    wSalt = new Uint8Array(msg.masterKey.salt);
    wIterations = msg.masterKey.iterations;
    totalTested = 0;
    stopped = false;
    ctx.postMessage({ type: 'READY' });
  }
  else if (msg.type === 'TEST_BATCH') {
    if (!encKey || !wSalt) return;
    stopped = false;

    const passwords: string[] = msg.passwords;
    const batchId: number = msg.batchId;
    const t0 = performance.now();
    let batchTested = 0;

    for (let i = 0; i < passwords.length; i++) {
      if (stopped) break;

      if (testPassword(passwords[i], encKey, wSalt, wIterations)) {
        ctx.postMessage({ type: 'FOUND', password: passwords[i], batchId });
        return;
      }

      batchTested++;
      totalTested++;

      // Progress every 3 passwords
      if (batchTested % 3 === 0) {
        ctx.postMessage({
          type: 'PROGRESS',
          batchId,
          tested: batchTested,
          currentPassword: passwords[i],
        });
      }
    }

    ctx.postMessage({ type: 'BATCH_DONE', batchId, tested: batchTested });
  }
  else if (msg.type === 'STOP') {
    stopped = true;
  }
};
