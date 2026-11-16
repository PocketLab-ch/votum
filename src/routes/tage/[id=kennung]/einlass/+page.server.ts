import { error, fail } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { text } from '$lib/server/formular';
import { ZUSTANDSNAMEN } from '$lib/domain/anwesenheit';
import { holePersonen } from '$lib/server/personen';
import {
	bestaetigeAnwesenheit,
	erfasseVerlassenDerVersammlung,
	holeUebersicht,
	loeseZugangAuf
} from '$lib/server/anwesenheit';
import { holeGeraete, widerrufeSitzungen } from '$lib/server/zugangssitzung';
import { kurznamen } from '$lib/domain/kurzname';
import { laengsteZweitfrist } from '$lib/server/reglement';
import {
	holeOffeneSaalmeldungen,
	lehneSaalmeldungAb,
	ordneSaalmeldungZu
} from '$lib/server/saaleinstieg';
import { lehneAnmeldungAb, erfasseListe } from '$lib/server/anwesenheit';
import { holeVersammlung, setzeWandbild } from '$lib/server/versammlungen';
import { fragtNachPapier, fristAmAbend } from '$lib/domain/versammlung';
import type { Wandbildart } from '$lib/domain/versammlung';
import QRCode from 'qrcode';
import { gibCodeMitBildAus } from '$lib/server/codeausgabe';
import { papiervermerkAusFormular } from '$lib/server/einlassaktionen';
import {
	hebePapierabgabeAuf,
	holeBeantwortete,
	holePapierabgaben,
	vermerkePapierabgabe
} from '$lib/server/papierabgabe';
import { nichtGefragte } from '$lib/domain/stimmabgabe';
import { holeOderErzeugeAbendmerkmal } from '$lib/server/saaleinstieg';
import { herkunft } from '$lib/server/herkunft';
import { verkuendeStand } from '$lib/server/versammlungsstand';
import { codeAusScan, gruppiere } from '$lib/domain/zugang';

import {
	eroeffneAmAbend,
	hausDesAbends,
	hausbefundssatz,
	holeTafel,
	lasseEin
} from '$lib/server/versammlungstag';
import type { Actions, PageServerLoad } from './$types';

/**
 * Ein Einlass für die ganze gemeinsame Versammlung (Story 7.6).
 *
 * Wer im Haus 4 wohnt und zwei Parkplätze hat, ist an zwei Versammlungen
 * stimmberechtigt — und steht einmal am Eingang. Je Versammlung entsteht
 * trotzdem ein eigenes Anwesenheitsereignis (AD-5).
 *
 * **Eigene Seite, und im Ablauf gesperrt, solange nichts läuft.** Vorher stand
 * das Formular mitten in der Vorbereitung und antwortete auf jeden Klick «nicht
 * möglich — die Versammlung läuft dort nicht».
 */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const op = locals.benutzer.operatorId;

	/*
	 * **Am Einlass gilt die Momentaufnahme, nicht die Liste.** Wer archiviert
	 * ist, kann trotzdem stimmberechtigt vor dem Tisch stehen — die
	 * Anwesenheit kommt aus `snapshot_party`, nicht aus `person`. Filterte man
	 * hier, fehlte die Person in «Ohne Karte einlassen», und es faellt erst
	 * auf, wenn sie da ist.
	 */
	const [tafel, personen] = await Promise.all([
		holeTafel(op, params.id),
		holePersonen(op, 'alle')
	]);
	const stwegs = new Set(tafel.map((z) => z.stwegId));
	/*
	 * **Die längste Frist der beteiligten Häuser** (Migration 122). Der Einlass
	 * eines gemeinsamen Abends gehört allen Gemeinschaften zugleich; nennte der
	 * Satz die Frist eines einzelnen Hauses, wäre er für die anderen falsch. Die
	 * längste ist für jedes zulässig.
	 *
	 * **Und `fristAmAbend` statt `fristKurz`**: Der Tag war auch vorher richtig,
	 * die Zuschreibung nicht. «Ihr Reglement verlangt 20 Tage» stand dann vor
	 * Gemeinschaften, die keine solche Klausel haben.
	 *
	 * **Nicht in das `Promise.all` darüber zu ziehen** (Code-Review 24.09.2026,
	 * zweiter Durchgang, Befund 10): Die Abfrage braucht `stwegs`, und das
	 * kommt aus `tafel`. Die Abhängigkeit ist echt, die zusätzliche Runde
	 * unvermeidlich — es sei denn, man liesse die Abfrage selbst über den Abend
	 * verbinden, was eine zweite Stelle mit derselben Baumkenntnis schüfe.
	 */
	const laengsteFrist = await laengsteZweitfrist(op, [...stwegs]);

	/*
	 * **Die Anwesenheitsliste des ganzen Abends** (Auftraggeber, 24.08.2026): «Ich muss
	 * beim Einlass das Checkin machen, ohne dass ich in 5 STWEG hin und her
	 * springen muss. Es braucht dieselbe Einfachheit wie bei einer Versammlung
	 * mit einer STWEG.»
	 *
	 * Eine Zeile je Partei, mit ihrem Haus daneben — nicht eine Tabelle je Haus.
	 * Am Eingang steht ein Mensch, und die Frage lautet «ist der schon da?»,
	 * nicht «in welchem Haus wohnt der?».
	 */
	/*
	 * **Kurznamen, wie in der Steuerung** (24.08.2026, beim Nachsehen am Bild
	 * gefunden). Auf der Kachel stand «MEG Nirgendweg 3-13a (Umgebung)
	 * (Prüflauf 20260824111738)» — vier Zeilen Name über einem Balken, der die
	 * Auskunft trägt. Gekürzt wird nur, solange die Häuser unterscheidbar
	 * bleiben; das rechnet `kurznamen`, nicht diese Stelle.
	 */
	const kurzliste = kurznamen(tafel.map((z) => z.gemeinschaft));
	const kurz = new Map(tafel.map((z, i) => [z.gemeinschaft, kurzliste[i]]));
	const kurzname = (name: string) => kurz.get(name) ?? name;

	/*
	 * **Wer am Eingang wartet — auch am Abend** (Auftraggeber, 24.08.2026: «Bitte Einlass
	 * nach Anwesenheit und Beschlussfähigkeit anpassen»).
	 *
	 * Zwei Wege führen hierher, und beide endeten bis zum 24.08.2026 im Nichts:
	 * Wer sich mit eigenem Konto anmeldet, wartet auf Freigabe; wer den QR von
	 * der Leinwand scannt, meldet sich über den Saal. Beides sah man nur auf der
	 * Seite des einzelnen Hauses — also genau dort, wo an einem gemeinsamen Abend
	 * niemand hinschaut. Der Saal-QR des Abends, einen Tag vorher gebaut, schrieb
	 * damit in eine Liste, die keine Sicht las.
	 */
	/*
	 * **Die Versammlung je Haus, einmal geholt** (10.09.2026). Sie wurde hier
	 * schon gelesen, aber weiter unten und nur für das Wandbild. Seit die Frage
	 * «digital oder von Hand» am Abend gestellt wird, braucht sie auch die Liste
	 * der Wartenden — und zweimal dieselbe Zeile zu holen wäre zweimal die
	 * Gelegenheit, verschiedene Antworten zu bekommen.
	 */
	const versammlungen = new Map(
		await Promise.all(
			tafel.map(async (z) => [z.meetingId, await holeVersammlung(op, z.meetingId)] as const)
		)
	);

	/**
	 * Fragt DIESES Haus nach Papier?
	 *
	 * **Je Haus und nicht je Abend** (Migration 108). Im Verbund hat jedes Haus
	 * seine eigene Betriebsart und seinen eigenen Schalter: Vier Häuser können
	 * `gefuehrt` fahren und das fünfte `einfach`, wo die Sitzungsleitung ohnehin
	 * alle Stimmen erfasst. Ein Schalter für den ganzen Abend stellte die Frage
	 * dort mit, wo sie nur eine Antwort hat.
	 *
	 * Fehlt die Versammlung (sie stand eben noch an der Tafel und ist inzwischen
	 * weg), wird nicht gefragt. Das ist die Vorgabe, die nichts sperrt.
	 */
	const fragtNachPapierIn = (meetingId: string) => {
		const v = versammlungen.get(meetingId);
		return v ? fragtNachPapier(v) : false;
	};

	const jeHaus = await Promise.all(
		tafel.map(async (z) => {
			const [uebersicht, geraete, meldungen, papier, beantwortet] = await Promise.all([
				holeUebersicht(op, z.meetingId),
				holeGeraete(op, z.meetingId),
				holeOffeneSaalmeldungen(op, z.meetingId),
				/*
				 * **Wer hier auf Papier abstimmt** (10.09.2026, im Code-Review
				 * gefunden). Der Kasten nach dem Einlass sagt «danach steht der
				 * Rückweg in der Anwesenheitsliste» — im Haus stimmte das, am Abend
				 * nicht: Diese Sicht las die Vermerke gar nicht. Nach fünf Sekunden
				 * gab es hier keinen Weg zurück mehr, nur den Umweg in die einzelne
				 * Versammlung.
				 *
				 * Genommen wird derselbe Leseweg wie im Haus, damit die beiden Sichten
				 * nicht auseinanderlaufen können.
				 */
				holePapierabgaben(op, z.meetingId),
				/*
				 * **Und wer überhaupt gefragt wurde** (Migration 109). Am Abend ist
				 * die Nachtragsliste der einzige Weg: Ein zweiter Scan derselben Karte
				 * bietet nichts mehr an, und die Zeile fragt hier nachher statt vorher.
				 */
				holeBeantwortete(op, z.meetingId)
			]);
			const staende = uebersicht?.staende ?? [];
			const aufPapier = new Set(papier.map((p) => p.parteiId));
			// Nur ein laufendes Haus: Danach sagt jede Antwort ab, und nach dem
			// Versiegeln käme eine rohe Datenbankmeldung zurück.
			const offeneFrage = z.zustand === 'laufend' && fragtNachPapierIn(z.meetingId)
				? nichtGefragte(staende, beantwortet, [...aufPapier])
				: [];
			return {
				nichtGefragt: offeneFrage.map((n) => ({
					meetingId: z.meetingId,
					gemeinschaft: kurzname(z.gemeinschaft),
					parteiId: n.parteiId,
					name: n.name
				})),
				zeilen: staende.map((s) => ({
					meetingId: z.meetingId,
					gemeinschaft: kurzname(z.gemeinschaft),
					laeuft: z.zustand === 'laufend',
					parteiId: s.parteiId,
					name: s.name,
					zustand: s.zustand,
					zustandName: ZUSTANDSNAMEN[s.zustand],
					seit: s.seit,
					geraet: geraete.get(s.parteiId)?.bezeichnung ?? null,
					// Für die Schnellsuche: Am Eingang nennt jemand «Wohnung 3.2»
					// so oft wie seinen Namen (Auftraggeber, 25.08.2026).
					einheiten: s.einheiten,
					/** Stimmt diese Partei auf Papier ab? Dann steht hier der Rückweg. */
					aufPapier: aufPapier.has(s.parteiId),
					/**
					 * Ob dieses Haus überhaupt fragt, und wie die Partei hereinkam.
					 *
					 * **Beides erst seit dem 11.09.2026 an der Zeile**, für den Weg
					 * «stimmt doch von Hand»: Der steht nur, wo die Frage gilt, und
					 * nicht bei einer vertretenen Partei, die kein Gerät im Saal hat.
					 * Am Abend gilt die Frage je Haus, nicht für den Abend.
					 */
					papierfrage: fragtNachPapierIn(z.meetingId),
					weg: s.weg
				})),
				wartende: staende
					.filter((s) => s.zustand === 'wartet')
					.map((s) => ({
						meetingId: z.meetingId,
						gemeinschaft: kurzname(z.gemeinschaft),
						parteiId: s.parteiId,
						name: s.name,
						einheiten: s.einheiten,
						papierfrage: fragtNachPapierIn(z.meetingId)
					})),
				saalmeldungen: meldungen.map((m) => ({
					...m,
					meetingId: z.meetingId,
					gemeinschaft: kurzname(z.gemeinschaft),
					papierfrage: fragtNachPapierIn(z.meetingId)
				}))
			};
		})
	);

	/*
	 * **Ein Wandbild für alle Häuser.** Am Eingang gehört die Begrüssung an die
	 * Wand, nicht die Traktandenliste — und wer dafür in die Sitzungsleitung
	 * wechseln muss, lässt sie stehen. Zeigen die Häuser Verschiedenes, steht
	 * keine Wahl vorgewählt da: Ein vorgewähltes Bild behauptete sonst eine
	 * Einigkeit, die es nicht gibt.
	 */
	const wandbilder = new Set(
		tafel.map((z) => versammlungen.get(z.meetingId)?.wandbild?.art ?? 'traktanden')
	);

	const zeilen = jeHaus
		.flatMap((h) => h.zeilen)
		// Nach Namen, nicht nach Haus: Am Eingang wird nach der Person gesucht.
		.sort((a, b) => a.name.localeCompare(b.name, 'de-CH'));
	const wartende = jeHaus.flatMap((h) => h.wartende);
	/*
	 * **Über alle Häuser in einer Liste, mit dem Haus je Zeile.** Der Eingang des
	 * Abends führt ohnehin eine Tafel über alle; zwei Listen nebeneinander wären
	 * zwei Orte für dieselbe Aufgabe.
	 */
	const nichtGefragt = jeHaus.flatMap((h) => h.nichtGefragt);
	const saalmeldungen = jeHaus.flatMap((h) => h.saalmeldungen);

	/*
	 * **Die Beschlussfähigkeit gehört an den Anfang** — wie auf der
	 * Anwesenheitsseite einer einzelnen Versammlung, wo sie als Banner über
	 * allem steht (Auftraggeber, 24.08.2026: «Optisch soll Gruppe und Einzel identisch
	 * aussehen»). Je Gemeinschaft eine, denn eine gemeinsame gibt es nicht.
	 */
	const stand = tafel.map((z) => ({
		meetingId: z.meetingId,
		gemeinschaft: kurzname(z.gemeinschaft),
		zustand: z.zustand,
		beschlussfaehig: z.beschlussfaehig
	}));

	/*
	 * **Der Quicklink auf das eigene Telefon** — wie auf der Anwesenheitsseite
	 * eines Hauses (dort seit dem 20.08.2026: «Wenn ich den Link zum QR mit dem
	 * Mobiltelefon aufrufe, komme ich nicht auf ein Einscanntool für den
	 * Sitzungsleiter»).
	 *
	 * Am Eingang steht die Sitzungsleitung mit dem Telefon in der Hand und will
	 * damit Karten scannen — dafür muss diese Seite dort offen sein. Die Adresse
	 * abzutippen ist im Saal die schlechteste aller Möglichkeiten.
	 *
	 * **Er trägt keinen Zugang.** Wer ihn scannt, landet hier und muss sich
	 * anmelden wie überall sonst — der Code ist eine Adresse, kein Schlüssel.
	 *
	 * **Und er führt auf DIESE Seite**, nicht auf eine schmale Zweitfassung: Am
	 * Abend gibt es keine, und eine zu bauen hiesse, dieselbe Arbeit zweimal zu
	 * führen. Die Tabelle wird auf dem Telefon ohnehin zu Karten.
	 */
	const quicklinkUrl = `${herkunft(url)}/tage/${params.id}/einlass`;
	const quicklink = {
		url: quicklinkUrl,
		svg: await QRCode.toString(quicklinkUrl, {
			type: 'svg',
			errorCorrectionLevel: 'M',
			margin: 1
		})
	};

	let saaleinstieg: { adresse: string; svg: string } | null = null;
	if (tafel.some((z) => z.zustand === 'laufend')) {
		const merkmal = await holeOderErzeugeAbendmerkmal(locals.benutzer.operatorId, params.id);
		const adresse = `${herkunft(url)}/e/tag/${merkmal}`;
		saaleinstieg = {
			adresse,
			svg: await QRCode.toString(adresse, { type: 'svg', errorCorrectionLevel: 'Q', margin: 1 })
		};
	}

	return {
		stand,
		zeilen,
		wartende,
		/**
		 * Wer anwesend ist, ohne je gefragt worden zu sein (Migration 109).
		 *
		 * **Am Abend ist das der einzige Weg.** Im Haus führt die nochmals gescannte
		 * Karte zur Frage; hier bietet ein zweiter Scan nichts mehr an, und die Zeile
		 * fragt nachher statt vorher. Wer im ausgeschalteten Fenster hereinkam oder
		 * über die Häkchenliste, hatte bis hierher gar keine Möglichkeit mehr.
		 */
		nichtGefragt,
		saalmeldungen,
		quicklink,
		wandbild: wandbilder.size === 1 ? [...wandbilder][0] : null,
		/*
		 * Die Zuordnung einer Saalmeldung braucht die Parteien **ihres** Hauses —
		 * mit Zustand, damit Anwesende ausgegraut mit Grund dastehen statt zu
		 * fehlen. Wer jemanden sucht und nicht findet, weiss sonst nicht, ob er
		 * sich vertippt hat oder ob die Person schon drin ist.
		 */
		parteien: zeilen.map((z) => ({
			meetingId: z.meetingId,
			parteiId: z.parteiId,
			name: z.name,
			zustand: z.zustand,
			seit: z.seit
		})),
		/** Die Frist der zweiten Versammlung — dieselbe Auskunft wie im Haus. */
		fristhinweis: fristAmAbend(laengsteFrist),
		/**
		 * Die Adresse zum Eintippen — für den Fall, dass die Kamera nicht mitspielt.
		 *
		 * Ohne Schema, weil sie vorgelesen wird: «versammlung.example.ch Schrägstrich
		 * z» spricht sich, «https://» nicht.
		 */
		einstiegAdresse: `${herkunft(url).replace(/^https?:\/\//, '')}/z`,
		/*
		 * **Der Saaleinstieg zum Hinhalten** (24.08.2026) — ein Code für den ganzen
		 * Abend, der auf die Hausauswahl führt. Nur, solange mindestens eine
		 * Versammlung läuft: vorher gibt es kein Merkmal.
		 */
		saaleinstieg,
		/**
		 * Fragt an diesem Abend überhaupt ein Haus nach «digital oder von Hand»?
		 *
		 * **Für die eine Maske, die nicht je Haus fragen kann**: «Ohne Karte
		 * einlassen» meldet eine Person in ALLEN ihren Häusern zugleich an. Ein
		 * Haken je Haus ginge dort nicht — welche Häuser es sind, steht erst nach
		 * der Wahl der Person fest.
		 *
		 * Fragt kein einziges Haus, steht der Haken gar nicht da. Fragt eines,
		 * steht er, und der Schreibweg überspringt die Häuser, die nicht fragen.
		 */
		papierfrageIrgendwo: tafel.some((z) => fragtNachPapierIn(z.meetingId)),
		anwesend: zeilen.filter((z) => z.zustand === 'anwesend').length,
		laufend: tafel.filter((z) => z.zustand === 'laufend').length,
		// Wer überhaupt hereinkommen kann: die Personen mit einer Partei in einer
		// der Versammlungen. Alle anderen anzubieten hiesse, am Eingang eine Liste
		// durchzublättern, in der die Hälfte nicht dazugehört.
		/*
		 * **Die Auswahl sagt, wer schon drin ist** (Auftraggeber, 24.08.2026: «dort ist
		 * die ‹Ohne Karte einlassen›-Sektion besser gelöst. Also auch das
		 * Dropdown»).
		 *
		 * Im Haus steht hinter jedem Namen «— bereits anwesend», und der Eintrag
		 * ist gesperrt. Hier stand nur der Name mit seinen Gemeinschaften: Wer
		 * jemanden auswählte, der längst da war, bekam eine Meldung, die er sich
		 * hätte sparen können — und wer eine Person suchte und den Grund nicht
		 * sah, fragte die Sitzungsleitung.
		 *
		 * `offen` zählt die **laufenden** Häuser, in denen die Person noch nicht
		 * anwesend ist. Null heisst: Hier gibt es nichts mehr zu tun.
		 */
		einlassbar: personen
			.filter((p) => p.parteien.some((x) => stwegs.has(x.stwegId)))
			.map((p) => {
				/*
				 * Die Parteikennung ist in beiden Listen dieselbe: `uebersicht()`
				 * führt «die Partei — nicht die Zeilenkennung der Momentaufnahme»
				 * (`domain/anwesenheit.ts`), und `holePersonen` liefert `party.id`.
				 * Damit lässt sich ohne zweite Abfrage sagen, wo jemand schon steht.
				 */
				const dazu = p.parteien.filter((x) => stwegs.has(x.stwegId));
				const laufend = dazu.filter((x) =>
					tafel.some((z) => z.stwegId === x.stwegId && z.zustand === 'laufend')
				);
				const eigene = new Set(laufend.map((x) => x.parteiId));
				const anwesend = zeilen.filter(
					(z) => z.laeuft && z.zustand === 'anwesend' && eigene.has(z.parteiId)
				).length;
				return {
					id: p.id,
					name: p.name,
					gemeinschaften: dazu.map((x) => kurzname(x.gemeinschaft)),
					/** In wie vielen laufenden Häusern noch nicht angemeldet. */
					offen: Math.max(0, laufend.length - anwesend),
					haeuser: laufend.length
				};
			})
	};
};

/**
 * Lohnt es sich, dieser Partei den Vermerk nachzutragen?
 *
 * Zwei Bedingungen, und beide gehören hierher:
 *
 *   · Das **Haus** muss überhaupt fragen. Dieselbe Auskunft wie in der
 *     Ladefunktion, nur einzeln: Die Handlungen haben keine Tafel im Rücken.
 *   · Die **Partei** darf noch keinen Vermerk haben. Ohne diese Prüfung bot der
 *     Kasten beim erneuten Scannen einer Papierpartei «Stimmt doch von Hand» an
 *     und behauptete darüber, sie stimme digital — beides falsch, und der Knopf
 *     wäre wirkungslos gewesen (10.09.2026, im Code-Review gefunden).
 */
async function nachtragMoeglich(
	operatorId: string,
	meetingId: string,
	parteiId: string
): Promise<boolean> {
	const v = await holeVersammlung(operatorId, meetingId);
	if (!v || !fragtNachPapier(v)) return false;
	const papier = await holePapierabgaben(operatorId, meetingId);
	return !papier.some((p) => p.parteiId === parteiId);
}

/**
 * Der Kasten mit dem Angebot — oder keiner.
 *
 * **Nur nach einem wirklich neuen Eintritt** (`neu`). Ohne diese Bedingung bot
 * ein zweiter Scan derselben Karte mitten in der laufenden Sitzung wieder
 * «Stimmt doch von Hand» an, und ein Klick sperrte das Telefon einer Partei, die
 * seit einer Stunde digital mitstimmt. Genau der Fall, den die Vorgabe
 * ausschliesst: Der Entscheid fällt am Eingang, nicht während der Sitzung
 * (Auftraggeber, 09.09.2026). Am Eingang ist er genau in dem Augenblick, in dem der
 * Eintritt entsteht.
 */
async function nachtragskasten(
	operatorId: string,
	meetingId: string,
	e: { neu: boolean; parteiId: string; name: string }
): Promise<{ parteiId: string; meetingId: string; name: string } | null> {
	if (!e.neu) return null;
	if (!(await nachtragMoeglich(operatorId, meetingId, e.parteiId))) return null;
	return { parteiId: e.parteiId, meetingId, name: e.name };
}

export const actions: Actions = {
	/**
	 * Die Versammlungen des Abends eröffnen — alle auf einmal oder eine.
	 *
	 * **Warum das hierher gehört** (Auftraggeber, 24.08.2026). Bis zum 24.08.2026 gab es
	 * das Eröffnen nur auf der Seite eines einzelnen Hauses. Wer einen Abend mit
	 * fünf Gemeinschaften führte, wechselte fünfmal die Sicht, bevor er den
	 * ersten Menschen einlassen konnte — und diese Seite hielt ihm derweil
	 * entgegen, es laufe noch nichts. Ein Schritt, der den Zustand verlangt, den
	 * er selbst herstellen müsste.
	 *
	 * Ohne `meeting` gilt es für alle: Das ist der Regelfall, denn ein
	 * gemeinsamer Abend beginnt gemeinsam.
	 */
	/*
	 * abend: meeting — `eroeffneAmAbend` holt die Häuser über `params.id` und
	 * filtert danach in JavaScript auf diese Kennung; eine fremde ergibt eine
	 * leere Auswahl und wirft `fremdes_haus`. Die Bindung steht also im Kern,
	 * nicht hier.
	 */
	eroeffnen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const befund = await eroeffneAmAbend(
				handelnder(locals),
				params.id,
				text(daten.get('meeting')) || null
			);
			for (const b of befund.filter((x) => x.ergebnis === 'getan')) {
				await verkuendeStand(locals.benutzer.operatorId, b.meetingId);
			}
			return { hinweis: hausbefundssatz(befund, 'eröffnet') };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/*
	 * **Die vier Handlungen am Eingang** — dieselben wie im Haus, nur mit dem
	 * Haus im Formular. Sie stehen nicht in `einlassaktionen`, weil die dort
	 * gebündelten die Versammlung aus dem Pfad nehmen (`params.id` ist dort die
	 * Versammlung, hier der Abend).
	 */
	bestaetigen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const meetingId = text(daten.get('meeting'));
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, meetingId);
			// Ohne `weg`: dieselbe Vorgabe wie im Haus (`einlassaktionen.bestaetigen`).
			// Zwei Sichten dürfen für denselben Vorgang nicht Verschiedenes in den
			// Verlauf schreiben.
			const e = await bestaetigeAnwesenheit(
				handelnder(locals),
				meetingId,
				text(daten.get('partei'))
			);
			/*
			 * **Derselbe Helfer wie im Haus** (09.09.2026, angeschlossen am
			 * 10.09.2026). Die Frage steht seither auch am Abend an den Knöpfen der
			 * Wartenden — je Eintrag, denn im Verbund hat jedes Haus seine eigene
			 * Betriebsart und seinen eigenen Schalter. Welches Haus fragt, entscheidet
			 * nicht diese Stelle: `vermerkePapierabgabe` prüft es am Schreibweg.
			 */
			const p = await papiervermerkAusFormular(locals, meetingId, e.parteiId, daten);
			await verkuendeStand(locals.benutzer.operatorId, meetingId);
			return {
				hinweis: `${e.name} ist freigegeben und gilt als anwesend.${p.satz}`,
				papier: p.papier
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	ablehnen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const meetingId = text(daten.get('meeting'));
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, meetingId);
			// `lehneAnmeldungAb` liefert nichts zurück — der Hinweis nennt deshalb
			// keinen Namen. Einen aus dem Formular zu übernehmen hiesse, den
			// Bildschirm dem Absender glauben zu lassen.
			await lehneAnmeldungAb(handelnder(locals), meetingId, text(daten.get('partei')));
			await verkuendeStand(locals.benutzer.operatorId, meetingId);
			return { hinweis: 'Anmeldung abgelehnt.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	saalZuordnen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const meetingId = text(daten.get('meeting'));
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, meetingId);
			const e = await ordneSaalmeldungZu(
				handelnder(locals),
				meetingId,
				text(daten.get('meldung')),
				text(daten.get('partei'))
			);
			/*
			 * **Auch der Saal-Zugang ist ein Eingang** (09.09.2026, im zweiten
			 * Code-Review gefunden). Wer sich über die Wand meldet und hier einer
			 * Partei zugeordnet wird, wird damit eingelassen — und die Frage
			 * «digital oder von Hand» gehört an denselben Vorgang.
			 */
			const p = await papiervermerkAusFormular(locals, meetingId, e.parteiId, daten);
			await verkuendeStand(locals.benutzer.operatorId, meetingId);
			return { hinweis: `${e.name} ist als anwesend erfasst.${p.satz}`, papier: p.papier };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	saalAblehnen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const meetingId = text(daten.get('meeting'));
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, meetingId);
			await lehneSaalmeldungAb(handelnder(locals), meetingId, text(daten.get('meldung')));
			return { hinweis: 'Meldung abgelehnt.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Die Häkchenliste — am Abend über alle Häuser hinweg.
	 *
	 * Jedes Häkchen trägt `<Haus>|<Partei>`, weil dieselbe Person in zwei
	 * Häusern stimmberechtigt sein kann und dort zwei getrennte Anwesenheiten
	 * entstehen (AD-5). Gebucht wird je Haus in einem Durchgang.
	 */
	liste: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const jeHaus = new Map<string, string[]>();
		for (const wert of daten.getAll('zeile').map(String).filter(Boolean)) {
			const [meetingId, parteiId] = wert.split('|');
			if (!meetingId || !parteiId) continue;
			jeHaus.set(meetingId, [...(jeHaus.get(meetingId) ?? []), parteiId]);
		}
		if (jeHaus.size === 0) {
			return fail(400, { fehler: { nachricht: 'Niemand angekreuzt.' } });
		}
		try {
			let erfasst = 0;
			let schon = 0;
			for (const [meetingId, parteien] of jeHaus) {
				await hausDesAbends(locals.benutzer.operatorId, params.id, meetingId);
				const e = await erfasseListe(handelnder(locals), meetingId, parteien);
				erfasst += e.erfasst;
				schon += e.schonAnwesend;
				await verkuendeStand(locals.benutzer.operatorId, meetingId);
			}
			return {
				hinweis:
					`${erfasst} ${erfasst === 1 ? 'Anwesenheit' : 'Anwesenheiten'} erfasst` +
					(schon > 0 ? `, ${schon} bestanden bereits` : '') +
					'.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/*
	 * **Der Einlass durch eine bevollmächtigte dritte Person steht nicht hier**
	 * (Auftraggeber, 24.08.2026: «Smarter wäre ein Absprung auf Vollmachten. Sonst
	 * führen wir das dort doppelt»).
	 *
	 * Die Maske stand kurz an dieser Stelle, mit einer Auswahlliste über alle
	 * Häuser. Sie tat dasselbe wie `/tage/<id>/vollmachten` — zwei Fassungen
	 * derselben Arbeit, und eine Vollmacht gilt je Gemeinschaft, also führt die
	 * Seite dort ohnehin je Haus. Der Eingang verweist jetzt dorthin.
	 */

	einlass: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const befund = await lasseEin(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				text(daten.get('person'))
			);
			const erfasst = befund.zeilen.filter((z) => z.ergebnis === 'erfasst');
			/*
			 * **Den Saal nachziehen** (Code-Review 24.08.2026, Befund 7). Der
			 * Hauptweg am Eingang verkündete als einziger nicht — anders als
			 * `scannen`, `vonHand` und `verlassen` daneben. Vierzig Personen
			 * hereinzulassen änderte an der gemeinsamen Wand keine Zahl: «0 von 30
			 * anwesend», Balken auf null, bis zufällig eine andere Handlung
			 * verkündete. Die Zeile ist älter als der Verbund-Umbau; sichtbar wurde
			 * sie erst, seit es einen gemeinsamen Monitor gibt.
			 */
			for (const zeile of erfasst) {
				await verkuendeStand(locals.benutzer.operatorId, zeile.meetingId);
			}
			/*
			 * **Auch dieser Eingang fragt** (10.09.2026, im Code-Review gefunden).
			 * Bis dahin galt jede ohne Karte eingelassene Partei am Abend still als
			 * digital, während dieselbe Person mit Karte gefragt worden wäre — und
			 * nachtragen liess es sich in der Oberfläche nicht mehr.
			 *
			 * **Eine Antwort für alle Häuser dieser Person, und das ist richtig so.**
			 * Am Eingang steht EIN Mensch und sagt, wie er abstimmt; er tut es nicht
			 * in Haus 4 digital und in der Einstellhalle von Hand. Der Vermerk geht
			 * deshalb an jede eben erfasste Zeile — und nur an die: Wo die Partei
			 * schon anwesend war, ist der Entscheid am Eingang bereits gefallen.
			 *
			 * **Häuser, die nicht fragen, überspringt der Schreibweg selbst.**
			 * `vermerkePapierabgabe` prüft `fragtNachPapier`; der Helfer fängt die
			 * Absage und gibt sie als Satz zurück. Damit bleibt der Sammeleinlass
			 * heil, wenn von fünf Häusern nur vier fragen.
			 *
			 * **Kein Rücknahmekasten hier.** Der trägt eine Partei, und hier können
			 * mehrere entstehen. Der Rückweg steht an den Zeilen der Liste darunter.
			 */
			const vermerkt = [];
			const ohneVermerk = [];
			for (const zeile of erfasst) {
				if (!zeile.parteiId) continue;
				const p = await papiervermerkAusFormular(
					locals,
					zeile.meetingId,
					zeile.parteiId,
					daten
				);
				if (p.papier) vermerkt.push(zeile.gemeinschaft);
				/*
				 * **Eine Absage verschwindet nicht** (10.09.2026, im zweiten
				 * Code-Review gefunden). Der Haken steht schon, wenn EIN Haus des
				 * Abends fragt; ist die Person nur in Häusern stimmberechtigt, die
				 * nicht fragen, wäre das Kreuz sonst spurlos weg. Am Eingang bliebe
				 * der Eindruck, der Vermerk sei gesetzt.
				 *
				 * `p.grund` ist genau dann gefüllt, wenn eine Antwort «ja» kam und der
				 * Schreibweg sie abgelehnt hat. Der blosse Grund und nicht `p.satz`:
				 * Der trägt seinen eigenen Rahmen, und zwei Rahmen ineinander ergeben
				 * «ohne Vermerk in Haus A: Der Vermerk konnte nicht gesetzt werden: …».
				 */
				else if (p.grund) ohneVermerk.push(`${zeile.gemeinschaft} (${p.grund})`);
			}
			const schon = befund.zeilen.filter((z) => z.ergebnis === 'schon_anwesend');
			const nicht = befund.zeilen.filter((z) => z.ergebnis === 'nicht_laufend');
			const teile = [`${befund.person}:`];
			if (erfasst.length > 0) {
				teile.push(`angemeldet in ${erfasst.map((z) => z.gemeinschaft).join(', ')}`);
			}
			if (vermerkt.length > 0) {
				teile.push(`stimmt von Hand ab in ${vermerkt.join(', ')}`);
			}
			if (ohneVermerk.length > 0) {
				teile.push(`ohne Vermerk in ${ohneVermerk.join(', ')}`);
			}
			if (schon.length > 0) {
				teile.push(`war schon anwesend in ${schon.map((z) => z.gemeinschaft).join(', ')}`);
			}
			// Übersprungenes wird benannt, nicht verschwiegen: Sonst entsteht am
			// Eingang der Eindruck, es sei alles erledigt.
			if (nicht.length > 0) {
				teile.push(
					`nicht möglich in ${nicht.map((z) => z.gemeinschaft).join(', ')} — die Versammlung läuft dort nicht`
				);
			}
			return { hinweis: teile.join(' · ') };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Eine Karte scannen oder einen Code eintippen — am Abend.
	 *
	 * **Der Code trägt seine Versammlung selbst** (`loeseZugangAuf` gibt sie
	 * zurück). Im Haus wird geprüft, ob sie DIE des Hauses ist; hier, ob sie zu
	 * einer der Gemeinschaften dieses Abends gehört. Ohne diese Prüfung liesse
	 * sich mit der Karte eines anderen Abends eine Anwesenheit erzeugen — die
	 * Karte wäre gültig, nur eben für etwas anderes.
	 *
	 * **Erfasst wird sofort**, anders als beim Nachschlagen im Haus: Am
	 * gemeinsamen Eingang steht die Person schon vor der Sitzungsleitung, und
	 * ein Zwischenschritt kostet dort die Zeit, die der Abend nicht hat. Wer
	 * nachsehen will, wen er vor sich hat, findet die Zeile in der Liste
	 * darunter.
	 */
	scannen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const code = codeAusScan(text(daten.get('code')));

		const befund = await loeseZugangAuf(locals.benutzer.operatorId, code);
		if (!befund.gueltig) {
			return fail(400, {
				fehler: { nachricht: befund.grund ?? 'Zugang nicht gültig.' }
			});
		}

		const tafel = await holeTafel(locals.benutzer.operatorId, params.id);
		const haus = befund.meetingId
			? tafel.find((z) => z.meetingId === befund.meetingId)
			: undefined;
		if (!haus || !befund.meetingId || !befund.parteiId) {
			return fail(400, {
				fehler: {
					nachricht:
						'Diese Karte gehört zu einer Versammlung, die heute Abend nicht mittagt. ' +
						'Sie ist gültig — nur nicht hier.'
				}
			});
		}

		try {
			const e = await bestaetigeAnwesenheit(
				handelnder(locals),
				befund.meetingId,
				befund.parteiId,
				'gescannt'
			);
			/*
			 * **Derselbe Helfer wie im Haus** (09.09.2026, angeschlossen am
			 * 10.09.2026). Die Frage steht seither auch am Abend an den Knöpfen der
			 * Wartenden — je Eintrag, denn im Verbund hat jedes Haus seine eigene
			 * Betriebsart und seinen eigenen Schalter. Welches Haus fragt, entscheidet
			 * nicht diese Stelle: `vermerkePapierabgabe` prüft es am Schreibweg.
			 */
			// `e.neu` mitgeben: Das Formular schickt `papier=nachher` an JEDEM Scan,
			// der Kasten erscheint aber nur nach einem neuen Eintritt. Ohne das nähme
			// ein zweiter Scan eine Partei still aus der Nachtragsliste.
			const p = await papiervermerkAusFormular(
				locals,
				befund.meetingId,
				e.parteiId,
				daten,
				undefined,
				e.neu
			);
			await verkuendeStand(locals.benutzer.operatorId, befund.meetingId);
			/*
			 * **Die Frage kommt hier NACH dem Erfassen** (10.09.2026).
			 *
			 * Im Haus steht sie an den beiden Knöpfen, weil dort erst ein
			 * Kontrollfeld erscheint und die Sitzungsleitung dann drückt. Am Abend
			 * erfasst der Scanner sofort, und die Kamera schickt selbst ab: Es gibt
			 * keinen Knopf, an den die Frage passte. Vorher zu fragen ginge auch
			 * sachlich nicht — welches Haus die Karte betrifft, steht erst fest,
			 * wenn der Code aufgelöst ist, und die Frage hängt am Haus.
			 *
			 * Der Nachtrag steht deshalb im Kasten daneben, für dieselben fünf
			 * Sekunden wie die Rücknahme, und nur solange dieselbe Person vor dem
			 * Tisch steht. Damit bleibt es der Entscheid am Eingang und nicht einer
			 * in der laufenden Sitzung.
			 */
			const nachtrag = p.papier
				? null
				: await nachtragskasten(locals.benutzer.operatorId, befund.meetingId, e);
			return {
				hinweis: `${e.name} ist erfasst — ${haus.gemeinschaft}.${p.satz}`,
				papier: p.papier,
				nachtrag
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Den Vermerk «stimmt von Hand ab» zurücknehmen — am Abend.
	 *
	 * **Warum das hier eigens steht.** Im Haus liegt die Handlung im geteilten
	 * Bündel und nimmt die Versammlung aus dem Pfad. Am Abend ist `params.id` der
	 * Abend; das Haus kommt aus dem Formular und wird gegen die Tafel geprüft wie
	 * bei jeder anderen Handlung hier.
	 *
	 * **Ohne sie war der Vermerk am Abend unwiderruflich** (10.09.2026 beim
	 * Anschluss gefunden). Die Einlasshandlungen gaben `papier` schon zurück, aber
	 * es gab keine Sicht, die ihn zeigte, und keine Handlung, die ihn wegnahm.
	 * Solange keine Maske die Frage stellte, fiel das nicht auf.
	 */
	papierZuruecknehmen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const meetingId = text(daten.get('meeting'));
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, meetingId);
			const weg = await hebePapierabgabeAuf(
				handelnder(locals),
				meetingId,
				text(daten.get('partei'))
			);
			// Wie im Haus: Der Vermerk sperrt das Telefon der Partei, und wer ihn
			// wegnimmt, gibt es wieder frei. Ohne Verkündung erführe das Gerät es
			// erst beim nächsten Laden.
			await verkuendeStand(locals.benutzer.operatorId, meetingId);
			return weg
				? { hinweis: 'Zurückgenommen — die Partei stimmt digital ab.' }
				: { hinweis: 'Es war kein Vermerk gesetzt; nichts geändert.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Den Vermerk nach dem Scannen nachtragen.
	 *
	 * **Es gibt ihn nur am Abend, und nur dort ist er kein zweiter Weg.** Im Haus
	 * steht die Frage an den beiden Einlassknöpfen; ein Nachtrag daneben wäre eine
	 * zweite Stelle für dieselbe Antwort. Am Abend erfasst der Scanner sofort (die
	 * Kamera schickt selbst ab), und vor dem Auflösen des Codes ist das Haus
	 * unbekannt — die Frage lässt sich dort nicht vorher stellen.
	 *
	 * **Der Entscheid bleibt damit am Eingang** (Vorgabe des Auftraggebers, 09.09.2026: «Der
	 * Entscheid fällt am Eingang, nicht während der laufenden Sitzung»). Der Knopf
	 * steht im Kasten unmittelbar nach dem Scan und verschwindet mit ihm; in der
	 * Anwesenheitsliste darunter gibt es ihn nicht.
	 *
	 * **Der Weg ist `gescannt`**, denn die Karte wurde gelesen. Wer hier `von_hand`
	 * schriebe, erzählte im Verlauf eine andere Geschichte als die, die stattfand.
	 *
	 * **Was der Server NICHT prüft, und warum das hier steht.** Das Fenster von
	 * fünf Sekunden ist eine Sache der Maske. Wer die Handlung von Hand aufruft,
	 * kann den Vermerk auch mitten in der Sitzung setzen — die Handlung verlangt
	 * nur eine berechtigte Sitzungsleitung und ein Haus dieses Abends, und
	 * `vermerkePapierabgabe` prüft davon, dass die Versammlung überhaupt fragt.
	 *
	 * Neu ist das nicht: Dieselbe Lücke haben die Einlasshandlungen im Haus, seit
	 * es sie gibt.
	 *
	 * **Und sie bleibt, das ist entschieden** (Auftraggeber, 10.09.2026). Eine Frist am
	 * Vermerk («nur, solange der Eintritt jünger ist als X») nähme den Weg weg,
	 * den die Vorgabe vom 09.09.2026 ausdrücklich offen lässt: «Dort gilt höchstens
	 * der bestehende Weg, wenn es technische Probleme gibt.» Sie ersetzte ihn durch
	 * eine erfundene Zahl. Zur Schranke wird die Lücke erst, wenn es eine Rolle je
	 * Versammlung gibt; der Abschnitt dazu steht im Kopf von
	 * `server/papierabgabe.ts`.
	 */
	papierNachtragen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const meetingId = text(daten.get('meeting'));
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, meetingId);
			const parteiId = text(daten.get('partei'));
			const neu = await vermerkePapierabgabe(handelnder(locals), meetingId, parteiId, 'gescannt');
			await verkuendeStand(locals.benutzer.operatorId, meetingId);
			return {
				hinweis: neu
					? 'Vermerkt: stimmt von Hand ab.'
					: 'Der Vermerk bestand bereits; nichts geändert.',
				papier: { parteiId, meetingId }
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Die Eingangsfrage für eine Partei **nachholen** (Migration 109).
	 *
	 * **Wortgleich zur Handlung im Haus**, nur mit der Versammlung aus dem
	 * Formular statt aus dem Pfad: Hier ist `params.id` der Abend, und
	 * `hausDesAbends` prüft, dass das genannte Haus zu ihm gehört.
	 *
	 * **Nicht zu verwechseln mit `papierNachtragen` darüber.** Der ist das
	 * Fenster von fünf Sekunden unmittelbar nach dem Scannen und kennt nur eine
	 * Richtung. Dies hier ist die Liste derer, die nie gefragt wurden, und sie
	 * nimmt beide Antworten entgegen.
	 */
	papierBeantworten: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const meetingId = text(daten.get('meeting'));
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, meetingId);
			const parteiId = text(daten.get('partei'));
			const p = await papiervermerkAusFormular(locals, meetingId, parteiId, daten, 'nachtrag');
			if (p.grund) return fail(400, { fehler: { nachricht: p.grund } });
			await verkuendeStand(locals.benutzer.operatorId, meetingId);
			return {
				hinweis: p.papier
					? 'Nachgetragen — die Partei stimmt von Hand ab.'
					: 'Nachgetragen — die Partei stimmt digital ab.',
				papier: p.papier
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},


	/*
	 * **Dieselben Handlungen wie in der einzelnen Versammlung** (Auftraggeber,
	 * 24.08.2026). Die Versammlung kommt aus dem Formular und wird gegen die
	 * Häuser dieses Abends geprüft — sonst wäre sie ein Weg an der Absicht
	 * vorbei: Der Zeilenschutz hält fremde Betreiber ab, innerhalb des eigenen
	 * liesse sich über eine untergeschobene Kennung eine fremde Versammlung
	 * ansteuern.
	 */
	/**
	 * Eine einzelne Partei von Hand als anwesend erfassen.
	 *
	 * **Neben dem Einlass über die Person, nicht statt seiner.** Der obere Weg
	 * meldet einen Menschen in ALLEN Gemeinschaften an, in denen er
	 * stimmberechtigt ist — das ist der Regelfall am Eingang. Hier geht es um
	 * die eine Zeile: Jemand ist in Haus A da und in Haus B noch nicht, oder er
	 * kam nach und niemand hat ihn gesehen.
	 */
	vonHand: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const meetingId = text(daten.get('meeting'));
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, meetingId);
			const e = await bestaetigeAnwesenheit(
				handelnder(locals),
				meetingId,
				text(daten.get('partei')),
				'von_hand'
			);
			/*
			 * **Auch dieser Weg ist ein Eingang** (10.09.2026, im zweiten
			 * Code-Review gefunden). Die Zeile erfasst eine einzelne Partei, und
			 * danach stand sie still als «digital» da, während dieselbe Person mit
			 * Karte gefragt worden wäre.
			 *
			 * **Die Frage kommt danach, nicht am Knopf.** Ein zweiter Knopf oder ein
			 * Haken je Zeile machte aus achtzig Zeilen hundertsechzig Bedienelemente;
			 * die Liste ist zum Suchen da, nicht zum Ausfüllen. Der Kasten daneben
			 * fragt einmal, für fünf Sekunden, und trifft nur den eben entstandenen
			 * Eintritt.
			 *
			 * Der Vermerkhelfer läuft trotzdem mit: Stellt die Zeile eines Tages doch
			 * die Frage, kommt die Antwort an, statt still verloren zu gehen. Der
			 * Wächter `papiereingang` verlangt ihn hier.
			 */
			// Wie beim Scanner: Der Kasten erscheint nur nach einem neuen Eintritt,
			// und nur dann ist `nachher` wirklich eine Frage.
			const p = await papiervermerkAusFormular(
				locals,
				meetingId,
				e.parteiId,
				daten,
				undefined,
				e.neu
			);
			const nachtrag = p.papier
				? null
				: await nachtragskasten(locals.benutzer.operatorId, meetingId, e);
			await verkuendeStand(locals.benutzer.operatorId, meetingId);
			return { hinweis: `${e.name} ist erfasst.${p.satz}`, papier: p.papier, nachtrag };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	verlassen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const meetingId = text(daten.get('meeting'));
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, meetingId);
			const e = await erfasseVerlassenDerVersammlung(
				handelnder(locals),
				meetingId,
				text(daten.get('partei'))
			);
			await verkuendeStand(locals.benutzer.operatorId, meetingId);
			return {
				hinweis:
					`${e.name} hat die Versammlung verlassen.` +
					(e.mitgenommen.length > 0
						? ` Damit gelten auch die Vertretenen als abwesend: ${e.mitgenommen.join(', ')}.`
						: '')
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Den Zugangscode ausgeben — mit QR zum Abscannen (24.08.2026).
	 *
	 * Dieselbe Maske wie in der Anwesenheitssicht eines Hauses: ein Fenster über
	 * allem, der QR zuerst, der Code daneben. Bis hierher erschien er am Abend
	 * nur als Meldungszeile — und verschwand, sobald der Ereignisstrom die Seite
	 * nachlud, mitten im Vorlesen.
	 */
	codeAusgeben: async ({ request, locals, params, url }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const meetingId = text(daten.get('meeting'));
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, meetingId);
			return {
				ausgabe: await gibCodeMitBildAus(
					handelnder(locals),
					meetingId,
					text(daten.get('partei')),
					herkunft(url)
				)
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/** Der Absturz-Fall des Auftraggebers: «Ich komme nicht in mein Konto, Mobiltelefon abgestürzt.» */
	geraeteWiderrufen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const meetingId = text(daten.get('meeting'));
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, meetingId);
			const anzahl = await widerrufeSitzungen(
				handelnder(locals),
				meetingId,
				text(daten.get('partei'))
			);
			return {
				hinweis:
					anzahl > 0
						? 'Das angemeldete Gerät ist abgemeldet. Ein neuer Code führt wieder herein.'
						: 'Es war kein Gerät angemeldet.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	}
};

function handelnder(locals: App.Locals) {
	const b = locals.benutzer!;
	return { operatorId: b.operatorId, userId: b.id, label: b.displayName };
}


function fachlich(fehler: unknown) {
	if (fehler instanceof FachlicherFehler) return { fehler: { nachricht: fehler.message } };
	throw fehler;
}
