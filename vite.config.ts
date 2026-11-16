import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

/**
 * Die SvelteKit-Konfiguration liegt seit Fassung 2.6x hier und nicht mehr in
 * svelte.config.js — Angaben dort werden stillschweigend ignoriert.
 *
 * adapter-node, nicht adapter-auto: Das Werkzeug läuft als ein Prozess neben
 * PostgreSQL (AD-13) und muss auf einem Notebook im Versammlungsraum genauso
 * starten wie auf dem Server (AD-18).
 */
/**
 * Unter welchen Namen der Entwicklungsserver antwortet.
 *
 * **Der Anlass (20.08.2026).** Hinter dem Reverse-Proxy antwortete jede Anfrage
 * mit `403` und `text/plain` — nicht von der Anwendung, sondern von Vite selbst:
 * Seit Fassung 6 weist der Entwicklungsserver jeden `Host` ab, den er nicht
 * kennt. Das ist richtig so (sonst liesse sich der offene Entwicklungsserver
 * über einen fremden Namen ansprechen), aber es sieht aus wie ein Fehler des
 * Proxys, und dort sucht man dann.
 *
 * **Nur der Entwicklungsserver.** Im Betrieb läuft `adapter-node`, der diese
 * Prüfung nicht kennt; dort wacht `ORIGIN` (siehe `docker-compose.yml`).
 *
 * Die Namen kommen über `VITE_ERLAUBTE_NAMEN`, durch Komma getrennt. Welcher
 * Name den Dev-Stapel hinter dem Proxy erreicht, ist eine Belegung des Hosts
 * und steht in der Betriebsdoku, nicht hier. Ohne die Variable lässt der
 * Entwicklungsserver nur `localhost` und Adressen zu, wie Vite es vorgibt.
 */
const ERLAUBTE_NAMEN = (process.env.VITE_ERLAUBTE_NAMEN ?? '')
	.split(',')
	.map((n) => n.trim())
	.filter(Boolean);

export default defineConfig({
	server: { allowedHosts: ERLAUBTE_NAMEN },
	plugins: [
		sveltekit({
			compilerOptions: {
				runes: ({ filename }: { filename: string }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			/**
			 * Inhaltssicherheitsregel (Audit B-12, 08.08.2026).
			 *
			 * **Von SvelteKit erzeugt und nicht von Hand geschrieben.** Die
			 * Anwendung liefert eigene Skripte in der Seite aus — die
			 * Erstanstrich-Umschaltung auf dunkel in `app.html` und SvelteKits
			 * eigene Startzeile. Eine handgeschriebene Regel müsste dafür
			 * `unsafe-inline` erlauben, und damit wäre sie kein Schutz mehr,
			 * sondern eine Kopfzeile, die wie einer aussieht. `mode: 'auto'` gibt
			 * jedem dieser Skripte eine Einmalkennung.
			 *
			 * **Das Netz für die eine Stelle, die es gibt.** Es hiess hier zuerst
			 * «ohne `{@html}`» — das war falsch (Abnahme 08.08.2026):
			 * `praesentation/+page.svelte` setzt den QR-Code der Leinwand als
			 * `{@html}`. Nachgemessen ist er harmlos, weil der Erzeuger nur `<svg>`
			 * und `<path>` ausgibt und den Text nie ins Markup schreibt — aber
			 * gespeist wird er aus einer Adresse, die ohne gesetztes `ORIGIN` aus
			 * der Anfrage stammt. Genau für diesen Fall ist `script-src 'self'` da.
			 */
			csp: {
				mode: 'auto',
				directives: {
					// Der Klickfänger ist hier der eigentliche Punkt: Ohne diese
					// Zeile liesse sich die Sitzungsleitung in einen fremden Rahmen
					// setzen, und ein untergeschobener Klick träfe Knöpfe wie
					// «Abstimmung schliessen» oder «Versiegeln».
					'frame-ancestors': ['none'],
					'default-src': ['self'],
					'script-src': ['self'],
					/*
					 * `unsafe-inline` bleibt hier bewusst stehen: Die Seite trägt
					 * Stilangaben unmittelbar am Element (`style="display: contents"`
					 * in `app.html`, dazu berechnete Balkenbreiten in der
					 * Auswertung). Für die kann es keine Einmalkennung geben — die
					 * gilt nur für `<style>`-Blöcke. Das ist der übliche Preis und
					 * kostet wenig: Ein eingeschleuster Stil kann keinen Code
					 * ausführen, und `script-src` bleibt eng.
					 */
					'style-src': ['self', 'unsafe-inline'],
					/*
					 * Ohne `data:`. Die erste Fassung liess es zu «für die QR-Codes,
					 * die als eingebettetes Bild entstehen» — die entstehen aber als
					 * `<svg>` in der Seite und im PDF gezeichnet, nicht als Datenadresse
					 * (Abnahme 08.08.2026). Eine Erlaubnis, die niemand braucht, ist
					 * keine Bequemlichkeit, sondern eine offene Tür mit falscher
					 * Aufschrift.
					 */
					'img-src': ['self'],
					'font-src': ['self'],
					// Die KI-Anbieter werden **serverseitig** gefragt; aus dem
					// Browser geht nichts nach draussen.
					'connect-src': ['self'],
					'form-action': ['self'],
					'base-uri': ['self'],
					'object-src': ['none']
				}
			}
		})
	]
});
