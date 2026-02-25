import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileKey, Shield, AlertTriangle } from 'lucide-react';

interface Props {
  onFileLoaded: (buffer: ArrayBuffer, fileName: string) => void;
}

export default function FileUpload({ onFileLoaded }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    setError(null);

    if (file.size > 500 * 1024 * 1024) {
      setError('Datei ist zu gross (max 500 MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        onFileLoaded(reader.result, file.name);
      }
    };
    reader.onerror = () => setError('Fehler beim Lesen der Datei');
    reader.readAsArrayBuffer(file);
  }, [onFileLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Features */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { icon: FileKey, label: 'wallet.dat', desc: 'Bitcoin Core Format' },
          { icon: Shield, label: 'Lokal', desc: 'Datei bleibt auf deinem PC' },
          { icon: Upload, label: 'Drag & Drop', desc: 'Oder klicke zum Hochladen' },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="glass rounded-xl p-4 text-center">
            <Icon className="w-6 h-6 mx-auto mb-2 text-cyan-400" />
            <div className="text-sm font-medium text-slate-200">{label}</div>
            <div className="text-xs text-slate-500">{desc}</div>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <motion.label
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={`
          relative block cursor-pointer rounded-2xl border-2 border-dashed p-12
          transition-all duration-300 text-center
          ${dragOver
            ? 'border-cyan-400 bg-cyan-400/5'
            : 'border-slate-700 hover:border-cyan-500/50 hover:bg-dark-800/50'
          }
        `}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          className="hidden"
          accept=".dat,.wallet"
          onChange={handleInputChange}
        />

        <motion.div
          animate={dragOver ? { y: -8, scale: 1.1 } : { y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <div className={`
            w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center
            ${dragOver ? 'bg-cyan-500/20' : 'bg-dark-600'}
          `}>
            <Upload className={`w-8 h-8 ${dragOver ? 'text-cyan-400' : 'text-slate-500'}`} />
          </div>
        </motion.div>

        <p className="text-lg font-medium text-slate-300 mb-1">
          {dragOver ? 'Datei hier ablegen...' : 'wallet.dat hierher ziehen'}
        </p>
        <p className="text-sm text-slate-500">
          oder klicke um eine Datei auszuwählen
        </p>
        <p className="text-xs text-slate-600 mt-3">
          Unterstützt: wallet.dat (Bitcoin Core, Litecoin, Dogecoin und Forks)
        </p>
      </motion.label>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-sm text-red-300">{error}</span>
        </motion.div>
      )}
    </div>
  );
}
