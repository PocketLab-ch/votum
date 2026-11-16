import { error, fail } from '@sveltejs/kit';
import { fragtNachPapier, fristKurz, vertagtMeldung } from '$lib/domain/versammlung';
import { holeBeantwortete, holePapierabgaben } from '$lib/server/papierabgabe';
import { nichtGefragte } from '$lib/domain/stimmabgabe';
import { holeTagDerVersammlung } from '$lib/server/versammlungstag';
import QRCode from 'qrcode';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import {
	WEGNAMEN,
	ZUSTANDSNAMEN,
	stimmtUeberSitzungsleitung
} from '$lib/domain/anwesenheit';
import {
	stelleBeschlussfaehigkeitFest,
} from '$lib/domain/beschlussfaehigkeit';
import { codeAusScan } from '$lib/domain/zugang';
import { zeichenzahl } from '$lib/domain/zeichenzahl';
import { jaNein, text } from '$lib/server/formular';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeAnwesenheitsregeln } from '$lib/server/reglement';
import { warVersammlungZeitweiseBeschlussfaehig } from '$lib/server/abstimmung';
import {
	eroeffneVersammlung,
	holeVersammlung,
	setzeWandbild,
	vertageVersammlung
} from '$lib/server/versammlungen';
import { datumLang } from '$lib/domain/datum';
import type { Wandbildart } from '$lib/domain/versammlung';
import {
	bestaetigeAnwesenheit,
	erfasseListe,
	erfasseVerlassenDerVersammlung,
	lasseDurchDritteEin,
	lasseEinMitVertretungen,
	holeUebersicht,
	lehneAnmeldungAb,
	loeseZugangAuf
} from '$lib/server/anwesenheit';
import { verkuendeStand } from '$lib/server/versammlungsstand';
import { keksSicher } from '$lib/server/keks';
import {
	holeGeraete,
	KARTENKEKS,
	KARTENKEKS_PFAD,
	widerrufeSitzungen
} from '$lib/server/zugangssitzung';
import { gibCodeMitBildAus } from '$lib/server/codeausgabe';
import { holeOderErzeugeSaalmerkmal } from '$lib/server/saaleinstieg';
import { holeParteien, holeVollmachten } from '$lib/server/vollmacht';
import {
	uebersicht as vollmachtsuebersicht,
	VERTRETUNGSGRUND_TEXT,
	verwaltungshakenAmEinlass,
	type Vertretungsgrund
} from '$lib/domain/vollmacht';
import {
	holeOffeneSaalmeldungen,
	lehneSaalmeldungAb,
	ordneSaalmeldungZu
} from '$lib/server/saaleinstieg';
import {
	einlassaktionen,
	papiervermerkAusFormular,
	fachlich,
	handelnder,
	mitVertretung,
	zurKontrolle,
	type Kontrollkarte
} from '$lib/server/einlassaktionen';
import type { Actions, PageServerLoad } from './$types';
import { herkunft } from '$lib/server/herkunft';


export const load: PageServerLoad = async ({ cookies, locals, params, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const [gemeinschaft, uebersicht, regeln, saalmeldungen, geraete, vollmachten, parteien] =
		await Promise.all([
			holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId),
			holeUebersicht(locals.benutzer.operatorId, params.id),
			holeAnwesenheitsregeln(locals.benutzer.operatorId, versammlung.stwegId),
			holeOffeneSaalmeldungen(locals.benutzer.operatorId, params.id),
			holeGeraete(locals.benutzer.operatorId, params.id),
			holeVollmachten(locals.benutzer.operatorId, params.id),
			holeParteien(locals.benutzer.operatorId, params.id)
		]);

	/*
	 * Wer wen vertritt, gehört in die Anwesenheitsliste.
	 *
	 * Sonst stünde dort eine Person als anwesend, die den Saal nie betreten hat
	 * — und niemand sähe der Zeile an, warum sie mitzählt.
	 *
	 * Die Vollmacht hängt an der Zeilenkennung der Momentaufnahme, die Liste an
	 * der Parteikennung; deshalb der Umweg über `holeParteien`.
	 */
	const vu = vollmachtsuebersicht(vollmachten);
	// Wer noch vertreten werden kann: nicht schon vertreten. Ein Eintrag, der zu
	// einer Absage führt, gehört nicht in die Auswahl.
	const belegt = new Map(
		vollmachten
			.filter((v) => v.zustand === 'erfasst' || v.zustand === 'bestaetigt')
			.map((v) => [v.vertreteneId, v.bevollmaechtigtName ?? ''])
	);
	// Die vorab erfasste Vollmacht an eine dritte Person (E3, 11.11.2026): Für
	// dieselbe Person gibt die Maske die Partei frei (`sperrgrundAmEinlass`),
	// für jede andere bleibt sie gesperrt. An eine Partei der Versammlung nie:
	// Die tritt selbst ein, und der Server weist den Weg über «dritte» ab.
	const vorabAnDritte = new Map(
		vollmachten
			.filter((v) => (v.zustand === 'erfasst' || v.zustand === 'bestaetigt') && !v.bevollmaechtigtId)
			.map((v) => [v.vertreteneId, v.bevollmaechtigtName ?? ''])
	);
	// Die Namen dritter Personen mit offener oder bestätigter Vollmacht und ob
	// der Name das Häkchen «Verwaltung» trägt: Damit belegt die Maske das
	// Kästchen beim Einlass desselben Namens vor (`verwaltungshakenAmEinlass`).
	// Die Kennzeichnung gilt je Name (M-4), deshalb genügt eine Zeile mit ihr.
	const drittePersonen = vollmachten
		.filter((v) => (v.zustand === 'erfasst' || v.zustand === 'bestaetigt') && !v.bevollmaechtigtId)
		.map((v) => ({ name: v.bevollmaechtigtName ?? '', istVerwaltung: v.istVerwaltung }));
	const jeParteiId = new Map(parteien.map((p) => [p.id, p.parteiId]));
	const vertretenDurch = new Map<string, string>();
	const vertritt = new Map<string, string[]>();
	for (const [snapshotId, v] of vu.wirksamJeVertretene) {
		const parteiId = jeParteiId.get(snapshotId);
		if (parteiId && v.bevollmaechtigtName) vertretenDurch.set(parteiId, v.bevollmaechtigtName);
	}
	for (const [snapshotId, liste] of vu.wirksamJeBevollmaechtigt) {
		const parteiId = jeParteiId.get(snapshotId);
		if (parteiId) vertritt.set(parteiId, liste.map((v) => v.vertreteneName));
	}
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	/*
	 * Eine Karte, die eben gescannt wurde (`/z/<CODE>` bei angemeldeter
	 * Sitzungsleitung).
	 *
	 * Der Keks wird beim Lesen weggeräumt: Die Rückfrage erscheint einmal, wie
	 * die Karte einmal gescannt wurde. Bliebe er liegen, stünde beim nächsten
	 * Aufruf der Seite dieselbe Frage wieder da — und irgendwann tippt jemand
	 * versehentlich auf «erfassen» für eine Person, die längst drin ist.
	 */
	let gescannt: Kontrollkarte | null = null;
	const kartencode = cookies.get(KARTENKEKS);
	if (kartencode) {
		cookies.delete(KARTENKEKS, { path: KARTENKEKS_PFAD, secure: keksSicher() });
		const befund = await loeseZugangAuf(locals.benutzer.operatorId, kartencode);
		if (befund.gueltig && befund.meetingId === params.id && befund.parteiId) {
			const stand = uebersicht?.staende.find((s) => s.parteiId === befund.parteiId);
			if (stand) {
				const papier = await holePapierabgaben(locals.benutzer.operatorId, params.id);
				gescannt = zurKontrolle(
					stand,
					uebersicht?.gesamtquote ?? 0,
					papier.some((x) => x.parteiId === stand.parteiId)
				);
			}
		}
	}

	// Die Feststellung läuft über dieselbe Funktion wie der Rechner aus Story 2.6
	// — nur speist sie sich jetzt aus der festgeschriebenen Anwesenheit statt aus
	// eingetippten Zahlen (AD-16).
	const beschlussfaehigkeit = uebersicht
		? stelleBeschlussfaehigkeitFest(
				versammlung.stufe,
				{
					eigentuemerGesamt: uebersicht.eigentuemerGesamt,
					eigentuemerAnwesend: uebersicht.eigentuemerAnwesend,
					kopfstimmenGesamt: uebersicht.kopfstimmenGesamt,
					kopfstimmenAnwesend: uebersicht.kopfstimmenAnwesend,
					gesamtquote: uebersicht.gesamtquote,
					quotenAnwesend: uebersicht.quotenAnwesend,
					einzigeParteiGemeinsam: uebersicht.einzigeParteiGemeinsam
				},
				regeln[versammlung.stufe] ?? null
			)
		: null;

	/*
	 * **Der Quicklink auf das eigene Telefon** (Wunsch des Auftraggebers vom 20.08.2026).
	 *
	 * Am Eingang steht die Sitzungsleitung mit dem Telefon in der Hand und will
	 * damit Karten scannen — dafür muss diese Seite dort offen sein. Die Adresse
	 * abzutippen ist im Saal die schlechteste aller Möglichkeiten; ein QR auf
	 * dem Notebook daneben kostet einen Blick.
	 *
	 * **Er trägt keinen Zugang.** Wer ihn scannt, landet auf dieser Seite und
	 * muss sich anmelden wie überall sonst — der Code ist eine Adresse, kein
	 * Schlüssel. Deshalb darf er auch auf einem Bildschirm stehen, den andere
	 * sehen.
	 */
	/*
	 * **Der Quicklink führt auf die schmale Einlass-Seite**, nicht auf diese hier
	 * (Auftraggeber, 20.08.2026: «Kann man das nicht auf einer separaten Seite machen?
	 * Also die Handy-Lösung?»).
	 *
	 * Wer den Code mit dem Telefon scannt, will scannen — nicht eine 7300 px
	 * lange Sicht mit Beamer, Wandbild und vierzehn Zeilen. Der Weg zurück steht
	 * dort am Fuss.
	 */
	let saaleinstieg: { adresse: string; svg: string } | null = null;
	if (versammlung.zustand === 'laufend') {
		const merkmal = await holeOderErzeugeSaalmerkmal(locals.benutzer.operatorId, params.id);
		const adresse = `${herkunft(url)}/e/${merkmal}`;
		saaleinstieg = {
			adresse,
			// Höhere Fehlerkorrektur: Er wird aus der Hand gescannt, oft schräg.
			svg: await QRCode.toString(adresse, { type: 'svg', errorCorrectionLevel: 'Q', margin: 1 })
		};
	}

	const quicklinkUrl = `${herkunft(url)}/versammlungen/${params.id}/einlass`;
	const quicklinkSvg = await QRCode.toString(quicklinkUrl, {
		type: 'svg',
		errorCorrectionLevel: 'M',
		margin: 1
	});

	// Einmal geholt: Die Liste braucht ihn zweimal — als Vermerk an der Zeile und
	// als Ausschluss aus der Nachtragsliste.
	const papier = await holePapierabgaben(locals.benutzer.operatorId, params.id);

	return {
		versammlung,
		/**
		 * Für den Ausklapper «Vertagen»: War die Versammlung heute schon
		 * beschlussfähig, wird die Folgeversammlung eine neue erste (C3, F4c).
		 * Nur an der laufenden ersten gebraucht.
		 */
		zeitweiseBeschlussfaehig:
			versammlung.zustand === 'laufend' && versammlung.stufe === 'erste'
				? await warVersammlungZeitweiseBeschlussfaehig(locals.benutzer.operatorId, params.id)
				: false,
		/** Ob der Einlass hier fragt, wer von Hand abstimmt (Migration 108). */
		papierfrage: fragtNachPapier(versammlung),
		/**
		 * Wer an dieser Versammlung auf Papier abstimmt.
		 *
		 * **Damit die Liste der Rückweg ist** (09.09.2026, im zweiten Code-Review
		 * gefunden). Das Fenster von fünf Sekunden fängt den Fehlgriff, die
		 * gescannte Karte den Rest — aber wer ohne Karte eingelassen wurde, hat
		 * keine zum Nachscannen. Für ihn blieb der Vermerk stehen, und der
		 * Kastentext versprach einen Weg, den es nicht gab.
		 */
		aufPapier: papier.map((x) => x.parteiId),
		/**
		 * Wer anwesend ist, ohne je gefragt worden zu sein (Migration 109).
		 *
		 * **Die Nachtragsliste.** Sie füllt sich, wenn die Frage mitten im Einlass
		 * eingeschaltet wurde — alle davor kamen ungefragt herein — und wenn die
		 * Häkchenliste ein Dutzend Namen auf einmal abgehakt hat, denn die fragt
		 * mit Absicht nicht. Sie ist leer, sobald jede anwesende Partei eine
		 * Antwort hat, und sie steht nur da, solange die Versammlung fragt.
		 */
		/*
		 * **Nur solange die Versammlung läuft** (Code-Review 10.09.2026). Danach
		 * scheitert jede Antwort am Schreibweg, und nach dem Versiegeln käme eine
		 * rohe Datenbankmeldung zurück. Eine Liste, deren Knöpfe alle absagen, ist
		 * keine Aufgabe mehr, sondern ein Vorwurf.
		 */
		nichtGefragt: versammlung.zustand === 'laufend' && fragtNachPapier(versammlung)
			? nichtGefragte(
					uebersicht?.staende ?? [],
					await holeBeantwortete(locals.benutzer.operatorId, params.id),
					papier.map((x) => x.parteiId)
				).map((s) => ({ parteiId: s.parteiId, name: s.name }))
			: [],
		gemeinschaft,
		/**
		 * Der gemeinsame Abend, wenn diese Versammlung zu einem gehört.
		 *
		 * Er entscheidet hier über eine Sache: das Wandbild. Es ist dieselbe Wand
		 * für alle Häuser des Saals und wird deshalb am Abend gewählt
		 * (`docs/vererbung-abend.md`).
		 */
		tag: await holeTagDerVersammlung(locals.benutzer.operatorId, params.id),
		quicklink: { url: quicklinkUrl, svg: quicklinkSvg },
		/*
		 * **Der Saaleinstieg zum Hinhalten** (24.08.2026). Derselbe Code wie auf der
		 * Leinwand — dort hängt er zehn Meter weiter und ist über eine Fernsitzung
		 * kaum zu scannen. Er entsteht nur, solange die Versammlung läuft: Vorher
		 * gibt es kein Merkmal, und ein nie gezeigtes wäre ein Geheimnis ohne Zweck.
		 */
		saaleinstieg,
		uebersicht: uebersicht
			? {
					...uebersicht,
					staende: uebersicht.staende.map((s) => ({
						...s,
						zustandName: ZUSTANDSNAMEN[s.zustand],
						wegName: s.weg ? WEGNAMEN[s.weg] : null,
						ueberSitzungsleitung: stimmtUeberSitzungsleitung(s.weg),
						geraet: geraete.get(s.parteiId) ?? null,
						vertretenDurch: vertretenDurch.get(s.parteiId) ?? null,
						vertritt: vertritt.get(s.parteiId) ?? []
					}))
				}
			: null,
		beschlussfaehigkeit,
		saalmeldungen,
		gescannt,
		/**
		 * Die Auswahl für den Einlass mit Vollmacht (Vorschlag des Auftraggebers vom
		 * 04.08.2026), **vollständig und mit Sperrgrund** statt gefiltert.
		 *
		 * Wer «Christen» sucht und nichts findet, weiss nicht, ob er sich vertippt
		 * hat, ob die Person fehlt oder ob sie schon da ist — und fragt dann die
		 * Sitzungsleitung, die gerade keine Zeit hat.
		 */
		vertretbare: parteien.map((p) => {
			const stand = uebersicht?.staende.find((s) => s.parteiId === p.parteiId);
			const schon = belegt.get(p.id);
			const anwesend = stand?.zustand === 'anwesend';
			return {
				id: p.id,
				parteiId: p.parteiId,
				name: p.name,
				einheiten: p.einheiten,
				anwesend,
				gesperrt: anwesend
					? 'bereits anwesend — übt selbst aus'
					: schon
						? `bereits bevollmächtigt an ${schon}`
						: null,
				vorabFuer: anwesend ? null : (vorabAnDritte.get(p.id) ?? null)
			};
		}),
		// Für das vorbelegte Häkchen «Verwaltung» beim Einlass (E3).
		drittePersonen,
		/*
		 * Die Adresse, die die Sitzungsleitung **im Saal vorliest** und die der
		 * Eigentümer auf seinem Telefon eintippt.
		 *
		 * Bis zur Abnahme am 08.08.2026 stand hier `url.host` — also die Angabe
		 * aus der Anfrage. Das ist dieselbe Fehlerklasse wie der QR-Code auf der
		 * Leinwand (Audit B-15), nur ohne Papier: Ein untergeschobenes `Host`
		 * ergäbe eine angesagte Adresse, die auf ein fremdes Haus führt. Sie war
		 * die einzige der sieben Stellen, die beim ersten Durchgang liegenblieb.
		 *
		 * Ohne gesetztes `ORIGIN` bleibt es beim bisherigen Verhalten — im
		 * Versammlungsraum ist die aufrufende Adresse die des Notebooks im WLAN
		 * und nicht die des Servers, und dort ist sie richtig.
		 */
		einstiegAdresse: `${herkunft(url).replace(/^https?:\/\//, '')}/z`,
		// Mit dem Wert dieser Gemeinschaft (Migration 122): Der Satz steht auf
		// derselben Seite wie der Terminvorschlag im Vertagen-Ausklapper, und die
		// beiden dürfen nicht verschiedene Tage nennen.
		fristhinweis: fristKurz(gemeinschaft?.zweitversammlungsfristTage)
	};
};




export const actions: Actions = {
	// Die neun Handlungen des Einlasses stehen in `$lib/server/einlassaktionen`,
	// weil die schmale Einlass-Seite fürs Telefon dieselben braucht.
	...einlassaktionen,

	/**
	 * Einlass ohne Karte — mit QR-Code, damit die Person gleich beitreten kann
	 * (31.08.2026, Block C1).
	 *
	 * Ueberschreibt das geteilte `einlassen` aus `einlassaktionen`: Wer von Hand
	 * ohne Karte eingelassen wird, bekommt den Code gleich auf den Bildschirm.
	 */
	einlassen: async ({ request, locals, params, url }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const vertritt = daten
			.getAll('vertritt')
			.map((w) => String(w))
			.filter(Boolean);
		const dateien = daten.getAll('nachweis').filter((d): d is File => d instanceof File);
		const parteiId = text(daten.get('partei'));
		const weg = text(daten.get('weg')) === 'gescannt' ? 'gescannt' as const : 'von_hand' as const;

		try {
			const e = await lasseEinMitVertretungen(handelnder(locals), params.id, parteiId, {
				vertritt,
				weg,
				nachweisVorgelegt: jaNein(daten.get('nachweisVorgelegt')),
				// Ä-28: Ohne diese Zeile nähme die Funktion den Wert zwar entgegen,
				// bekäme ihn aber nie — und eine gesetzliche Vertretung liefe am
				// Einlasstisch in die Sperre der Höchstzahl.
				vertretungsgrund: (text(daten.get('vertretungsgrund')) as Vertretungsgrund) || null,
				dateien
			});
			/*
			 * **Derselbe Helfer wie im geteilten `einlassen`.** Diese Handlung
			 * überschreibt jenes; wer den Papiervermerk nur dort einbaute, hätte
			 * einen Eingang, der fragt, und einen, der die Antwort verliert.
			 */
			const p = await papiervermerkAusFormular(locals, params.id, e.parteiId, daten);
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			const zusatz =
				e.vollmachten.length > 0
					? ` Mit Vollmacht für ${e.vollmachten.join(', ')} — bestätigt und wirksam.`
					: '';
			const bestaetigt = `${e.name} ist als anwesend erfasst.${zusatz}${mitVertretung(e)}${p.satz}`;

			/*
			 * **Wer von Hand abstimmt, bekommt keinen Code aufgedrängt**
			 * (09.09.2026, im Durchstich gefunden).
			 *
			 * Der Einlass ohne Karte legt sonst gleich einen Zugangscode samt Bild
			 * auf den Bildschirm — sinnvoll, wenn die Person am Telefon abstimmt.
			 * Bei einer Papierpartei ist er zweierlei zu viel: Ihr Gerät zeigt
			 * ohnehin keine Schaltflächen, und der Kasten ist ein Fenster über der
			 * ganzen Seite. Es deckte den Rückweg «Zurück (5)» genau die fünf
			 * Sekunden lang zu, in denen er hilft — gemessen im Durchstich, der
			 * Knopf war sichtbar und unerreichbar.
			 *
			 * Gebraucht wird der Code deshalb nicht, verwehrt ist er aber auch
			 * nicht: In der Liste steht je Partei «Code ausgeben» (`?/codeAusgeben`).
			 * Wer ihn doch will, holt ihn dort.
			 */
			if (weg === 'von_hand' && !p.papier) {
				return {
					bestaetigt,
					papier: p.papier,
					ausgabe: await gibCodeMitBildAus(
						handelnder(locals),
						params.id,
						parteiId,
						herkunft(url)
					)
				};
			}

			/*
			 * **Der Satz nur dort, wo wirklich einer entfiel** (09.09.2026, im
			 * Code-Review gefunden). Auf dem gescannten Weg gibt es nie einen Code
			 * auszugeben — die Person hält ihre Karte in der Hand. «Kein
			 * Zugangscode ausgegeben» hätte dort eine Ausnahme gemeldet, die es
			 * nicht gibt.
			 */
			return {
				bestaetigt:
					weg === 'von_hand' && p.papier
						? `${bestaetigt} Kein Zugangscode ausgegeben — für die Papierabgabe wird keiner gebraucht. In der Liste steht «Code ausgeben», falls doch.`
						: bestaetigt,
				papier: p.papier
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Wechselt das Bild an der Wand (Migration 035).
	 *
	 * Kein `verkuendeStand` mit Wortlaut: Der Strom trägt nur die Marke, die
	 * Saalsicht holt den Text selbst nach (AD-11).
	 */
	wandbild: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		/*
		 * **Auch hier** (25.08.2026): Das Wandbild steht an zwei Stellen — am
		 * Eingang und in der Sitzungsleitung —, und es ist dieselbe Wand. Nur
		 * die Leitung zu sperren hiesse, den zweiten Weg offen zu lassen; die
		 * Häuser liefen dann über den Eingang auseinander. Beide Enden jedes
		 * Wegs prüfen.
		 */
		const abend = await holeTagDerVersammlung(locals.benutzer.operatorId, params.id);
		if (abend) {
			return fail(400, {
				fehler: {
					nachricht:
						`Die Wand gehört zum gemeinsamen Abend «${abend.bezeichnung}» — dort steht das ` +
						'Wandbild für alle Gemeinschaften zugleich.'
				}
			});
		}
		try {
			await setzeWandbild(
				handelnder(locals),
				params.id,
				text(daten.get('art')) as Wandbildart,
				text(daten.get('text')) || null
			);
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return { hinweis: 'Wandbild gewechselt.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Eine dritte Person übt eine Vollmacht aus (FR-23, FR-24).
	 *
	 * Sie ist keine Partei und «trifft» deshalb nicht ein — anwesend wird die
	 * vertretene Partei, mit dem Weg `vertretung` und dem Namen der Person in der
	 * Bemerkung.
	 */
	dritte: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const e = await lasseDurchDritteEin(handelnder(locals), params.id, {
				bevollmaechtigtName: text(daten.get('bevollmaechtigtName')),
				vertritt: daten
					.getAll('vertritt')
					.map((w) => String(w))
					.filter(Boolean),
				nachweisVorgelegt: jaNein(daten.get('nachweisVorgelegt')),
				// Ä-28, siehe oben.
				vertretungsgrund: (text(daten.get('vertretungsgrund')) as Vertretungsgrund) || null,
				// L8 (Migration 184), M3: das Häkchen «Bevollmächtigt ist die
				// Verwaltung», wie die Vollmacht der Leitung. Gesetzt, entfernt
				// oder «nicht angegeben» nach `verwaltungshakenAmEinlass`: Entfernt
				// wird nur, was die Maske vorbelegt hatte (E3, 11.11.2026; davor
				// Codeprüfung Lauf 5, B1).
				istVerwaltung: verwaltungshakenAmEinlass(
					text(daten.get('istVerwaltung')),
					text(daten.get('istVerwaltungVorher'))
				),
				dateien: daten.getAll('nachweis').filter((d): d is File => d instanceof File)
			});
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return {
				bestaetigt:
					`${e.bevollmaechtigtName} vertritt ${e.eingelassen.join(', ')} — als anwesend erfasst. ` +
					'Die Stimmen erfassen Sie, oder Sie geben der Person einen Ausgabecode.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},


	/**
	 * Vertagen und die Folgeversammlung ansetzen: die zweite (ZGB Art. 712p
	 * Abs. 2) oder eine neue erste (C3, F4c).
	 *
	 * Steht hier und nicht auf der Leitungsseite: Vertagt wird, weil der Saal zu
	 * leer ist — und das sieht man an der Anwesenheit, direkt unter dem Satz zur
	 * Zehntagesfrist.
	 */
	vertagen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const e = await vertageVersammlung(handelnder(locals), params.id, {
				grund: text(daten.get('grund'))
			});
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return { hinweis: vertagtMeldung(e.folge, e.folgestufe, datumLang(e.folge.datum)) };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Eine Partei verlässt die Versammlung — **mit Begründung** (Befund
	 * Praxisdurchlauf 03.10.2026, Punkt 8).
	 *
	 * Die Begründung ist hier Pflicht und nicht im Serverbaustein: Der Einlass
	 * am gemeinsamen Abend geht denselben Weg, und dort wird sie noch nicht
	 * gefragt. Ohne diese Prüfung wäre das Pflichtfeld der Maske eine Bitte —
	 * ein von Hand gebauter POST käme ohne Grund durch. Was die Leitung
	 * einträgt, muss im Nachweis stehen.
	 */
	verlassen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const begruendung = text(daten.get('begruendung')).trim();
			// `zeichenzahl` und nicht `.length`: JavaScript zählt UTF-16-Einheiten,
			// die Datenbank Zeichen (siehe `domain/zeichenzahl`).
			if (zeichenzahl(begruendung) < 3) {
				throw new FachlicherFehler(
					'ohne_begruendung',
					'Bitte begründen Sie das Verlassen mit mindestens drei Zeichen.',
					'begruendung'
				);
			}
			const e = await erfasseVerlassenDerVersammlung(
				handelnder(locals),
				params.id,
				text(daten.get('partei')),
				begruendung
			);
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return {
				hinweis:
					`${e.name} hat die Versammlung verlassen.` +
					(e.mitgenommen.length > 0
						? ` Damit gelten auch die Vertretenen als abwesend: ${e.mitgenommen.join(', ')}. ` +
							'Die Vollmacht bleibt bestehen — kommt die Person zurück, ziehen sie wieder nach.'
						: '')
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/** Die Häkchenliste der einfachen Betriebsart, in einem Durchgang. */
	liste: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const gewaehlt = daten.getAll('partei').map(String).filter(Boolean);
		try {
			const e = await erfasseListe(handelnder(locals), params.id, gewaehlt);
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return {
				bestaetigt:
					`${e.erfasst} ${e.erfasst === 1 ? 'Partei' : 'Parteien'} erfasst` +
					(e.schonAnwesend > 0 ? `, ${e.schonAnwesend} waren es bereits` : '') +
					'.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Einen kurzen Code für den Saal ausgeben (Ausnahmefall).
	 *
	 * Der Regelfall ist die Karte. Dies ist für alle, bei denen sie nicht
	 * funktioniert: vergessen, Kamera zu alt, Papier zerknittert. Der Code
	 * erscheint **einmal** auf dem Bildschirm der Sitzungsleitung, wird
	 * vorgelesen oder aufgeschrieben, und gilt wenige Minuten.
	 */
	codeAusgeben: async ({ request, locals, params, url }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			return {
				ausgabe: await gibCodeMitBildAus(
					handelnder(locals),
					params.id,
					text(daten.get('partei')),
					herkunft(url)
				)
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Den Zugang einer Partei wieder freigeben.
	 *
	 * Zwei Anlässe, derselbe Griff: Das Telefon des Eigentümers ist leer oder der
	 * Browser weg — dann kommt er an seine eigene Sitzung nicht mehr heran und
	 * braucht diesen Weg. Oder ein vorgelesener Code ist beim Falschen gelandet.
	 * Weil nur ein Gerät angemeldet sein kann, ist das der einzige Weg von aussen
	 * und deshalb ausdrücklich einer, den ein Mensch geht.
	 */
	geraeteWiderrufen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const anzahl = await widerrufeSitzungen(
				handelnder(locals),
				params.id,
				text(daten.get('partei'))
			);
			return {
				hinweis:
					anzahl === 0
						? 'Es war kein Gerät angemeldet. Ein offener Ausgabecode wurde zurückgenommen.'
						: 'Der Zugang ist wieder frei. Die Karte bleibt gültig — der Eigentümer ' +
							'kann sich damit neu anmelden.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Von hier aus eröffnen (Nachtrag 02.08.2026).
	 *
	 * Wer am Eingang steht, steht im Schritt «Anwesenheit» — und dort fällt der
	 * Entscheid, wann eröffnet wird. Der Knopf lag bisher nur auf der
	 * Versammlungsseite, also einen Seitenwechsel entfernt.
	 *
	 * Der Anzeigecode für den Beamer entsteht dabei; er steht danach auf der
	 * Versammlungsseite, und die Präsentationssicht braucht ihn nur, wenn sie an
	 * einem fremden Gerät läuft.
	 */
	eroeffnen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			/*
			 * **Zu früh eröffnen braucht eine Bestätigung** (Praxisdurchlauf
			 * 28.08.2026). Vor dem Versammlungsdatum zu eröffnen ist ein
			 * Ausnahmefall, kein Versehen — wer auf den Knopf drückt, soll die
			 * Frage vor sich sehen, nicht den vollzogenen Stand. Zwei Stufen wie
			 * beim Löschen der Versammlung: der erste Klick bringt die Frage,
			 * der zweite trägt `bestaetigt=ja`.
			 */
			if (text(daten.get('bestaetigt')) !== 'ja') {
				const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
				const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
				if (versammlung && versammlung.datum > heute) {
					return fail(400, {
						eroeffnungsfrage:
							`Die Versammlung ist für den ${datumLang(versammlung.datum)} angesetzt — heute ist der ` +
							`${datumLang(heute)}. Vor dem angesetzten Datum zu eröffnen ist ein Ausnahmefall. ` +
							'Jetzt trotzdem eröffnen?'
					});
				}
			}
			await eroeffneVersammlung(handelnder(locals), params.id);
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return { hinweis: 'Die Versammlung ist eröffnet. Ab jetzt zählt die Anwesenheit.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	}
};
