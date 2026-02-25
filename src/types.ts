export interface MasterKeyData {
  encryptedKey: Uint8Array;
  salt: Uint8Array;
  method: number;
  iterations: number;
}

export interface WalletInfo {
  fileName: string;
  fileSize: number;
  isEncrypted: boolean;
  masterKey: MasterKeyData | null;
  format: 'bdb' | 'sqlite' | 'unknown';
}

export interface RecoveryProgress {
  tested: number;
  total: number;
  speed: number; // passwords per second
  currentPassword: string;
  running: boolean;
  found: boolean;
  foundPassword: string | null;
  elapsedMs: number;
}

// Worker messages
export type WorkerRequest =
  | { type: 'INIT'; masterKey: { encryptedKey: number[]; salt: number[]; method: number; iterations: number } }
  | { type: 'TEST_BATCH'; passwords: string[]; batchId: number }
  | { type: 'STOP' };

export type WorkerResponse =
  | { type: 'READY' }
  | { type: 'PROGRESS'; batchId: number; tested: number; currentPassword: string }
  | { type: 'FOUND'; password: string; batchId: number }
  | { type: 'BATCH_DONE'; batchId: number; tested: number }
  | { type: 'ERROR'; message: string };
