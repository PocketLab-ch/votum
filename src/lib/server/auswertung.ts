/**
 * Die Gesamtauswertung einer Versammlung (Story 5.13, FR-42).
 *
 * Eine Stelle, zwei Ausgaben: die Seite in der Sitzungsleitung und das PDF.
 * Rechneten sie getrennt, stünde eines Tages auf dem Papier eine andere Zahl
 * als auf dem Bildschirm — und niemand wüsste, welche gilt.
 */
import { einsprachelesartProtokollsatz, kopfzaehlweiseProtokollsatz, lesartProtokollsatz } from '$lib/domain/auszaehlung';
import { EINSPRACHE_KNOTEN } from '$lib/domain/entscheidbaum';
import { abgebrochen, massgebender } from '$lib/domain/abstimmung';
import { grundOhneBeschluss, neuabstimmungNachRueckkommen } from '$lib/domain/rueckkommen';
import {
	ergebnisLiegtAnderswo,
	findeErsetzung,
	type Ersetzungslage
} from '$lib/domain/folgeantragsersetzung';
import { holeVorgaengeFuerProtokoll } from './verlaufsabfrage';
import {
	beschlossen,
	ergebnisInWorten,
	ergebnislage,
	ergebniswertung,
	beschlussGilt,
	mehrheitGesetzt,
	erfordernisInWorten
} from '$lib/domain/auszaehlung';
import { stichentscheidInWorten, zaehlweiseImKopf } from '$lib/domain/gemeinschaft';
import { holeDurchgaenge, holeErgebnis } from './abstimmung';
import { alsBetreiber } from './db';
import type { BetroffeneImDurchgang } from './betroffene';
import { holeMomentaufnahme } from './freigabe';
import {
	PROTOKOLLVERMERK_UNIVERSAL_AUFGENOMMEN,
	protokollvermerkReglement,
	protokollvermerkUniversal,
	protokollvermerkWiderspruchVorEroeffnen,
	reglementGestattet,
	wiederEroeffenbar
} from '$lib/domain/ausnahmen';
import { holeGemeinschaft } from './gemeinschaften';
import { holeTraktanden } from './traktanden';
import { holeVersammlung } from './versammlungen';
import { holeWidersprueche } from './universal';
import type { Auswertungszeile } from './pdf/auswertung';
import type { Versammlung } from '$lib/domain/versammlung';
import type { Id } from '$lib/domain/types';

export interface Auswertung {
	versammlung: Versammlung;
	zeilen: Auswertungszeile[];
	/**
	 * Die Unterbrechungen des Abends, in ihrer Reihenfolge (22.08.2026).
	 *
	 * Nicht an einem Traktandum, sondern dazwischen — deshalb eine eigene Liste.
	 * Im Protokoll fehlten sie ganz, obwohl eine Pause den Ablauf ebenso prägt
	 * wie ein Beschluss: Wer eine halbe Stunde lang nicht im Saal war, findet
	 * hier, was in dieser Zeit nicht geschah.
	 */
	unterbrechungen: { art: 'unterbrochen' | 'fortgesetzt'; zeitpunkt: string; text: string | null }[];
	/**
	 * Wie die Köpfe gezählt wurden und worauf sich das stützt — aus der
	 * Momentaufnahme, nicht aus den heutigen Stammdaten. Null nur, solange keine
	 * Momentaufnahme besteht, also vor der Freigabe.
	 */
	zaehlweise: string | null;
	/**
	 * Die reglementarische Auflösung eines Gleichstands, falls die Gemeinschaft
	 * eine kennt. Null bei der gesetzlichen Lage — dort gibt es nichts zu erklären.
	 */
	stichentscheid: string | null;
	/** Wie viele Anträge angenommen und abgelehnt wurden — die Zahl fürs Protokoll. */
	angenommen: number;
	abgelehnt: number;
	/**
	 * Abgestimmt, aber ohne Ergebnis: ein offener Stichentscheid — der
	 * Verwalterfall ohne eingetragenen Entscheid oder der Gleichstand über
	 * einer Handzählung, den die Wertquoten entscheiden.
	 *
	 * Getrennt von `abgelehnt` **und** von `ohneAbstimmung`: Das eine wäre
	 * falsch, das andere auch. Wer die Zahlen zusammenzählt, muss diese sehen.
	 */
	ohneErgebnis: number;
	/**
	 * Abgestimmt, aber die Universalversammlung hat nicht gehalten (Migration
	 * 128). Weder abgelehnt noch offen: Entschieden ist, dass nichts gilt.
	 */
	keinBeschluss: number;
	ohneAbstimmung: number;
	/**
	 * Votum führt kein Ergebnis, die Leitung hat aber erklärt, dass von Hand
	 * abgestimmt wurde (Beschlussvermerk, Migration 135). Getrennt von
	 * `ohneAbstimmung`: Abgestimmt wurde, nur nicht in Votum. Zählte der Punkt
	 * dort mit, stünde im Kopf der Auswertung «1 ohne Abstimmung» über einer
	 * Zeile, die auf das Protokoll verweist.
	 */
	mitBeschlussvermerk: number;
}

/**
 * Wer den Beschlussvermerk heute trägt — ohne die Prüfung der Schranken.
 *
 * bindung: meetingId — die Abfrage läuft unter der Zeilensperre des Betreibers
 *   und liest nur Traktanden dieser Versammlung.
 */
export async function holeBeschlussvermerke(operatorId: Id, meetingId: Id): Promise<Set<Id>> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<{ id: string }[]>`
			SELECT id FROM agenda_item WHERE meeting_id = ${meetingId} AND minute_decision
		`;
		return new Set(zeilen.map((z) => z.id));
	});
}

/**
 * Die Lage, wenn das Traktandum an einem Rückkommen beteiligt ist, das über
 * einen Folgeantrag lief (Produktentscheid 30.09.2026; Plan Folgeantrag nach
 * Rückkommen, Soll 6); sonst null. Für Auswertung, Protokoll, Stimmnachweis,
 * Leitung und Wand dieselbe Rechnung.
 *
 * Beim Grundantrag nur, solange er keinen eigenen geltenden Durchgang hat oder
 * der Folgeantrag nichts ersetzt hat: Hat ein weiteres Rückkommen wieder über
 * ihn selbst entschieden, erklären das die bisherigen Sätze. Nach einem
 * Beschluss von Hand ohne Rückkommen folgen die Sätze dem Stand; die zwei
 * Regeln dazu stehen in `findeErsetzung`.
 *
 * bindung: traktandumId — nur verglichen in `durchgaenge` und `traktanden`, die
 *   der Aufrufer zu `meetingId` geladen hat; eine fremde Kennung findet dort
 *   nichts. Gelesen werden danach nur Durchgänge aus dieser Liste, über
 *   `holeErgebnis(…, meetingId, …)`.
 */
export async function ersetzungslage(
	operatorId: Id,
	meetingId: Id,
	traktandumId: Id,
	durchgaenge: Awaited<ReturnType<typeof holeDurchgaenge>>,
	traktanden: Awaited<ReturnType<typeof holeTraktanden>>
): Promise<Ersetzungslage | null> {
	const ziele = new Map(
		traktanden
			.filter((x) => x.knoten.rueckkommenZielId)
			.map((x) => [x.knoten.id, x.knoten.rueckkommenZielId as string])
	);
	const fund = findeErsetzung(durchgaenge, traktandumId, ziele);
	if (!fund) return null;
	const eigener = massgebender(durchgaenge.filter((d) => d.traktandumId === traktandumId));
	if (fund.rolle === 'grundantrag' && eigener && fund.art === 'ersetzt') return null;

	const kopf = (id: string) => {
		const x = traktanden.find((k) => k.knoten.id === id);
		return { nummer: x?.nummer ?? '', titel: x?.knoten.titel ?? '' };
	};
	const lageVon = async (id: string | null) => {
		if (!id) return null;
		const a = (await holeErgebnis(operatorId, meetingId, id)).auszaehlung;
		return { lage: ergebnislage(a), grund: grundOhneBeschluss(a) };
	};
	const folge = await lageVon(fund.folgeDurchgangId);
	const frueherD = durchgaenge.find((d) => d.id === fund.fruehererDurchgangId) ?? null;
	const frueher = await lageVon(frueherD?.id ?? null);
	const ausgang =
		fund.art === 'ohne_beschluss'
			? 'ohne_beschluss'
			: fund.art === 'neuabstimmung'
				? 'neuabstimmung'
				: folge?.lage === 'angenommen'
					? 'angenommen'
					: folge?.lage === 'abgelehnt'
						? 'abgelehnt'
						: null;
	// Ohne lesbares Ergebnis des Folgeantrags gibt es keinen Satz: Er müsste
	// raten, was gilt (offener Stichentscheid endet als `ohne_beschluss`).
	if (!ausgang) return null;
	return {
		rolle: fund.rolle,
		grundantragId: fund.grundantragId,
		folgeDurchgangId: fund.folgeDurchgangId,
		fruehererDurchgangId: fund.fruehererDurchgangId,
		grundantrag: kopf(fund.grundantragId),
		folgeantrag: kopf(fund.folgeantragId),
		rueckkommensantrag: kopf(fund.rueckkommensantragId).nummer,
		frueher: frueherD
			? {
					nummer: frueherD.nummer,
					ergebnis:
						frueher?.lage === 'angenommen' || frueher?.lage === 'abgelehnt' ? frueher.lage : null,
					traktandum:
						frueherD.traktandumId !== fund.grundantragId ? kopf(frueherD.traktandumId).nummer : null
				}
			: null,
		ausgang,
		spaeterErsetzt: fund.spaeterErsetzt,
		abgebrochen: fund.abgebrochen ?? false,
		grund: ausgang === 'ohne_beschluss' ? (folge?.grund ?? null) : null
	};
}

export async function holeAuswertung(operatorId: Id, meetingId: Id): Promise<Auswertung | null> {
	const versammlung = await holeVersammlung(operatorId, meetingId);
	if (!versammlung) return null;

	const [traktanden, durchgaenge, momentaufnahme, gemeinschaft, vorgaenge, widersprueche, beschlussvermerke] = await Promise.all([
		holeTraktanden(operatorId, meetingId),
		holeDurchgaenge(operatorId, meetingId),
		holeMomentaufnahme(operatorId, meetingId),
		holeGemeinschaft(operatorId, versammlung.stwegId),
		/*
		 * **Was am Abend geschah, ausser dem Abstimmen** (22.08.2026, Befund D-02).
		 *
		 * Im Prüflauf fehlten vier Vorgänge vollständig im Protokoll, obwohl die
		 * Anwendung alle vier kennt und im Verlauf führt: Ausstand, Rückzug,
		 * dessen Rücknahme und die Unterbrechung. Bei Traktandum 7 stand «(von 4)»
		 * statt «(von 5)» — ohne ein Wort dazu, warum. Wer das Protokoll später
		 * liest, sieht eine Zahl, die er sich nicht erklären kann.
		 *
		 * Der Verlauf ist die Quelle, nicht ein zweiter Merker am Traktandum: Er
		 * wird ohnehin geschrieben, ist unveränderlich und trägt Zeitpunkt und
		 * handelnde Person.
		 */
		holeVorgaengeFuerProtokoll(operatorId, meetingId),
		holeWidersprueche(operatorId, meetingId),
		holeBeschlussvermerke(operatorId, meetingId)
	]);

	// Die Fundstelle des Stichentscheids liegt bei der Gemeinschaft: Sie belegt
	// eine Regel, die sich nicht ändert, während die Zählweise selbst eingefroren
	// ist. Fehlt sie, sagt der Satz das ausdrücklich.
	const gemeinschaftFundstelle = gemeinschaft?.tieBreakRuleSource ?? null;

	/**
	 * Die Unterbrechungen des Abends — nicht an einem Traktandum, sondern
	 * dazwischen. Sie kommen als eigene Liste, weil sie im Protokoll an ihrer
	 * Stelle im Ablauf stehen und nicht unter einem Geschäft.
	 */
	const unterbrechungen = vorgaenge
		.filter((v) => v.art === 'meeting.paused' || v.art === 'meeting.resumed')
		.map((v) => ({
			art: v.art === 'meeting.paused' ? ('unterbrochen' as const) : ('fortgesetzt' as const),
			zeitpunkt: v.zeitpunkt,
			// Der Wortlaut, den die Wand zeigte — er stand im Saal und gehört ins
			// Protokoll, wenn er dort stand.
			text: typeof v.angaben.text === 'string' ? v.angaben.text : null
		}));

	const zeilen: Auswertungszeile[] = [];
	let angenommen = 0;
	let abgelehnt = 0;
	let ohneAbstimmung = 0;
	/*
	 * **Ein offener Stichentscheid ist keine Ablehnung** (05.09.2026, im
	 * Browserdurchlauf gefunden). Er wurde bis dahin mitgezählt, weil
	 * `angenommen` dort `false` ist — und stand damit als Ablehnung in der
	 * Zusammenfassung, im Protokoll und auf der Leinwand. Er zählt auch nicht zu
	 * `ohneAbstimmung`: Abgestimmt **wurde**, es fehlt nur der Entscheid.
	 */
	let ohneErgebnis = 0;
	let keinBeschluss = 0;
	let mitBeschlussvermerk = 0;

	for (const t of traktanden) {
		const dazu = durchgaenge.filter((d) => d.traktandumId === t.knoten.id);
		const m = massgebender(dazu);

		const ersetzung = await ersetzungslage(operatorId, meetingId, t.knoten.id, durchgaenge, traktanden);

		/*
		 * **Der Widerspruch vor dem Eröffnen** (Migration 129). Der während einer
		 * Abstimmung steht schon im Stand ihres Durchgangs; nur der frühe hat
		 * sonst keinen Ort im Protokoll.
		 */
		const vorher = widersprueche.get(t.knoten.id);
		const vorDemEroeffnen = vorher && vorher.durchgangId === null ? vorher : null;
		const universalvermerk = m?.universal?.stand ? protokollvermerkUniversal(m.universal.stand) : null;
		const e =
			m && m.zustand === 'geschlossen' ? await holeErgebnis(operatorId, meetingId, m.id) : null;
		const auszaehlung = e?.auszaehlung ?? null;

		/*
		 * **Nach dem Rückkommen neu abgestimmt, dann Neuabstimmung angesetzt**
		 * (Migration 131; seit H6 nur nach offenem Stichentscheid). Dann gilt
		 * weiter der frühere Beschluss, und der jüngste Durchgang liegt nach dem
		 * massgebenden. Mit dem Ergebnis des überholten: Wer das Protokoll liest,
		 * muss sehen können, ob er anders ausging (Fachprüfung 29.09.2026,
		 * Rz. 129 ad Art. 712n).
		 */
		const ueberholtNachRueckkommen = neuabstimmungNachRueckkommen(dazu, m);
		const nachRueckkommen = ueberholtNachRueckkommen
			? await (async () => {
					const a = (await holeErgebnis(operatorId, meetingId, ueberholtNachRueckkommen.id))
						.auszaehlung;
					const lage = ergebnislage(a);
					return {
						nummer: ueberholtNachRueckkommen.nummer,
						begruendung: ueberholtNachRueckkommen.ueberholungsgrund,
						ergebnis: lage === 'angenommen' || lage === 'abgelehnt' ? lage : null,
						unentschieden: a?.stichentscheidOffen === true,
						abgebrochen: abgebrochen(ueberholtNachRueckkommen),
						geltenderDurchgang: m!.nummer,
						geltendAbgelehnt: ergebnislage(auszaehlung) === 'abgelehnt'
					};
				})()
			: null;

		/*
		 * **Jede angesetzte Neuabstimmung mit Begründung** (Produktentscheid
		 * 30.09.2026: «Ja, immer nennen»). Das Protokoll geht an alle, und mit
		 * seiner Zustellung läuft die Anfechtungsfrist auch für die Abwesenden
		 * (Rz. 126 ad Art. 712n); vorher stand der Grund nur im Verlauf. Mit dem
		 * Ergebnis des überholten in Worten; die Zahlen nennt das Protokoll nicht.
		 * Ohne den jüngsten, wenn ihn `neuabstimmungOffen` oder
		 * `nachRueckkommen` schon nennt.
		 */
		const juengster = dazu.length > 0 ? dazu.reduce((a, b) => (b.nummer > a.nummer ? b : a)) : null;
		const schonGenannt = ueberholtNachRueckkommen?.id ?? (!m ? juengster?.id : undefined);
		const neuabstimmungen: {
			nummer: number;
			begruendung: string | null;
			ergebnis: 'angenommen' | 'abgelehnt' | null;
			unentschieden: boolean;
			abgebrochen: boolean;
		}[] = [];
		for (const d of [...dazu].sort((a, b) => a.nummer - b.nummer)) {
			if (d.ueberholungsart !== 'korrektur' || d.id === schonGenannt) continue;
			// Ein Durchgang, den `nachWeggang` schon nennt, nicht ein zweites Mal:
			// Setzt die Leitung nach einem Weggang eine Neuabstimmung an statt neu zu
			// eröffnen, trägt er `korrektur` und einen wieder eröffenbaren Stand, und
			// es stünden zwei widersprüchliche Sätze da (Codeprüfung 30.09.2026, M1).
			if (d.ueberholtAm && wiederEroeffenbar(d.universal?.stand)) continue;
			const a = (await holeErgebnis(operatorId, meetingId, d.id)).auszaehlung;
			const lage = ergebnislage(a);
			neuabstimmungen.push({
				nummer: d.nummer,
				begruendung: d.ueberholungsgrund,
				ergebnis: lage === 'angenommen' || lage === 'abgelehnt' ? lage : null,
				// Seit H6 der Regelfall: Überholt wird nur, was nicht verkündet ist.
				unentschieden: a?.stichentscheidOffen === true,
				abgebrochen: abgebrochen(d)
			});
		}

		/*
		 * **Überholte konsultative Durchgänge mit ihren Zahlen** (Migration 158).
		 * Ein späterer Durchgang hat sie überholt, meist der verbindliche, nachdem
		 * die Versammlung beschlussfähig wurde. Ihr Ergebnis war nie ein
		 * Beschluss; was sie festhalten, ist allein, wie die Anwesenden standen,
		 * und das fiele ohne die Zahlen weg. Ohne Ergebnis (abgebrochen) bleibt
		 * es bei den Neuabstimmungen oben.
		 *
		 * **Nach einem Rückzug auch der letzte** (Produktentscheid 14.10.2026,
		 * H7 Teil D): Ihn überholt nichts mehr, und der Satz zum Rückzug
		 * verdrängt im Protokoll den Abschnitt mit den Zahlen. Er ist dann der
		 * massgebende und trägt `auszaehlung`; die Auswertung zählt ihn wie jeden
		 * konsultativen als «kein Beschluss».
		 */
		const konsultativFrueher: NonNullable<Auswertungszeile['konsultativFrueher']> = [];
		for (const d of [...dazu].sort((a, b) => a.nummer - b.nummer)) {
			if (!d.konsultativ || (!d.ueberholtAm && !t.knoten.rueckzug)) continue;
			const a = (await holeErgebnis(operatorId, meetingId, d.id)).auszaehlung;
			if (!a) continue;
			konsultativFrueher.push({
				nummer: d.nummer,
				neuAnZweiter: d.konsultativNeu,
				zahlen: a.geheim
					? null
					: { koepfe: a.koepfe, quoten: a.quotenErhoben === false ? null : a.quoten }
			});
		}

		// Durch ein Rückkommen ersetzte Durchgänge, mit ihrem Ergebnis in Worten
		// (Produktentscheid 30.09.2026, «Nein heisst Nein»; Fachprüfung F-11).
		// Seit dem Produktentscheid 08.10.2026 mit der Nummer des Folgeantrags,
		// wenn der Durchgang durch dessen Beschluss ersetzt wurde (Migration 133):
		// Der Satz am Grundantrag soll den Folgeantrag nennen statt nur «durch
		// ein Rückkommen ersetzt» zu sagen (`docs/freigabe.md`, «Gebaut:
		// Folgeantrag nach Rückkommen, zwei Randfälle ohne eigenen Satz»).
		const ersetztNachRueckkommen: {
			nummer: number;
			ergebnis: 'angenommen' | 'abgelehnt' | null;
			/** Die Nummer des Folgeantrags, der diesen Durchgang ersetzt hat. */
			folgeantrag?: string | null;
		}[] = [];
		for (const d of [...dazu].sort((a, b) => a.nummer - b.nummer)) {
			if (d.ueberholungsart !== 'rueckkommen') continue;
			const lage = ergebnislage((await holeErgebnis(operatorId, meetingId, d.id)).auszaehlung);
			const ersetztDurch = d.ersetztDurchId
				? durchgaenge.find((x) => x.id === d.ersetztDurchId)
				: null;
			const folgeantrag =
				ersetztDurch && ersetztDurch.traktandumId !== t.knoten.id
					? (traktanden.find((x) => x.knoten.id === ersetztDurch.traktandumId)?.nummer ?? null)
					: null;
			ersetztNachRueckkommen.push({
				nummer: d.nummer,
				ergebnis: lage === 'angenommen' || lage === 'abgelehnt' ? lage : null,
				folgeantrag
			});
		}

		/*
		 * **Rückkommen beschlossen, aber nicht erneut abgestimmt** (Fachprüfung
		 * 30.09.2026, F-8). Der jüngste angenommene Rückkommensantrag auf dieses
		 * Geschäft, auf den sich kein Durchgang stützt. Eine Neuabstimmung auf den
		 * Durchgang danach nennt `nachRueckkommen`; dort gibt es einen.
		 */
		let rueckkommenOhneDurchgang: {
			antrag: string;
			geltenderDurchgang: number;
			geltendAbgelehnt: boolean;
			folgeantrag?: string | null;
		} | null = null;
		/*
		 * **Auch nach einer Ersetzung durch einen Folgeantrag** (B2b, zweiter
		 * Randfall; Produktentscheid 15.10.2026: eigener Satz). Dann hat das
		 * Grundtraktandum keinen geltenden Durchgang mehr, der Beschluss liegt am
		 * Folgeantrag, und ohne diesen Zweig stand unter dem Rückkommensantrag
		 * «siehe Traktandum 9», während Traktandum 9 nichts dazu sagte.
		 */
		const amFolgeantrag =
			!m &&
			ersetzung?.rolle === 'grundantrag' &&
			!ersetzung.spaeterErsetzt &&
			(ersetzung.ausgang === 'angenommen' || ersetzung.ausgang === 'abgelehnt')
				? ersetzung
				: null;
		if (amFolgeantrag) {
			const folgeDurchgang = durchgaenge.find((d) => d.id === amFolgeantrag.folgeDurchgangId);
			for (const r of traktanden) {
				if (r.knoten.rueckkommenZielId !== t.knoten.id) continue;
				if (durchgaenge.some((d) => d.rueckkommensantragId === r.knoten.id)) continue;
				const rm = massgebender(durchgaenge.filter((d) => d.traktandumId === r.knoten.id));
				if (!rm || rm.zustand !== 'geschlossen') continue;
				const lage = ergebnislage((await holeErgebnis(operatorId, meetingId, rm.id)).auszaehlung);
				if (lage !== 'angenommen' || !folgeDurchgang) continue;
				rueckkommenOhneDurchgang = {
					antrag: r.nummer,
					geltenderDurchgang: folgeDurchgang.nummer,
					geltendAbgelehnt: amFolgeantrag.ausgang === 'abgelehnt',
					folgeantrag: amFolgeantrag.folgeantrag.nummer
				};
			}
		}
		if (m && m.zustand === 'geschlossen') {
			for (const r of traktanden) {
				if (r.knoten.rueckkommenZielId !== t.knoten.id) continue;
				// Auch ein Durchgang über einen Folgeantrag, der statt des alten
				// Antrags zur Abstimmung kam: Dann gab es einen, und `ersetzung` sagt
				// es (Codeprüfung B1; Plan Folgeantrag nach Rückkommen, Soll 6).
				if (durchgaenge.some((d) => d.rueckkommensantragId === r.knoten.id)) continue;
				const rm = massgebender(durchgaenge.filter((d) => d.traktandumId === r.knoten.id));
				if (!rm || rm.zustand !== 'geschlossen') continue;
				const lage = ergebnislage((await holeErgebnis(operatorId, meetingId, rm.id)).auszaehlung);
				if (lage !== 'angenommen') continue;
				// Nur mit festem Ergebnis des geltenden (Codeprüfung Reste, N1).
				const lageGeltend = ergebnislage(auszaehlung);
				if (lageGeltend !== 'angenommen' && lageGeltend !== 'abgelehnt') continue;
				rueckkommenOhneDurchgang = {
					antrag: r.nummer,
					geltenderDurchgang: m.nummer,
					geltendAbgelehnt: ergebnislage(auszaehlung) === 'abgelehnt'
				};
			}
		}

		// Dieses Traktandum ist ein angenommener Rückkommensantrag, der keinen
		// Durchgang getragen hat (Laienprüfung Reste, L4).
		let rueckkommenNichtGenutzt: string | null = null;
		const ziel = t.knoten.rueckkommenZielId;
		if (ziel && m && ergebnislage(auszaehlung) === 'angenommen') {
			// An welchem Traktandum, zählt nicht: Auch ein Folgeantrag kann den
			// Durchgang tragen (Produktentscheid 30.09.2026); dann nennt ihn
			// `ersetzung`, und «erneut abgestimmt wurde nicht» wäre falsch.
			const genutzt = durchgaenge.some((d) => d.rueckkommensantragId === t.knoten.id);
			if (!genutzt) {
				rueckkommenNichtGenutzt = traktanden.find((x) => x.knoten.id === ziel)?.nummer ?? null;
			}
		}

		// Offener Stichentscheid nach dem Rückkommen (Reste vom 30.09.2026, Punkt 3).
		let rueckkommenStichentscheidOffen = false;
		for (const d of dazu) {
			if (d.ueberholungsart !== 'rueckkommen_erfolglos') continue;
			if ((await holeErgebnis(operatorId, meetingId, d.id)).auszaehlung?.stichentscheidOffen) {
				rueckkommenStichentscheidOffen = true;
			}
		}

		/*
		 * **Von Hand festgehalten** (Plan Beschluss von Hand, Block 1): Dann wurde
		 * gegen kein Erfordernis gerechnet, und die Zeile nennt keines, auch nicht
		 * das am Traktandum gesetzte. «Weglassen heisst nicht falsch behaupten»
		 * (Produktentscheid 30.09.2026).
		 */
		const vonHand = auszaehlung?.vonHand !== undefined;
		/*
		 * **Konsultativ: ohne Erfordernis und ohne Schwelle** (Migration 158;
		 * Fach- und Laienprüfung 14.10.2026, K7). Gegen die Schwelle wurde
		 * nichts entschieden, und «2 Ja, nötig 2» unter «kein Beschluss» las ein
		 * Abwesender als erreichte Mehrheit (Rz. 131 ad Art. 712n). Wie beim
		 * Beschluss von Hand: weglassen, nicht falsch behaupten.
		 */
		const konsultativ = auszaehlung?.keinBeschluss?.grund === 'konsultativ';
		const ohneErfordernis = vonHand || konsultativ;

		const neuabstimmungOffen = await (async () => {
			if (m || !juengster) return null;
			// Nur `korrektur` ist eine von der Leitung angesetzte
			// Neuabstimmung. Die Neueröffnung nach einem Weggang trägt seit
			// Migration 130 `neueroeffnung` und erscheint hier nicht.
			if (juengster.ueberholungsart !== 'korrektur') return null;
			// Mit dem Ergebnis in Worten: Wirkung hat, was im Protokoll steht
			// (Fachprüfung 30.09.2026, F-6; BGer 5C.254/2006 E. 3.1).
			const a = (await holeErgebnis(operatorId, meetingId, juengster.id)).auszaehlung;
			const lage = ergebnislage(a);
			return {
				nummer: juengster.nummer,
				begruendung: juengster.ueberholungsgrund,
				ergebnis: lage === 'angenommen' || lage === 'abgelehnt' ? lage : null,
				unentschieden: a?.stichentscheidOffen === true,
				abgebrochen: abgebrochen(juengster)
			};
		})();

		/*
		 * **Der Beschlussvermerk trägt nur, wo sonst «Es wurde nicht abgestimmt.»
		 * stünde** (Block 7b). Führt Votum doch etwas zu dem Traktandum, einen
		 * Folgeantrag an seiner Stelle oder eine angesetzte Neuabstimmung, bleibt
		 * es bei dem, was Votum weiss. Ein Vermerk, dessen Grundlage weggefallen
		 * ist, verschweigt so nichts.
		 *
		 * **Nicht dieselbe Bedingung wie `ohneErgebnis` im Kern**, sondern die
		 * Glieder davon, die hier vorliegen. Es fehlen drei: der Rückzug, der
		 * angenommene Folgeantrag unter dem Traktandum und der entschiedene
		 * Folgeantrag zur Wahl oder Abberufung unter dem Häkchen
		 * (`teileEntschieden`, Entscheid 0045, Punkt 9). `ohneErgebnis` lässt
		 * sich hier nicht rufen, weil `folgeantraegeAngenommen` die fertige
		 * Auswertung voraussetzt (`holeBeschlussvermerkLagen`). Beide Lagen
		 * entstehen nur in der laufenden Versammlung, der Vermerk nur nach dem
		 * Schluss und nur, wo `ohneErgebnis` zutrifft; die Auswertung schrieb
		 * dort schon bisher «Es wurde nicht abgestimmt.». Wer einen Schreibweg
		 * baut, der das ändert, zieht die Glieder hier nach.
		 */
		const beschlussvermerk =
			beschlussvermerke.has(t.knoten.id) &&
			t.knoten.art !== 'kenntnisnahme' &&
			!auszaehlung &&
			!ersetzung &&
			!neuabstimmungOffen;

		// Eine Kenntnisnahme, zu der die Leitung einen Beschluss von Hand
		// festgehalten hat, hat ein Ergebnis und zählt dort, wo es hingehört.
		if (t.knoten.art === 'kenntnisnahme' && !vonHand) ohneAbstimmung++;
		// Nach einer Ersetzung zählt die Sache beim Folgeantrag, nicht hier; und
		// ein Folgeantrag ohne Beschluss wurde abgestimmt, nur ohne Beschluss.
		else if (ergebnisLiegtAnderswo(ersetzung, auszaehlung)) {
			// zählt dort, wo der geltende Beschluss liegt
		} else if (
			!auszaehlung &&
			ersetzung?.rolle === 'folgeantrag' &&
			ersetzung.ausgang === 'ohne_beschluss'
		)
			keinBeschluss++;
		else if (beschlussvermerk) mitBeschlussvermerk++;
		else if (!auszaehlung) ohneAbstimmung++;
		else if (ergebnislage(auszaehlung) === 'angenommen') angenommen++;
		else if (ergebnislage(auszaehlung) === 'abgelehnt') abgelehnt++;
		else if (ergebnislage(auszaehlung) === 'kein_beschluss') keinBeschluss++;
		else ohneErgebnis++;

		zeilen.push({
			nummer: t.nummer,
			tiefe: t.tiefe,
			titel: t.knoten.titel,
			// Eine Kenntnisnahme mit einem von Hand festgehaltenen Beschluss hat ein
			// Ergebnis. Protokoll, Auswertungsseite und PDF verzweigen an `art` auf
			// «Kenntnisnahme, kein Beschluss»; an dieser einen Stelle umgestellt,
			// statt an jeder der fünf.
			art: vonHand && t.knoten.art === 'kenntnisnahme' ? 'abstimmung' : t.knoten.art,
			spontan: t.knoten.spontan ?? false,
			spontanart: t.knoten.spontanart ?? null,
			// Der geltende Rückzug, für den Satz in Seite und PDF (Schritt F2).
			rueckzug: t.knoten.rueckzug?.grund ?? null,
			// Die Fundstelle aus der Momentaufnahme: Es gilt, was bei der Freigabe
			// stand, nicht was die Gemeinschaft heute hinterlegt hat.
			ausnahmeVermerk:
				t.knoten.ausnahme === 'reglement'
					? protokollvermerkReglement(reglementGestattet(momentaufnahme?.ausnahmen))
					: t.knoten.ausnahme === 'universal'
						? // Der Stand beim Schliessen des massgebenden Durchgangs; vorher
							// nur, dass das Geschäft so aufgenommen ist.
							vorDemEroeffnen
							? protokollvermerkWiderspruchVorEroeffnen(
									{ name: vorDemEroeffnen.name, zeitpunkt: vorDemEroeffnen.am },
									universalvermerk,
									m && beschlussGilt(auszaehlung)
										? {
												durchgang: m.nummer,
												abgelehnt: ergebnislage(auszaehlung) === 'abgelehnt'
											}
										: null,
									!m && dazu.length > 0,
									nachRueckkommen
										? {
												durchgang: nachRueckkommen.geltenderDurchgang,
												abgelehnt: nachRueckkommen.geltendAbgelehnt
											}
										: null
								)
							: (universalvermerk ?? PROTOKOLLVERMERK_UNIVERSAL_AUFGENOMMEN)
						: null,
			durchgang: m?.nummer ?? null,
			// Überholte Durchgänge bleiben einsehbar; hier steht nur, wie viele es
			// sind — die Zahl gehört ins Protokoll, die Einzelheiten in den Verlauf.
			frueherenDurchgaenge: dazu.length > 0 ? dazu.length - 1 : 0,
			/*
			 * **Abgestimmt, dann Neuabstimmung angesetzt, nicht mehr eröffnet**
			 * (Fachprüfung Block 4a, Runde 3, F-1; Laienprüfung L11). Ohne das
			 * stand «Über diesen Antrag wurde nicht abgestimmt.», obwohl
			 * abgestimmt wurde, und der einzige Grund, warum kein Beschluss gilt,
			 * fehlte. Kommt vor allem nach einem Widerspruch vor dem neuen
			 * Eröffnen vor.
			 */
			neuabstimmungOffen,
			neuabstimmungNachRueckkommen: nachRueckkommen,
			neuabstimmungen,
			konsultativFrueher,
			nachWeggang: dazu
				.filter((d) => d.ueberholtAm && wiederEroeffenbar(d.universal?.stand))
				.sort((a, b) => a.nummer - b.nummer)
				.map((d) => ({
					nummer: d.nummer,
					namen: d.universal!.stand!.keinBeschluss!.namen,
					handzaehlung: d.universal!.stand!.keinBeschluss!.handzaehlung === true,
					nurDurchLeitung: d.universal!.stand!.keinBeschluss!.nurDurchLeitung ?? []
				})),
			// Und wie viele davon durch ein **Rückkommen** ersetzt wurden: Dort hat
			// die Versammlung zweimal entschieden, statt dass ein Fehler richtig
			// gestellt wurde (FR-44).
			frueherenDurchRueckkommen: dazu.filter((d) => d.ueberholungsart === 'rueckkommen').length,
			ersetztNachRueckkommen,
			rueckkommenOhneDurchgang,
			rueckkommenStichentscheidOffen,
			rueckkommenNichtGenutzt,
			ersetzung,
			// Ein erfolgloses Rückkommen: zurückgekommen, erneut abgestimmt, kein
			// Beschluss (die Universalversammlung hielt nicht, Migration 128, oder ein
			// Stichentscheid ist offen); der frühere Beschluss blieb in Kraft. Eine
			// Ablehnung endet seit dem 30.09.2026 nicht mehr hier («Nein heisst Nein»).
			rueckkommenErfolglos: dazu.some((d) => d.ueberholungsart === 'rueckkommen_erfolglos'),
			/*
			 * **Die Mehrheit, nicht der Fallname** (22.08.2026, Befund D-04).
			 *
			 * Bis hierher stand hier `titel` — der Fall, nicht die Regel. Im
			 * Protokoll las sich das als «Erforderliche Mehrheit: Décharge und
			 * Protokollgenehmigung», und das ist keine Mehrheit. Der Fall steht
			 * jetzt daneben, wo er hingehört.
			 */
			erfordernis: ohneErfordernis
				? null
				: m?.erfordernis
					? erfordernisInWorten(m.erfordernis)
					: t.knoten.erfordernis
						? erfordernisInWorten(t.knoten.erfordernis)
						: null,
			/** Der Fallname — als Einordnung neben der Regel, nicht an ihrer Stelle. */
			fall: ohneErfordernis ? null : (m?.erfordernis?.titel ?? t.knoten.erfordernis?.titel ?? null),
			/** Dann nennt das Protokoll keinen Fall als Herleitung (`mehrheitGesetzt`). */
			mehrheitGesetzt: (() => {
				const e = m?.erfordernis ?? t.knoten.erfordernis;
				return e ? mehrheitGesetzt(e) : false;
			})(),
			/**
			 * Was an diesem Traktandum ausser dem Abstimmen geschah (Befund D-02).
			 *
			 * Ausstand, Rückzug und dessen Rücknahme — in der Reihenfolge, in der
			 * sie geschahen. Sie erklären, was sonst unerklärlich bliebe: eine
			 * Bezugsgrösse, die kleiner ist als die Zahl der Stimmberechtigten,
			 * oder ein Antrag, über den doch abgestimmt wurde, obwohl er einmal
			 * zurückgezogen war.
			 */
			vorgaenge: vorgaenge
				.filter((v) => v.traktandumId === t.knoten.id)
				.map((v) => ({
					art: v.art,
					wer: v.handelnder,
					angaben: v.angaben,
					zeitpunkt: v.zeitpunkt,
					/*
					 * Ob nach der Rücknahme eines Rückzugs noch ein Durchgang eröffnet
					 * wurde (Schritt F2; `freigabe.md`, «Offen aus H7, Teil D», (d)).
					 * Ohne die Angabe sagte das Protokoll immer «und es wurde darüber
					 * abgestimmt». Beide Zeitpunkte sind ISO-Zeichenketten in UTC; «>=», weil sie
					 * nur Millisekunden tragen. Ein früherer Durchgang liegt vor dem Rückzug
					 * selbst, also deutlich vor der Rücknahme.
					 */
					...(v.art === 'agenda.item.withdrawal.revoked'
						? {
								// Ein danach eröffneter und abgebrochener Durchgang zählt
								// nicht (Codeprüfung F2, Befund 5).
								danachAbgestimmt: durchgaenge.some(
									(d) =>
										d.traktandumId === t.knoten.id &&
										d.eroeffnetAm >= v.zeitpunkt &&
										!abgebrochen(d)
								)
							}
						: {})
				})),
			rechtsgrundlage: ohneErfordernis
				? null
				: (m?.erfordernis?.rechtsgrundlage ?? t.knoten.erfordernis?.rechtsgrundlage ?? null),
			/**
			 * Die Fassung des Regelwerks zum Erfordernis (Ä-09), aus derselben
			 * Quelle wie die Rechtsgrundlage: dem eingefrorenen Erfordernis des
			 * Durchgangs, sonst dem des Traktandums.
			 */
			regelfassung: ohneErfordernis
				? null
				: (m?.erfordernis?.fassung ?? t.knoten.erfordernis?.fassung ?? null),
			/**
			 * Die Lesart der Gemeinschaft (Migration 169), aus derselben Quelle:
			 * dem eingefrorenen Erfordernis des Durchgangs, sonst dem des Traktandums.
			 */
			// Nur, wo nach ihr gerechnet wurde: nicht ohne Auszählung und nicht bei
			// «kein Beschluss» (Codeprüfung Teil 3, N4).
			lesart:
				ohneErfordernis || !auszaehlung || auszaehlung.keinBeschluss
					? null
					: (() => {
							const e = m?.erfordernis ?? t.knoten.erfordernis;
							// L2, L4, L6, L9, L11 und L12 am Mehr, daneben L3 an der Zählung (Migration 172): zwei
							// Zeilen, wenn beide an einem Traktandum wirken.
							const mehr = lesartProtokollsatz(e);
							// L13 hinter dem Satz zum Mehr, wie auf der Karte (Endfassung Block C, Abschnitt 3).
							const koepfe = kopfzaehlweiseProtokollsatz(e);
							const zaehlung = einsprachelesartProtokollsatz(e, momentaufnahme);
							return [mehr, koepfe, zaehlung].filter((s): s is string => s !== null).join(' ') || null;
						})(),
			// A5, Punkt 2: Abberufung und Einsprache haben eigene Wege (`anfechtungsabschnitt`).
			anfechtungssonderfall: (() => {
				const knoten = (m?.erfordernis ?? t.knoten.erfordernis)?.knotenId;
				return knoten === 'k-bewirtschaftung-abberufen'
					? ('abberufung' as const)
					: knoten === EINSPRACHE_KNOTEN
						? ('einsprache' as const)
						: null;
			})(),
			/** Der offene Beschluss zur geheimen Abstimmung (Migration 165, Ä-38). */
			geheimBeschlossen: m?.geheimBeschlossen === true,
			/** Nach Reglement (Migration 166, Ä-38). */
			geheimNachReglement: m?.geheimNachReglement === true,
			satz:
				auszaehlung && m?.erfordernis ? ergebnisInWorten(auszaehlung, m.erfordernis) : null,
			protokollsatz:
				auszaehlung && m?.erfordernis ? ergebniswertung(auszaehlung, m.erfordernis) : null,
			satzOhneNamen:
				auszaehlung && m?.erfordernis
					? ergebnisInWorten(auszaehlung, m.erfordernis, { namentlich: false })
					: null,
			/*
			 * **Geheim: ohne die Zahlenhinweise** (Produktentscheid 28.09.2026).
			 * Die Hinweise der Auszählung tragen bei einem Gleichstand die genaue
			 * Verteilung («Gleichstand bei den Kopfstimmen (2 zu 2)», «500
			 * Wertquoten dafür»), und diese Auswertung geht an alle Eigentümer.
			 * Die Sitzungsleitung sieht sie weiter über `holeErgebnis`; hier
			 * fallen sie weg. Der Satz darüber sagt nur erreicht/nicht erreicht.
			 */
			auszaehlung:
				auszaehlung && auszaehlung.geheim
					? { ...auszaehlung, hinweise: [] }
					: auszaehlung && konsultativ
						? {
								...auszaehlung,
								koepfe: { ...auszaehlung.koepfe, schwelle: null },
								quoten: { ...auszaehlung.quoten, schwelle: null }
							}
						: auszaehlung,
			// Die Vorab-Vermerke aus dem beim Schliessen festgeschriebenen Stand
			// (Block A2), auch widerrufene. Die Namen aus der Momentaufnahme, wie in
			// der Auszählung; vertreten heisst: in den beim Schliessen
			// festgeschriebenen Vertretungen.
			vorab: (m?.betroffene ?? [])
				.filter(
					(b): b is BetroffeneImDurchgang & { vorab: string } => b.vorab !== null
				)
				.map((b) => ({
					parteiId: b.parteiId,
					name:
						momentaufnahme?.parties.find((p) => p.partyId === b.parteiId)?.displayName ??
						b.parteiId,
					vermerk: b.vorab,
					durchVertretung: m?.vertretungen.some((v) => v.vertreteneId === b.parteiId) ?? false
				})),
			// Nur beim massgebenden Durchgang: Ein überholter Durchgang kann von
			// Hand gezählt worden sein, ohne dass es für das geltende Ergebnis
			// etwas bedeutet.
			handzaehlung: m?.handzaehlung
				? { vermerk: m.handzaehlung.vermerk, erfasstAm: m.handzaehlung.erfasstAm }
				: null,
			stichentscheid: m?.stichentscheid
				? {
						wahl: m.stichentscheid.wahl,
						wer: m.stichentscheid.wer,
						begruendung: m.stichentscheid.begruendung,
						...(m.stichentscheid.eigentuemer ? { eigentuemer: true } : {})
					}
				: null,
			/**
			 * Details, Präzisierungen oder Änderungen zum Beschluss — vom
			 * **massgebenden** Durchgang, wie die Handzählung darüber. Ein überholter
			 * trägt seinen eigenen Text, und der gehört nicht unter das geltende
			 * Ergebnis.
			 */
			beschlusstext: m?.beschlusstext ?? null,
			durchgangId: m?.id ?? null,
			beschlussvermerk
		});
	}

	return {
		versammlung,
		zeilen,
		unterbrechungen,
		zaehlweise: momentaufnahme
			? zaehlweiseImKopf(
					momentaufnahme.headCountMode,
					momentaufnahme.parkingCountsAsHead,
					momentaufnahme.headCountRuleSource
				)
			: null,
		stichentscheid: momentaufnahme
			? stichentscheidInWorten(momentaufnahme.tieBreak, gemeinschaftFundstelle)
			: null,
		angenommen,
		ohneErgebnis,
		keinBeschluss,
		abgelehnt,
		ohneAbstimmung,
		mitBeschlussvermerk
	};
}

/** Die Zahlen und Zeilen des Abschlussbildes an der Wand. */
export interface Abschlussbild {
	angenommen: number;
	abgelehnt: number;
	ohneAbstimmung: number;
	vonHand: number;
	zeilen: { nummer: string; titel: string; angenommen: boolean | null }[];
}

/**
 * Der Abschluss an der Wand, für `/p` (Anzeigecode) und die Präsentationssicht.
 *
 * **Eine Rechnung für beide Leinwände** (Nachzug Block 2b, 03.10.2026). Beide
 * Lader bauten dieselbe Aufstellung je selbst; zwei Abschriften derselben
 * Zählung laufen beim nächsten Umbau auseinander, und dann zeigt die eine
 * Leinwand andere Zahlen als die andere. Gezählt wird aus der `Auswertung`, die
 * die eine Quelle für Bildschirm, Protokoll und PDF ist. Die Begründungen der
 * beiden Lader stehen jetzt hier.
 */
export function abschlussbild(auswertung: Auswertung): Abschlussbild {
	return {
		angenommen: auswertung.angenommen,
		abgelehnt: auswertung.abgelehnt,
		/*
		 * **Nur Traktanden mit Abstimmung** (Praxisdurchlauf 28.08.2026). «Ohne
		 * Beschluss» neben «angenommen/abgelehnt» liest sich, als wäre über das
		 * Traktandum nicht abgestimmt worden; für eine Kenntnisnahme ist das
		 * missverständlich.
		 *
		 * **«Ohne Beschluss» umfasst den offenen Stichentscheid** (05.09.2026).
		 * Gezählt wurde `!z.auszaehlung`; ein Traktandum mit ausstehendem
		 * Entscheid hat aber eine Auszählung und fiel damit in keine der drei
		 * Zahlen: Die Wand zeigte für vier Traktanden eine Bilanz über drei.
		 * `ergebnislage` fasst beide Fälle, und die Beschriftung stimmt für
		 * beide, beschlossen ist dort nichts.
		 *
		 * Ohne den Grundantrag, dessen Beschluss ein Folgeantrag nach einem
		 * Rückkommen ersetzt hat: Die Sache steht beim Folgeantrag, und hier
		 * zählte sie sonst als «ohne Beschluss» (Codeprüfung B2b, M3).
		 */
		ohneAbstimmung: auswertung.zeilen.filter(
			(z) =>
				z.art === 'abstimmung' &&
				!ergebnisLiegtAnderswo(z.ersetzung, z.auszaehlung) &&
				// Mit Beschlussvermerk steht der Beschluss im Protokoll; die Wand
				// zählt ihn darunter eigens (Block 7c).
				!z.beschlussvermerk &&
				beschlossen(ergebnislage(z.auszaehlung)) === null
		).length,
		/*
		 * **Von Hand abgestimmt, im Protokoll festgehalten** (Block 7c). Bis dahin
		 * zählte die Wand ein Traktandum mit Beschlussvermerk als «ohne
		 * Beschluss», während Protokoll, Auswertung, Tafel und Leiste es anders
		 * führten. Die Zahl aus der Auswertung, nicht neu gezählt:
		 * `holeAuswertung` schränkt den Vermerk schon ein.
		 */
		vonHand: auswertung.mitBeschlussvermerk,
		zeilen: auswertung.zeilen
			.filter((z) => z.art === 'abstimmung' && !ergebnisLiegtAnderswo(z.ersetzung, z.auszaehlung))
			.map((z) => ({
				nummer: z.nummer,
				titel: z.titel,
				/*
				 * `null` heisst: kein Beschluss. Zurückgezogen, übersprungen, nie
				 * aufgerufen, **ein Stichentscheid, der aussteht**, oder eine
				 * Universalversammlung, die nicht gehalten hat (Migration 128). Die
				 * Wand nennt es «kein Beschluss», nicht «abgelehnt»: Es gab keine
				 * Mehrheit dagegen.
				 *
				 * **Über `ergebnislage`, nicht über das Rohfeld** (05.09.2026, aus dem
				 * Code-Review). `angenommen` ist beim offenen Stichentscheid `false`
				 * und damit nicht `null`; die Wand schrieb «abgelehnt» für einen
				 * Antrag, über den niemand befunden hat. Genau das, wogegen die
				 * Schranke in `versammlungsstand.ts` steht; sie schützt aber nur die
				 * laufende Abstimmung, nicht diese Abschlussliste.
				 */
				angenommen: beschlossen(ergebnislage(z.auszaehlung))
			}))
	};
}
