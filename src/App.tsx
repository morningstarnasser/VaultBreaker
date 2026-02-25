import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, RotateCcw, Lock, Cpu, Eye } from 'lucide-react';
import FileUpload from './components/FileUpload';
import WalletInfoPanel from './components/WalletInfo';
import RecoveryPanel from './components/RecoveryPanel';
import { parseWalletDat } from './lib/wallet-parser';
import type { WalletInfo } from './types';

export default function App() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);

  const handleFileLoaded = useCallback((buffer: ArrayBuffer, fileName: string) => {
    const info = parseWalletDat(buffer, fileName);
    setWallet(info);
  }, []);

  const handleReset = () => setWallet(null);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-800/50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-200">VaultBreaker</h1>
              <p className="text-[11px] text-slate-500">AES-256 Wallet Password Recovery</p>
            </div>
          </div>
          {wallet && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Neue Datei
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {!wallet ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Hero */}
              <div className="text-center mb-10">
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent mb-3"
                >
                  Wallet Passwort wiederherstellen
                </motion.h2>
                <p className="text-slate-500 max-w-lg mx-auto text-sm">
                  Lade deine verschlüsselte wallet.dat hoch, um das Passwort wiederherzustellen.
                  Alles läuft lokal in deinem Browser — die Datei verlässt nie deinen Computer.
                </p>
              </div>

              <FileUpload onFileLoaded={handleFileLoaded} />

              {/* How it works */}
              <div className="mt-16 max-w-2xl mx-auto">
                <h3 className="text-sm font-medium text-slate-400 text-center mb-6">Wie funktioniert es?</h3>
                <div className="grid grid-cols-3 gap-6">
                  {[
                    {
                      icon: Lock,
                      title: 'Master Key finden',
                      desc: 'Der verschlüsselte Master Key wird aus der wallet.dat extrahiert.',
                    },
                    {
                      icon: Cpu,
                      title: 'Passwörter testen',
                      desc: 'Jedes Passwort wird per SHA-512 + AES-256-CBC gegen den Key getestet.',
                    },
                    {
                      icon: Eye,
                      title: 'Ergebnis',
                      desc: 'Bei gültigem PKCS7 Padding ist das korrekte Passwort gefunden.',
                    },
                  ].map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="text-center">
                      <div className="w-10 h-10 rounded-xl bg-dark-700 flex items-center justify-center mx-auto mb-3">
                        <Icon className="w-5 h-5 text-cyan-400" />
                      </div>
                      <h4 className="text-sm font-medium text-slate-300 mb-1">{title}</h4>
                      <p className="text-xs text-slate-500">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {/* Left: Wallet Info */}
              <WalletInfoPanel wallet={wallet} />

              {/* Right: Recovery Panel */}
              {wallet.isEncrypted && wallet.masterKey ? (
                <RecoveryPanel masterKey={wallet.masterKey} />
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="glass rounded-2xl p-6 flex flex-col items-center justify-center text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-dark-700 flex items-center justify-center mb-4">
                    <Lock className="w-8 h-8 text-slate-600" />
                  </div>
                  <h3 className="text-slate-400 font-medium mb-2">Kein verschlüsselter Key gefunden</h3>
                  <p className="text-sm text-slate-600 max-w-sm">
                    {wallet.format === 'unknown'
                      ? 'Die Datei scheint keine gültige wallet.dat zu sein. Prüfe die Datei und versuche es erneut.'
                      : 'Diese Wallet ist möglicherweise nicht verschlüsselt oder verwendet ein unbekanntes Format.'}
                  </p>
                  <button
                    onClick={handleReset}
                    className="mt-4 px-4 py-2 rounded-xl text-sm text-cyan-400 border border-cyan-500/30
                      hover:bg-cyan-500/10 transition-colors"
                  >
                    Andere Datei laden
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/30 mt-auto">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between text-[11px] text-slate-600">
          <span>Educational Tool — Nur für eigene Wallets verwenden</span>
          <span>AES-256-CBC + SHA-512 + PBKDF2</span>
        </div>
      </footer>
    </div>
  );
}
