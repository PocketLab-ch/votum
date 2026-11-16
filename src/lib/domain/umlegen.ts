/**
 * Angaben der gemeinsamen Versammlung auf ihre Teilnehmerinnen umlegen (rein).
 *
 * **Warum es das gibt.** Eine gemeinsame Versammlung ist ein Termin, den mehrere
 * Gemeinschaften teilen. Verschiebt sich der Abend, verschiebt sich jede
 * einzelne Versammlung mit — bis zum 11.08.2026 aber nur von Hand, Haus für
 * Haus. Gemeldet: «Auch sollte man dies global ändern können, damit ich nicht
 * X mal Angaben korrigieren muss, wenn der Ort oder Zeit und Datum änderten.»
 *
 * **Was nicht umgelegt wird, wird genannt.** Ab der Freigabe steht Datum und Ort
 * in versandten Einladungen; sie dort still zu überschreiben hiesse, die
 * Einladung zur Lüge zu machen. Solche Versammlungen bleiben stehen — und
 * erscheinen in der Meldung, damit niemand annimmt, es sei alles nachgezogen.
 *
 * Rein: hinein gehen Ziel und Teilnehmerinnen, heraus kommt der Plan.
 */
import type { Betriebsart, Versammlungsart, Versammlungszustand } from './versammlung';
import { zustandsname } from './versammlung';

/** Eine mittagende Versammlung, so weit die Rechnung sie kennen muss. */
export interface Mittagende {
	id: string;
	gemeinschaft: string;
	zustand: Versammlungszustand;
	datum: string;
	uhrzeit: string;
	ort: string;
	art: Versammlungsart;
	anlass: string | null;
	betriebsart: Betriebsart;
}

/** Was die gemeinsame Versammlung vorgibt. */
export interface Umlegeziel {
	datum: string;
	uhrzeit: string;
	ort: string;
	art: Versammlungsart;
	anlass: string | null;
	betriebsart: Betriebsart;
}

export interface Umlegeplan {
	/** Was geändert wird, mit den Namen der Angaben. */
	aendern: { id: string; gemeinschaft: string; was: string[] }[];
	/** Wer schon passt — nichts zu tun. */
	unveraendert: string[];
	/** Wer nicht kann, mit Grund. */
	gesperrt: { gemeinschaft: string; grund: string }[];
}

export function planeUmlegung(ziel: Umlegeziel, mittagende: Mittagende[]): Umlegeplan {
	const plan: Umlegeplan = { aendern: [], unveraendert: [], gesperrt: [] };

	for (const m of mittagende) {
		const was: string[] = [];
		if (m.datum !== ziel.datum) was.push('Tag');
		if (kurz(m.uhrzeit) !== kurz(ziel.uhrzeit)) was.push('Beginn');
		if (normiert(m.ort) !== normiert(ziel.ort)) was.push('Ort');
		if (m.art !== ziel.art) was.push('Art');
		else if (m.art === 'ausserordentlich' && (m.anlass ?? '') !== (ziel.anlass ?? ''))
			was.push('Anlass');
		/*
		 * **Die Betriebsart gehört dazu** (Auftraggeber, 25.08.2026: «Wie wird
		 * abgestimmt? fehlt bei Gruppenveranstaltung»). Im Saal wird einheitlich
		 * gezählt; zwei Verfahren nebeneinander liessen sich nicht führen.
		 *
		 * Sie steht **nach** Datum und Ort in der Aufzählung, weil sie im
		 * Alltag seltener wechselt — die Liste soll mit dem beginnen, weswegen
		 * man die Seite geöffnet hat.
		 */
		if (m.betriebsart !== ziel.betriebsart) was.push('Abstimmungsweise');

		if (was.length === 0) {
			plan.unveraendert.push(m.gemeinschaft);
			continue;
		}
		// Die Sperre kommt **nach** dem Vergleich: Eine freigegebene Versammlung,
		// die ohnehin passt, ist kein Fall für eine Warnung.
		if (m.zustand !== 'entwurf') {
			plan.gesperrt.push({ gemeinschaft: m.gemeinschaft, grund: sperrgrund(m.zustand) });
			continue;
		}
		plan.aendern.push({ id: m.id, gemeinschaft: m.gemeinschaft, was });
	}

	return plan;
}

/**
 * Was geschehen ist, in einem Satz.
 *
 * Nennt beides: was übernommen wurde und was nicht. Eine Meldung, die nur den
 * Erfolg zählt, liest sich wie «alles erledigt» — und genau das wäre falsch.
 */
export function umlegungsmeldung(plan: Umlegeplan): string {
	const teile: string[] = [];

	if (plan.aendern.length > 0) {
		const angaben = [...new Set(plan.aendern.flatMap((a) => a.was))];
		teile.push(
			`${verbunden(angaben)} auf ${plan.aendern.length} ${
				plan.aendern.length === 1 ? 'Versammlung' : 'Versammlungen'
			} übernommen.`
		);
	} else if (plan.gesperrt.length === 0) {
		teile.push('Alle Versammlungen stimmten schon überein.');
	}

	if (plan.gesperrt.length > 0) {
		teile.push(
			`Nicht übernommen bei ${plan.gesperrt
				.map((g) => `${g.gemeinschaft} (${g.grund})`)
				.join(', ')}. Dort ändern Sie es auf der Seite der Versammlung.`
		);
	}

	return teile.join(' ');
}

/**
 * Warum eine Versammlung nicht mitzieht — je Zustand ein eigener Satz.
 *
 * «laufend — die Angaben stehen in der Einladung» stand einmal da und war
 * schief: Bei einer laufenden Versammlung ist die Einladung längst nicht mehr
 * das Hindernis, sondern dass sie begonnen hat.
 */
function sperrgrund(zustand: Versammlungszustand): string {
	if (zustand === 'freigegeben') return 'freigegeben — der Tag steht in der Einladung';
	if (zustand === 'laufend') return 'läuft gerade';
	return `${zustandsname(zustand)} — sie hat stattgefunden`;
}

/** «19:00:00» und «19:00» sind derselbe Beginn. */
function kurz(zeit: string): string {
	return zeit.slice(0, 5);
}

function normiert(ort: string): string {
	return ort.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-CH');
}

function verbunden(teile: string[]): string {
	if (teile.length === 1) return teile[0];
	return `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`;
}
