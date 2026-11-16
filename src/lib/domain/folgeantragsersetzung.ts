/**
 * Der Folgeantrag, der nach einem Rückkommen statt des alten Antrags zur
 * Abstimmung kam, und was Leitung, Wand, Auswertung, Protokoll und
 * Stimmnachweis darüber sagen (Plan
 * `docs/plan-folgeantrag-nach-rueckkommen-2026-09-30.md`, Soll 6) — rein.
 *
 * **Produktentscheid 30.09.2026:** Nach einem angenommenen Rückkommen darf
 * statt des alten Antrags ein Folgeantrag zur Abstimmung kommen, «statt des
 * alten». Angenommen ersetzt er den alten Beschluss, abgelehnt entfällt der
 * alte, ohne Beschluss bleibt er.
 *
 * **Warum ein eigenes Modul.** Drei Traktanden sind beteiligt: der Grundantrag,
 * der Rückkommensantrag und der Folgeantrag. Bis zu diesem Block las jede
 * Ausgabe den Durchgang je Traktandum und sah die Verbindung nicht; beim
 * Grundantrag stand nach einer Ersetzung «Es wurde nicht abgestimmt.», beim
 * Rückkommensantrag «Erneut abgestimmt wurde nicht». Die Lage wird hier einmal
 * gesucht (`findeErsetzung`) und in Sätze gefasst (`ersetzungInKuerze`), und
 * jede Ausgabe nimmt dieselben.
 *
 * **Die Wirkung einer Neuabstimmung nennen die Sätze nicht.** Ob die Leitung
 * einen verkündeten Durchgang überholen darf, ist offen (`docs/freigabe.md`,
 * «Offen: Aus der Prüfung zu ‹Rückkommen, dann Neuabstimmung›», (b)); bis zum
 * Entscheid geben neue Sätze nur die Anordnung wieder.
 */
import { abgebrochen, type Durchgang } from './abstimmung';
import type { Id } from './types';

/** Wie die Abstimmung über den Folgeantrag ausging. */
export type Ersetzungsausgang =
	/** Angenommen: Sein Beschluss ersetzt den alten. */
	| 'angenommen'
	/** Abgelehnt: Der alte Beschluss ist aufgehoben (Nein heisst Nein). */
	| 'abgelehnt'
	/** Kein Beschluss: Der alte bleibt in Kraft. */
	| 'ohne_beschluss'
	/** Die Leitung hat eine Neuabstimmung darauf angesetzt. */
	| 'neuabstimmung';

/** Die Durchgänge, an denen die Lage hängt, noch ohne Ergebnis und Titel. */
export interface Ersetzungsfund {
	/** Welche Rolle das gefragte Traktandum spielt. */
	rolle: 'grundantrag' | 'folgeantrag' | 'rueckkommensantrag';
	grundantragId: Id;
	folgeantragId: Id;
	rueckkommensantragId: Id;
	/**
	 * Der Durchgang über den Folgeantrag, dessen Ergebnis gilt: der, der das
	 * Rückkommen trug, oder der Beschluss von Hand, der ihn berichtigt hat.
	 */
	folgeDurchgangId: Id;
	/**
	 * Der Durchgang des Grundantrags, um dessen Beschluss es geht: der ersetzte,
	 * oder der, der ohne neuen Beschluss bleibt. Null, wenn keiner zu finden ist.
	 */
	fruehererDurchgangId: Id | null;
	/** Ohne das Ergebnis des Folgeantrags: das liest der Server nach. */
	art: 'ersetzt' | 'ohne_beschluss' | 'neuabstimmung';
	/**
	 * Nur bei `ersetzt`: Der Beschluss zum Folgeantrag ist nach einem weiteren
	 * Rückkommen selbst ersetzt worden.
	 */
	spaeterErsetzt: boolean;
	/**
	 * Nur bei `neuabstimmung`: Die Leitung hat die Abstimmung über den
	 * Folgeantrag ohne Ergebnis abgebrochen (H6, `abgebrochen`), statt eine
	 * Neuabstimmung anzusetzen. Dieselbe Lage, ein anderer Satz.
	 */
	abgebrochen?: boolean;
}

/**
 * Wo das Traktandum `traktandumId` an einem Rückkommen beteiligt ist, das über
 * einen Folgeantrag lief; sonst null.
 *
 * Gesucht werden geschlossene Durchgänge, die sich auf einen Rückkommensantrag
 * stützen (`rueckkommensantragId`) und an einem **anderen** Traktandum liegen
 * als dessen Ziel: Das ist der Folgeantrag, der statt des alten Antrags zur
 * Abstimmung kam. Rückkommen am selben Traktandum erklären die bisherigen
 * Sätze; sie bleiben hier aussen vor.
 *
 * Gibt es mehrere, zählt der jüngste. `ziele` bildet Rückkommensantrag auf sein
 * Ziel ab (`agenda_item.reconsiders_item_id`).
 */
export function findeErsetzung<T extends Durchgang & { rueckkommensantragId?: Id | null }>(
	alle: T[],
	traktandumId: Id,
	ziele: Map<Id, Id>
): Ersetzungsfund | null {
	const kandidaten = alle.filter((x) => {
		if (x.zustand !== 'geschlossen' || !x.rueckkommensantragId) return false;
		const ziel = ziele.get(x.rueckkommensantragId);
		if (!ziel || ziel === x.traktandumId) return false;
		return (
			ziel === traktandumId ||
			x.traktandumId === traktandumId ||
			x.rueckkommensantragId === traktandumId
		);
	});
	if (kandidaten.length === 0) return null;
	const x = kandidaten.reduce((a, b) =>
		b.eroeffnetAm > a.eroeffnetAm || (b.eroeffnetAm === a.eroeffnetAm && b.id > a.id) ? b : a
	);
	const ziel = ziele.get(x.rueckkommensantragId!)!;
	/*
	 * **Die Sätze folgen dem Stand** (Produktentscheid 01.10.2026, auf die
	 * Frage, was sie nach einem Beschluss von Hand ohne tragendes Rückkommen
	 * sagen sollen: «Sätze folgen dem Stand»). Hat die Leitung das Ergebnis des
	 * Folgeantrags von Hand berichtigt, ist dessen Durchgang am selben
	 * Traktandum als `notweg` überholt (Migration 134), und der berichtigende
	 * steht an seiner Stelle: Sein Ergebnis nennen die Sätze, nicht das
	 * überholte. Die Suche oben bleibt beim Durchgang, der das Rückkommen trug;
	 * auf ihn zeigt der ersetzte.
	 */
	const nachId = new Map(alle.map((d) => [d.id, d]));
	let folge = x;
	const besucht = new Set<Id>([x.id]);
	while (folge.ueberholungsart === 'notweg' && folge.ersetztDurchId) {
		const n = nachId.get(folge.ersetztDurchId);
		if (!n || n.traktandumId !== x.traktandumId || n.zustand !== 'geschlossen' || besucht.has(n.id)) {
			break;
		}
		besucht.add(n.id);
		folge = n;
	}
	const art: Ersetzungsfund['art'] =
		folge.ueberholungsart === 'rueckkommen_erfolglos'
			? 'ohne_beschluss'
			: folge.ueberholungsart === 'korrektur'
				? 'neuabstimmung'
				: 'ersetzt';
	/*
	 * Der frühere Durchgang: bei der Ersetzung der, dessen Verweis auf den
	 * Durchgang über den Folgeantrag zeigt; sonst der geltende der Sache, der
	 * ohne neuen Beschluss bleibt oder nach der Neuabstimmung wieder gilt
	 * (Migration 131 löscht den Verweis dann). Nach einem zweiten Rückkommen
	 * liegt er an einem früheren Folgeantrag (Fachprüfung 30.09.2026, Frage A);
	 * die Sätze nennen dann dessen Traktandum.
	 */
	// Nur der als `rueckkommen` ersetzte: Auf einen Beschluss von Hand zeigt auch
	// ein offener Durchgang, den er ohne Auszählung beendet hat (`notweg`,
	// Migration 134); der ist nicht «der bisherige» (Codeprüfung 01.10.2026, N1).
	const frueher =
		alle.find((d) => d.ersetztDurchId === x.id && d.ueberholungsart === 'rueckkommen') ??
		geltendZurZeit(alle, ziel, x);
	const rolle: Ersetzungsfund['rolle'] =
		ziel === traktandumId
			? 'grundantrag'
			: x.traktandumId === traktandumId
				? 'folgeantrag'
				: 'rueckkommensantrag';
	/*
	 * **Ein späteres Rückkommen am Grundantrag selbst überholt die Lage**
	 * (Codeprüfung B2b, M1). Wurde danach wieder über den alten Antrag
	 * abgestimmt, gestützt auf ein Rückkommen, erklären das die bisherigen Sätze
	 * am Grundantrag; der Satz über den Folgeantrag nannte sonst die Reihenfolge
	 * verdreht oder den späteren Durchgang als den, der blieb. Beim
	 * Rückkommensantrag genügt ein späterer Durchgang, der sich auf **ihn**
	 * stützt (nach einer Neuabstimmung am Folgeantrag der Weg über den alten
	 * Antrag). Der Satz beim Folgeantrag selbst bleibt: Er beschreibt dessen
	 * eigenen Durchgang.
	 */
	const spaeter = (y: T) =>
		y.zustand === 'geschlossen' &&
		y.id !== x.id &&
		(y.eroeffnetAm > x.eroeffnetAm || (y.eroeffnetAm === x.eroeffnetAm && y.id > x.id));
	/*
	 * Nur wenn der Grundantrag danach einen eigenen geltenden Durchgang hat
	 * (Codeprüfung B2b, zweiter Durchgang, Befund 2). Endete der spätere
	 * Durchgang ohne Beschluss, oder ist er selbst wieder ersetzt, erklärt nur
	 * dieser Satz, was mit dem Grundantrag geschah; ohne ihn fiel das Protokoll
	 * auf «nicht abgestimmt … gegenstandslos» zurück.
	 */
	if (
		rolle === 'grundantrag' &&
		alle.some(
			(y) => y.traktandumId === ziel && !!y.rueckkommensantragId && !y.ueberholtAm && spaeter(y)
		)
	) {
		return null;
	}
	if (
		rolle === 'rueckkommensantrag' &&
		alle.some((y) => y.rueckkommensantragId === x.rueckkommensantragId && spaeter(y))
	) {
		return null;
	}
	/*
	 * **Ein späterer Beschluss von Hand am Grundantrag, ohne Rückkommen**
	 * (Produktentscheid 01.10.2026: «Sätze folgen dem Stand»). Er überholt nur
	 * am eigenen Traktandum; der Durchgang des Folgeantrags bleibt daneben
	 * gültig, und zur Sache stehen zwei Beschlüsse. «Dieser Beschluss ersetzt
	 * den bisherigen» am Folgeantrag und «statt dieses Antrags kam … zur
	 * Abstimmung» am Grundantrag beschrieben dann einen Stand, der nicht mehr
	 * der letzte ist. Beide entfallen; jedes Traktandum zeigt sein eigenes
	 * Ergebnis. Der Satz am Rückkommensantrag bleibt: Worüber erneut abgestimmt
	 * wurde, ändert sich dadurch nicht.
	 *
	 * **Nur, wo der Folgeantrag ersetzt hat und sein Durchgang gilt**
	 * (Codeprüfung 01.10.2026, M1). Endete er ohne Beschluss oder ist er selbst
	 * ersetzt, hat der Folgeantrag kein eigenes Ergebnis; ohne den Satz stünde
	 * dort «nicht abgestimmt». Ein späterer Durchgang ohne Rückkommen entsteht
	 * am Grundantrag dann auch ohne Beschluss von Hand: nach einer Neuabstimmung
	 * auf den Durchgang, der blieb, ist das Rückkommen verbraucht.
	 */
	if (
		rolle !== 'rueckkommensantrag' &&
		art === 'ersetzt' &&
		!folge.ueberholtAm &&
		alle.some(
			(y) => y.traktandumId === ziel && !y.rueckkommensantragId && !y.ueberholtAm && spaeter(y)
		)
	) {
		return null;
	}
	return {
		rolle,
		grundantragId: ziel,
		folgeantragId: x.traktandumId,
		rueckkommensantragId: x.rueckkommensantragId!,
		folgeDurchgangId: folge.id,
		fruehererDurchgangId: frueher?.id ?? null,
		art,
		spaeterErsetzt: art === 'ersetzt' && folge.ueberholungsart === 'rueckkommen',
		abgebrochen: art === 'neuabstimmung' && abgebrochen(folge)
	};
}

/**
 * Der Durchgang, der zur Sache galt, als über den Folgeantrag abgestimmt wurde
 * (Codeprüfung B2b, M1). Nicht der heute geltende: Nach einem späteren
 * Rückkommen am Grundantrag nannte der Satz sonst diesen späteren Durchgang
 * als den, «bei dem es bleibt».
 *
 * Gesucht in der Kette der Sache (wie `massgebenderDerSache`): geschlossene
 * Durchgänge, vor dem Folgeantrag eröffnet, weder als Neuabstimmung noch als
 * erfolgloses Rückkommen überholt, und damals nicht schon durch einen anderen
 * ersetzt. Der jüngste davon.
 */
function geltendZurZeit<T extends Durchgang>(alle: T[], ziel: Id, x: T): T | null {
	const nachId = new Map(alle.map((d) => [d.id, d]));
	const kette = new Map<Id, T>();
	const offen = alle.filter((d) => d.traktandumId === ziel);
	while (offen.length > 0) {
		const d = offen.pop()!;
		if (kette.has(d.id)) continue;
		kette.set(d.id, d);
		if (d.ueberholungsart === 'rueckkommen' && d.ersetztDurchId) {
			const n = nachId.get(d.ersetztDurchId);
			if (n) offen.push(n);
		}
	}
	let bester: T | null = null;
	for (const d of kette.values()) {
		if (d.id === x.id || d.zustand !== 'geschlossen' || d.eroeffnetAm >= x.eroeffnetAm) continue;
		if (d.ueberholungsart && d.ueberholungsart !== 'rueckkommen') continue;
		if (d.ueberholungsart === 'rueckkommen') {
			const durch = d.ersetztDurchId ? nachId.get(d.ersetztDurchId) : undefined;
			if (durch && durch.eroeffnetAm < x.eroeffnetAm) continue;
		}
		// Gleiche Zeit: die Kennung, wie in `findeErsetzung` (uuidv7 ist zeitsortiert).
		if (
			!bester ||
			d.eroeffnetAm > bester.eroeffnetAm ||
			(d.eroeffnetAm === bester.eroeffnetAm && d.id > bester.id)
		) {
			bester = d;
		}
	}
	return bester;
}

/** Die Lage mit Nummern, Titeln und Ergebnissen, wie die Sätze sie brauchen. */
export interface Ersetzungslage {
	rolle: Ersetzungsfund['rolle'];
	/** Kennungen für Stellen, die weiterarbeiten (Wand, Neuabstimmung); die Sätze brauchen sie nicht. */
	grundantragId?: Id;
	folgeDurchgangId?: Id;
	fruehererDurchgangId?: Id | null;
	grundantrag: { nummer: string; titel: string };
	folgeantrag: { nummer: string; titel: string };
	/** Die Nummer des Rückkommensantrags, etwa «4.1». */
	rueckkommensantrag: string;
	/** Der frühere Durchgang der Sache; ohne ihn nennen die Sätze keinen. */
	frueher: {
		nummer: number;
		ergebnis: 'angenommen' | 'abgelehnt' | null;
		/**
		 * Die Nummer seines Traktandums, wenn er nicht am Grundantrag liegt:
		 * nach einem zweiten Rückkommen an einem früheren Folgeantrag.
		 */
		traktandum?: string | null;
	} | null;
	ausgang: Ersetzungsausgang;
	/** Siehe `Ersetzungsfund.spaeterErsetzt`. */
	spaeterErsetzt: boolean;
	/** Siehe `Ersetzungsfund.abgebrochen`. */
	abgebrochen?: boolean;
	/**
	 * Nur bei `ohne_beschluss`: warum, wie `grundOhneBeschluss` in
	 * `domain/rueckkommen.ts` (der kurze Grund oder `stichentscheid`).
	 */
	grund?: string | 'stichentscheid' | null;
}

/**
 * « zu Traktandum 4.2», wenn der frühere Durchgang an einem anderen Traktandum
 * liegt. Nicht am Folgeantrag selbst, wenn er dort liegt (Codeprüfung B2b, N5).
 */
function woanders(l: Ersetzungslage): string {
	if (!l.frueher?.traktandum) return '';
	if (l.rolle === 'folgeantrag' && l.frueher.traktandum === l.folgeantrag.nummer) return '';
	return ` zu Traktandum ${l.frueher.traktandum}`;
}

/**
 * Ob dieses Traktandum sein Ergebnis an einen anderen abgegeben hat: der
 * Grundantrag, dessen Beschluss ein Folgeantrag ersetzt hat, und der
 * Folgeantrag, dessen Beschluss später selbst ersetzt wurde. Sie zählen nicht
 * als «ohne Beschluss» (Codeprüfung B2b, M3 und zweiter Durchgang, Befund 3);
 * die Sache zählt dort, wo der geltende Beschluss liegt.
 */
export function ergebnisLiegtAnderswo(
	e: Ersetzungslage | null | undefined,
	eigeneAuszaehlung: unknown
): boolean {
	if (eigeneAuszaehlung || !e) return false;
	return e.rolle === 'grundantrag' || (e.rolle === 'folgeantrag' && e.spaeterErsetzt);
}

/** «aus dem 1. Durchgang («angenommen»)», oder leer ohne früheren Durchgang. */
function ausDemFrueheren(l: Ersetzungslage): string {
	if (!l.frueher) return '';
	return (
		`${woanders(l)} aus dem ${l.frueher.nummer}. Durchgang` +
		(l.frueher.ergebnis ? ` («${l.frueher.ergebnis}»)` : '')
	);
}

/** «Es bleibt beim Beschluss aus dem 1. Durchgang» bzw. bei der Ablehnung. */
function esBleibt(l: Ersetzungslage, zuTraktandum: boolean): string {
	const zu = l.frueher?.traktandum
		? woanders(l)
		: zuTraktandum
			? ` zu Traktandum ${l.grundantrag.nummer}`
			: '';
	const n = l.frueher ? ` aus dem ${l.frueher.nummer}. Durchgang` : '';
	return l.frueher?.ergebnis === 'abgelehnt'
		? `Es bleibt bei der Ablehnung${zu}${n}`
		: `Es bleibt beim Beschluss${zu}${n}`;
}

/** Warum kein Beschluss, als Nachsatz; beim offenen Stichentscheid ein eigener Satz. */
function ohneBeschlussSatz(l: Ersetzungslage, zuTraktandum: boolean): string {
	if (l.grund === 'stichentscheid') {
		// «Es stand unentschieden» wie im geprüften Satz beim selben Traktandum:
		// Ohne ihn erfährt niemand, dass es Stimmengleichheit gab (Laienprüfung
		// 30.09.2026, 1d).
		return (
			'Es stand unentschieden, und der Stichentscheid ist dabei nicht festgestellt. ' +
			`${esBleibt(l, zuTraktandum)}, bis eine Neuabstimmung entscheidet.`
		);
	}
	return (
		`Ein Beschluss kam dabei nicht zustande${l.grund ? ` (${l.grund})` : ''}. ` +
		`${esBleibt(l, zuTraktandum)}.`
	);
}

/**
 * Die Lage in wenigen Sätzen, für Leitung, Wand, Auswertung und
 * Stimmnachweis. Das Protokoll setzt dieselben Sätze ein und ergänzt, wo es
 * keine Zahlen zeigt, wer sie bekannt gibt.
 */
export function ersetzungInKuerze(l: Ersetzungslage): string {
	const g = `Traktandum ${l.grundantrag.nummer} «${l.grundantrag.titel}»`;
	const f = `Folgeantrag ${l.folgeantrag.nummer} «${l.folgeantrag.titel}»`;
	const nachRueckkommen = `Nach dem Rückkommen (Traktandum ${l.rueckkommensantrag})`;

	if (l.rolle === 'rueckkommensantrag') {
		return (
			`Erneut abgestimmt wurde über den ${f} statt über den bisherigen Antrag; siehe ` +
			`Traktandum ${l.folgeantrag.nummer}.`
		);
	}

	if (l.rolle === 'grundantrag') {
		const kam = `${nachRueckkommen} kam statt dieses Antrags der ${f} zur Abstimmung`;
		switch (l.ausgang) {
			case 'angenommen':
				return (
					`${kam}. Er wurde angenommen; sein Beschluss ersetzt den bisherigen` +
					`${ausDemFrueheren(l)}.`
				);
			case 'abgelehnt':
				/*
				 * **Abgelehnt ist der Folgeantrag, nicht die Sache** (Fachprüfung
				 * 30.09.2026, F-3; Laienprüfung 1b). «Zu dieser Sache gilt die
				 * Ablehnung» las sich beim Traktandum als Ablehnung des
				 * ursprünglichen Antrags, und das Protokoll wirkt, wie es lautet
				 * (Rz. 133 ad Art. 712n).
				 */
				return (
					`${kam}. Er wurde abgelehnt; damit ist der bisherige Beschluss${ausDemFrueheren(l)} ` +
					'aufgehoben. Abgelehnt ist nur der Folgeantrag; angenommen ist zu dieser Sache nichts ' +
					'mehr.'
				);
			case 'ohne_beschluss':
				return `${kam}. ${ohneBeschlussSatz(l, false)}`;
			case 'neuabstimmung':
				return (
					`${kam}; die Sitzungsleitung hat ` +
					(l.abgebrochen
						? 'die Abstimmung dort ohne Ergebnis abgebrochen'
						: 'dort eine Neuabstimmung angesetzt') +
					`, siehe Traktandum ${l.folgeantrag.nummer}.`
				);
		}
	}

	// Der Folgeantrag selbst. «zu Traktandum 4», ausser der bisherige Beschluss
	// liegt an einem früheren Folgeantrag; dann nennt `ausDemFrueheren` ihn.
	const statt = `${nachRueckkommen} wurde statt über den Antrag zu ${g} abgestimmt`;
	const zuG = l.frueher?.traktandum ? '' : ` zu Traktandum ${l.grundantrag.nummer}`;
	switch (l.ausgang) {
		case 'angenommen':
			return (
				`${statt}. Dieser Beschluss ersetzt den bisherigen${zuG}${ausDemFrueheren(l)}.` +
				(l.spaeterErsetzt ? spaeter(l) : '')
			);
		case 'abgelehnt':
			return (
				`${statt}. Mit der Ablehnung ist der bisherige Beschluss${zuG}${ausDemFrueheren(l)} ` +
				'aufgehoben.' +
				(l.spaeterErsetzt ? spaeter(l) : '')
			);
		case 'ohne_beschluss':
			return `${statt}. ${ohneBeschlussSatz(l, true)}`;
		case 'neuabstimmung':
			return `${statt}.`;
	}
}

function spaeter(l: Ersetzungslage): string {
	return (
		' Nach einem weiteren Rückkommen ist dieser Beschluss selbst ersetzt; siehe Traktandum ' +
		`${l.grundantrag.nummer}.`
	);
}
