/**
 * Traktanden (Story 3.2, FR-12, AD-1).
 *
 * Ein Traktandum ist das, worüber die Versammlung spricht — und bei der Art
 * «Abstimmung» das, worüber sie beschliesst. Die beiden Arten unterscheiden
 * sich nicht nur in der Anzeige: Bei der Kenntnisnahme gibt es keinen
 * Antragswortlaut und kein Mehrheitserfordernis, und ein Ergebnis dazu wäre
 * eine Erfindung.
 */
import { FachlicherFehler } from './gemeinschaft';
import { hindernisFuerRueckzug, type Antragsknoten } from './folgeantrag';
import { AUSSCHLUSSKLAGE_KNOTEN, EINSPRACHE_KNOTEN, type Erfordernis } from './entscheidbaum';
import type { Id } from './types';
import type { Ausnahmegrund } from './ausnahmen';
import type { Verwaltungsangabe } from './verwaltungsangabe';
import { EREIGNISARTEN, ereignis, uebergang, type Uebergang } from './verlauf';
import { zeichenzahl } from './zeichenzahl';

/**
 * Wird abgestimmt oder nur zur Kenntnis genommen?
 *
 * Die Trennung ist rechtlich: Über eine Kenntnisnahme wird nicht beschlossen,
 * also gibt es dazu weder Antragswortlaut noch Mehrheit noch Anfechtungsfrist.
 * Wer sie als Abstimmung mit «einfachem Mehr» führte, erzeugte einen Beschluss,
 * den niemand fassen wollte.
 */
export type Traktandumart = 'abstimmung' | 'kenntnisnahme';

/**
 * Wer den Antrag stellt.
 *
 * Steht in der Einladung und im Protokoll. Bei einem Antrag eines einzelnen
 * Eigentümers ist zusätzlich festzuhalten, welcher — sonst liesse sich später
 * nicht prüfen, ob er antragsberechtigt war.
 */
export type Antragstellerart =
	| 'bewirtschaftung'
	| 'gemeinschaft'
	| 'untergemeinschaft'
	| 'eigentuemer'
	| 'mehrere_eigentuemer'
	| 'ausschuss'
	| 'revision'
	| 'frei';

/**
 * Was ein Antragsteller ausser seiner Art noch braucht (Migration 034).
 *
 *   `keine`     — die Art benennt ihn vollständig.
 *   `eine`      — eine Partei oder Gemeinschaft, über `antragstellerId`.
 *   `mehrere`   — mindestens zwei Parteien, über `antragstellerIds`.
 *   `name`      — ein Freitext, Pflicht.
 *   `nameFrei`  — ein Freitext, freiwillig.
 */
export type Antragstellerbedarf = 'keine' | 'eine' | 'mehrere' | 'name' | 'nameFrei';

export const ANTRAGSTELLERARTEN: {
	art: Antragstellerart;
	bezeichnung: string;
	bedarf: Antragstellerbedarf;
}[] = [
	{ art: 'bewirtschaftung', bezeichnung: 'Die Bewirtschaftung', bedarf: 'keine' },
	{ art: 'gemeinschaft', bezeichnung: 'Die Gemeinschaft', bedarf: 'keine' },
	{ art: 'untergemeinschaft', bezeichnung: 'Eine Untergemeinschaft', bedarf: 'eine' },
	{ art: 'eigentuemer', bezeichnung: 'Ein einzelner Eigentümer', bedarf: 'eine' },
	{ art: 'mehrere_eigentuemer', bezeichnung: 'Mehrere Eigentümer gemeinsam', bedarf: 'mehrere' },
	{ art: 'ausschuss', bezeichnung: 'Der Ausschuss', bedarf: 'nameFrei' },
	{ art: 'revision', bezeichnung: 'Die Revisionsstelle', bedarf: 'nameFrei' },
	{ art: 'frei', bezeichnung: 'Andere — z. B. eine Arbeitsgruppe', bedarf: 'name' }
];

export function antragstellerbedarf(art: Antragstellerart): Antragstellerbedarf {
	return ANTRAGSTELLERARTEN.find((a) => a.art === art)?.bedarf ?? 'keine';
}

/**
 * Der Antragsteller in Worten — für Traktandenliste, Protokoll und Anzeige.
 *
 * An **einer** Stelle, weil er an dreien erscheint und überall gleich lauten
 * muss: Wer im PDF «Die Revisionsstelle: Meier AG» liest und auf dem Bildschirm
 * «Revision», zweifelt an beidem.
 */
export function antragstellerInWorten(
	art: Antragstellerart,
	name?: string | null,
	namen: string[] = []
): string {
	const bezeichnung = ANTRAGSTELLERARTEN.find((a) => a.art === art)?.bezeichnung ?? art;
	if (art === 'frei') return name?.trim() || bezeichnung;
	if (art === 'mehrere_eigentuemer' && namen.length > 0) {
		return `Mehrere Eigentümer: ${namen.join(', ')}`;
	}
	if (name?.trim()) return `${bezeichnung}: ${name.trim()}`;
	return bezeichnung;
}

/**
 * Zwei Fälle eines während der Sitzung aufgenommenen Traktandums (Migration 031).
 *
 * **Folgeantrag** — hält sich im Kern des angekündigten Grundantrags: ein
 * anderer Betrag, eine Etappierung, ein Vorbehalt. Darüber
 * darf abgestimmt werden, ohne dass die Versammlung die Traktandenliste
 * erweitert. Angekündigt sein muss der **Gegenstand** (ZGB Art. 712m Abs. 2 i.V.m.
 * Art. 67 Abs. 3), nicht jeder Antrag dazu — sonst könnte eine Versammlung zu
 * einem angekündigten Geschäft nur unverändert Ja oder Nein sagen, und die
 * Beratung wäre folgenlos.
 *
 * **Die Rückweisung ist kein Folgeantrag** (Produktentscheid 06.10.2026,
 * «Einfaches Mehr», auf Fachprüfung FP-1 und FP2-1 bis FP2-6): Rückweisung und
 * Verschiebung des Traktandums sind Ordnungsanträge (SVIT-Kommentar Rz. 98a ad
 * Art. 712n). Die Versammlung entscheidet sie sofort, vor jeder Abstimmung zur
 * Sache, per Handzeichen mit einfachem Mehr, wenn das Reglement nichts anderes
 * bestimmt. Die Leitung hält den Entscheid mit den Zahlen im Feld «Voten,
 * Begründungen, Ordnungsentscheide» fest; die Anwendung bildet ihn nicht ab.
 * Angenommen, wird heute über die Sache nicht mehr abgestimmt; was schon
 * beschlossen ist, bleibt. «Verschiebung des Traktandums» und nicht
 * «Vertagung», weil «Vertagen» hier die ganze Versammlung meint.
 *
 * **Neues Geschäft** — sachfremd. Dafür braucht es eine Ausnahme: das Reglement
 * oder die Universalversammlung (Migrationen 127 und 128).
 *
 * Wo die Grenze verläuft, entscheidet die Sitzungsleitung. Das Werkzeug kann
 * nicht beurteilen, ob ein Antrag «im Kern» liegt; es hält fest, wie sie
 * entschieden hat, und woran der Folgeantrag hängt.
 */
/**
 * Was während der Sitzung auf die Liste kam.
 *
 *   * `neu` — sachfremd; darüber wird nur beschlossen, wenn das Reglement es
 *     ausdrücklich gestattet (ZGB Art. 67 Abs. 3 i.V.m. Art. 712m Abs. 2) oder
 *     die Versammlung als Universalversammlung tagt (`ausnahme`, Migrationen
 *     127 und 128).
 *   * `folgeantrag` — im Kern eines angekündigten Antrags; darf zur Abstimmung.
 *   * `rueckkommen` — der Ordnungsantrag, auf ein behandeltes Traktandum
 *     zurückzukommen (FR-44). Der Gegenstand war angekündigt; beschlossen wird
 *     nur, ob nochmals beraten wird.
 */
export type Spontanart = 'folgeantrag' | 'neu' | 'rueckkommen';

/**
 * Ab welcher Länge des ausführlichen Inhalts eine Kurzfassung angemahnt wird.
 *
 * Vierhundert Zeichen sind etwa ein halber Bildschirm auf dem Telefon. Darüber
 * liest im Saal niemand mehr mit, und die Kurzfassung ist das, was tatsächlich
 * gelesen wird.
 */
export const SCHWELLE_KURZFASSUNG = 400;

export interface TraktandumEingabe {
	meetingId: Id;
	titel: string;
	art: Traktandumart;
	/** Der ausführliche Inhalt. Freiwillig — nicht jedes Traktandum braucht ihn. */
	inhalt?: string;
	/** Ein bis zwei Sätze in einfacher Sprache. Erscheint auf Liste, Beamer und Telefon. */
	kurzfassung?: string;
	/** Bei der Art «Abstimmung» Pflicht. */
	antragswortlaut?: string;
	antragstellerart: Antragstellerart;
	/** Bei «eigentuemer» beziehungsweise «untergemeinschaft»: wer genau. */
	antragstellerId?: Id | null;
	antragstellerName?: string;
	/** Bei «mehrere Eigentümer»: wer gemeinsam. Mindestens zwei. */
	antragstellerIds?: Id[];
	/** Unmittelbar Betroffene, deren Zustimmung das Erfordernis verlangt. */
	betroffeneParteiIds?: Id[];
	/**
	 * Es geht um die Entschädigung der Verwaltung, einen Vertrag mit ihr oder
	 * ihre Entlastung (L8, Migration 184). Nur bei der Art «abstimmung»: Über
	 * eine Kenntnisnahme wird nicht beschlossen, und an ihr ruhen keine
	 * Vollmachten. Zusammen mit dem Häkchen an der Vollmacht lässt es die
	 * Vollmachten der Verwaltung ruhen, je nach der Einstellung der
	 * Gemeinschaft.
	 */
	verwaltungsGeschaeft?: boolean;
	parentId?: Id | null;
}

export interface Traktandum extends TraktandumEingabe {
	id: Id;
	operatorId: Id;
	parentId: Id | null;
	betroffeneParteiIds: Id[];
	/**
	 * Im Ergebnis immer gesetzt, anders als in der Eingabe: Der Kern
	 * normalisiert das Häkchen, und die Spalte steht auf `NOT NULL`
	 * (Migration 184).
	 */
	verwaltungsGeschaeft: boolean;
	/** Position unter den Geschwistern. Die Nummerierung entsteht daraus (Story 3.3). */
	position: number;
	/** Von Hand gesetzte Nummer. Bleibt bei der Neunummerierung unberührt. */
	nummerManuell?: string | null;
	/**
	 * Die Nummer aus der Einladung, bei der Freigabe festgeschrieben
	 * (Migration 072). `null` bei allem, was danach im Saal hinzukam.
	 */
	nummerFest?: string | null;
	erfordernis?: Erfordernis | null;
	/**
	 * Erst während der Versammlung aufgenommen (Story 5.11, FR-14).
	 *
	 * Rechtlich ein anderer Fall als ein angekündigtes Traktandum: Über ein
	 * nicht angekündigtes Geschäft wird nur beschlossen, wenn das Reglement es
	 * ausdrücklich gestattet (ZGB Art. 67 Abs. 3 i.V.m. Art. 712m Abs. 2;
	 * Migration 127) oder die Versammlung als Universalversammlung tagt
	 * (Migration 128); bis zum 28.09.2026 stand hier, eine vorher genehmigte Erweiterung
	 * der Traktandenliste genüge. In der Liste sähen beide gleich aus —
	 * deshalb steht es an der Zeile.
	 */
	spontan?: boolean;
	/**
	 * Welcher der beiden Fälle (Migration 031).
	 *
	 * `folgeantrag` hält sich im Kern des angekündigten Grundantrags und darf
	 * ohne Ausnahme zur Abstimmung; `neu` ist sachfremd und darf es nicht. Die
	 * Beurteilung trifft die Sitzungsleitung — das Werkzeug hält fest, wie sie
	 * entschieden hat.
	 */
	spontanart?: Spontanart | null;
	/**
	 * Die Angabe der Sitzungsleitung an einem Folgeantrag mit Häkchen
	 * (Entscheid 0045, Punkt 11; Migration 185): Er betrifft eine andere als
	 * die bisherige Verwaltung oder die Kündigung ihres Vertrags. Fehlt sie,
	 * ist keine gemacht.
	 */
	verwaltungsangabe?: Verwaltungsangabe;
	/**
	 * Worauf sich ein nicht angekündigtes Geschäft stützt, das zur Abstimmung
	 * darf (Migration 127). Null bei allem anderen.
	 */
	ausnahme?: Ausnahmegrund | null;
	/**
	 * Das Traktandum, in dem die Erweiterung genehmigt wurde (Story 5.12,
	 * FR-15). Altbestand: Den Weg gibt es seit dem 28.09.2026 nicht mehr
	 * (Migrationen 127 und 128 ersetzen ihn); das Feld bleibt für frühere
	 * Versammlungen lesbar.
	 */
	genehmigungTraktandumId?: Id | null;
	aufgenommenAm?: string | null;
	/** Aus welcher Versammlung übernommen, solange unbearbeitet (Story 3.8). */
	uebernommenAus?: { versammlungId: Id; datum: string } | null;
	/** Von der Vorlage erzeugt, nicht von Hand erfasst (Story 3.8). */
	ausVorlage?: boolean;
	/**
	 * Die Namen der gemeinsam Antragstellenden — nur zum Anzeigen.
	 *
	 * Aufgelöst beim Lesen, nicht gespeichert: Gespeichert sind die Kennungen,
	 * und ein mitgeführter Name liefe nach einer Berichtigung dem echten davon.
	 */
	antragstellerNamen?: string[];
	/**
	 * Zurückgezogen vor der Abstimmung (Welle 3, FR-45).
	 *
	 * **Zurückgezogen ist nicht abgelehnt.** Es gab keine Abstimmung, also auch
	 * keine Mehrheit dagegen. Steht im Protokoll «abgelehnt», wo
	 * «zurückgezogen» hingehört, behauptet es eine Mehrheit, die nie gezählt
	 * wurde — und hält den Antragsteller womöglich davon ab, die Sache im
	 * nächsten Jahr erneut vorzubringen.
	 */
	rueckzug?: Rueckzug | null;
	/**
	 * Beim Rückkommensantrag: das behandelte Traktandum, auf das er zurückkommt
	 * (FR-44).
	 */
	rueckkommenZielId?: Id | null;
}

export interface Rueckzug {
	am: string;
	durch: string;
	grund: string;
}

/**
 * Darf dieser Antrag noch zurückgezogen werden?
 *
 * Zwei Bedingungen, beide fachlich. **Nur ein Antrag:** Eine Kenntnisnahme
 * kennt keinen Antrag, den man zurücknehmen könnte. **Nur vor der Abstimmung:**
 * Danach gehört das Ergebnis der Versammlung, nicht mehr dem Antragsteller; wer
 * es ändern will, braucht den Rückkommensantrag und damit ihre Zustimmung.
 */
export function verlangeZurueckziehbar(t: {
	art: Traktandumart;
	rueckzug?: Rueckzug | null;
	wurdeAbgestimmt: boolean;
	/**
	 * Die Folgeanträge, die noch offen an ihm hängen.
	 *
	 * **Pflichtangabe, nicht optional** (Bedienbarkeitsprüfung 05.09.2026). Ein
	 * voreingestelltes `[]` hiesse: Wer sie nicht mitgibt, bekommt stillschweigend
	 * die alte, lückenhafte Prüfung. So zählt der Typprüfer stattdessen jeden
	 * Aufrufer auf.
	 */
	offeneFolgeantraege: Antragsknoten[];
}): void {
	if (t.art !== 'abstimmung') {
		throw new FachlicherFehler(
			'keine_abstimmung',
			'Eine Kenntnisnahme lässt sich nicht zurückziehen — es gibt keinen Antrag. Nehmen Sie sie von der Liste, solange die noch offen ist.',
			'art'
		);
	}
	if (t.rueckzug) {
		throw new FachlicherFehler(
			'schon_zurueckgezogen',
			'Dieser Antrag ist bereits zurückgezogen.',
			'zustand'
		);
	}
	if (t.wurdeAbgestimmt) {
		throw new FachlicherFehler(
			'schon_abgestimmt',
			'Über diesen Antrag wurde bereits abgestimmt. Ein gefasster Beschluss lässt sich nicht durch Rückzug beseitigen — dafür gibt es den Rückkommensantrag.',
			'zustand'
		);
	}
	/*
	 * **Zuletzt, weil es der teuerste Weg heraus ist.** Wer eine Kenntnisnahme
	 * zurückziehen will oder einen längst entschiedenen Antrag, soll das zuerst
	 * hören; die Folgeanträge zu erledigen ist Arbeit im Saal.
	 */
	const hindernis = hindernisFuerRueckzug(t.offeneFolgeantraege);
	if (hindernis) throw new FachlicherFehler(hindernis.code, hindernis.meldung, 'zustand');
}

/**
 * Verlangt, dass sich ein Rückzug zurücknehmen lässt.
 *
 * **Warum das geht** (Auftraggeber, 21.08.2026): «Rückzug kann aber zurückgenommen
 * werden, wenn gewünscht und das vom Recht her korrekt ist.»
 *
 * Er ist korrekt. Der Rückzug ist eine Erklärung des Antragstellers, kein
 * Beschluss der Versammlung — es hat niemand darüber abgestimmt, und es ist
 * nichts entstanden, das jemandem gehört. Der **Gegenstand** war angekündigt
 * und bleibt es; über ihn darf die Versammlung beschliessen (ZGB Art. 712m
 * Abs. 2 i.V.m. Art. 67 Abs. 3). Wer zurückzieht, weil eine Offerte fehlt, und
 * zehn Minuten später die Offerte in der Hand hält, soll den Antrag nicht in
 * die nächste Versammlung schieben müssen.
 *
 * **Die Grenze ist dieselbe wie beim Rückzug selbst:** Ist abgestimmt, ist der
 * Beschluss da. Dann führt nur noch das Rückkommen weiter — und das ist ein
 * Beschluss der Versammlung, keine Erklärung eines Einzelnen.
 */
export function verlangeRuecknehmbar(t: {
	rueckzug?: Rueckzug | null;
	wurdeAbgestimmt: boolean;
}): void {
	if (!t.rueckzug) {
		throw new FachlicherFehler(
			'nicht_zurueckgezogen',
			'Dieser Antrag ist gar nicht zurückgezogen.',
			'zustand'
		);
	}
	if (t.wurdeAbgestimmt) {
		throw new FachlicherFehler(
			'schon_abgestimmt',
			'Über diesen Antrag wurde bereits abgestimmt. Der Rückzug lässt sich nicht mehr zurücknehmen.',
			'zustand'
		);
	}
}

/** Ohne Begründung kein Rückzug: Im Protokoll stünde sonst eine Lücke. */
export function verlangeRueckzugsgrund(grund: string): string {
	const wortlaut = grund?.trim() ?? '';
	if (zeichenzahl(wortlaut) < 3) {
		throw new FachlicherFehler(
			'ohne_grund',
			'Nennen Sie den Grund des Rückzugs. Er steht später im Protokoll — «zurückgezogen» ohne Grund lässt jeden Leser rätseln.',
			'grund'
		);
	}
	return wortlaut;
}

/** Wie ein zurückgezogener Antrag im Protokoll und in der Auswertung erscheint. */
export function rueckzugInWorten(r: Rueckzug): string {
	return `Zurückgezogen: ${r.grund}`;
}

/**
 * Ein Befund, der nicht blockiert.
 *
 * Nicht jeder Mangel darf die Erfassung verhindern. Eine fehlende Kurzfassung
 * ist ein Mangel; sie zur Pflicht zu machen, führte nur dazu, dass jemand den
 * Titel hineinkopiert — und dann steht auf der Traktandenliste zweimal
 * dasselbe, was schlechter ist als ein leeres Feld.
 */
export interface Hinweis {
	feld: string;
	text: string;
}

/**
 * Die geprüfte Eingabe: wie `TraktandumEingabe`, nur mit dem Häkchen, das der
 * Kern normalisiert hat (L8, Migration 184).
 */
export type GepruefteTraktandumeingabe = Omit<TraktandumEingabe, 'verwaltungsGeschaeft'> & {
	verwaltungsGeschaeft: boolean;
};

export function pruefeTraktandum(eingabe: TraktandumEingabe): GepruefteTraktandumeingabe {
	const titel = eingabe.titel?.trim() ?? '';
	if (zeichenzahl(titel) < 3) {
		throw new FachlicherFehler(
			'titel_zu_kurz',
			'Der Titel des Traktandums fehlt oder ist zu kurz.',
			'titel'
		);
	}
	if (zeichenzahl(titel) > 300) {
		throw new FachlicherFehler('titel_zu_lang', 'Der Titel ist länger als 300 Zeichen.', 'titel');
	}

	if (eingabe.art !== 'abstimmung' && eingabe.art !== 'kenntnisnahme') {
		throw new FachlicherFehler(
			'art_fehlt',
			'Es ist zu wählen, ob abgestimmt oder nur zur Kenntnis genommen wird.',
			'art'
		);
	}

	const wortlaut = eingabe.antragswortlaut?.trim() || undefined;
	if (eingabe.art === 'abstimmung' && !wortlaut) {
		// Ohne Wortlaut steht im Protokoll später, es sei «dem Antrag zugestimmt
		// worden» — ohne dass irgendwo stünde, welchem.
		throw new FachlicherFehler(
			'wortlaut_fehlt',
			'Bei einer Abstimmung ist der Antragswortlaut zu erfassen. Über ihn wird abgestimmt, und er steht so im Protokoll.',
			'antragswortlaut'
		);
	}

	if (!ANTRAGSTELLERARTEN.some((a) => a.art === eingabe.antragstellerart)) {
		throw new FachlicherFehler(
			'antragsteller_fehlt',
			'Der Antragsteller ist zu wählen.',
			'antragstellerart'
		);
	}

	// Wer den Antrag gestellt hat, muss benennbar bleiben: Sonst liesse sich
	// später nicht prüfen, ob er antragsberechtigt war.
	const bedarf = antragstellerbedarf(eingabe.antragstellerart);
	const brauchtPerson = bedarf === 'eine';
	const mehrere = (eingabe.antragstellerIds ?? []).filter(Boolean);

	if (brauchtPerson && !eingabe.antragstellerId) {
		throw new FachlicherFehler(
			'antragsteller_unbestimmt',
			eingabe.antragstellerart === 'eigentuemer'
				? 'Bei einem Antrag eines einzelnen Eigentümers ist zu erfassen, welcher.'
				: 'Bei einem Antrag einer Untergemeinschaft ist zu erfassen, welcher.',
			'antragstellerId'
		);
	}

	/*
	 * **Mindestens zwei.** Einer allein ist «ein einzelner Eigentümer», und die
	 * Unterscheidung ist keine Wortklauberei: Im Protokoll steht sonst «mehrere
	 * Eigentümer» über einem Antrag, den einer gestellt hat.
	 */
	if (bedarf === 'mehrere' && new Set(mehrere).size < 2) {
		throw new FachlicherFehler(
			'antragsteller_unbestimmt',
			'Bei einem gemeinsamen Antrag sind mindestens zwei Eigentümer zu wählen. Bei einem ' +
				'einzelnen wählen Sie «Ein einzelner Eigentümer».',
			'antragstellerIds'
		);
	}

	if (bedarf === 'name' && !eingabe.antragstellerName?.trim()) {
		throw new FachlicherFehler(
			'antragsteller_unbestimmt',
			'Bei «Andere» ist zu erfassen, wer den Antrag gestellt hat — etwa «Arbeitsgruppe ' +
				'Umgebung». Ohne Bezeichnung benennt die Angabe niemanden.',
			'antragstellerName'
		);
	}

	return {
		meetingId: eingabe.meetingId,
		titel,
		art: eingabe.art,
		inhalt: eingabe.inhalt?.trim() || undefined,
		kurzfassung: eingabe.kurzfassung?.trim() || undefined,
		// Der Wortlaut wird bei der Kenntnisnahme verworfen, nicht mitgeschleppt:
		// Er erschiene sonst auf der Traktandenliste als Antrag, über den niemand
		// abstimmt.
		antragswortlaut: eingabe.art === 'abstimmung' ? wortlaut : undefined,
		antragstellerart: eingabe.antragstellerart,
		antragstellerId: brauchtPerson ? (eingabe.antragstellerId ?? null) : null,
		antragstellerIds: bedarf === 'mehrere' ? [...new Set(mehrere)] : [],
		antragstellerName:
			bedarf === 'name' || bedarf === 'nameFrei'
				? eingabe.antragstellerName?.trim() || undefined
				: undefined,
		betroffeneParteiIds: eingabe.betroffeneParteiIds ?? [],
		// L8 (Migration 184): Nur bei einer Abstimmung; an einer Kenntnisnahme
		// ruhen keine Vollmachten, und das Häkchen wäre eine Angabe ohne Wirkung.
		verwaltungsGeschaeft: eingabe.art === 'abstimmung' && eingabe.verwaltungsGeschaeft === true,
		parentId: eingabe.parentId ?? null
	};
}

/**
 * Was auffällt, ohne die Erfassung zu verhindern.
 *
 * Getrennt von `pruefeTraktandum`, weil Hinweise und Fehler verschiedene Dinge
 * sind: Ein Fehler heisst «so nicht», ein Hinweis heisst «sieh nochmal hin».
 * Würden beide gleich behandelt, wäre bald jeder Hinweis abgeschaltet.
 */
export function hinweiseZu(
	t: Pick<TraktandumEingabe, 'inhalt' | 'kurzfassung' | 'art'>,
	erfordernis?: Erfordernis | null,
	betroffene: Id[] = []
): Hinweis[] {
	const hinweise: Hinweis[] = [];

	if (zeichenzahl(t.inhalt ?? '') > SCHWELLE_KURZFASSUNG && !t.kurzfassung?.trim()) {
		hinweise.push({
			feld: 'kurzfassung',
			text:
				`Der Inhalt ist länger als ${SCHWELLE_KURZFASSUNG} Zeichen und es fehlt eine Kurzfassung. ` +
				`Sie erscheint auf der Traktandenliste, auf dem Beamer und auf dem Telefon über der ` +
				`Abstimmungsfrage — dort wird sie gelesen, der lange Text nicht.`
		});
	}

	if (t.art === 'abstimmung' && !erfordernis) {
		hinweise.push({
			feld: 'erfordernis',
			text: 'Das Mehrheitserfordernis steht noch nicht fest. Ohne es lässt sich nicht auszählen.'
		});
	}

	// Der Nachweis muss unmittelbar aus dem Traktandum folgen. Steht das
	// Erfordernis auf Zustimmung der Betroffenen und ist niemand zugewiesen,
	// wäre bei der Auswertung nichts zu prüfen — und das Ergebnis sähe
	// vollständig aus.
	if (erfordernis?.zustimmungBetroffenerNoetig && betroffene.length === 0) {
		hinweise.push({
			feld: 'betroffene',
			text:
				'Dieses Mehrheitserfordernis verlangt die Zustimmung der unmittelbar Betroffenen. ' +
				'Solange niemand namentlich zugewiesen ist, kann sie bei der Auswertung nicht geprüft werden.'
		});
	}

	// Die Ausschlussklage braucht die beklagte Partei (Produktentscheid
	// 29.09.2026); ohne sie sperrt die Freigabe (`pruefeFreigabe`). Der Hinweis
	// sagt es schon im Entwurf, nicht erst beim Freigeben.
	if (erfordernis?.knotenId === AUSSCHLUSSKLAGE_KNOTEN && betroffene.length === 0) {
		hinweise.push({
			feld: 'betroffene',
			text:
				'Bei der Ermächtigung zur Ausschlussklage ist keine beklagte Partei eingetragen. Ohne ' +
				'sie lässt sich weder die Einladung freigeben noch abstimmen. Im Entwurf tragen Sie sie ' +
				'am Traktandum ein, danach in der Sitzungsleitung unter «Betroffene».'
		});
	}

	// Ebenso die Einsprache (ab Fassung 2026-10-20): ohne Eintrag sperren
	// Freigabe und Abstimmung (`pruefeFreigabe`, `erfordernisluecke`).
	if (erfordernis?.knotenId === EINSPRACHE_KNOTEN && betroffene.length === 0) {
		hinweise.push({
			feld: 'betroffene',
			text:
				'Bei der Einsprache ist nicht eingetragen, wer verkauft, vermietet oder belastet. Ohne ' +
				'diese Partei lässt sich weder die Einladung freigeben noch abstimmen. Im Entwurf tragen ' +
				'Sie sie am Traktandum ein, danach in der Sitzungsleitung unter «Betroffene».'
		});
	}

	if (erfordernis?.typ === 'grenzfall') {
		hinweise.push({
			feld: 'erfordernis',
			text:
				'Die Einordnung ist ein Grenzfall. Vor der Einladung ist zu entscheiden, welches ' +
				'Erfordernis gilt — im Saal ist es dafür zu spät.'
		});
	}

	return hinweise;
}

export function legeTraktandumAn(
	id: Id,
	operatorId: Id,
	position: number,
	eingabe: TraktandumEingabe
): Uebergang<Traktandum> {
	const geprueft = pruefeTraktandum(eingabe);

	const t: Traktandum = {
		...geprueft,
		id,
		operatorId,
		position,
		parentId: geprueft.parentId ?? null,
		betroffeneParteiIds: geprueft.betroffeneParteiIds ?? [],
		nummerManuell: null,
		// Wer nach der Freigabe hinzukommt, war nicht auf der Einladung und trägt
		// deshalb keine festgeschriebene Nummer — seine wird gerechnet.
		nummerFest: null,
		erfordernis: null
	};

	return uebergang(
		t,
		ereignis(
			EREIGNISARTEN.traktandumAngelegt,
			{ art: 'agenda_item', id },
			{
				versammlung: geprueft.meetingId,
				titel: geprueft.titel,
				traktandumart: geprueft.art,
				antragsteller: geprueft.antragstellerart,
				// L8 (Migration 184), G-6 (07.11.2026): Das Häkchen im Verlauf
				// auch beim Anlegen und beim Erben über diese Funktion; nur
				// gesetzt, wenn es trägt, sonst stünde da eine Verneinung, die
				// niemand angekreuzt hat.
				...(geprueft.verwaltungsGeschaeft ? { verwaltungsGeschaeft: true } : {})
			}
		)
	);
}

export function aendereTraktandum(
	bisher: Traktandum,
	eingabe: TraktandumEingabe
): Uebergang<Traktandum> {
	const geprueft = pruefeTraktandum({ ...eingabe, meetingId: bisher.meetingId });

	const neu: Traktandum = {
		...bisher,
		...geprueft,
		// Der Elternteil bleibt: Bearbeiten schreibt ihn nicht, das tut nur das
		// Verschieben. Aus der Eingabe übernommen, trug das Ergebnis einen
		// Elternteil, den die Zeile nie bekam, auch einen von anderswo (Kreuzteil
		// des Fremdbetreiber-Durchstichs, 27.10.2026).
		parentId: bisher.parentId ?? null,
		betroffeneParteiIds: geprueft.betroffeneParteiIds ?? [],
		// Sobald jemand das Traktandum bearbeitet, ist es nicht mehr «übernommen»:
		// Die Kennzeichnung sagt, dass der Text der von damals ist. Nach einer
		// Änderung wäre sie eine Falschauskunft (Story 3.8).
		uebernommenAus: null
	};

	const felder: Record<string, { vorher: unknown; nachher: unknown }> = {};
	for (const feld of [
		'titel',
		'art',
		'inhalt',
		'kurzfassung',
		'antragswortlaut',
		'antragstellerart',
		'antragstellerId',
		'verwaltungsGeschaeft'
	] as const) {
		if (bisher[feld] !== neu[feld]) felder[feld] = { vorher: bisher[feld], nachher: neu[feld] };
	}
	if (!gleicheMenge(bisher.betroffeneParteiIds, neu.betroffeneParteiIds)) {
		felder.betroffene = { vorher: bisher.betroffeneParteiIds, nachher: neu.betroffeneParteiIds };
	}

	if (Object.keys(felder).length === 0) return uebergang(neu);

	return uebergang(
		neu,
		ereignis(EREIGNISARTEN.traktandumGeaendert, { art: 'agenda_item', id: bisher.id }, { felder })
	);
}

function gleicheMenge(a: Id[], b: Id[]): boolean {
	if (a.length !== b.length) return false;
	const menge = new Set(a);
	return b.every((x) => menge.has(x));
}

/**
 * Entfernt ein Traktandum.
 *
 * Nur im Entwurf und nur ohne Untertraktanden: Ein Teilbaum, der beim Entfernen
 * des Elternteils mitverschwindet, nimmt Geschäfte mit, an die niemand gedacht
 * hat. Wer den ganzen Ast weghaben will, entfernt ihn von unten.
 */
export function entferneTraktandum(
	t: Traktandum,
	anzahlKinder: number,
	/** Hinweis aus der Vorlage, sofern es sich um ein festes Traktandum handelt. */
	vorlagenhinweis?: string | null,
	/** Was mit ihm ging, aus `raeumeTraktandenAb` (`server/traktandenreste.ts`). */
	mitentfernt: Record<string, unknown> = {}
): Uebergang<Id> {
	if (anzahlKinder > 0) {
		throw new FachlicherFehler(
			'hat_untertraktanden',
			`«${t.titel}» hat ${anzahlKinder} ${anzahlKinder === 1 ? 'Untertraktandum' : 'Untertraktanden'}. ` +
				`Entfernen Sie diese zuerst — sonst verschwänden Geschäfte, an die niemand gedacht hat.`,
			'id'
		);
	}
	return uebergang(
		t.id,
		ereignis(
			EREIGNISARTEN.traktandumEntfernt,
			{ art: 'agenda_item', id: t.id },
			{
				versammlung: t.meetingId,
				titel: t.titel,
				// Beim festen Traktandum ausdrücklich vermerkt, worauf hingewiesen
				// wurde. Später ist die Frage nicht «wurde es entfernt», sondern «hat
				// es jemand bewusst getan».
				ausVorlage: t.ausVorlage ?? false,
				hinweis: vorlagenhinweis ?? null,
				...mitentfernt
			}
		)
	);
}

/**
 * Setzt das Mehrheitserfordernis an ein Traktandum.
 *
 * Bei der Kenntnisnahme abgewiesen: Dort wird nicht beschlossen, und ein
 * gesetztes Erfordernis liesse bei der Auswertung ein Ergebnis entstehen, das
 * niemand beschlossen hat.
 */
export function setzeTraktandumErfordernis(
	t: Traktandum,
	e: Erfordernis
): Uebergang<Traktandum> {
	if (t.art === 'kenntnisnahme') {
		throw new FachlicherFehler(
			'kenntnisnahme_ohne_erfordernis',
			'Bei einer Kenntnisnahme wird nicht abgestimmt. Ein Mehrheitserfordernis hätte hier nichts zu bestimmen.',
			'art'
		);
	}

	return uebergang(
		{ ...t, erfordernis: e, uebernommenAus: null },
		ereignis(
			EREIGNISARTEN.erfordernisGesetzt,
			{ art: 'agenda_item', id: t.id },
			{
				traktandum: t.titel,
				typ: e.typ,
				fassung: e.fassung,
				knoten: e.knotenId,
				quelle: e.quelle,
				risiko: e.risiko ?? false
			}
		)
	);
}
