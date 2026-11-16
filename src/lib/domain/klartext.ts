/**
 * Klartext — die Fachbegriffe der Anwendung in Alltagssprache.
 *
 * Am 11.08.2026 gemeldet: «Text und Knopf müssen so dastehen, dass eine
 * unerfahrene Person das intuitiv bedienen kann.» Auf der Versammlungsseite
 * stand «Betriebsart · Einfach — Unterschriftenliste auf Papier, Stimmen
 * erfasst durch die Sitzungsleitung». Jedes Wort davon ist richtig, und keines
 * beantwortet die Frage, die jemand tatsächlich hat: Wie wird abgestimmt?
 *
 * Die Sätze stehen hier und nicht in den Seiten, aus drei Gründen:
 *
 * 1. **Dieselbe Sache heisst überall gleich.** Drei Seiten erklärten die
 *    Betriebsart, jede mit eigenen Worten.
 * 2. **Sie sind prüfbar.** Ein Satz in einer Svelte-Datei ist es nicht.
 * 3. **Der Fachbegriff geht nicht verloren.** Er bleibt als `fachwort`
 *    erhalten — im Protokoll, in der Einladung und gegenüber der Revision
 *    zählt er, nicht die Umschreibung.
 *
 * Bauart jedes Eintrags: **Frage** als Überschrift, **Antwort** in einem Satz,
 * **Zusatz** für das eine Detail, das man sofort braucht, **erklaerung** für
 * den Hintergrund, der zugeklappt wartet.
 */
import { FRIST_KURZ, type Betriebsart, type Versammlungsart } from './versammlung';
import { anteilInWorten, type Beschlussfaehigkeitsregel, type Versammlungsstufe } from './beschlussfaehigkeit';

export interface Klartextangabe {
	/** Die Überschrift — eine Frage, wie sie jemand stellen würde. */
	frage: string;
	/** Die Antwort in einem Satz. Steht gross und ohne Umschweife. */
	antwort: string;
	/**
	 * Dieselbe Antwort als Beschriftung — ohne Punkt, für Auswahl und Knopf.
	 *
	 * Ein Satzzeichen hinter einer Auswahlmöglichkeit sieht aus wie ein
	 * Versehen, und «Auf Papier.» als Knopfaufschrift liest sich falsch.
	 */
	kurz: string;
	/** Das eine Detail dazu, das man sofort braucht. */
	zusatz: string;
	/** Der Hintergrund. Wartet zugeklappt. */
	erklaerung: string;
	/**
	 * Wie es im Recht, im Protokoll und im Handbuch heisst.
	 *
	 * Steht in Klammern hinter der Beschriftung. Wer den Fachbegriff sucht,
	 * findet ihn; wer ihn nicht kennt, liest darüber hinweg.
	 */
	fachwort: string;
}

const ABSTIMMUNG: Record<Betriebsart, Klartextangabe> = {
	einfach: {
		frage: 'Wie wird abgestimmt?',
		antwort: 'Auf Papier.',
		kurz: 'Auf Papier',
		zusatz: 'Die Sitzungsleitung trägt die Stimmen für alle ein.',
		erklaerung:
			'Wer da ist, unterschreibt auf einer Liste. Beim Abstimmen zählt die Sitzungsleitung ' +
			'die Hände und trägt das Ergebnis ein. Es braucht keine Zugangskarten und keinen Beamer.',
		fachwort: 'einfach'
	},
	gefuehrt: {
		frage: 'Wie wird abgestimmt?',
		antwort: 'Am eigenen Handy.',
		kurz: 'Am eigenen Handy',
		zusatz: 'Jede Person stimmt selbst ab.',
		erklaerung:
			'Jede Person bekommt vor der Versammlung eine Zugangskarte. Damit meldet sie sich im ' +
			'Saal an und stimmt am eigenen Handy oder Tablet ab. Das Ergebnis erscheint auf dem Beamer.',
		fachwort: 'geführt'
	}
};

export function abstimmungsweise(b: Betriebsart): Klartextangabe {
	return ABSTIMMUNG[b] ?? ABSTIMMUNG.einfach;
}

const ART: Record<Versammlungsart, Klartextangabe> = {
	ordentlich: {
		frage: 'Was für eine Versammlung?',
		antwort: 'Die jährliche Versammlung.',
		kurz: 'Die jährliche Versammlung',
		zusatz: 'Die immer gleichen Geschäfte entstehen von selbst.',
		erklaerung:
			'Einmal im Jahr muss die Gemeinschaft zusammenkommen. Protokoll, Jahresrechnung, ' +
			'Revisionsbericht, Budget, Erneuerungsfonds und Entlastung der Verwaltung werden ' +
			'als Traktanden angelegt, ohne dass jemand sie eintippen muss.',
		fachwort: 'ordentlich'
	},
	ausserordentlich: {
		frage: 'Was für eine Versammlung?',
		antwort: 'Aus einem besonderen Anlass.',
		kurz: 'Aus einem besonderen Anlass',
		zusatz: 'Der Anlass gehört in die Einladung.',
		erklaerung:
			'Sie wird ausserhalb der Jahresversammlung einberufen, weil etwas ansteht, das nicht ' +
			'warten kann. Am genannten Anlass misst sich später, ob die Einberufung berechtigt war. ' +
			'Es entstehen nur die festen Traktanden.',
		fachwort: 'ausserordentlich'
	}
};

export function versammlungsart(a: Versammlungsart): Klartextangabe {
	return ART[a] ?? ART.ordentlich;
}

const STUFE: Record<Versammlungsstufe, Klartextangabe> = {
	erste: {
		frage: 'Das wievielte Treffen?',
		antwort: 'Das erste Treffen.',
		kurz: 'Das erste Treffen',
		zusatz: 'Es muss die Hälfte da sein, damit beschlossen werden kann.',
		erklaerung:
			'Beschlossen werden kann nur, wenn die Hälfte der Eigentümer da ist und diese Hälfte ' +
			'zugleich die Hälfte der Anteile hält (ZGB Art. 712p Abs. 1). Kommen zu wenige, wird ' +
			'die Versammlung trotzdem eröffnet und die Beschlussunfähigkeit protokolliert — ' +
			'danach lädt man zum zweiten Treffen ein.',
		fachwort: 'Erstversammlung'
	},
	zweite: {
		frage: 'Das wievielte Treffen?',
		antwort: 'Das zweite Treffen.',
		kurz: 'Das zweite Treffen',
		zusatz: 'Hier genügt ein Drittel.',
		erklaerung:
			'Das zweite Treffen folgt auf ein erstes, bei dem zu wenige da waren. Jetzt genügt ein ' +
			'Drittel der Eigentümer, und auf die Anteile kommt es nicht mehr an (ZGB Art. 712p ' +
			`Abs. 3). ${FRIST_KURZ}`,
		fachwort: 'Zweitversammlung'
	}
};

/**
 * Die Versammlungsstufe — und was das Reglement daran ändert.
 *
 * Ohne Regel gilt das Gesetz, und der Zusatz nennt die gesetzliche Schwelle.
 * **Mit** Regel muss er die des Reglements nennen: Eine Gemeinschaft, die für
 * das zweite Treffen die Hälfte statt einem Drittel verlangt hat, liest sonst
 * beim Wählen «Hier genügt ein Drittel» — und das ist bei ihr falsch.
 *
 * Am 11.08.2026 gemeldet. Die Regel selbst wird nicht hier angewandt, sondern
 * in `stelleBeschlussfaehigkeitFest`; dieser Satz beschreibt sie nur.
 */
export function versammlungsstufe(
	s: Versammlungsstufe,
	regel?: Beschlussfaehigkeitsregel | null
): Klartextangabe {
	const grund = STUFE[s] ?? STUFE.erste;
	if (!regel) return grund;

	const kopf = anteilInWorten(regel.kopf);
	const quoten = regel.quoten ? `, dazu ${anteilInWorten(regel.quoten)} der Anteile` : '';
	return {
		...grund,
		zusatz: `Ihr Reglement verlangt ${kopf}${quoten}.`,
		erklaerung:
			`Ihre Gemeinschaft hat eine eigene Schwelle festgehalten: ${kopf}${quoten} müssen ` +
			`anwesend oder vertreten sein, mindestens aber ${regel.mindestens}. Fundstelle: ` +
			`${regel.fundstelle}. Das Reglement darf die Beschlussfähigkeit nur erschweren, ` +
			`nie erleichtern. ${grund.erklaerung}`
	};
}

/**
 * Die Beschriftung für eine Auswahl oder eine Karte: Klartext, Fachwort in
 * Klammern.
 *
 * Am 11.08.2026 gemeldet: «Hier würde ich noch von ordentlicher und
 * ausserordentlicher Versammlung schreiben, sowie Erstversammlung und
 * Zweitversammlung, wegen der Terminologie.» Beides muss dastehen — der
 * Klartext, damit man versteht, was man wählt, und der Fachbegriff, damit man
 * ihn im Protokoll, im Handbuch und im Gesetz wiederfindet.
 */
export function beschriftung(a: Klartextangabe): string {
	return `${a.kurz} (${a.fachwort})`;
}

/**
 * Gehört die Versammlung zu einer gemeinsamen Versammlung?
 *
 * Der einzige Eintrag, dessen Antwort von Daten abhängt statt von einer festen
 * Auswahl — deshalb eine Funktion mit Argument statt einer Tabelle.
 *
 * **Was gemeinsam ist, stand hier falsch.** Bis zum 11.08.2026 hiess es, Datum
 * und Ort blieben «bei jeder Versammlung für sich». Das verkehrt den Zweck:
 * Gemeinsam heisst gerade, dass alle am selben Tag am selben Ort tagen.
 * Getrennt bleibt, was rechtlich getrennt sein muss.
 *
 * **Nicht «Abend»** (Produktentscheid 11.08.2026): Sie kann am Vormittag
 * stattfinden, und wer sie vorbereitet, denkt in Versammlungen, nicht in
 * Tageszeiten.
 */
export function abendzugehoerigkeit(bezeichnung: string | null): Klartextangabe {
	return {
		frage: 'Zusammen mit anderen?',
		antwort: bezeichnung ? `Ja — ${bezeichnung}.` : 'Nein, sie ist allein.',
		kurz: bezeichnung ?? 'Für sich allein',
		zusatz: bezeichnung
			? 'Alle tagen am selben Tag am selben Ort, eine nach der anderen.'
			: 'Mehrere Gemeinschaften können zusammen tagen.',
		erklaerung:
			'Eine gemeinsame Versammlung fasst mehrere zusammen: gleicher Tag, gleicher Ort, ' +
			'ein Einlass und eine Tafel im Saal. Getrennt bleibt, was rechtlich getrennt sein muss — ' +
			'jede Gemeinschaft hat ihre eigene Beschlussfähigkeit, ihre eigenen Traktanden und ihre ' +
			'eigenen Beschlüsse. Die Uhrzeiten unterscheiden sich, weil nacheinander getagt wird.',
		fachwort: 'Versammlungstag'
	};
}

/**
 * Passen Tag und Ort der Versammlung zur gemeinsamen Versammlung?
 *
 * Die Zuordnung setzt nur die Kennung; Tag und Ort der Versammlung
 * bleiben unangetastet und werden nirgends geprüft. Beide können damit
 * auseinanderlaufen — und dann steht in der Einladung ein anderer Tag als auf
 * der Tafel im Saal. Gefunden am 11.08.2026.
 *
 * Bewusst **kein** Fehler und keine Sperre: Es gibt einen zulässigen Grund für
 * eine Abweichung, nämlich eine kurzfristig verlegte gemeinsame Versammlung,
 * deren Teilnehmerinnen noch nachgezogen werden. Der Hinweis macht sichtbar, dass etwas
 * zu tun ist; entscheiden muss die Sitzungsleitung.
 *
 * Die **Uhrzeit** bleibt aussen vor: Die Gemeinschaften tagen nacheinander,
 * verschiedene Anfangszeiten sind der Normalfall.
 */
export function abendabweichung(
	versammlung: { datum: string; ort: string; betriebsart?: Betriebsart },
	abend: { datum: string; ort: string; betriebsart?: Betriebsart } | null
): string | null {
	if (!abend) return null;

	const abweichungen: string[] = [];
	if (versammlung.datum !== abend.datum) {
		abweichungen.push(`der Tag (dort ${punktdatum(abend.datum)})`);
	}
	if (versammlung.ort.trim() !== abend.ort.trim()) {
		abweichungen.push(`der Ort (dort ${abend.ort})`);
	}
	/*
	 * **Die Abstimmungsweise gehört dazu** (25.08.2026). Sie ist hart, aber es
	 * gibt noch einen Weg an der Vorgabe vorbei: den Umschalter am Haus, den
	 * eine freigegebene Versammlung anbietet. Er bleibt — ohne ihn hätte ein
	 * Haus, dessen Technik ausfällt, gar keinen Ausweg mehr. Sichtbar muss die
	 * Abweichung dann aber sein: Im Saal folgen Einlass, Tafel und
	 * Stimmerfassung dieser Wahl, und zwei Verfahren nebeneinander merkt man
	 * sonst erst, wenn die ersten Leute vor verschlossener Anmeldung stehen.
	 */
	if (
		versammlung.betriebsart &&
		abend.betriebsart &&
		versammlung.betriebsart !== abend.betriebsart
	) {
		abweichungen.push(`die Abstimmungsweise (dort ${abstimmungsweise(abend.betriebsart).kurz})`);
	}

	if (abweichungen.length === 0) return null;

	const verb = abweichungen.length === 1 ? 'weicht' : 'weichen';
	const liste =
		abweichungen.length === 1
			? abweichungen[0]
			: `${abweichungen.slice(0, -1).join(', ')} und ${abweichungen.at(-1)}`;
	// Grossbuchstabe am Satzanfang: «der Tag weicht …» liest sich wie ein Bruch.
	const satz = liste.charAt(0).toLocaleUpperCase('de-CH') + liste.slice(1);
	return `${satz} ${verb} von der gemeinsamen Versammlung ab.`;
}

/** Ein ISO-Datum als Schweizer Datum. Dieselbe Schreibweise wie in den Listen. */
function punktdatum(iso: string): string {
	const [j, m, t] = iso.split('-');
	return t && m && j ? `${t}.${m}.${j}` : iso;
}
