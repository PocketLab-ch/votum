/**
 * Ein im Saal gestellter Antrag auf Zulässigkeit (FR-60) — rein.
 *
 * **Gefragt wird nur, was sich nicht rechnen lässt.** Drei der vier Punkte aus
 * FR-60 stehen schon fest, ohne dass jemand ein Modell befragen müsste:
 *
 *   * Ob ein Rückkommensantrag ein Geschäft **derselben** Versammlung betrifft
 *     — die Anwendung kennt die Versammlung.
 *   * Ob er das **Mehrheitserfordernis verschiebt** — `erfordernisabweichung()`
 *     vergleicht zwei Erfordernisse, seit FR-43.
 *   * Ob ein Spontantraktandum eine **Beschlussfassung ohne Ankündigung** wäre
 *     — das hängt an der Art und an der Ausnahme (Reglement oder
 *     Universalversammlung), beides erfasst.
 *
 * Übrig bleibt die eine Frage, die wirklich Beurteilung ist: **Hält sich der
 * Antrag im Sachbereich des angekündigten Geschäfts?** Aus «Fassade streichen»
 * darf «Fassade streichen und dämmen» werden — oder eben nicht mehr. Diese
 * Grenze steht in keinem Feld.
 *
 * Ein Modell auch die drei anderen Punkte beurteilen zu lassen, hiesse:
 * langsamer, teurer, und mit der Möglichkeit, dass es einer bekannten Tatsache
 * widerspricht. Im Saal ist beides untragbar.
 *
 * **Das Ergebnis ist eine Einschätzung, kein Verbot** (FR-60). Die
 * Sitzungsleitung entscheidet und darf abweichen; dass sie es getan hat, wird
 * festgehalten.
 */
import { NICHT_ANGEKUENDIGT_GRUNDSATZ } from './ausnahmen';
import { FachlicherFehler } from './gemeinschaft';

/** Wie ein Antrag zum angekündigten Geschäft steht. */
export const EINSCHAETZUNGEN = ['im_rahmen', 'grenzwertig', 'sachfremd'] as const;
export type Einschaetzung = (typeof EINSCHAETZUNGEN)[number];

export const EINSCHAETZUNGSNAMEN: Record<Einschaetzung, string> = {
	im_rahmen: 'Hält sich im angekündigten Geschäft',
	grenzwertig: 'Grenzwertig',
	sachfremd: 'Verlässt das angekündigte Geschäft'
};

export interface Beurteilung {
	einschaetzung: Einschaetzung;
	/** Warum — in ein bis zwei Sätzen. Ohne sie keine Beurteilung. */
	begruendung: string;
	/** Was der Antrag an Neuem einführt, das nicht angekündigt war. */
	neuesThema: string | null;
}

/**
 * Nimmt entgegen, was das Modell geantwortet hat.
 *
 * **Ohne Begründung keine Beurteilung.** «Sachfremd» allein wäre im Saal
 * unbrauchbar: Die Sitzungsleitung muss der Versammlung sagen können, warum
 * sie einen Antrag nicht zur Abstimmung bringt — und ein Satz aus einer
 * Maschine ist dafür kein Ersatz, aber ein Anfang.
 */
export function lesbareBeurteilung(roh: unknown): Beurteilung | null {
	if (typeof roh !== 'object' || roh === null) return null;
	const v = roh as Record<string, unknown>;
	const e = typeof v.einschaetzung === 'string' ? v.einschaetzung.trim().toLowerCase() : '';
	const begruendung = typeof v.begruendung === 'string' ? v.begruendung.trim() : '';
	if (!(EINSCHAETZUNGEN as readonly string[]).includes(e)) return null;
	// zeichenzahl-frei: Plausibilität einer KI-Antwort, keine Eingabeschranke.
	if (begruendung.length < 10) return null;
	const neu = typeof v.neuesThema === 'string' ? v.neuesThema.trim() : '';
	return {
		einschaetzung: e as Einschaetzung,
		begruendung,
		neuesThema: neu === '' ? null : neu
	};
}

/**
 * Der Auftrag an das Modell.
 *
 * **Eine Frage, nicht vier.** Der Auftrag nennt die Rechtslage in zwei Sätzen
 * und verlangt genau eine Einordnung. Das ist der Grund, warum die Antwort in
 * einer Sekunde da ist — FR-60 verlangt das ausdrücklich, weil eine Prüfung,
 * die im Saal zwanzig Sekunden braucht, niemand benutzt.
 */
export function beurteilungsauftrag(): string {
	return [
		'Du beurteilst, ob ein während einer Stockwerkeigentümerversammlung gestellter Antrag',
		'sich im Sachbereich des angekündigten Traktandums hält (ZGB Art. 67 Abs. 3 i.V.m. Art. 712m Abs. 2).',
		'',
		'Massstab: Über ein Geschäft, das nicht angekündigt war, wird in der Regel nicht beschlossen —',
		'wer nicht kam, konnte nicht wissen, dass darüber entschieden wird. Ein Antrag, der den',
		'angekündigten Gegenstand nur **abwandelt** (anderer Betrag, Etappierung, anderer Termin,',
		'engere oder weitere Ausführung derselben Sache), hält sich darin. Ein Antrag, der eine',
		'**andere Sache** einführt, verlässt ihn — auch wenn beide dasselbe Gebäude betreffen.',
		'',
		'Bist du unsicher, antworte "grenzwertig". Rate nicht.',
		'',
		'Antworte ausschliesslich mit JSON, ohne Zäune und ohne Vorrede:',
		'{"einschaetzung":"im_rahmen|grenzwertig|sachfremd",',
		' "begruendung":"ein bis zwei Sätze",',
		' "neuesThema":"was der Antrag an Nichtangekündigtem einführt, sonst leer"}'
	].join('\n');
}

/**
 * Was das Werkzeug **empfiehlt** — und was es niemals tut.
 *
 * **Die Sitzungsleitung entscheidet, nicht das Werkzeug** (Vorgabe des Auftraggebers vom
 * 05.08.2026). Der Unterschied ist nicht die Höflichkeit der Formulierung,
 * sondern die Rechtslage: Die Leitung der Versammlung obliegt dem Vorsitzenden,
 * und ein Beschluss, dessen Zulassung eine Maschine bestimmt hat, wäre in einer
 * Anfechtung schwer zu verteidigen.
 *
 * Deshalb heisst es «Empfehlung» und nicht «Ergebnis», und deshalb steht bei
 * jeder Empfehlung, dass sie eine ist. Eine Aussage wie «Der Antrag verlässt das
 * angekündigte Geschäft» klingt nach Feststellung — sie ist aber die
 * Einschätzung eines Modells, das drei Zeilen Text gelesen hat.
 */
export interface Empfehlung {
	/** Wozu geraten wird. `selbst_entscheiden`, wo nichts zu raten ist. */
	wort: 'zulassen' | 'nicht_zulassen' | 'selbst_entscheiden';
	/** Der Satz, der in der Oberfläche steht. Er beginnt mit «Empfehlung». */
	satz: string;
}

export function empfehlung(
	b: Beurteilung,
	reglementFundstelle: string | null = null,
	/** Ob die Gemeinschaft die Universalversammlung zulässt, wie bei der Freigabe (Migration 128). */
	universalZugelassen = false
): Empfehlung {
	if (b.einschaetzung === 'im_rahmen') {
		return {
			wort: 'zulassen',
			satz:
				'Empfehlung: zur Abstimmung zulassen. Der Antrag wandelt das angekündigte Geschäft ab, ' +
				'ohne eine andere Sache einzuführen.'
		};
	}
	/*
	 * **Mit hinterlegter Bestimmung des Reglements ein anderer Satz** (Fach- und
	 * Laienprüfung 29.09.2026). Der allgemeine nennte dort einen Grund, der für
	 * dieses Reglement nicht zutrifft, und verschwiege den Weg, den es gibt: das
	 * Geschäft als eigenes aufnehmen, gestützt auf das Reglement. Der Rat zur
	 * Zurückhaltung bleibt (Rz. 38 ad Art. 712n).
	 */
	if (b.einschaetzung === 'sachfremd' && reglementFundstelle) {
		return {
			wort: 'nicht_zulassen',
			satz:
				'Empfehlung: nicht als Folgeantrag zur Abstimmung bringen. Ihr Reglement gestattet ' +
				`Beschlüsse über nicht angekündigte Gegenstände (${reglementFundstelle}). Soll heute ` +
				'beschlossen werden, nehmen Sie die Sache als eigenes Geschäft auf, «Abstimmung, ' +
				'gestützt auf das Reglement». Zieht die Antragstellerin den Folgeantrag dann zurück, ' +
				'halten Sie das mit «Antrag zurückziehen» fest. Die Fachliteratur rät dabei zur ' +
				'Zurückhaltung (SVIT-Kommentar Rz. 38 ad Art. 712n).'
		};
	}
	/*
	 * **Die Universalversammlung als eigener Weg, nicht über den Folgeantrag**
	 * (Fachprüfung Runde 3, Migration 128). «Trotzdem zulassen» bringt einen
	 * sachfremden Antrag als Folgeantrag zur Abstimmung, ohne dass jemand prüft,
	 * ob alle da sind und niemand widerspricht. Die Empfehlung zeigt deshalb den
	 * Weg, auf dem Votum genau das prüft.
	 *
	 * **Und erinnert zuerst an einen Widerspruch** (`docs/freigabe.md`, «Offen:
	 * Reste zur Universalversammlung», Punkt 3). Er gilt der Sache, nicht dem
	 * Geschäft: Art. 67 Abs. 3 ZGB knüpft an den nicht angekündigten Gegenstand
	 * an, und wer widerspricht, nimmt insoweit nicht ohne Vorbehalt teil (Rz. 28
	 * ad Art. 712n). Die Rüge bezieht sich auf «la question affectée» (BGE 136
	 * III 174 E. 5.1.2, dort zu einer unvollständigen Traktandenliste); dass sie
	 * fortwirkt, wenn dieselbe Sache unter einem anderen Geschäft wiederkommt,
	 * ist Folgerung, nicht Wortlaut (Fachprüfung 30.09.2026, Runde 2, F2).
	 * Votum hält den Widerspruch aber am Geschäft fest, und ob ein Folgeantrag
	 * oder ein neues Geschäft dieselbe Sache betrifft, kann es nicht erkennen.
	 * Vor dem Weg über die Universalversammlung, weil er diesen einschränkt
	 * (Laienprüfung L4). Nur mit Universalversammlung: Ohne sie gibt es keinen
	 * Widerspruch. Mit Reglement hängt am Widerspruch nichts, solange die
	 * Bestimmung nicht selbst verlangt, dass niemand widerspricht; die
	 * Empfehlung dort rät ohnehin zur Zurückhaltung.
	 */
	if (b.einschaetzung === 'sachfremd') {
		return {
			wort: 'nicht_zulassen',
			satz:
				`Empfehlung: heute nicht als Folgeantrag zur Abstimmung bringen. ${NICHT_ANGEKUENDIGT_GRUNDSATZ} ` +
				(universalZugelassen
					? 'Hat heute schon jemand widersprochen, dass über diese Sache beschlossen wird, bringen ' +
						'Sie sie heute nicht mehr zur Abstimmung, weder als Folgeantrag noch als eigenes ' +
						'Geschäft; nehmen Sie sie zur Kenntnis und traktandieren Sie sie für die nächste ' +
						'Versammlung. Votum erkennt einen Widerspruch nur an dem Geschäft, an dem er ' +
						'festgehalten ist. Hat niemand widersprochen und sind alle Eigentümer da, nehmen Sie ' +
						'die Sache als eigenes Geschäft auf, «Abstimmung als Universalversammlung»; Votum ' +
						'prüft dann, ob alle da sind. '
					: '') +
				'Zur Kenntnis nehmen und vertagen ist immer möglich.'
		};
	}
	return {
		wort: 'selbst_entscheiden',
		satz:
			'Empfehlung: keine — der Fall liegt an der Grenze. Sie kennen die Ankündigung und den ' +
			'Willen der Versammlung; das Modell kennt drei Zeilen Text.'
	};
}

export const ENTSCHEIDE_ANTRAG = ['zugelassen', 'nicht_zugelassen'] as const;
export type Antragsentscheid = (typeof ENTSCHEIDE_ANTRAG)[number];

export function verlangeAntragsentscheid(wert: string): Antragsentscheid {
	if (!(ENTSCHEIDE_ANTRAG as readonly string[]).includes(wert)) {
		throw new FachlicherFehler(
			'antragsentscheid_unbekannt',
			'Zu einem geprüften Antrag gehört, was damit geschehen ist: zugelassen oder nicht zugelassen.',
			'entscheid'
		);
	}
	return wert as Antragsentscheid;
}

/**
 * Der Satz, der die Einschätzung mit dem Entscheid der Sitzungsleitung
 * zusammenbringt (FR-60).
 *
 * **Die Abweichung wird benannt, nicht getadelt.** Dass die Sitzungsleitung
 * einen als sachfremd eingeschätzten Antrag trotzdem zulässt, ist ihr gutes
 * Recht — sie kennt die Ankündigung, das Modell kennt drei Zeilen Text. Im
 * Protokoll gehört beides nebeneinander, damit später niemand rekonstruieren
 * muss, ob jemand hingesehen hat.
 */
export function abweichungssatz(b: Beurteilung, entscheid: Antragsentscheid): string | null {
	if (b.einschaetzung === 'sachfremd' && entscheid === 'zugelassen') {
		return (
			'Zugelassen, obwohl die Einschätzung den Antrag ausserhalb des angekündigten Geschäfts ' +
			'sieht. Halten Sie im Protokoll fest, worauf sich die Zulassung stützt. Ohne ' +
			'Ankündigung, ohne Bestimmung des Reglements, die es gestattet, und ohne ' +
			'Universalversammlung ist ein Beschluss darüber anfechtbar (ZGB Art. 67 Abs. 3 i.V.m. ' +
			'Art. 712m Abs. 2). Als Folgeantrag prüft Votum nicht, ob alle da sind und ob jemand ' +
			'widersprochen hat.'
		);
	}
	if (b.einschaetzung === 'im_rahmen' && entscheid === 'nicht_zugelassen') {
		return 'Nicht zugelassen, obwohl die Einschätzung keinen Grund dagegen sah. Der Grund gehört ins Protokoll.';
	}
	return null;
}

/**
 * Der Satz nach dem Klick der Leitung auf die Empfehlung (`docs/freigabe.md`,
 * «Offen: Reste zur Universalversammlung», Punkt 13).
 *
 * **Bis zum 30.09.2026 stand `abweichungssatz` nirgends in der Oberfläche**,
 * nur in den Tests; Prüfungen und Handbuch hielten ihn für angezeigt. Die
 * Knöpfe halten fest, ob die Leitung der Empfehlung folgt («angenommen») oder
 * anders entscheidet («abgelehnt»), nicht ob sie zulässt. «Anders» heisst bei
 * «sachfremd» zulassen, bei «im Rahmen» nicht zulassen; bei «grenzwertig» gibt
 * es keine Empfehlung, von der man abweichen könnte.
 */
export function abweichungNachKlick(b: Beurteilung, klick: string): string | null {
	if (klick !== 'abgelehnt') return null;
	if (b.einschaetzung === 'sachfremd') return abweichungssatz(b, 'zugelassen');
	if (b.einschaetzung === 'im_rahmen') return abweichungssatz(b, 'nicht_zugelassen');
	return null;
}
