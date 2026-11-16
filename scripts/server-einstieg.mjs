/**
 * Der Einstieg des gebauten Stands.
 *
 * **Warum diese Datei existiert** (GP-V-3, Pentest nach dem Go-Public,
 * 12.11.2026). adapter-node liefert die statischen Dateien aus `build/client`
 * mit sirv aus, **bevor** SvelteKits `handle`-Haken läuft. Die drei
 * Sicherheitsköpfe aus `src/lib/server/sicherheitskopfzeilen.ts` fehlen deshalb auf `/robots.txt`,
 * `/handbuch/…` und `/_app/immutable/…`. Ein Proxy davor setzt sie nicht zwingend, und der
 * Betrieb auf dem Notebook im Versammlungsraum hat gar keinen Proxy (AD-9,
 * AD-18). Dort wäre sonst nichts davon da.
 *
 * **Warum am HTTP-Server und nicht im Adapter oder in einer Route.** Eine Route
 * erreicht `/_app/immutable/…` nicht, weil der Adapter diese Dateien vor der
 * Anwendung ausliefert. Der Server sieht jede Antwort, statisch wie gerendert,
 * und die drei Köpfe sind für beide richtig. CSP und HSTS bleiben, wo sie
 * hingehören: Die Nonce-CSP gilt nur für gerenderte Antworten, und HSTS setzt
 * der Haken nur über TLS; die drei Köpfe hier gelten für jede Antwort, auch für
 * die statischen Dateien. `permissions-policy` bleibt ebenfalls beim Haken: Auf
 * einer statischen Datei gibt es keine Kamera und kein Mikrofon zu erlauben.
 *
 * **Warum eine Vorlage und kein eigener Einstieg neben `build/`.** `node build`
 * bleibt der Startbefehl in Dockerfile, Doku und Durchstichen.
 * `scripts/nachbau-einstieg.mjs` legt diese Datei nach dem Bau als
 * `build/index.js` ab und verschiebt den adapter-eigenen Einstieg nach
 * `build/adapter.js`; von dort kommt `server` samt Port, Socket-Aktivierung und
 * geordnetem Beenden.
 */
import { server } from './adapter.js';

server.server.prependListener('request', (req, res) => {
	res.setHeader('x-frame-options', 'DENY');
	res.setHeader('x-content-type-options', 'nosniff');
	res.setHeader('referrer-policy', 'same-origin');
});

export * from './adapter.js';
