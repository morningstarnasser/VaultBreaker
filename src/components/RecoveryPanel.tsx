import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Square, KeyRound, FileText, Zap, Loader2,
  CheckCircle, Copy, Clock, Gauge, Hash, Keyboard, Calendar, Shuffle,
} from 'lucide-react';
import type { MasterKeyData, RecoveryProgress, WorkerRequest, WorkerResponse } from '../types';

interface Props {
  masterKey: MasterKeyData;
}

type Mode = 'single' | 'wordlist' | 'generator' | 'keyboard' | 'dates' | 'combo';

// ============================================================
// Password Generation Strategies
// ============================================================

function generateVariations(base: string): string[] {
  const passwords: string[] = [base];
  const suffixes = ['', '!', '@', '#', '$', '1', '12', '123', '1234', '!1', '!@#', '0', '00', '01', '69', '99'];
  const prefixes = ['', '1', '12', '123', '!'];

  // Case variations
  passwords.push(base.toLowerCase(), base.toUpperCase());
  passwords.push(base.charAt(0).toUpperCase() + base.slice(1).toLowerCase());

  // With common suffixes & prefixes
  for (const suffix of suffixes) {
    passwords.push(base + suffix, base.toLowerCase() + suffix);
    passwords.push(base.charAt(0).toUpperCase() + base.slice(1).toLowerCase() + suffix);
  }
  for (const prefix of prefixes) {
    if (prefix) passwords.push(prefix + base);
  }

  // Year suffixes
  for (let year = 1970; year <= 2026; year++) {
    passwords.push(base + year, base + String(year).slice(2));
  }

  // Number suffixes 0-9999
  for (let i = 0; i <= 9999; i++) passwords.push(base + i);

  // Leet speak
  const leet: Record<string, string[]> = { a:['@','4'], e:['3'], i:['1','!'], o:['0'], s:['$','5'], t:['7'] };
  const lower = base.toLowerCase();
  for (const [char, repls] of Object.entries(leet)) {
    for (const repl of repls) {
      const v = lower.replace(new RegExp(char, 'g'), repl);
      if (v !== lower) {
        passwords.push(v);
        for (const s of suffixes) passwords.push(v + s);
      }
    }
  }

  // Reversed
  const rev = base.split('').reverse().join('');
  passwords.push(rev, rev + '!', rev + '123');

  // Doubled
  passwords.push(base + base, base + base.toUpperCase());

  return [...new Set(passwords)];
}

/**
 * Keyboard walk patterns (QWERTY adjacency).
 */
function generateKeyboardWalks(): string[] {
  const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'];
  const passwords: string[] = [];

  // Horizontal walks (3-8 chars)
  for (const row of rows) {
    for (let start = 0; start < row.length; start++) {
      for (let len = 3; len <= Math.min(8, row.length - start); len++) {
        const walk = row.substring(start, start + len);
        passwords.push(walk, walk.toUpperCase());
        passwords.push(walk + '!', walk + '123', walk + '!@#');
        // Reversed
        const rev = walk.split('').reverse().join('');
        passwords.push(rev);
      }
    }
  }

  // Common keyboard patterns
  const patterns = [
    'qwerty', 'qwerty123', 'qwerty!', 'qwertz', 'qwertz123',
    'asdfgh', 'asdfgh123', 'zxcvbn', 'zxcvbn123',
    'qazwsx', 'qazwsx123', 'qazwsxedc',
    '1qaz2wsx', '1qaz2wsx3edc',
    'zaq1zaq1', 'zaq12wsx',
    '!QAZ2wsx', '1qaz!QAZ',
    'asdfjkl;', 'poiuytrewq',
    'mnbvcxz', '0987654321',
  ];

  for (const p of patterns) {
    passwords.push(p, p.toUpperCase());
    passwords.push(p.charAt(0).toUpperCase() + p.slice(1));
  }

  return [...new Set(passwords)];
}

/**
 * Date-based patterns.
 */
function generateDatePatterns(): string[] {
  const passwords: string[] = [];

  for (let year = 1970; year <= 2026; year++) {
    const y4 = String(year);
    const y2 = y4.slice(2);

    for (let month = 1; month <= 12; month++) {
      const m2 = String(month).padStart(2, '0');
      const m1 = String(month);

      for (let day = 1; day <= 31; day++) {
        const d2 = String(day).padStart(2, '0');
        const d1 = String(day);

        // Various date formats
        passwords.push(
          `${d2}${m2}${y4}`,   // 01012000
          `${d2}${m2}${y2}`,   // 010100
          `${m2}${d2}${y4}`,   // 01012000 (US)
          `${m2}${d2}${y2}`,   // 010100 (US)
          `${y4}${m2}${d2}`,   // 20000101
          `${d2}.${m2}.${y4}`, // 01.01.2000
          `${d2}.${m2}.${y2}`, // 01.01.00
          `${m2}/${d2}/${y4}`, // 01/01/2000
          `${d1}${m1}${y4}`,   // 112000
          `${d1}${m1}${y2}`,   // 1100
        );
      }
    }

    // Year only
    passwords.push(y4, y2);
  }

  return [...new Set(passwords)];
}

/**
 * Combination attack: word1 + separator + word2.
 */
function generateCombinations(words: string[]): string[] {
  const passwords: string[] = [];
  const separators = ['', ' ', '_', '-', '.', '!', '@', '#', '1', '123'];
  const top = words.slice(0, 50); // Limit to prevent explosion

  for (const w1 of top) {
    for (const w2 of top) {
      if (w1 === w2) continue;
      for (const sep of separators) {
        passwords.push(w1 + sep + w2);
      }
    }
  }

  return passwords;
}

const CRYPTO_WORDS = [
  'bitcoin', 'Bitcoin', 'BITCOIN', 'btc', 'BTC',
  'satoshi', 'Satoshi', 'nakamoto', 'Nakamoto',
  'wallet', 'Wallet', 'crypto', 'Crypto',
  'blockchain', 'mining', 'hodl', 'HODL',
  'moon', 'lambo', 'diamond', 'hands',
  'password', 'Password', 'passwort', 'Passwort',
  'geheim', 'Geheim', 'secret', 'Secret',
  'master', 'Master', 'admin', 'Admin',
  'test', 'Test', 'letmein', 'welcome',
];

// ============================================================
// Component
// ============================================================

export default function RecoveryPanel({ masterKey }: Props) {
  const [mode, setMode] = useState<Mode>('single');
  const [singlePassword, setSinglePassword] = useState('');
  const [baseWord, setBaseWord] = useState('');
  const [wordlistPasswords, setWordlistPasswords] = useState<string[]>([]);
  const [wordlistName, setWordlistName] = useState('');

  const [progress, setProgress] = useState<RecoveryProgress>({
    tested: 0, total: 0, speed: 0, currentPassword: '',
    running: false, found: false, foundPassword: null, elapsedMs: 0,
  });

  const workersRef = useRef<Worker[]>([]);
  const startTimeRef = useRef(0);
  const testedRef = useRef(0);
  const timerRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      workersRef.current.forEach(w => w.terminate());
      clearInterval(timerRef.current);
    };
  }, []);

  const stopRecovery = useCallback(() => {
    workersRef.current.forEach(w => {
      w.postMessage({ type: 'STOP' } satisfies WorkerRequest);
      w.terminate();
    });
    workersRef.current = [];
    clearInterval(timerRef.current);
    setProgress(prev => ({ ...prev, running: false }));
  }, []);

  const startRecovery = useCallback((passwords: string[]) => {
    if (passwords.length === 0) return;
    stopRecovery();

    const numWorkers = Math.min(navigator.hardwareConcurrency || 4, 8, passwords.length);
    const batchSize = Math.ceil(passwords.length / numWorkers);

    testedRef.current = 0;
    startTimeRef.current = Date.now();

    setProgress({
      tested: 0, total: passwords.length, speed: 0, currentPassword: '',
      running: true, found: false, foundPassword: null, elapsedMs: 0,
    });

    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const speed = elapsed > 0 ? (testedRef.current / elapsed) * 1000 : 0;
      setProgress(prev => ({ ...prev, speed, elapsedMs: elapsed }));
    }, 500);

    let completedWorkers = 0;
    const workers: Worker[] = [];

    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(
        new URL('../lib/recovery-worker.ts', import.meta.url),
        { type: 'module' },
      );

      const batch = passwords.slice(i * batchSize, (i + 1) * batchSize);

      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;

        if (msg.type === 'READY') {
          worker.postMessage({ type: 'TEST_BATCH', passwords: batch, batchId: i } satisfies WorkerRequest);
        }
        if (msg.type === 'PROGRESS') {
          testedRef.current += msg.tested;
          setProgress(prev => ({ ...prev, tested: testedRef.current, currentPassword: msg.currentPassword }));
        }
        if (msg.type === 'FOUND') {
          setProgress(prev => ({
            ...prev, found: true, foundPassword: msg.password,
            running: false, elapsedMs: Date.now() - startTimeRef.current,
          }));
          workers.forEach(w => { w.postMessage({ type: 'STOP' }); w.terminate(); });
          workersRef.current = [];
          clearInterval(timerRef.current);
        }
        if (msg.type === 'BATCH_DONE') {
          testedRef.current += msg.tested;
          completedWorkers++;
          if (completedWorkers >= numWorkers) {
            clearInterval(timerRef.current);
            setProgress(prev => ({
              ...prev, tested: testedRef.current, running: false,
              elapsedMs: Date.now() - startTimeRef.current,
            }));
          }
        }
      };

      worker.postMessage({
        type: 'INIT',
        masterKey: {
          encryptedKey: Array.from(masterKey.encryptedKey),
          salt: Array.from(masterKey.salt),
          method: masterKey.method,
          iterations: masterKey.iterations,
        },
      } satisfies WorkerRequest);

      workers.push(worker);
    }
    workersRef.current = workers;
  }, [masterKey, stopRecovery]);

  const handleSingleTest = () => { if (singlePassword) startRecovery([singlePassword]); };

  const handleWordlistUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWordlistName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const passwords = (reader.result as string).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      setWordlistPasswords(passwords);
    };
    reader.readAsText(file);
  };

  const handleGeneratorStart = () => {
    if (!baseWord) return;
    startRecovery(generateVariations(baseWord));
  };

  const handleKeyboardStart = () => startRecovery(generateKeyboardWalks());
  const handleDatesStart = () => startRecovery(generateDatePatterns());
  const handleComboStart = () => {
    const words = baseWord ? [...CRYPTO_WORDS, ...baseWord.split(/[\s,;]+/)] : CRYPTO_WORDS;
    startRecovery(generateCombinations(words));
  };

  const copyPassword = () => {
    if (progress.foundPassword) navigator.clipboard.writeText(progress.foundPassword);
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  };

  const modes: { id: Mode; icon: typeof KeyRound; label: string; desc: string }[] = [
    { id: 'single', icon: KeyRound, label: 'Einzeltest', desc: 'Ein Passwort testen' },
    { id: 'wordlist', icon: FileText, label: 'Wortliste', desc: 'Eigene .txt Datei' },
    { id: 'generator', icon: Zap, label: 'Generator', desc: 'Variationen eines Worts' },
    { id: 'keyboard', icon: Keyboard, label: 'Keyboard', desc: 'QWERTY-Muster' },
    { id: 'dates', icon: Calendar, label: 'Datum', desc: 'Datums-Patterns' },
    { id: 'combo', icon: Shuffle, label: 'Kombi', desc: 'Wort + Wort' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass rounded-2xl p-6"
    >
      <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-cyan-400" />
        Password Recovery
      </h2>

      {/* Found Password */}
      <AnimatePresence>
        {progress.found && progress.foundPassword && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 gradient-border"
          >
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="font-semibold text-emerald-300">Passwort gefunden!</span>
            </div>
            <div className="flex items-center gap-3">
              <code className="flex-1 bg-slate-900/60 rounded-lg px-4 py-3 text-lg font-mono text-emerald-200 select-all">
                {progress.foundPassword}
              </code>
              <button onClick={copyPassword}
                className="p-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors">
                <Copy className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Gefunden nach {progress.tested.toLocaleString('de-DE')} Versuchen in {formatTime(progress.elapsedMs)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900/60 rounded-xl mb-5">
        {modes.map(({ id, icon: Icon, label, desc }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex flex-col items-center gap-0.5 py-2 px-2 rounded-lg text-xs transition-all
              ${mode === id
                ? 'bg-slate-700 text-cyan-400 shadow-lg shadow-cyan-500/5'
                : 'text-slate-500 hover:text-slate-300'
              }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="font-medium">{label}</span>
            <span className="text-[9px] opacity-60">{desc}</span>
          </button>
        ))}
      </div>

      {/* Single */}
      {mode === 'single' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input type="text" value={singlePassword}
              onChange={e => setSinglePassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSingleTest()}
              placeholder="Passwort eingeben..."
              className="flex-1 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
            <button onClick={handleSingleTest} disabled={!singlePassword || progress.running}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-medium text-sm flex items-center gap-1.5">
              {progress.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Testen
            </button>
          </div>
        </div>
      )}

      {/* Wordlist */}
      {mode === 'wordlist' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">Lade eine .txt Datei mit Passwoertern (eins pro Zeile):</p>
          <div className="flex gap-2 items-center">
            <label className="flex-1 cursor-pointer">
              <div className="bg-slate-900/60 border border-slate-800 hover:border-cyan-500/30 rounded-xl px-4 py-2.5 text-sm text-slate-400">
                {wordlistName || 'Textdatei auswaehlen...'}
              </div>
              <input type="file" className="hidden" accept=".txt,.csv,.list" onChange={handleWordlistUpload} />
            </label>
            <button onClick={() => startRecovery(wordlistPasswords)}
              disabled={wordlistPasswords.length === 0 || progress.running}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-medium text-sm flex items-center gap-1.5">
              {progress.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Start
            </button>
          </div>
          {wordlistPasswords.length > 0 && (
            <p className="text-xs text-slate-500">{wordlistPasswords.length.toLocaleString('de-DE')} Passwoerter geladen</p>
          )}
        </div>
      )}

      {/* Generator */}
      {mode === 'generator' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Basiswort eingeben - generiert ~10.000+ Variationen (Zahlen, Leet-Speak, Jahreszahlen, Reversed):
          </p>
          <div className="flex gap-2">
            <input type="text" value={baseWord}
              onChange={e => setBaseWord(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGeneratorStart()}
              placeholder="z.B. bitcoin, MyWallet..."
              className="flex-1 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
            <button onClick={handleGeneratorStart} disabled={!baseWord || progress.running}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-medium text-sm flex items-center gap-1.5">
              {progress.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Start
            </button>
          </div>
          {baseWord && <p className="text-xs text-slate-500">~{generateVariations(baseWord).length.toLocaleString('de-DE')} Variationen</p>}
        </div>
      )}

      {/* Keyboard Walks */}
      {mode === 'keyboard' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Testet QWERTY Keyboard-Patterns: qwerty, asdfgh, 1qaz2wsx, qazwsx etc.
          </p>
          <button onClick={handleKeyboardStart} disabled={progress.running}
            className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-medium text-sm flex items-center justify-center gap-1.5">
            {progress.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Keyboard className="w-4 h-4" />}
            {generateKeyboardWalks().length.toLocaleString('de-DE')} Keyboard-Patterns testen
          </button>
        </div>
      )}

      {/* Date Patterns */}
      {mode === 'dates' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Testet Datums-Formate (1970-2026): DD.MM.YYYY, DDMMYYYY, MM/DD/YYYY, YYYYMMDD etc.
          </p>
          <button onClick={handleDatesStart} disabled={progress.running}
            className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-medium text-sm flex items-center justify-center gap-1.5">
            {progress.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            ~{generateDatePatterns().length.toLocaleString('de-DE')} Datums-Patterns testen
          </button>
        </div>
      )}

      {/* Combination */}
      {mode === 'combo' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Kombiniert Woerter: bitcoin_wallet, Satoshi123, crypto!secret etc.
            Optional eigene Woerter hinzufuegen:
          </p>
          <input type="text" value={baseWord}
            onChange={e => setBaseWord(e.target.value)}
            placeholder="Eigene Woerter (komma-getrennt, optional)..."
            className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
          <button onClick={handleComboStart} disabled={progress.running}
            className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-medium text-sm flex items-center justify-center gap-1.5">
            {progress.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
            Kombinationen generieren & testen
          </button>
        </div>
      )}

      {/* Progress */}
      <AnimatePresence>
        {(progress.running || progress.tested > 0) && !progress.found && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-5 space-y-3"
          >
            <div className="border-t border-slate-800 pt-4" />

            {progress.total > 0 && (
              <div className="relative h-2 bg-slate-900/60 rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full"
                  animate={{ width: `${Math.min((progress.tested / progress.total) * 100, 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <StatBox icon={<Hash className="w-3.5 h-3.5 text-cyan-400" />} label="Getestet"
                value={`${progress.tested.toLocaleString('de-DE')} / ${progress.total.toLocaleString('de-DE')}`} />
              <StatBox icon={<Gauge className="w-3.5 h-3.5 text-violet-400" />} label="Speed"
                value={`${progress.speed.toFixed(1)} pw/s`} />
              <StatBox icon={<Clock className="w-3.5 h-3.5 text-amber-400" />} label="Zeit"
                value={formatTime(progress.elapsedMs)} />
            </div>

            {progress.currentPassword && (
              <p className="text-xs text-slate-600 font-mono truncate">Aktuell: {progress.currentPassword}</p>
            )}

            {progress.running && (
              <button onClick={stopRecovery}
                className="w-full py-2 rounded-xl border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10 flex items-center justify-center gap-1.5">
                <Square className="w-3.5 h-3.5" /> Stoppen
              </button>
            )}

            {!progress.running && !progress.found && progress.tested > 0 && (
              <div className="text-center py-2 text-sm text-slate-500">
                Passwort nicht gefunden. Versuche andere Strategien oder eine groessere Wortliste.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-slate-900/40 rounded-lg p-2.5 text-center">
      <div className="flex items-center justify-center gap-1 mb-0.5">{icon}<span className="text-[10px] text-slate-500">{label}</span></div>
      <div className="text-sm font-mono text-slate-300">{value}</div>
    </div>
  );
}
