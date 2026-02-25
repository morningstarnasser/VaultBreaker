import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Database, Key, Hash, RotateCw, Copy, Download, Terminal } from 'lucide-react';
import type { WalletInfo, MasterKeyData } from '../types';
import { toHex, formatSize } from '../lib/wallet-parser';

interface Props {
  wallet: WalletInfo;
}

function buildHashcatHash(mk: MasterKeyData): string {
  const cry = toHex(mk.encryptedKey);
  const salt = toHex(mk.salt);
  // hashcat mode 11300: $bitcoin$<len>$<cry>$<salt_len>$<salt>$<iter>$2$00$2$00
  return `$bitcoin$${mk.encryptedKey.length * 2}$${cry}$${mk.salt.length * 2}$${salt}$${mk.iterations}$2$00$2$00`;
}

function buildBtcrecoverGuide(mk: MasterKeyData, hash: string): string {
  return `
=== WALLET RECOVERY GUIDE ===

Extracted Hash (hashcat mode 11300):
${hash}

--- Option 1: btcrecover (Empfohlen, einfachste Methode) ---

pip3 install btcrecover
python3 btcrecover.py --wallet wallet.dat --tokenlist tokens.txt

tokens.txt Beispiel (ein Wort pro Zeile):
bitcoin
mypassword
MeinPasswort
geheim

--- Option 2: hashcat (GPU, schnellste Methode) ---

# Hash in Datei speichern:
echo '${hash}' > wallet.hash

# Dictionary Attack:
hashcat -m 11300 wallet.hash wordlist.txt

# Dictionary + Rules:
hashcat -m 11300 wallet.hash wordlist.txt -r rules/best64.rule

# Brute-Force (6 Zeichen):
hashcat -m 11300 wallet.hash -a 3 ?a?a?a?a?a?a

# Mask Attack (Wort + 4 Ziffern):
hashcat -m 11300 wallet.hash -a 6 wordlist.txt ?d?d?d?d

--- Option 3: John the Ripper ---

# bitcoin2john (aus John Jumbo):
echo '${hash}' > wallet.hash
john --format=bitcoin wallet.hash --wordlist=wordlist.txt

--- Raw Parameters ---
Encrypted Key: ${toHex(mk.encryptedKey)}
Salt:          ${toHex(mk.salt)}
Method:        ${mk.method} (SHA-512 EVP_BytesToKey)
Iterations:    ${mk.iterations}
Algorithm:     AES-256-CBC

--- Performance Comparison ---
Browser (JS):     ~10-100 pw/s
CPU (hashcat):    ~500-5.000 pw/s
GPU RTX 3080:     ~20.000-50.000 pw/s
GPU RTX 4090:     ~50.000-100.000 pw/s

(Geschwindigkeit haengt von ${mk.iterations.toLocaleString()} Iterationen ab)
`.trim();
}

export default function WalletInfoPanel({ wallet }: Props) {
  const [copied, setCopied] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  const mk = wallet.masterKey;
  const hashcatHash = mk ? buildHashcatHash(mk) : '';

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const downloadGuide = () => {
    if (!mk) return;
    const guide = buildBtcrecoverGuide(mk, hashcatHash);
    const blob = new Blob([guide], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallet_recovery_guide_${wallet.fileName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-6 space-y-4"
    >
      <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
        <Database className="w-5 h-5 text-cyan-400" />
        Wallet Analyse
      </h2>

      {/* Basic Info */}
      <div className="space-y-3">
        <InfoRow label="Datei" value={wallet.fileName} />
        <InfoRow label="Groesse" value={formatSize(wallet.fileSize)} />
        <InfoRow label="Format" value={wallet.format.toUpperCase()} />

        <div className="border-t border-slate-800 my-3" />

        {wallet.isEncrypted && mk ? (
          <>
            <div className="flex items-center gap-2 text-emerald-400 mb-3">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Verschluesselter Master Key gefunden</span>
            </div>

            <InfoRow
              icon={<Key className="w-3.5 h-3.5 text-yellow-400" />}
              label="Encrypted Key"
              value={toHex(mk.encryptedKey).substring(0, 32) + '...'}
              mono
            />
            <InfoRow
              icon={<Hash className="w-3.5 h-3.5 text-violet-400" />}
              label="Salt"
              value={toHex(mk.salt)}
              mono
            />
            <InfoRow
              icon={<RotateCw className="w-3.5 h-3.5 text-cyan-400" />}
              label="Iterationen"
              value={mk.iterations.toLocaleString('de-DE')}
            />
            <InfoRow
              label="Methode"
              value={mk.method === 0 ? 'SHA-512 (EVP_BytesToKey)' : 'scrypt'}
            />
            <InfoRow
              label="Verschluesselung"
              value="AES-256-CBC"
            />
          </>
        ) : (
          <div className="flex items-center gap-2 text-red-400">
            <XCircle className="w-4 h-4" />
            <span className="text-sm">
              {wallet.format === 'unknown'
                ? 'Kein gueltiges Wallet-Format erkannt'
                : 'Kein verschluesselter Master Key gefunden'}
            </span>
          </div>
        )}
      </div>

      {/* Hashcat / btcrecover Export */}
      {mk && (
        <div className="border-t border-slate-800 pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-violet-400" />
            Export fuer Hashcat / btcrecover
          </h3>

          <p className="text-xs text-slate-500">
            GPU-Tools sind 100-1000x schneller als Browser-Recovery.
            Kopiere den Hash fuer hashcat (mode 11300) oder btcrecover.
          </p>

          {/* Hash display */}
          <div className="relative">
            <pre className="bg-slate-900/80 rounded-lg p-3 text-[10px] font-mono text-emerald-300 break-all select-all overflow-x-auto">
              {hashcatHash}
            </pre>
            <button
              onClick={() => copyText(hashcatHash, 'hash')}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 transition-colors"
              title="Hash kopieren"
            >
              {copied === 'hash'
                ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="flex-1 text-xs py-2 px-3 rounded-lg border border-violet-500/30 text-violet-300
                hover:bg-violet-500/10 transition-colors flex items-center justify-center gap-1.5"
            >
              <Terminal className="w-3 h-3" />
              {showGuide ? 'Guide ausblenden' : 'Recovery Guide anzeigen'}
            </button>
            <button
              onClick={downloadGuide}
              className="flex-1 text-xs py-2 px-3 rounded-lg border border-emerald-500/30 text-emerald-300
                hover:bg-emerald-500/10 transition-colors flex items-center justify-center gap-1.5"
            >
              <Download className="w-3 h-3" />
              Guide als .txt
            </button>
          </div>

          {/* Full guide */}
          {showGuide && (
            <motion.pre
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-slate-900/80 rounded-lg p-4 text-[11px] font-mono text-slate-300 whitespace-pre-wrap overflow-auto max-h-80"
            >
              {buildBtcrecoverGuide(mk, hashcatHash)}
            </motion.pre>
          )}
        </div>
      )}
    </motion.div>
  );
}

function InfoRow({ label, value, mono, icon }: {
  label: string; value: string; mono?: boolean; icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-500 flex items-center gap-1.5 shrink-0">
        {icon}{label}
      </span>
      <span className={`text-sm text-slate-300 truncate ${mono ? 'font-mono text-xs' : ''}`} title={value}>
        {value}
      </span>
    </div>
  );
}
