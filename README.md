# VaultBreaker

**Offline Browser-Based Bitcoin Wallet Password Recovery Tool**

VaultBreaker extrahiert den verschluesselten Master Key aus einer `wallet.dat` und versucht das Passwort direkt im Browser wiederherzustellen. Alles laeuft **100% lokal** — keine Daten verlassen deinen Computer.

---

## Features

### Wallet-Analyse
- Automatische Erkennung des Wallet-Formats (Berkeley DB / SQLite)
- Extraktion des verschluesselten Master Keys (AES-256-CBC)
- Anzeige aller kryptografischen Parameter (Salt, Iterationen, Methode)

### 6 Angriffsmodi

| Modus | Beschreibung |
|---|---|
| **Einzeltest** | Ein einzelnes Passwort direkt testen |
| **Wortliste** | Eigene `.txt` Datei mit Passwoertern hochladen |
| **Generator** | ~10.000+ Variationen eines Basisworts (Leet-Speak, Zahlen, Jahreszahlen, Reversed, Case-Varianten) |
| **Keyboard** | QWERTY Keyboard-Walk-Patterns (qwerty, asdfgh, 1qaz2wsx, ...) |
| **Datum** | Datums-Formate von 1970–2026 (DD.MM.YYYY, YYYYMMDD, MM/DD/YYYY, ...) |
| **Kombi** | Kombinations-Angriff: Wort + Trennzeichen + Wort |

### Export fuer externe Tools
- **Hashcat** Hash-Export (Mode 11300) — kopierbereit
- **btcrecover** Anleitung mit Beispiel-Befehlen
- **John the Ripper** Anleitung
- Downloadbarer Recovery-Guide als `.txt` mit allen Parametern und Performance-Vergleich

### Technische Details
- Multi-threaded via Web Workers (nutzt alle CPU-Kerne)
- AES-256-CBC Entschluesselung mit SHA-512 (EVP_BytesToKey) / PBKDF2
- PKCS7 Padding-Validierung zur Passwort-Verifizierung
- Unterstuetzt Bitcoin Core, Litecoin, Dogecoin und weitere Forks

---

## Schnellstart

### Voraussetzungen
- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/morningstarnasser/VaultBreaker.git
cd VaultBreaker
npm install
```

### Entwicklung

```bash
npm run dev
```

Oeffne `http://localhost:5173` im Browser.

### Production Build

```bash
npm run build
npm run preview
```

---

## Verwendung

1. **wallet.dat hochladen** — Per Drag & Drop oder Datei-Auswahl
2. **Analyse pruefen** — Format, Verschluesselung, Master Key Parameter
3. **Angriffsmodus waehlen** — Einzeltest, Wortliste, Generator, Keyboard, Datum oder Kombi
4. **Recovery starten** — Fortschritt in Echtzeit verfolgen (Speed, getestete Passwoerter, Zeit)
5. **Passwort gefunden?** — Kopieren und Wallet entsperren
6. **Alternativ: Export** — Hashcat-Hash kopieren fuer GPU-beschleunigte Recovery

---

## Performance-Vergleich

| Methode | Geschwindigkeit |
|---|---|
| Browser (JavaScript) | ~10–100 pw/s |
| CPU (hashcat) | ~500–5.000 pw/s |
| GPU RTX 3080 | ~20.000–50.000 pw/s |
| GPU RTX 4090 | ~50.000–100.000 pw/s |

> Die tatsaechliche Geschwindigkeit haengt von der Anzahl der PBKDF2-Iterationen der Wallet ab.

Fuer groessere Passwort-Raeume wird empfohlen, den exportierten Hash mit **hashcat** oder **btcrecover** auf einer GPU zu verwenden.

---

## Architektur

```
VaultBreaker/
├── index.html                 # Entry HTML
├── package.json               # Dependencies & Scripts
├── vite.config.ts             # Vite Konfiguration
├── tailwind.config.js         # TailwindCSS Konfiguration
├── tsconfig.json              # TypeScript Konfiguration
└── src/
    ├── main.tsx               # React Entry Point
    ├── App.tsx                # Haupt-App (Upload → Analyse → Recovery)
    ├── index.css              # TailwindCSS + Glassmorphism Styles
    ├── types.ts               # TypeScript Typen & Worker-Messages
    ├── components/
    │   ├── FileUpload.tsx     # Drag & Drop Upload-Komponente
    │   ├── WalletInfo.tsx     # Wallet-Analyse + Hashcat-Export
    │   └── RecoveryPanel.tsx  # Recovery-UI mit 6 Angriffsmodi
    └── lib/
        ├── wallet-parser.ts   # Binaer-Parser fuer wallet.dat (BDB + SQLite)
        └── recovery-worker.ts # Web Worker fuer AES-256-CBC Tests
```

---

## Tech Stack

| Technologie | Verwendung |
|---|---|
| React 18 | UI Framework |
| TypeScript | Typsicherheit |
| Vite 6 | Build Tool & Dev Server |
| TailwindCSS 3 | Styling |
| Framer Motion | Animationen |
| Lucide React | Icons |
| Web Workers | Multi-threaded Crypto-Operationen |
| Web Crypto API | AES-256-CBC / SHA-512 / PBKDF2 |

---

## Kryptografie

### Wie Bitcoin Core Wallets verschluesselt sind

1. Ein **Master Key** (32 Bytes) wird zufaellig generiert — dieser verschluesselt alle Private Keys
2. Der Master Key wird mit dem Benutzer-Passwort verschluesselt:
   - Passwort → **SHA-512** (EVP_BytesToKey) oder **PBKDF2** mit Salt und N Iterationen
   - Ergebnis: AES-256-CBC Key + IV
   - Master Key wird mit AES-256-CBC verschluesselt (Ergebnis: 48 Bytes = 32 Key + 16 PKCS7 Padding)

### Was VaultBreaker macht

1. **Extrahiert** den verschluesselten Master Key, Salt und Iterationen aus der `wallet.dat`
2. **Testet** jedes Kandidaten-Passwort:
   - Passwort + Salt → SHA-512 × N Iterationen → AES Key + IV
   - Entschluesselt die 48 Bytes mit AES-256-CBC
   - Prueft ob die letzten 16 Bytes gueltiges **PKCS7 Padding** sind
3. **Gueltiges Padding** = korrektes Passwort gefunden

---

## Sicherheit & Datenschutz

- Keine Netzwerk-Requests — die App funktioniert komplett offline
- Die `wallet.dat` wird nur im Browser-Speicher gelesen und nie hochgeladen
- Kein Backend, kein Server, keine Datenbank
- Open Source — der gesamte Code ist einsehbar

---

## Unterstuetzte Wallet-Formate

| Format | Status |
|---|---|
| Bitcoin Core (BDB) | Vollstaendig unterstuetzt |
| Bitcoin Core (SQLite) | Unterstuetzt (Raw-Scan) |
| Litecoin | Unterstuetzt (gleiche wallet.dat Struktur) |
| Dogecoin | Unterstuetzt (gleiche wallet.dat Struktur) |
| Andere Bitcoin-Forks | Sollte funktionieren (gleiche Verschluesselung) |

---

## Disclaimer

Dieses Tool ist ausschliesslich fuer **eigene Wallets** gedacht, fuer die du das Passwort vergessen hast. Die Verwendung fuer unbefugten Zugriff auf fremde Wallets ist illegal und wird nicht unterstuetzt.

**Educational Tool — Nur fuer eigene Wallets verwenden.**

---

## Lizenz

MIT
