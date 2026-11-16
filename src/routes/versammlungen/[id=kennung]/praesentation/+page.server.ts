import { abgeschlossen } from '$lib/domain/versammlung';
import { error } from '@sveltejs/kit';
import QRCode from 'qrcode';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeVersammlung } from '$lib/server/versammlungen';
import { abschlussbild, holeAuswertung } from '$lib/server/auswertung';
import { holeTraktanden } from '$lib/server/traktanden';
import { holeOderErzeugeSaalmerkmal } from '$lib/server/saaleinstieg';
import { ermittleStand } from '$lib/server/versammlungsstand';
import { stelltBeschlussfaehigkeitFest } from '$lib/domain/traktandenvorlage';
import { bezeichnungMitBasis } from '$lib/domain/entscheidbaum';
import { mehrheitGesetzt } from '$lib/domain/auszaehlung';
import { holeRegelwerkFuerAnzeige } from '$lib/rules';
import { holeDurchgaenge } from '$lib/server/abstimmung';
import { ersetzungslage } from '$lib/server/auswertung';
import { ersetzungInKuerze } from '$lib/domain/folgeantragsersetzung';
import type { PageServerLoad } from './$types';
import { herkunft } from '$lib/server/herkunft';

/**
 * Die Sicht für den Beamer (Story 4.4, FR-35, AD-11).
 *
 * Sie zeigt Zahlen und Traktanden, nie Namen. Was hier steht, sehen alle im
 * Saal — und ein Anwesenheitsstand mit Namen wäre eine Anwesenheitsliste an der
 * Wand.
 *
 * Der QR-Code für den Einstieg entsteht hier als SVG und wird eingebettet: Der
 * Beamer soll nicht erst eine zweite Anfrage stellen müssen, und im lokalen
 * Betrieb ohne Netz gibt es keinen Dienst, der ihn liefern könnte.
 */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const [gemeinschaft, traktanden, stand] = await Promise.all([
		holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId),
		holeTraktanden(locals.benutzer.operatorId, params.id),
		ermittleStand(locals.benutzer.operatorId, params.id)
	]);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	// Das Saalmerkmal entsteht erst, wenn die Präsentationssicht geöffnet wird —
	// vorher braucht es keines, und ein nie gezeigtes Merkmal wäre ein Geheimnis
	// ohne Zweck.
	let einstiegUrl: string | null = null;
	let einstiegSvg: string | null = null;
	if (versammlung.zustand === 'laufend') {
		const merkmal = await holeOderErzeugeSaalmerkmal(locals.benutzer.operatorId, params.id);
		einstiegUrl = `${herkunft(url)}/e/${merkmal}`;
		einstiegSvg = await QRCode.toString(einstiegUrl, {
			type: 'svg',
			errorCorrectionLevel: 'M',
			margin: 1
		});
	}

	const aktuelles = traktanden.find((t) => t.knoten.id === versammlung.aktuellesTraktandumId);

	/*
	 * **Die Wand nennt die Ersetzung am Grundantrag** (Produktentscheid
	 * 08.10.2026, `docs/freigabe.md`, «Offen: Folgeantrag nach Rückkommen, aus
	 * dem Durchstich», Punkt 1). Bis dahin zeigte sie dort weder Ergebnis noch
	 * Satz; an der Leitung steht derselbe Satz aus `ersetzungInKuerze` in der
	 * Auskunft. Nur die Rolle Grundantrag: Am Folgeantrag erklärt ihn sein
	 * eigenes Ergebnis. Vorrang im Saalbild hat ohnehin, was die Abstimmung
	 * zeigt; der Satz gehört zur Traktandumsicht.
	 */
	const ersetzungAmAufgerufenen = aktuelles
		? await ersetzungslage(
				locals.benutzer.operatorId,
				params.id,
				aktuelles.knoten.id,
				await holeDurchgaenge(locals.benutzer.operatorId, params.id),
				traktanden
			)
		: null;
	const ersetzungssatz =
		ersetzungAmAufgerufenen?.rolle === 'grundantrag'
			? ersetzungInKuerze(ersetzungAmAufgerufenen)
			: null;

	/*
	 * **Beide Leinwände zeigen dasselbe.** Das eigene Beamerfenster und `/p` mit
	 * dem Anzeigecode teilen sich `Saalbild` — und seit dem 02.08.2026 auch die
	 * Daten dafür. Der Abschluss (21.08.2026) macht da keine Ausnahme: Wer ihn
	 * nur auf einer Sicht baute, hätte am Ende des Abends zwei verschiedene
	 * Wände.
	 */
	/*
	 * **Auch versiegelt** (04.09.2026): Hier stand `=== 'geschlossen'`, und mit
	 * dem Versiegeln verschwand die Liste der Beschlüsse von der Wand.
	 */
	const auswertung = abgeschlossen(versammlung.zustand)
		? await holeAuswertung(locals.benutzer.operatorId, params.id)
		: null;

	return {
		versammlung,
		gemeinschaftName: gemeinschaft.name,
		stand,
		/*
		 * **Die Beschlussfähigkeit füllt die Wand, wenn sie der Punkt ist**
		 * (28.08.2026, wie am gemeinsamen Abend).
		 */
		beschlussfaehigkeitImVordergrund: aktuelles
			? stelltBeschlussfaehigkeitFest(aktuelles.knoten.titel)
			: false,
		/*
		 * **Dieselbe Zählung wie auf `/p`** (Nachzug Block 2b): Beide Leinwände
		 * bauen ihr Abschlussbild aus `abschlussbild` (`server/auswertung.ts`).
		 * Zwei Abschriften liefen beim nächsten Umbau auseinander, und dann zeigte
		 * die eine Leinwand andere Zahlen als die andere.
		 */
		abschluss: auswertung ? abschlussbild(auswertung) : null,
		einstiegUrl,
		einstiegSvg,
		traktanden: traktanden.map((t) => ({
			id: t.knoten.id,
			nummer: t.nummer,
			titel: t.knoten.titel,
			tiefe: t.tiefe,
			art: t.knoten.art
		})),
		aktuelles: aktuelles
			? {
					nummer: aktuelles.nummer,
					titel: aktuelles.knoten.titel,
					kurzfassung: aktuelles.knoten.kurzfassung ?? null,
					antragswortlaut: aktuelles.knoten.antragswortlaut ?? null,
					ersetzung: ersetzungssatz,
					erfordernis: aktuelles.knoten.erfordernis
						? {
								// Beim von Hand gesetzten Mehr ist der gespeicherte
								// Titel nur der Kurztyp («Einfaches Mehr») und stünde
								// neben der Marke mit Bezugsgrösse doppelt
								// (Codeprüfung 09.10.2026); dann trägt allein die
								// Marke.
								titel: mehrheitGesetzt(aktuelles.knoten.erfordernis)
									? null
									: aktuelles.knoten.erfordernis.titel,
								rechtsgrundlage: aktuelles.knoten.erfordernis.rechtsgrundlage,
								// Der Quorumstyp für die Marke an der Wand (Praxisfund
								// 03.10.2026), aus der Fassung des Erfordernisses — mit
								// der Bezugsgrösse (Produktentscheid 08.10.2026).
								bezeichnung: bezeichnungMitBasis(
									holeRegelwerkFuerAnzeige(aktuelles.knoten.erfordernis.fassung),
									aktuelles.knoten.erfordernis
								)
							}
						: null
				}
			: null
	};
};
