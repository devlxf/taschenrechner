// Service Worker des Taschenrechners: macht die Web-App zur PWA, die nach
// dem ersten Besuch auch ohne Netz startet.
//
// Beim Veroeffentlichen (tool/web_veroeffentlichen.ps1) werden 20261119-143134-e0bc39e1d5c9
// und die Vorladeliste eingesetzt. Jede Veroeffentlichung aendert damit
// diese Datei; der Browser bemerkt das beim naechsten Oeffnen, laedt die
// neue Fassung komplett in einen eigenen Vorrat und schaltet erst dann um.
// So passen alle Dateien einer Sitzung immer zusammen.
//
// Unter `flutter run` (localhost) wird der Service Worker nicht angemeldet,
// siehe web/flutter_bootstrap.js.

const FASSUNG = '20261119-143134-e0bc39e1d5c9';
const VORRAT = 'taschenrechner-' + FASSUNG;
// Dateien fremder Server (Schriften von fonts.gstatic.com)
const FREMD = 'taschenrechner-fremd';
const VORLADEN = [
  'assets/AssetManifest.bin',
  'assets/AssetManifest.bin.json',
  'assets/assets/01_HT-Spickzettel.pdf',
  'assets/assets/02_HT-Kurzanleitung.pdf',
  'assets/assets/03_HT-Bedienungsanleitung.pdf',
  'assets/assets/fonts/LcdDot.ttf',
  'assets/assets/icon.png',
  'assets/assets/logo-HT.png',
  'assets/FontManifest.json',
  'assets/fonts/fallback/Roboto-Regular.ttf',
  'assets/fonts/MaterialIcons-Regular.otf',
  'assets/packages/cupertino_icons/assets/CupertinoIcons.ttf',
  'assets/packages/material_ui/shaders/ink_sparkle.frag',
  'assets/shaders/ink_sparkle.frag',
  'assets/shaders/stretch_effect.frag',
  'canvaskit/canvaskit.js',
  'canvaskit/canvaskit.wasm',
  'canvaskit/chromium/canvaskit.js',
  'canvaskit/chromium/canvaskit.wasm',
  'favicon.png',
  'flutter_bootstrap.js',
  'flutter.js',
  'icons/Icon-192.png',
  'icons/Icon-512.png',
  'icons/Icon-maskable-192.png',
  'icons/Icon-maskable-512.png',
  'index.html',
  'main.dart.js',
  'manifest.json',
  'version.json'
];

self.addEventListener('install', (ereignis) => {
  ereignis.waitUntil((async () => {
    const vorrat = await caches.open(VORRAT);
    // cache: 'reload' – am Browser-Zwischenspeicher vorbei, sonst kaemen
    // bis zu zehn Minuten alte Kopien von GitHub Pages in den Vorrat.
    await vorrat.addAll(
      VORLADEN.map((pfad) => new Request(pfad, {cache: 'reload'})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (ereignis) => {
  ereignis.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('taschenrechner-') &&
          name !== VORRAT && name !== FREMD) {
        await caches.delete(name);
      }
    }
    await self.clients.claim();
  })());
});

/** Pfad relativ zum Geltungsbereich (ohne Anhang) oder null. */
function relativ(adresse) {
  const bereich = self.registration.scope;
  if (!adresse.startsWith(bereich)) return null;
  return adresse.slice(bereich.length).split('?')[0].split('#')[0];
}

self.addEventListener('fetch', (ereignis) => {
  const anfrage = ereignis.request;
  if (anfrage.method !== 'GET') return;
  const adresse = new URL(anfrage.url);
  if (!adresse.protocol.startsWith('http')) return;
  const pfad = relativ(adresse.href);
  if (pfad === null) {
    ereignis.respondWith(vorratZuerst(FREMD, anfrage, anfrage));
    return;
  }
  // Die Startadresse (…/taschenrechner/) ist index.html. Andere
  // Seitenaufrufe nicht darauf umbiegen: die Web-Fassung zeigt die
  // Anleitungen als PDF in einem eingebetteten Rahmen.
  ereignis.respondWith(
      vorratZuerst(VORRAT, pfad === '' ? 'index.html' : pfad, anfrage));
});

/** Antwort aus dem Vorrat, sonst aus dem Netz (und dann ablegen). */
async function vorratZuerst(name, schluessel, anfrage) {
  const vorrat = await caches.open(name);
  const treffer = await vorrat.match(schluessel, {ignoreSearch: true});
  if (treffer) return treffer;
  const antwort = await fetch(anfrage);
  if (antwort.ok || antwort.type === 'opaque') {
    await vorrat.put(schluessel, antwort.clone());
  }
  return antwort;
}
