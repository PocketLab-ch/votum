/**
 * Prüfdatei der Texte zu L6 (Reglementsschranke: das Reglement bindet seine
 * Änderung an die Zustimmung aller), aus dem Code erzeugt wie
 * `pruefdatei-lesart-zustaendigkeit.ts` (Konzept Lesarten, Abschnitt 4).
 *
 * Gezeigt wird, je Wahl («Klausel anwenden», «Nach dem Gesetz»): die Seite
 * «Lesarten», die Ergebniskarte der Herleitung, die Traktandenseite, die
 * Leitung vor der Abstimmung und Leitung und Protokoll nach der Abstimmung in
 * vier Fällen; dazu die Leitungskarte am Rückkommen auf den Beschluss neben der
 * des Beschlusses (Review DeepSeek 05.11.2026, B2), und den zweiten Durchgang
 * nach dem angenommenen Rückkommen mit Protokollauszug (Fachprüfung B2,
 * B2-F-6). Eine Gemeinschaft mit sechs Eigentümern zu 200, 180, 170, 160,
 * 150 und 140 von 1000; der Eigentümer zu 140 ist abwesend, weder da noch
 * vertreten, und zählt nach der Klausel wie ein Nein. Im ersten Fall ist er
 * vertreten: Nur so kann die Klausel eine Annahme ergeben.
 *
 * Aufruf im Container des Prüflaufs oder im Worktree:
 *
 *   ./node_modules/.bin/vite-node scripts/pruefdatei-f4c-l6.ts > <ziel>.md
 */
import { holeRegelwerk, knotenDerFassung } from '$lib/rules';
import { EIGENE_SCHRANKE_ID } from '$lib/rules/quorum-2026-11-05';
import {
	einspracheZaehlweiseHinweis,
	erfordernisAusKnoten,
	ergebniskarte,
	umstrittenSatz,
	type Erfordernis,
	type Ergebniskarte
} from '$lib/domain/entscheidbaum';
import { einstimmigkeitAusReglement, zirkularbeschlusshinweis } from '$lib/domain/mehrhinweise';
import {
	erfordernisFuerRueckkommen,
	rueckkommensauskunft,
	rueckkommenstitel,
	rueckkommenswortlaut
} from '$lib/domain/rueckkommen';
import { protokollentwurf, type Protokollzeile } from '$lib/domain/protokoll';
import {
	LESARTEN_VORGABE,
	knotenNachLesart,
	lesartVon,
	wendeLesartAn,
	type Lesartenwahl
} from '$lib/domain/lesarten';
import {
	andereLesartInWorten,
	andereLesartenVon,
	erfordernisInWorten,
	ergebnisInWorten,
	ergebniswertung,
	mehrheitGesetzt,
	lesartKartensatz,
	lesartProtokollsatz,
	mehrheitsvorschau,
	stichentscheidGrenzeKartensatz,
	zaehleAus,
	type Auszaehlung,
	type Auszaehlungslage
} from '$lib/domain/auszaehlung';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';

const RW = holeRegelwerk('2026-11-05');

/**
 * Die Sätze der Reglementsseite je Wahl, wie sie im Kasten stehen; der Test
 * prüft, dass jeder davon in `+page.svelte` steht.
 */
export const REGLEMENTSSEITE: [string, string][] = [
	[
		'Klausel anwenden (Vorgabe)',
		'Dieses Reglement verlangt für seine eigene Änderung Einstimmigkeit (Fundstelle). Die Angabe steht bei ' +
			'jedem Reglementstraktandum an der Frage im Entscheidbaum. Wer sie dort wählt, bekommt Einstimmigkeit; ' +
			'eine hinterlegte Abweichung mildert sie dann nicht.'
	],
	[
		'Nach dem Gesetz',
		'Dieses Reglement verlangt für seine eigene Änderung Einstimmigkeit (Fundstelle). Die Angabe steht bei ' +
			'jedem Reglementstraktandum an der Frage im Entscheidbaum. Wer sie dort wählt, bekommt nach Ihrer ' +
			'Lesart «Nach dem Gesetz» das qualifizierte Mehr nach Art. 712g Abs. 3 ZGB. Votum nennt dazu, wie der ' +
			'Beschluss nach der Klausel ausginge.'
	],
	[
		'Nach dem Gesetz, darunter (auch ohne Haken)',
		'Die Lesart «Nach dem Gesetz» wirkt nur an dieser Frage. Steht unter «Hinterlegte Abweichungen» für ' +
			'«Reglement ändern, gewöhnliche Bestimmung» eine Regel, die in jeder Hinsicht strenger ist als das ' +
			'Gesetz, rechnet Votum dort nach ihr. Es vermerkt, dass das umstritten ist. Verlangt diese ' +
			'Regel die Zustimmung aller, ist es dieselbe Klausel, nach der dieser Kasten fragt. Soll Ihre Lesart für sie gelten, wählen Sie im Entscheidbaum «Das Reglement ' +
			'verlangt für seine eigene Änderung Einstimmigkeit», auch wenn eine gewöhnliche Bestimmung geändert wird.'
	]
];
const zeilen: string[] = [];
const aus = (...z: string[]) => zeilen.push(...z);

function karte(titel: string, k: Ergebniskarte) {
	aus(`#### ${titel}`, '');
	for (const [feld, wert] of Object.entries(k)) {
		if (feld === 'freigabevermerk' || feld === 'hinweiseUnterRegel' || feld === 'lesart') continue;
		if (wert === null || wert === undefined || wert === '' || typeof wert === 'boolean') continue;
		if (Array.isArray(wert)) {
			if (wert.length === 0) continue;
			aus(`- **${feld}:**`);
			for (const w of wert) aus(`  - ${typeof w === 'string' ? w : JSON.stringify(w)}`);
		} else if (typeof wert === 'object') {
			aus(`- **${feld}:** ${JSON.stringify(wert)}`);
		} else {
			aus(`- **${feld}:** ${String(wert)}`);
		}
	}
	aus('');
}

/** Sechs Eigentümer, einer abwesend: weder da noch vertreten. */
const M: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-11-05T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: false,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	parties: [
		['p1', 'Erika Beispiel', 200],
		['p2', 'Hans Probe', 180],
		['p3', 'Grosse Wohnung AG', 170],
		['p4', 'Ida Muster', 160],
		['p5', 'Kurt Beispiel', 150],
		['p6', 'Lisa Probe', 140]
	].map(([id, name, quote]) => ({
		partyId: id as string,
		displayName: name as string,
		representativeName: null,
		isCommunity: false,
		units: [{ unitId: `${id}-u`, label: `Whg ${id}`, kind: 'unit' as const, countsAsHead: true, quota: quote as number }]
	}))
};

const ANWESENDE = ['p1', 'p2', 'p3', 'p4', 'p5'];

function stimmen(...wahlen: [string, VoteChoice][]): Vote[] {
	return wahlen.map(([p, choice]) => ({
		partyId: p,
		unitId: `${p}-u`,
		choice,
		castAt: '2026-11-05T19:10:00.000Z',
		recordedByChair: false
	}));
}

/**
 * Die vier Fälle: alle sechs stimmen zu, der Sechste vertreten; alle
 * Anwesenden stimmen zu, der Sechste fehlt; das qualifizierte Mehr ist
 * erreicht, die Zustimmung aller nicht; es ist nicht erreicht.
 */
const FAELLE: [string, Vote[], string[]][] = [
	[
		'Alle sechs stimmen zu; der Sechste ist vertreten',
		stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes'], ['p4', 'yes'], ['p5', 'yes'], ['p6', 'yes']),
		[...ANWESENDE, 'p6']
	],
	[
		'Alle Anwesenden stimmen zu; der Sechste ist abwesend',
		stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes'], ['p4', 'yes'], ['p5', 'yes']),
		ANWESENDE
	],
	[
		'Das qualifizierte Mehr ist erreicht, die Zustimmung aller nicht',
		stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes'], ['p4', 'yes'], ['p5', 'no']),
		ANWESENDE
	],
	[
		'Das qualifizierte Mehr ist nicht erreicht',
		stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'no'], ['p4', 'no'], ['p5', 'no']),
		ANWESENDE
	]
];

function erfordernis(wahl: Lesartenwahl) {
	const knoten = RW.knoten.find((k) => k.id === EIGENE_SCHRANKE_ID)!;
	return wendeLesartAn(erfordernisAusKnoten(RW, knoten), wahl);
}

/**
 * Die Karte der Leitung vor dem Eröffnen, in der Reihenfolge der Seite
 * (`versammlungen/[id]/leitung`: `+page.svelte` ab «Die nötige Mehrheit steht
 * beim Antrag» und «Warnungen vor dem Eröffnen», die Liste `mehrhinweise` in
 * `+page.server.ts`). Beschlussfähig ist die Versammlung in beiden Lagen; der
 * Satz zur zweiten Versammlung steht am Abend nicht dort. Die Meldung zum
 * zweiten Durchgang nach einem Rückkommen (`rueckkommen.satz`) gibt der
 * Abschnitt dazu eigens aus.
 */
type Rueckkommenslage = Pick<Auszaehlungslage, 'rueckkommenAufAnnahme' | 'nachRueckkommen'>;

function leitungskarte(e: Erfordernis, anwesende: string[], rk: Rueckkommenslage = {}) {
	const v = mehrheitsvorschau({
		momentaufnahme: M,
		erfordernis: e,
		anwesende,
		vertretungen: [],
		betroffeneParteiIds: [],
		alleEigentuemerBeklagt: [],
		imAusstand: [],
		...rk
	});
	aus(`- **Titel des Erfordernisses:** ${e.titel}`);
	if (v.kopf || v.quoten) {
		aus(`- **Beim Antrag (nötig):** ${v.satz}`);
		aus(`- **Darunter, klein:** ${v.regelInWorten} · ${e.titel}`);
	} else {
		aus(`- **Beim Freigeben:** Erfordernis: ${e.titel}`, `- **Darunter:** ${v.sperrgrund ?? v.satz}`);
	}
	if (v.ausstandshinweis) aus(`- **Saalhinweis:** ${v.ausstandshinweis}`);
	const warnungen = [
		v.erreichbarkeitshinweis ?? null,
		zirkularbeschlusshinweis(e, false),
		einstimmigkeitAusReglement(e, knotenDerFassung(e.fassung, e.knotenId)),
		einspracheZaehlweiseHinweis(e, M.headCountMode),
		lesartKartensatz(e),
		stichentscheidGrenzeKartensatz(e, M.tieBreak)
	].filter((t): t is string => t !== null);
	if (warnungen.length === 0) aus('- **Warnung:** (keine)');
	for (const w of warnungen) aus(`- **Warnung:** ${w}`);
	aus('');
}

function zaehle(e: Erfordernis, stimmenAb: Vote[], anwesende: string[], rk: Rueckkommenslage = {}): Auszaehlung {
	return zaehleAus({ momentaufnahme: M, erfordernis: e, stimmen: stimmenAb, anwesende, geheim: false, ...rk });
}

/** Ob alle sechs Ja gesagt haben (B2b): Daran hängt unter L6, ob der Beschluss nach beiden Lesarten besteht. */
function mitAllen(a: Auszaehlung): boolean {
	return a.koepfe.ja === M.parties.length;
}

aus(
	'# Prüfdatei: Votum F4c, Block 1 (L6 Reglementsschranke)',
	'',
	'Erzeugt aus dem Code mit `scripts/pruefdatei-f4c-l6.ts`, Fassung 2026-11-05.',
	'Leserin: Verwaltung und Sitzungsleitung einer Stockwerkeigentümergemeinschaft (Texte nach',
	'innen, aber mit Rechtsaussagen, die im Saal und im Protokoll zählen). Das Protokoll lesen auch',
	'Eigentümer. Die Karte erscheint im Entscheidbaum unter «Reglement ändern» › «Reglement',
	'verlangt für seine Änderung selbst Einstimmigkeit». Die Gemeinschaft: sechs Eigentümer zu',
	'200, 180, 170, 160, 150 und 140 von 1000; der Eigentümer zu 140 ist abwesend, weder da noch',
	'vertreten (im ersten Fall nach der Abstimmung ist er vertreten).',
	''
);

const GESETZ: Lesartenwahl = { ...LESARTEN_VORGABE, L6: 'gesetz' };
const WAHLEN: [string, Lesartenwahl][] = [
	['Klausel anwenden (Vorgabe)', LESARTEN_VORGABE],
	['Nach dem Gesetz', GESETZ]
];

aus('## 1. Katalog: Seite «Lesarten»', '');
const l6 = lesartVon('L6')!;
aus(`- **Frage:** ${l6.frage}`);
for (const w of l6.wahlen) {
	// Wie das Formular: erst die Wirkung, dann die Fundstelle (Lesartenwahl.svelte).
	aus(`- **Wahl «${w.bezeichnung}»${w.wert === l6.vorgabe ? ' (Vorgabe)' : ''}:** ${w.wirkung ? `${w.wirkung} ` : ''}${w.fundstelle}`);
}
aus(`- **Warum die Vorgabe:** ${l6.warumVorgabe}`);
if (l6.geltung) aus(`- **Geltung:** ${l6.geltung}`);
aus('');

// Der Vermerk steht unter jeder Herleitung und auf der Seite «Quorum»; neu ist nur sein letzter Satz.
aus('## Freigabevermerk der Fassung (neuer Satz)', '');
aus(`- ${RW.freigabevermerk.slice(holeRegelwerk('2026-11-04').freigabevermerk.length).trim()}`, '');

// Neu an der Antwort, die zur Karte führt (Fachprüfung 05.11.2026, E-1).
const selbst = RW.fragen.flatMap((f) => f.antworten).find((x) => x.id === 'f3-1-selbst')!;
aus('## Entscheidbaum: Hilfe an der Antwort zur Karte (neu)', '');
aus(`- **Antwort:** ${selbst.text}`, `- **Hilfe:** ${selbst.hilfe ?? '(keine)'}`, '');

// Zum Vergleich: der Satz, den alte Traktanden dieser Karte bis zur Fassung
// 2026-11-04 tragen, mit dem Erfordernis jener Fassung gerechnet (Codeprüfung 11).
const RW_VORHER = holeRegelwerk('2026-11-04');
const knotenVorher = RW_VORHER.knoten.find((k) => k.id === EIGENE_SCHRANKE_ID)!;
aus('## Traktandenseite bis zur Fassung 2026-11-04 (zum Vergleich, unverändert)', '');
aus(
	`- **Satz zur Gegenmeinung:** ${
		umstrittenSatz(erfordernisAusKnoten(RW_VORHER, knotenVorher), knotenVorher) ?? '(kein Satz)'
	}`,
	''
);

// Die Reglementsseite, Kasten «Änderung des Reglements», mit Haken bei der
// eigenen Schranke (Entscheid 0042). Von Hand aus der Seite übernommen; der
// Test vergleicht die Sätze mit der Seite.
aus('## Reglementsseite: Kasten «Änderung des Reglements» (neu unter «Nach dem Gesetz»)', '');
for (const [wahl, saetze] of REGLEMENTSSEITE) {
	aus(`- **${wahl}:** ${saetze}`);
}
aus('');

let abschnitt = 1;
for (const [titel, wahl] of WAHLEN) {
	abschnitt += 1;
	const e = erfordernis(wahl);
	const knoten = RW.knoten.find((k) => k.id === EIGENE_SCHRANKE_ID)!;
	aus(`## ${abschnitt}. Wahl «${titel}»`, '');

	aus('### Ergebniskarte der Herleitung', '');
	karte('Nach der eingestellten Wahl', ergebniskarte(RW, knotenNachLesart(RW, knoten, wahl)));

	aus('### Traktandenseite', '');
	aus(`- **Satz zur Lesart (Kasten «Zu beachten»):** ${lesartKartensatz(e)}`);
	aus(
		`- **Satz zur Gegenmeinung (Fassung 2026-11-05):** ${
			umstrittenSatz(e, knotenDerFassung(e.fassung, e.knotenId)) ?? '(schweigt; die Lesart trägt die andere Ansicht)'
		}`
	);
	aus('');

	aus('### Leitung vor der Abstimmung', '');
	const vorschau = mehrheitsvorschau({
		momentaufnahme: M,
		erfordernis: e,
		anwesende: ANWESENDE,
		vertretungen: [],
		betroffeneParteiIds: [],
		alleEigentuemerBeklagt: [],
		imAusstand: []
	});
	aus(`- **Mehrheit, das sagt die Leitung:** ${vorschau.satz}`);
	aus(
		`- **Warnung, wenn die Mehrheit im Saal nicht zu erreichen ist:** ${
			vorschau.erreichbarkeitshinweis ?? '(kein Satz: Die Mehrheit ist mit den Anwesenden erreichbar)'
		}`
	);
	aus('');

	aus('### Leitung und Protokoll nach der Abstimmung', '');
	for (const [fall, stimmenAb, anwesende] of FAELLE) {
		const a = zaehle(e, stimmenAb, anwesende);
		aus(`#### Fall: ${fall}`, '');
		aus(`- **Ergebnis nach der eingestellten Wahl:** ${a.angenommen ? 'angenommen' : 'abgelehnt'}`);
		if (a.andereLesart) {
			const s = andereLesartInWorten(a.andereLesart, false);
			aus(`- **Leitung:** ${s.leitung}`);
		} else {
			aus('- **Leitung:** (kein zweites Ergebnis)');
		}
		// Was das Protokoll am Ausgang trägt; der Satz zum zweiten Ergebnis steht darunter.
		const ausgang = (a.protokollhinweise ?? []).filter((h) => h.ort === 'ausgang');
		if (ausgang.length === 0) aus('- **Protokoll am Ausgang:** (kein Satz)');
		for (const h of ausgang) aus(`- **Protokoll am Ausgang:** ${h.satz}`);
		aus(`- **Zeile im Protokoll je Beschluss:** ${lesartProtokollsatz(e)}`, '');
	}

	/*
	 * **Das Rückkommen auf den angenommenen Beschluss** (Review DeepSeek
	 * 05.11.2026, B2; B2b): dasselbe Mehr, die Lesart des Beschlusses für die
	 * Sätze der Leitung, und seit B2b, ob der Beschluss die Ja-Stimmen aller
	 * hatte. Unter der Klausel hatte er sie immer; unter dem Gesetz je ein
	 * Abschnitt für beide Ausgänge. Zum Vergleich je Lage die Karte des
	 * Beschlusses davor.
	 */
	const nachGesetz = wahl.L6 === 'gesetz';
	const beschlussAusgaenge: [string, boolean][] = nachGesetz
		? [
				['Der Beschluss hatte die Ja-Stimmen aller sechs', true],
				['Der Beschluss hatte nur das qualifizierte Mehr', false]
			]
		: [['Der Beschluss hatte die Ja-Stimmen aller sechs (unter dieser Wahl immer)', true]];
	for (const [ausgang, alleJa] of beschlussAusgaenge) {
		const rk = erfordernisFuerRueckkommen(e, true, null, alleJa);
		aus(`### Leitungskarte vor dem Eröffnen: Beschluss und Rückkommen. ${ausgang}`, '');
		for (const [lage, anwesende] of [
			['Alle sechs sind da', [...ANWESENDE, 'p6']],
			['Der Sechste ist abwesend (oder gegangen)', ANWESENDE]
		] as const) {
			aus(`#### Lage: ${lage}`, '');
			aus('##### Karte des Beschlusses', '');
			leitungskarte(e, [...anwesende]);
			aus('##### Karte des Rückkommens auf den angenommenen Beschluss', '');
			leitungskarte(rk, [...anwesende], { rueckkommenAufAnnahme: true });
		}

		aus(`### Rückkommen: Leitung und Protokoll nach der Abstimmung. ${ausgang}`, '');
		for (const [fall, stimmenAb, anwesende] of FAELLE) {
			const a = zaehle(rk, stimmenAb, anwesende, { rueckkommenAufAnnahme: true });
			aus(`#### Rückkommen, Fall: ${fall}`, '');
			aus(`- **Ergebnis:** ${a.angenommen ? 'angenommen' : 'abgelehnt'}`);
			const andere = andereLesartenVon(a);
			if (andere.length === 0) aus('- **Leitung:** (kein Satz)');
			for (const r of andere) aus(`- **Leitung:** ${andereLesartInWorten(r, false).leitung}`);
			const ausgangssaetze = (a.protokollhinweise ?? []).filter((h) => h.ort === 'ausgang');
			if (ausgangssaetze.length === 0) aus('- **Protokoll am Ausgang:** (kein Satz)');
			for (const h of ausgangssaetze) aus(`- **Protokoll am Ausgang:** ${h.satz}`);
			aus(`- **Zeile im Protokoll je Beschluss:** ${lesartProtokollsatz(rk) ?? '(keine)'}`, '');
		}
	}

	/*
	 * **Der zweite Durchgang nach dem angenommenen Rückkommen** (Fachprüfung
	 * B2, B2-F-6): Er rechnet mit dem Erfordernis des Traktandums samt Lesart
	 * und zweitem Ergebnis (`server/abstimmung.ts` lädt `requirement_reading`
	 * am Traktandum); seit B2b weiss er, wie Beschluss und Rückkommen ausgingen
	 * (`nachRueckkommen`). Unter dem Gesetz der Fall, in dem das zählt: Der
	 * Beschluss hatte die Ja-Stimmen aller, das Rückkommen nur das
	 * qualifizierte Mehr. Gezeigt
	 * werden die Meldung vor dem Eröffnen, die Karte, die Sätze nach der
	 * Abstimmung und der Protokollauszug beider Traktanden, gerendert mit
	 * `protokollentwurf`. Die Felder der Protokollzeilen setzt das Skript wie
	 * `server/auswertung.ts`, soweit sie hier Sätze tragen; der Rückkommensantrag
	 * steht als Untertraktandum «1.1» wie in `server/traktanden.ts`.
	 */
	const rk = erfordernisFuerRueckkommen(e, true, null, true);
	const [rkFall, rkStimmen, rkAnwesende] = nachGesetz ? FAELLE[2] : FAELLE[0];
	const aRk = zaehle(rk, rkStimmen, rkAnwesende, { rueckkommenAufAnnahme: true });
	const nachRk: Rueckkommenslage = {
		nachRueckkommen: {
			traktandum: '1.1',
			geltenderDurchgang: 1,
			beschlussMitAllen: true,
			rueckkommenMitAllen: mitAllen(aRk)
		}
	};
	if (!aRk.angenommen) throw new Error(`Das Rückkommen im Fall «${rkFall}» ist nicht angenommen.`);
	aus('### Zweiter Durchgang nach dem angenommenen Rückkommen', '');
	aus(
		`Angenommen ist das Rückkommen ${
			nachGesetz
				? 'unter dieser Wahl schon mit dem qualifizierten Mehr; hier im Fall'
				: 'unter dieser Wahl nur mit allen sechs; hier im Fall'
		} «${rkFall}»; der Beschluss hatte die Ja-Stimmen aller sechs.`,
		''
	);
	const auskunft = rueckkommensauskunft({
		abgestimmt: true,
		antrag: { nummer: '1.1', stand: 'angenommen', verbraucht: false }
	});
	aus(`- **Leitung vor dem Eröffnen (grüne Meldung auf der Karte, nach den Warnungen):** ${auskunft.satz}`, '');
	aus('#### Karte vor dem Eröffnen, der Sechste ist da', '');
	leitungskarte(e, [...ANWESENDE, 'p6'], nachRk);
	aus(`#### Karte vor dem Eröffnen, der Sechste ist ${nachGesetz ? 'nicht da' : 'gegangen'}`, '');
	leitungskarte(e, ANWESENDE, nachRk);
	const danach = rueckkommensauskunft({
		abgestimmt: true,
		antrag: { nummer: '1.1', stand: 'angenommen', verbraucht: true }
	});
	aus('#### Nach dem zweiten Durchgang, in jedem Fall', '');
	aus(`- **Leitung, Meldung am Traktandum (Warnung):** ${danach.satz}`, '');

	const ziel = { nummer: '1', titel: 'Änderung des Reglements, Art. 12 (Hauswart)' };
	for (const [fall, stimmenAb, anwesende] of FAELLE) {
		const a = zaehle(e, stimmenAb, anwesende, nachRk);
		aus(`#### Zweiter Durchgang, Fall: ${fall}`, '');
		aus(`- **Ergebnis nach der eingestellten Wahl:** ${a.angenommen ? 'angenommen' : 'abgelehnt'}`);
		aus(`- **Leitung, Ergebnis:** ${ergebnisInWorten(a, e)}`);
		for (const h of a.hinweise) aus(`- **Leitung, Hinweis:** ${h}`);
		const andere = andereLesartenVon(a);
		if (andere.length === 0) aus('- **Leitung, andere Lesart:** (kein zweites Ergebnis)');
		for (const r of andere) aus(`- **Leitung, andere Lesart:** ${andereLesartInWorten(r, false).leitung}`);
		aus('- **Protokollauszug:**', '');
		const auszug = protokollentwurf({
			gemeinschaft: 'STWEG Beispielweg',
			datum: '2026-11-05',
			uhrzeit: '19:00',
			ort: 'Probesaal',
			art: 'ordentlich',
			stufe: 'erste',
			schlusszeit: '21:00',
			sitzungsleitung: null,
			protokollfuehrung: null,
			beschlussfaehigkeit: null,
			zaehlweise: 'Eine Stimme je Eigentümer',
			stichentscheid: null,
			teilnehmer: [],
			zeilen: [
				protokollzeile({
					nummer: ziel.nummer,
					titel: ziel.titel,
					antragswortlaut: 'Art. 12 des Reglements wird neu gefasst.',
					...erfordernisfelder(e),
					satz: ergebniswertung(a, e),
					zahlen: zahlenspiegel(a),
					lesart: lesartProtokollsatz(e),
					protokollhinweise: a.protokollhinweise ?? [],
					durchgang: 2,
					frueherenDurchgaenge: 1,
					frueherenDurchRueckkommen: 1,
					ersetztNachRueckkommen: [{ nummer: 1, ergebnis: 'angenommen' }]
				}),
				protokollzeile({
					nummer: '1.1',
					tiefe: 1,
					titel: rueckkommenstitel(ziel),
					antragswortlaut: rueckkommenswortlaut(ziel, true),
					...erfordernisfelder(rk),
					satz: ergebniswertung(aRk, rk),
					zahlen: zahlenspiegel(aRk),
					lesart: lesartProtokollsatz(rk),
					protokollhinweise: aRk.protokollhinweise ?? [],
					spontan: true
				})
			],
			erzeugtAm: '5. November 2026, 21:30',
			erzeugtDurch: 'Prüfdatei'
		});
		// Nur die zwei Traktanden: der Abschnitt «Verhandlungen» bis vor den nächsten.
		const verhandlungen = auszug.split('\n## Verhandlungen\n')[1];
		if (!verhandlungen) throw new Error('Protokollentwurf ohne Abschnitt «Verhandlungen»');
		for (const z of verhandlungen.split('\n## ')[0].trim().split('\n')) aus(`  > ${z}`.trimEnd());
		aus('');
	}
}

/** Die Felder zur Mehrheit wie in `server/auswertung.ts` (Befund D-04: die Regel, nicht der Fallname). */
function erfordernisfelder(x: Erfordernis) {
	return {
		erfordernis: erfordernisInWorten(x),
		fall: x.titel,
		rechtsgrundlage: x.rechtsgrundlage,
		regelfassung: x.fassung,
		mehrheitGesetzt: mehrheitGesetzt(x)
	};
}

/**
 * Der Zahlenspiegel wie `protokollspiegel` in `server/protokoll.ts` (dort nicht
 * ausgeführt): Ohne ihn hält `protokollentwurf` den Antrag für nicht abgestimmt.
 */
function zahlenspiegel(a: Auszaehlung): Protokollzeile['zahlen'] {
	const sp = (s: Auszaehlung['koepfe']) => ({
		ja: s.ja,
		nein: s.nein,
		enthaltung: s.enthaltung,
		ohneAbgabe: s.ohneAbgabe,
		nichtAnwesend: s.nichtAnwesend,
		...(s.stimmtNicht ? { stimmtNicht: s.stimmtNicht } : {}),
		...(s.imAusstand ? { imAusstand: s.imAusstand } : {}),
		basis: s.basis,
		schwelle: s.schwelle
	});
	return { koepfe: sp(a.koepfe), quoten: sp(a.quoten) };
}

/** Eine Zeile des Protokollentwurfs mit den Angaben, die hier nichts ändern. */
function protokollzeile(u: Partial<Protokollzeile> & Pick<Protokollzeile, 'nummer' | 'titel'>): Protokollzeile {
	return {
		tiefe: 0,
		art: 'abstimmung',
		antragswortlaut: null,
		kurzfassung: null,
		notiz: null,
		erfordernis: null,
		rechtsgrundlage: null,
		rueckzug: null,
		beschlusstext: null,
		pendenzen: [],
		satz: null,
		zahlen: null,
		quotenErhoben: true,
		handzaehlung: null,
		ohneZustimmung: [],
		durchgang: 1,
		frueherenDurchgaenge: 0,
		frueherenDurchRueckkommen: 0,
		rueckkommenErfolglos: false,
		antragsteller: null,
		folgeantraegeAngenommen: null,
		stichentscheid: null,
		stellvertretend: [],
		spontan: false,
		vorgezogen: false,
		...u
	};
}

console.log(zeilen.join('\n'));
