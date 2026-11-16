/**
 * Stammdaten aus immotool übernehmen — die Abbildung (FR-7).
 *
 * **Warum das hier eine Umwandlung ist und kein zweiter Einleseweg.** FR-7
 * verlangt ausdrücklich: «Der Import erfolgt über dasselbe Datenschema wie der
 * CSV-Import.» Deshalb entsteht hier aus dem, was immotool liefert, **genau die
 * Datei**, die auch von Hand hochgeladen würde — und alles Weitere macht
 * `uebernahme.ts` unverändert: dieselbe Prüfung, dieselbe Vorschau, dieselbe
 * Bestätigung, derselbe Schreibweg. Ein zweiter Einleseweg wäre eine zweite
 * Stelle, an der eine Wertquote falsch ankommen kann, und nur eine davon wäre
 * geprüft.
 *
 * **Die Feldnamen der Gegenseite bleiben stehen.** `value_quota`,
 * `ownership_form`, `usage_type` heissen hier so, wie sie in immotool heissen,
 * obwohl sonst alles in diesem Verzeichnis deutsch ist. Das ist Absicht: Wer
 * prüfen will, ob die Abbildung stimmt, legt diese Datei neben den Endpunkt in
 * `immotool/backend/features/integration/router.py` und vergleicht Zeile für
 * Zeile. Übersetzt würde, wäre der Vergleich eine Übersetzungsaufgabe.
 *
 * **Was immotool nicht weiss, erfindet diese Datei nicht.** Nutzniessung,
 * juristische Person, Vertretungsbefugnis und die Kopfstimme stehen dort nicht
 * — jedenfalls nicht so, dass sie sich hier belegen liessen. Statt einen
 * plausiblen Wert zu setzen, sagen die Hinweise, was fehlt, und die Vorschau
 * zeigt vor der Übernahme, was daraus folgt.
 */
import { schreibe } from './csv';
import { STAMMQUOTE } from './einheiten';

// ── Was immotool liefert ────────────────────────────────────────────────────

export interface ImmotoolVerteiler {
	id: string;
	/** Wie er in immotool heisst: «Wertquote», «Aufzug», «Heizung». */
	name: string;
	/** Der Nenner, auf den sich die Werte beziehen. */
	total_value: number;
	is_default: boolean;
}

export interface ImmotoolEigentum {
	party_id: number;
	name: string;
	/** `sole`, `co`, `joint` — oder nichts, wenn in immotool nie erfasst. */
	ownership_form: string | null;
	/**
	 * Die Authentik-User-UUID dieser Person, falls immotool sie führt.
	 *
	 * Leer ist der Normalfall, nicht der Fehlerfall: bei Firmen immer (dort
	 * stünde die Kennung der Ansprechperson, und die ist nicht die
	 * Eigentümerin), bei natürlichen Personen bis zum Onboarding. Seit dem
	 * 20.08.2026 im Endpunkt, ältere immotool-Stände liefern das Feld nicht —
	 * deshalb wahlfrei.
	 */
	authentik_uuid?: string | null;
}

export interface ImmotoolEinheit {
	id: string;
	unit_number: string | null;
	name: string;
	usage_type: string;
	/** Die Stammquote, in immotool eine ganze Zahl an der Einheit selbst. */
	value_quota: number;
	/** Verteiler-Kennung → Wert. Aus `unit_quotas`. */
	quotas: Record<string, number>;
	/** Wer am Stichtag eingetragen ist. Leer heisst: niemand. */
	owners: ImmotoolEigentum[];
}

export interface ImmotoolStammdaten {
	property: { id: string; short_code: string; name: string };
	stichtag: string;
	distribution_keys: ImmotoolVerteiler[];
	units: ImmotoolEinheit[];
}

// ── Was daraus wird ─────────────────────────────────────────────────────────

export interface Uebernahmedateien {
	/** Der Inhalt der Eigentümerdatei — wie hochgeladen, nur nie gespeichert. */
	eigentuemer: string;
	/** Der Inhalt der Einheitendatei. */
	einheiten: string;
	/**
	 * Was die Übernahme nicht mitbringt und warum.
	 *
	 * Steht über der Vorschau. Eine übergangene Einheit still wegzulassen wäre
	 * der eine Fehler, den die Vorschau nicht sichtbar machen kann: Was nicht in
	 * der Datei steht, taucht dort auch nicht als «fehlerhaft» auf.
	 */
	hinweise: string[];
	gezaehlt: { eigentuemer: number; einheiten: number; uebergangen: number };
}

/**
 * Die Eigentumsformen von immotool in die Wörter der Übernahmedatei.
 *
 * Beide Seiten meinen dasselbe; nur schreibt immotool die Kurzform aus dem
 * Steuerteil (Migration 067) und die Übernahmedatei das ausgeschriebene Wort
 * aus dem Vorgängerprojekt.
 */
const EIGENTUMSFORMEN: Record<string, string> = {
	sole: 'alleineigentum',
	co: 'miteigentum',
	joint: 'gesamteigentum'
};

/**
 * Nutzungsarten, die in einer Versammlung ein Nebenobjekt sind.
 *
 * immotool führt die Nutzungsart als freien Text mit einer Vorschlagsliste
 * («Wohnung», «Büro», «Gewerbe», «Parkplatz», «Lager», «Gemeinschaft»). Was
 * nicht in dieser Liste steht, gilt als Einheit — im Zweifel lieber eine
 * Kopfstimme zu viel als eine Stimme, die stillschweigend fehlt.
 */
const NEBENOBJEKTE = new Set([
	'parkplatz',
	'einstellplatz',
	'abstellplatz',
	'garage',
	'lager',
	'keller',
	'estrich',
	'bastelraum',
	'hobbyraum'
]);

/**
 * Aus dem Namen eines Verteilers wird sein Schlüssel.
 *
 * In immotool hat ein Verteiler nur einen Namen, in dieser Anwendung zusätzlich
 * einen Schlüssel — er steht in der Spaltenüberschrift `quota_<schlüssel>` und
 * in der Wertquotenprüfung. Abgeleitet wird er so, wie ein Mensch ihn tippen
 * würde: klein, ohne Umlaute, ohne Zeichen dazwischen.
 */
export function schluesselAusName(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]+/g, '');
}

/** Namen, unter denen ein Verteiler in immotool die Stammquote meint. */
const STAMMQUOTENNAMEN = new Set(['wertquote', 'wertquoten', 'stammquote', 'quote', 'wq']);

/**
 * Zählt Betroffene auf, ohne den Hinweis zur Liste zu machen.
 *
 * Bei zwei Einheiten will man beide Namen lesen; bei vierzehn will man die Zahl
 * und ein Beispiel. Eine Aufzählung über eine halbe Seite liest niemand mehr.
 */
function nennung(namen: readonly string[], einzahl: string, mehrzahl: string): string {
	if (namen.length === 1) return `«${namen[0]}» ${einzahl}`;
	if (namen.length <= 3) return `${namen.map((n) => `«${n}»`).join(', ')} ${mehrzahl}`;
	return `${namen.length} Einheiten ${mehrzahl} (darunter «${namen[0]}»)`;
}

/**
 * Der Schlüssel, unter dem eine Gruppe von Eigentümern eine Stimme führt.
 *
 * **Warum die Kennungen und nicht die Namen:** Eine Partei wird beim zweiten
 * Durchgang über diese Kennung wiedergefunden. Ein Name ändert sich (Heirat,
 * Firmenumbenennung) und legte dann eine zweite Partei an, neben der die alte
 * mit ihrer Einheit stehen bliebe. Die Kennung aus immotool ändert sich nicht.
 *
 * Mehrere Personen an einer Einheit führen **eine** Stimme (ZGB 712o Abs. 1) und
 * werden deshalb zu einer Partei zusammengefasst. Der Schlüssel ist die
 * aufsteigend sortierte Liste — damit dieselben zwei Personen in beliebiger
 * Reihenfolge dieselbe Partei ergeben.
 */
export function parteischluessel(owners: readonly ImmotoolEigentum[]): string {
	return owners
		.map((o) => o.party_id)
		.slice()
		.sort((a, b) => a - b)
		.map((id) => `p${id}`)
		.join('+');
}

interface Partei {
	ref: string;
	personen: string[];
	eigentumsform: string;
	/**
	 * Die Kennung der einen Person, oder null.
	 *
	 * **Nur bei genau einer Person.** Führt eine Partei zwei Menschen, gehört
	 * die Stimme beiden, und welcher der beiden sich anmelden dürfte,
	 * entscheidet keine Umwandlung. Statt eine auszuwählen bleibt das Feld leer,
	 * und die Hinweise sagen, wie oft das vorkam.
	 */
	authentik: string | null;
}

/**
 * Welche Eigentumsform eine Einheit trägt.
 *
 * **Die Zahl der Personen entscheidet, ob es eine Gemeinschaft ist; die erfasste
 * Form nur, welche.** Andersherum gerechnet kam am 13.08.2026 «alleineigentum»
 * für eine Einheit mit zwei Eigentümern heraus, weil die erste Zeile in immotool
 * noch auf `sole` stand — die Übernahme hätte zwei Personen zu einer erklärt,
 * die allein besitzt. Zwei Menschen können an derselben Einheit kein
 * Alleineigentum haben; das ist kein Grenzfall, sondern ein Widerspruch, und
 * Widersprüche gehören in die Hinweise statt in die Datei.
 *
 * Ohne Angabe: bei mehreren Personen Miteigentum (ZGB 646 ist der Regelfall),
 * bei einer Person Alleineigentum.
 */
function eigentumsform(
	u: ImmotoolEinheit,
	alleineigentumZuZweit: string[],
	gemeinschaftAllein: string[]
): string {
	const label = u.name.trim() || (u.unit_number ?? '').trim();
	const genannt = u.owners
		.map((o) => (o.ownership_form ? EIGENTUMSFORMEN[o.ownership_form] : null))
		.find((f): f is string => Boolean(f));

	if (u.owners.length > 1) {
		if (genannt === 'alleineigentum') alleineigentumZuZweit.push(label);
		return genannt && genannt !== 'alleineigentum' ? genannt : 'miteigentum';
	}

	// Eine Person, aber als Mit- oder Gesamteigentum erfasst. Bei
	// Gesamteigentum ist das der Normalfall — die Erbengemeinschaft steht in
	// immotool als **eine** Partei. Bei Miteigentum fehlt jemand.
	if (genannt === 'miteigentum') gemeinschaftAllein.push(label);
	return genannt ?? 'alleineigentum';
}

/**
 * Aus einer Lieferung von immotool die beiden Übernahmedateien.
 *
 * `bekannteQuotenarten` sind die Schlüssel, die diese Gemeinschaft führt. Ein
 * Verteiler, den sie nicht kennt, wird **nicht** mitgeschrieben: Die
 * CSV-Prüfung weist eine unbekannte Spalte je Zeile ab, und dann fiele jede
 * Einheit als fehlerhaft aus — wegen einer Spalte, die niemand angelegt hat.
 * Stattdessen steht der Verteiler in den Hinweisen mit dem, was zu tun ist.
 */
export function alsUebernahmedateien(
	daten: ImmotoolStammdaten,
	bekannteQuotenarten: readonly string[]
): Uebernahmedateien {
	const hinweise: string[] = [];
	const bekannt = new Set(bekannteQuotenarten);

	// ── Welche Verteiler kommen als eigene Spalte mit ────────────────────────
	const spaltenJeVerteiler = new Map<string, string>();
	for (const v of daten.distribution_keys) {
		const schluessel = schluesselAusName(v.name);

		// Die Stammquote kommt aus `value_quota` an der Einheit und ist dort eine
		// ganze Zahl. Ein gleichnamiger Verteiler ist dieselbe Sache und würde
		// dieselbe Spalte ein zweites Mal füllen.
		if (STAMMQUOTENNAMEN.has(schluessel) || schluessel === STAMMQUOTE) continue;

		if (!bekannt.has(schluessel)) {
			hinweise.push(
				`Den Verteiler «${v.name}» gibt es hier nicht. Legen Sie ihn bei den Einheiten ` +
					`unter «Weitere Verteiler» mit dem Schlüssel «${schluessel}» und dem Nenner ` +
					`${v.total_value} an, dann kommt er beim nächsten Mal mit. Bis dahin bleiben ` +
					`seine Werte in immotool.`
			);
			continue;
		}

		// Diese Anwendung rechnet Quoten in ganzen Zahlen; immotool speichert sie
		// mit vier Nachkommastellen. Ein einziger gebrochener Wert würde **seine**
		// Einheit abweisen — deshalb bleibt lieber die ganze Spalte weg, mit
		// Ansage, als dass eine zufällige Auswahl von Einheiten durchfällt.
		const gebrochen = daten.units.filter((u) => {
			const wert = u.quotas[v.id];
			return wert !== undefined && !Number.isInteger(wert);
		});
		if (gebrochen.length > 0) {
			hinweise.push(
				`Der Verteiler «${v.name}» trägt bei ${gebrochen.length} ` +
					`${gebrochen.length === 1 ? 'Einheit einen' : 'Einheiten'} gebrochenen Wert ` +
					`(zum Beispiel ${gebrochen[0].quotas[v.id]}). Hier sind nur ganze Zahlen zulässig, ` +
					`darum bleibt die Spalte weg.`
			);
			continue;
		}

		spaltenJeVerteiler.set(v.id, schluessel);
	}

	// ── Einheiten und die Parteien, die daran hängen ─────────────────────────
	const parteien = new Map<string, Partei>();
	const einheitenzeilen: string[][] = [];
	let uebergangen = 0;
	/** Einheiten, an denen mehrere Personen als Alleineigentum stehen. */
	const alleineigentumZuZweit: string[] = [];
	/** Einheiten, die Miteigentum sagen, aber nur eine Person führen. */
	const gemeinschaftAllein: string[] = [];
	/** Parteien mit mehreren Personen, bei denen mindestens eine eine Kennung trägt. */
	const mehrpersonenMitKennung = new Set<string>();

	for (const u of daten.units) {
		const label = u.name.trim() || (u.unit_number ?? '').trim();
		if (!label) {
			uebergangen++;
			hinweise.push(`Eine Einheit ohne Bezeichnung bleibt weg (Kennung ${u.id}).`);
			continue;
		}

		// Ohne Eigentümer gibt es keine Stimme, und die CSV-Prüfung wiese die Zeile
		// ohnehin ab. Häufigster Fall ist die Nutzungsart «Gemeinschaft» — eine
		// Fläche, die allen gehört und niemandem eine Stimme gibt.
		if (u.owners.length === 0) {
			uebergangen++;
			hinweise.push(
				`«${label}» hat in immotool am ${daten.stichtag} keinen Eigentümer und bleibt weg.`
			);
			continue;
		}

		const ref = parteischluessel(u.owners);
		if (!parteien.has(ref)) {
			const kennungen = u.owners
				.map((o) => (o.authentik_uuid ?? '').trim())
				.filter((k) => k.length > 0);
			parteien.set(ref, {
				ref,
				personen: u.owners.map((o) => o.name.trim()).filter((n) => n.length > 0),
				eigentumsform: eigentumsform(u, alleineigentumZuZweit, gemeinschaftAllein),
				authentik: u.owners.length === 1 && kennungen.length === 1 ? kennungen[0] : null
			});
			if (u.owners.length > 1 && kennungen.length > 0) mehrpersonenMitKennung.add(ref);
		}

		const nebenobjekt = NEBENOBJEKTE.has(u.usage_type.trim().toLowerCase());
		const zeile = [
			u.id,
			label,
			nebenobjekt ? 'parking' : 'unit',
			ref,
			nebenobjekt ? '0' : '1',
			String(u.value_quota)
		];
		for (const [verteilerId] of spaltenJeVerteiler) {
			const wert = u.quotas[verteilerId];
			zeile.push(wert === undefined ? '' : String(wert));
		}
		einheitenzeilen.push(zeile);
	}

	// ── Die beiden Dateien ───────────────────────────────────────────────────
	const einheitenkopf = [
		'holding_ref',
		'label',
		'holding_type',
		'owner_voter_ref',
		'counts_as_head',
		'quota_units',
		...[...spaltenJeVerteiler.values()].map((s) => `quota_${s}`)
	];

	const eigentuemerzeilen = [...parteien.values()].map((p) => [
		p.ref,
		// `display_name` bleibt leer: Die Übernahme setzt den Namen aus den
		// Personen zusammen, und zwar an einer Stelle für beide Wege.
		'',
		p.personen.join(' | '),
		p.eigentumsform,
		String(p.personen.length),
		p.authentik ?? ''
	]);

	// Widersprüche in immotool: gemeldet, nicht stillschweigend geglättet. Sie
	// stehen dort und gehören dort berichtigt — hier wäre jede Korrektur eine
	// zweite Wahrheit.
	if (alleineigentumZuZweit.length > 0) {
		hinweise.push(
			`${nennung(alleineigentumZuZweit, 'trägt', 'tragen')} in immotool mehrere Eigentümer, ` +
				'sind dort aber als Alleineigentum erfasst. Übernommen wird Miteigentum — eine ' +
				'Einheit, eine Stimme (ZGB 712o Abs. 1). Bitte in immotool berichtigen.'
		);
	}
	if (gemeinschaftAllein.length > 0) {
		hinweise.push(
			`${nennung(gemeinschaftAllein, 'ist', 'sind')} als Miteigentum erfasst, führt in ` +
				'immotool aber nur eine Person. Fehlt jemand, fehlt der Name später auf der ' +
				'Stimmkarte.'
		);
	}

	// Weggelassene Kennungen gehören angesagt: Ohne diesen Satz sähe die
	// Bewirtschaftung nur, dass bei manchen Parteien nichts steht, und suchte den
	// Fehler in immotool.
	if (mehrpersonenMitKennung.size > 0) {
		const zahl = mehrpersonenMitKennung.size;
		hinweise.push(
			`${zahl} ${zahl === 1 ? 'Partei führt' : 'Parteien führen'} mehrere Personen, von denen ` +
				`mindestens eine in immotool eine Authentik-Kennung hat. Die Kennung bleibt weg: Die ` +
				`Stimme gehört allen Genannten, und welche Person sich dafür anmelden darf, entscheidet ` +
				`die Bewirtschaftung — nicht die Übernahme.`
		);
	}

	if (parteien.size > 0) {
		hinweise.push(
			'Ob jemand eine juristische Person ist und wer für eine Gemeinschaft die Stimme ' +
				'ausübt, führt immotool nicht. Beides steht nach der Übernahme auf «natürliche ' +
				'Person» beziehungsweise auf der erstgenannten Person und ist bei den Eigentümern ' +
				'zu berichtigen.'
		);
	}

	if (einheitenzeilen.some((z) => z[2] === 'parking')) {
		hinweise.push(
			'Die Kopfstimme kennt immotool nicht; sie ist aus der Nutzungsart abgeleitet — ' +
				'Nebenobjekte ohne, alles andere mit. Die Vorschau zeigt jede Abweichung.'
		);
	}

	return {
		eigentuemer: schreibe([
			[
				'voter_ref',
				'display_name',
				'person_names',
				'ownership_type',
				'person_count',
				'person_authentik'
			],
			...eigentuemerzeilen
		]),
		einheiten: schreibe([einheitenkopf, ...einheitenzeilen]),
		hinweise,
		gezaehlt: {
			eigentuemer: parteien.size,
			einheiten: einheitenzeilen.length,
			uebergangen
		}
	};
}
