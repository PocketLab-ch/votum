import { error } from '@sveltejs/kit';
import { listeGemeinschaften } from '$lib/server/gemeinschaften';
import { holeEinheiten, pruefeGemeinschaftSalden } from '$lib/server/einheiten';
import { STAMMQUOTE } from '$lib/domain/einheiten';
import { stimmkraftAnsicht } from '$lib/server/eigentuemer';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeAnwesenheitsregeln, holeReglementsregeln } from '$lib/server/reglement';
import { holeVersammlungen } from '$lib/server/versammlungen';
import type { PageServerLoad } from './$types';

/**
 * Der Überblick über eine Gemeinschaft (Story 6.7).
 *
 * An dieser Stelle stand bisher das Bearbeitungsformular. Es ist nach
 * `/angaben` gewandert; hier steht jetzt, was die Gemeinschaft ausmacht.
 *
 * Alles Angezeigte ist abgeleitet, nichts gespeichert: Eine zusätzlich abgelegte
 * Kennzahl wäre eine zweite Wahrheit, die eines Tages von der ersten abweicht.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, params.id);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	// Schweizer Zeitzone, weil sich «heute» nach dem Saal richtet und nicht nach
	// der Uhr des Servers.
	const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });

	const [einheiten, stimmkraft, salden, versammlungen] = await Promise.all([
		holeEinheiten(locals.benutzer.operatorId, params.id),
		stimmkraftAnsicht(locals.benutzer.operatorId, params.id, heute),
		pruefeGemeinschaftSalden(locals.benutzer.operatorId, params.id),
		holeVersammlungen(locals.benutzer.operatorId, params.id, 'aktiv')
	]);

	/*
	 * **Die Häuser darunter, mit Namen und Stand** (23.08.2026, A-01). Vorher
	 * reiste nur ihre Anzahl mit, und die Seite konnte deshalb nur sagen, dass
	 * es sie gibt — nicht, welche und wie weit sie sind. Wer eine Gruppe öffnet,
	 * will genau das wissen; sonst muss er über die Gemeinschaftenliste zurück.
	 *
	 * Der Stand je Haus wird einzeln erhoben, nicht summiert: Eine Gruppe rechnet
	 * nicht über ihre Häuser (siehe unten), aber sie darf zeigen, ob eines von
	 * ihnen klafft.
	 */
	/*
	 * **Auch die archivierten Häuser.** Sie tragen weiter ihren Anteil am Nenner
	 * der übergeordneten Gemeinschaft; wer sie hier weglässt, zeigt eine
	 * Quotensumme, die nicht aufgeht, und lässt den Grund dafür verschwinden.
	 * Die Zeile ist als archiviert gekennzeichnet.
	 */
	const alle = await listeGemeinschaften(locals.benutzer.operatorId, 'alle');
	const kinder = await Promise.all(
		alle
			.filter((x) => x.parentStwegId === params.id)
			.map(async (k) => {
				const [eigene, stand] = await Promise.all([
					holeEinheiten(locals.benutzer!.operatorId, k.id),
					pruefeGemeinschaftSalden(locals.benutzer!.operatorId, k.id)
				]);
				return {
					id: k.id,
					name: k.name,
					einheiten: eigene.length,
					quotenGehenAuf: stand.stammquotenStimmig,
					// Der Stand der **Gruppe**: Ein Haus liegt auch dann im Archiv,
					// wenn nicht es selbst, sondern seine Klammer archiviert wurde.
					archiviertAm: k.imArchivSeit
				};
			})
	);

	const laufende = versammlungen.find((v) => v.zustand === 'laufend') ?? null;
	// Die nächste ist die früheste noch bevorstehende. `holeVersammlungen` gibt
	// die neuesten zuerst, deshalb von hinten.
	const anstehende =
		versammlungen
			.filter((v) => (v.zustand === 'entwurf' || v.zustand === 'freigegeben') && v.datum >= heute)
			.at(-1) ?? null;

	return {
		gemeinschaft,
		kennzahlen: {
			einheiten: einheiten.length,
			eigentuemer: stimmkraft.zeilen.length,
			kopfstimmen: stimmkraft.summeKopfstimmen,
			/*
			 * **Zwei Zahlen, die verwechselt wurden** (23.08.2026, Prüflauf II,
			 * A-37). Die Kachel zeigte die Summe der ZUGEORDNETEN Wertquoten und
			 * hiess «Wertquoten» — dieselbe Beschriftung wie auf der Einheitenseite,
			 * wo die ERFASSTEN stehen. Solange kein Eigentümer zugeordnet war, sagte
			 * die eine Seite «0 von 1000, geht nicht auf» und die andere im selben
			 * Augenblick «990 von 1000». Beide hatten recht, keine sagte, wovon sie
			 * spricht.
			 *
			 * Jetzt reisen beide mit, und die Kachel nennt die Zuordnung nur, wenn
			 * sie von der Erfassung abweicht.
			 */
			wertquote: stimmkraft.summeWertquote,
			wertquoteErfasst: einheiten.reduce((summe, e) => summe + (e.quotas[STAMMQUOTE] ?? 0), 0),
			nenner: gemeinschaft.quotaDenominator
		},
		quotenGehenAuf: salden.stammquotenStimmig,
		/*
		 * **Was für diese Gemeinschaft gilt, an einer Stelle** (23.08.2026,
		 * Prüflauf I, A-11). Die Zählweise stand hier, der Stichentscheid auch —
		 * die Vollmachtsgrenze, die Beschlussfähigkeitsregel und die Zahl der
		 * hinterlegten Quorenabweichungen aber auf drei weiteren Seiten. «Heute
		 * muss ich vier Seiten einzeln aufsuchen, um zu wissen, was ich vor elf
		 * Minuten selbst eingestellt habe.»
		 *
		 * Nur die Zahlen, nicht die Regeln selbst: Die Karte sagt, dass es sie
		 * gibt und wo sie stehen. Was sie im Einzelnen bestimmen, gehört auf ihre
		 * eigene Seite.
		 */
		regelwerk: {
			quorenabweichungen: (await holeReglementsregeln(locals.benutzer.operatorId, params.id))
				.length,
			// Je Versammlungsstufe höchstens eine Regel — gezählt wird, für wie viele
			// Stufen etwas hinterlegt ist (erste, zweite).
			anwesenheitsregeln: Object.keys(
				await holeAnwesenheitsregeln(locals.benutzer.operatorId, params.id)
			).length
		},
		/**
		 * Wie viele Gemeinschaften unter dieser hängen (23.08.2026, Prüflauf II).
		 *
		 * Eine Gemeinschaft mit Untergemeinschaften, aber **ohne eigene
		 * Einheiten**, sieht in allen Zahlen aus wie eine leere: 0 Einheiten, 0
		 * Kopfstimmen, 0 Wertquoten. Im Prüflauf hielt der Verwalter das für einen
		 * Rechenfehler — die Anwendung summiere die dreissig Einheiten der beiden
		 * Häuser nicht.
		 *
		 * **Sie summiert bewusst nicht.** Eine Miteigentümergemeinschaft über zwei
		 * Stockwerkeigentumsgemeinschaften hat ihre EIGENEN Anteile: Die Häuser
		 * sind ihre Miteigentümer, mit je einem Anteil an Umgebung, Zufahrt und
		 * Tiefgarage. Die Summe aller Wohnungen wäre etwas ganz anderes und
		 * ergäbe eine Stimmkraft, die es rechtlich nicht gibt.
		 *
		 * Nur gesagt hat das niemand. Der Hinweis auf der Seite holt das nach.
		 *
		 * **Nachtrag 23.08.2026:** Der Hinweis nannte einen Weg — «erfassen Sie
		 * eigene Anteile» — und verschwieg den zweiten, den das Werkzeug selbst
		 * anbietet: Ein gemeinsamer Abend über `/versammlungen/neu` klammert je
		 * eine Versammlung pro Haus. Dafür braucht die Gruppe gar keine eigenen
		 * Einheiten. Und statt einer blossen Zahl reisen die Häuser jetzt mit
		 * Namen und Stand, damit die Seite zeigt, dass es sie gibt.
		 */
		untergemeinschaften: kinder,
		einheitenOhneEigentuemer: stimmkraft.einheitenOhneEigentuemer,
		laufende,
		anstehende,
		anzahlVersammlungen: versammlungen.length
	};
};
