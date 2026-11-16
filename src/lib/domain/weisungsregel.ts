/**
 * Wie ein Haus über die Weisung an seinen Vertreter entscheidet (Migration 085).
 *
 * **Der Auftrag** (Auftraggeber, 25.08.2026): «In meinem Reglement steht: Ist ein
 * dominierendes Grundstück in Stockwerkeigentum aufgeteilt, so haben die
 * beteiligten Stockwerkeigentümer nur eine Stimme, die sie durch einen durch sie
 * bezeichneten Vertreter auszuüben haben. […] Also einfaches Mehr. Es könnte
 * auch Qual-Mehr geben. Das muss abgebildet werden können. Also wie viele
 * Kopfstimmen braucht es in % oder im Verhältnis. Dasselbe wenn WQ auch
 * abgebildet ist. Also K und oder WQ.»
 *
 * **Was hier NICHT passiert: nachrechnen.** Die Regel wird zum **Erfordernis**
 * des Weisungstraktandums im Haus. Das Haus stimmt danach ab, sein Beschluss
 * steht fest, und die Weisung liest ihn. Würde die Miteigentümergemeinschaft
 * dieselben Stimmen ein zweites Mal nach einer zweiten Regel auszählen,
 * entstünde eine zweite Wahrheit, die eines Tages von der ersten abweicht —
 * davor warnt `haltungAusBeschluss` seit dem ersten Tag.
 *
 * **Was sie zusätzlich regelt:** was gilt, wenn das Haus gar nicht entscheidet.
 * Der Auftraggeber: «Ist auch im Reglement geklärt. Enthaltung oder Nein als Auswahl
 * anbieten.»
 *
 * Rein: keine Datenbank, keine Uhr (AD-1).
 */
import { FachlicherFehler } from './gemeinschaft';
import { schwelleInWorten, type Schwelle } from './mehrheit';
import type { Erfordernis } from './entscheidbaum';
import type { Kopfbasis, Quotenbasis } from './regelwerk';
import type { Haltung } from './weisung';
import type { Id } from './types';
import { EREIGNISARTEN, ereignis, uebergang, type Uebergang } from './verlauf';
import { zeichenzahl } from './zeichenzahl';

/** Was gilt, wenn das Haus zu einem Geschäft nicht entscheidet. */
export type OhneBeschluss = 'enthaltung' | 'nein';

export interface WeisungsregelEingabe {
	stwegId: Id;
	/** Wie viele Kopfstimmen es im Haus braucht — als Bruch, nie als Kommazahl. */
	kopfSchwelle: Schwelle;
	kopfbasis: Kopfbasis;
	/** Zusätzlich die Wertquoten, oder null. «K und oder WQ». */
	quotenSchwelle: Schwelle | null;
	quotenbasis: Quotenbasis;
	/** Wo im Reglement das steht. Pflicht — ohne sie ist die Regel nicht überprüfbar. */
	fundstelle: string;
	/** Ob Enthaltungen in der Bezugsgrösse bleiben (AD-15: nie annehmen). */
	enthaltungZaehltMit: boolean;
	ohneBeschluss: OhneBeschluss;
	hinweis?: string | null;
}

export interface Weisungsregel extends WeisungsregelEingabe {
	id: Id;
}

/** Wie bei den Reglementsregeln: Brüche bleiben klein und nachvollziehbar. */
const HOECHSTER_NENNER = 100;

function pruefeSchwelle(s: Schwelle, feld: string): Schwelle {
	if (!Number.isInteger(s.zaehler) || !Number.isInteger(s.nenner)) {
		throw new FachlicherFehler(
			'bruch_ungueltig',
			'Zähler und Nenner müssen ganze Zahlen sein — ein Bruch, keine Kommazahl.',
			feld
		);
	}
	if (s.zaehler < 1 || s.nenner < 1 || s.zaehler > s.nenner) {
		throw new FachlicherFehler(
			'bruch_ungueltig',
			'Der Zähler muss mindestens eins sein und darf den Nenner nicht überschreiten.',
			feld
		);
	}
	if (s.nenner > HOECHSTER_NENNER) {
		throw new FachlicherFehler(
			'nenner_zu_gross',
			`Nenner über ${HOECHSTER_NENNER} sind keine Reglementsregel mehr. Kürzen Sie den Bruch.`,
			feld
		);
	}
	return s;
}

export function pruefeWeisungsregel(eingabe: WeisungsregelEingabe): WeisungsregelEingabe {
	pruefeSchwelle(eingabe.kopfSchwelle, 'kopfSchwelle');

	/*
	 * **Wertquoten: entweder ganz oder gar nicht.** Eine Schwelle ohne Basis
	 * misst gegen nichts, eine Basis ohne Schwelle verspricht eine Prüfung, die
	 * nicht stattfindet. Dieselbe Schranke steht in der Datenbank; hier steht
	 * sie, damit die Absage einen Satz hat statt einer Verletzungsmeldung.
	 */
	if (eingabe.quotenSchwelle && eingabe.quotenbasis === 'keine') {
		throw new FachlicherFehler(
			'quotenbasis_fehlt',
			'Zu einer Wertquotenschwelle gehört die Bezugsgrösse: Wovon zwei Drittel?',
			'quotenbasis'
		);
	}
	if (!eingabe.quotenSchwelle && eingabe.quotenbasis !== 'keine') {
		throw new FachlicherFehler(
			'quotenschwelle_fehlt',
			'Eine Bezugsgrösse ohne Schwelle prüft nichts. Tragen Sie den Bruch ein oder wählen Sie «keine».',
			'quotenSchwelle'
		);
	}
	if (eingabe.quotenSchwelle) pruefeSchwelle(eingabe.quotenSchwelle, 'quotenSchwelle');

	const fundstelle = eingabe.fundstelle.trim();
	if (zeichenzahl(fundstelle) < 3) {
		throw new FachlicherFehler(
			'fundstelle_fehlt',
			'Ohne Fundstelle im Reglement lässt sich die Regel nicht überprüfen — sie steht im Protokoll.',
			'fundstelle'
		);
	}

	return { ...eingabe, fundstelle, hinweis: eingabe.hinweis?.trim() || null };
}

/** Die Bezugsgrösse als vollständige Wendung, mit ihrem Artikel (siehe reglement.ts). */
function basisWort(basis: Kopfbasis | Quotenbasis): string {
	switch (basis) {
		case 'anwesend_vertreten':
			// «oder», wie überall seit dem Produktentscheid 08.10.2026: Vertreten
			// ist nicht anwesend, und das Protokoll soll nicht zweierlei schreiben.
			return 'der anwesenden oder vertretenen Stimmen';
		case 'alle_eigentuemer':
			return 'aller Eigentümer';
		case 'alle_ausser_betroffene':
			return 'aller Eigentümer ausser den unmittelbar Betroffenen';
		case 'alle_quoten':
			return 'der gesamten';
		case 'keine':
			return '—';
	}
}

/** Der Satz, der im Protokoll steht. */
export function weisungsregelInWorten(regel: WeisungsregelEingabe): string {
	const kopf = `${schwelleInWorten(regel.kopfSchwelle)} ${basisWort(regel.kopfbasis)}`;
	const quoten = regel.quotenSchwelle
		? ` und zugleich ${schwelleInWorten(regel.quotenSchwelle)} ${basisWort(regel.quotenbasis)} Wertquoten`
		: '';
	return `${kopf}${quoten}.`;
}

/**
 * Was gilt, wenn das Haus nicht entschieden hat — als Satz.
 *
 * Steht neben der Regel, weil es die Hälfte der Auskunft ist: Ein Haus, das
 * nicht tagt, verschiebt die Mehrheit in der Miteigentümergemeinschaft, und
 * zwar je nach Regel in die eine oder die andere Richtung.
 */
export function ohneBeschlussInWorten(regel: WeisungsregelEingabe): string {
	return regel.ohneBeschluss === 'nein'
		? 'Entscheidet das Haus nicht, gilt seine Stimme als Nein.'
		: 'Entscheidet das Haus nicht, enthält es sich.';
}

/** Die Haltung, wenn kein Beschluss vorliegt. */
export function haltungOhneBeschluss(regel: WeisungsregelEingabe): Haltung {
	return regel.ohneBeschluss === 'nein' ? 'nein' : 'enthaltung';
}

/**
 * Die Regel als Erfordernis des Weisungstraktandums im Haus.
 *
 * **Ein eigener Ast**, nicht der Reglementsast: Das Erfordernis stammt zwar aus
 * dem Reglement, aber nicht aus einer Geschäftsart — es gilt für die Weisung an
 * den Vertreter, gleich worum es in der Sache geht. Die Fundstelle wandert mit
 * und steht später im Protokoll.
 */
export function erfordernisAusWeisungsregel(regel: Weisungsregel): Erfordernis {
	return {
		fassung: 'weisungsregel',
		// Wie jede Regel dieser Anwendung: nicht juristisch gegengelesen.
		juristischGegengelesen: false,
		astId: 'a-weisung',
		knotenId: 'k-weisung-reglement',
		typ: 'reglementsmehr',
		titel: weisungsregelInWorten(regel),
		rechtsgrundlage: `Reglement der Gemeinschaft, ${regel.fundstelle}`,
		kopfbasis: regel.kopfbasis,
		quotenbasis: regel.quotenbasis,
		kopfSchwelle: regel.kopfSchwelle,
		quotenSchwelle: regel.quotenSchwelle,
		zustimmungBetroffenerNoetig: false,
		pfad: [
			{
				frageId: 'f-weisung',
				frageText: 'Worüber entscheidet das Haus?',
				antwortId: 'a-weisung',
				antwortText:
					'Über die Weisung an seinen Vertreter in der Miteigentümergemeinschaft — ' +
					`Reglement der Gemeinschaft, ${regel.fundstelle}`
			}
		],
		quelle: 'reglement',
		fundstelle: regel.fundstelle
	};
}

export function legeWeisungsregelAn(id: Id, eingabe: WeisungsregelEingabe): Uebergang<Weisungsregel> {
	const geprueft = pruefeWeisungsregel(eingabe);
	const regel: Weisungsregel = { ...geprueft, id };
	return uebergang(
		regel,
		ereignis(
			EREIGNISARTEN.reglementsregelHinterlegt,
			{ art: 'stweg', id: eingabe.stwegId },
			{
				gegenstand: 'weisung',
				regel: weisungsregelInWorten(regel),
				ohneBeschluss: regel.ohneBeschluss,
				fundstelle: regel.fundstelle
			}
		)
	);
}

export function hebeWeisungsregelAuf(regel: Weisungsregel): Uebergang<Id> {
	return uebergang(
		regel.id,
		ereignis(
			EREIGNISARTEN.reglementsregelAufgehoben,
			{ art: 'stweg', id: regel.stwegId },
			{ gegenstand: 'weisung', regel: weisungsregelInWorten(regel), fundstelle: regel.fundstelle }
		)
	);
}
