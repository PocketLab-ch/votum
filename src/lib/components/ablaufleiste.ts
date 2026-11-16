/**
 * Der Ablauf einer Versammlung als Leistengruppen — an **einer** Stelle.
 *
 * **Warum das ein eigener Baustein ist.** Zwei Schritte der Vorbereitung liegen
 * nicht bei der Versammlung, sondern bei der Gemeinschaft: Einheiten und
 * Eigentümer. Wer dort hinklickte, bekam bisher eine andere Navigation — die
 * Leiste wechselte von «Ablauf der Versammlung» zu «Bereiche der Gemeinschaft»,
 * und der Bezug zur Versammlung stand nur noch in einer Zeile am Fuss.
 *
 * Gemeldet am 01.08.2026: «Wenn ich in der Versammlung bin und auf Einheiten
 * und Wertquote klicke, ist auf dieser Seite eine andere Navigation. Das muss
 * über alles durchgängig logisch aufgebaut sein.»
 *
 * Aus der Sicht des Benutzers bereitet er weiterhin dieselbe Versammlung vor.
 * Die Leiste zeigt deshalb weiterhin ihren Ablauf — auf beiden Ebenen dieselbe,
 * aus derselben Rechnung. Zwei Aufbauten nebeneinander liefen sonst
 * auseinander, sobald einer geändert wird.
 */
import type { Leistengruppe, Leistenpunkt } from './seitenleiste';
import { schrittgruppen, type Schritt } from '$lib/domain/vorbereitung';
import { datumLang } from '$lib/domain/datum';
import { zustandsname } from '$lib/domain/versammlung';

export interface Ablaufeingabe {
	versammlungId: string;
	versammlungszustand: string;
	schritte: Schritt[];
	/** Story 7.3: Weisungen gibt es nur, wo Anteile auf andere Gemeinschaften lauten. */
	mitgliedsgemeinschaften: number;
}

/**
 * Schritte, die auf eine Gemeinschaftsseite führen, tragen die Versammlung mit.
 *
 * Ohne diesen Zusatz wüsste die Gemeinschaftsseite nicht, für welche Versammlung
 * dort gerade Einheiten erfasst werden — und könnte den Ablauf nicht
 * fortführen. Die Kennung steht im Abfrageteil und bindet die Seite an nichts:
 * Ohne sie ist sie weiterhin die Gemeinschaft und sonst nichts.
 */
export function mitHerkunft(pfad: string, versammlungId: string): string {
	if (!pfad.startsWith('/gemeinschaften/')) return pfad;
	return `${pfad}${pfad.includes('?') ? '&' : '?'}zur=${versammlungId}`;
}

/**
 * Ein Ablaufschritt als Leistenpunkt — an **einer** Stelle.
 *
 * Diese Umwandlung stand zweimal im Haus: einmal hier für die einzelne
 * Versammlung, einmal von Hand im Layout der gemeinsamen. Am 12.08.2026 fiel auf,
 * wozu das führt — die neue Lückenwarnung war im Kern gesetzt, stand bei einer
 * einzelnen Versammlung in der Leiste und beim gemeinsamen Abend nicht, weil die
 * zweite Abschrift das Feld nicht kannte. Wer hier ein Feld ergänzt, ergänzt es
 * für beide.
 *
 * Der Weg geht durch `weg`, weil er sich unterscheidet: Bei einer einzelnen
 * Versammlung trägt jeder Schritt, der in die Gemeinschaft führt, seine Herkunft
 * mit; beim gemeinsamen Abend zeigen die Schritte auf den Abend selbst.
 */
export function alsPunkt(s: Schritt, weg: (pfad: string) => string = (p) => p): Leistenpunkt {
	return {
		titel: s.titel,
		pfad: s.zustand === 'gesperrt' ? null : weg(s.pfad),
		stand: s.stand,
		// Kommt fertig aus dem Kern (`vorbereitung.ts`, `gemeinsamerablauf.ts`);
		// diese Datei ordnet nur an. Rechnete sie selbst, stünde in der Leiste eines
		// Tages etwas anderes als auf der Seite dahinter.
		// Die Kurzfassung, wo der Kern eine liefert (Produktentscheid 06.10.2026,
		// «Kurz in der Leiste, ganz auf der Seite»); die volle steht auf der Seite.
		warnung: s.warnungKurz ?? s.warnung,
		sperrgrund: s.sperrgrund,
		zustand: s.zustand,
		extern: s.pfad.endsWith('.pdf')
	};
}

export function ablaufgruppen(e: Ablaufeingabe): Leistengruppe[] {
	const aus: Leistengruppe[] = schrittgruppen(e.schritte).map((g) => ({
		titel: g.titel,
		punkte: g.schritte.map((s) => alsPunkt(s, (p) => mitHerkunft(p, e.versammlungId)))
	}));

	/*
	 * Die Anwesenheit ist seit dem 02.08.2026 ein **Schritt** des Ablaufs und
	 * kommt aus `vorbereitungsschritte` — nicht mehr als Zusatz von hier.
	 *
	 * Der Grund: Die Weiter-Leiste rechnet mit den Schritten. Solange die
	 * Anwesenheit nur ein Eintrag der Seitenleiste war, übersprang sie diese und
	 * führte von den Zugängen unmittelbar zur Sitzungsleitung — obwohl zuerst
	 * der Eingang kommt.
	 */

	const vorbereiten = aus.find((g) => g.titel === 'Vorbereiten');

	/*
	 * Die Angaben stehen vorn: Datum, Ort, Art und Betriebsart sind das, was man
	 * zuerst festlegt, und alles Weitere setzt darauf auf.
	 *
	 * **Mit Häkchen**, anders als die Traktandenliste. Der Unterschied ist die
	 * Herkunft der Angaben: Datum, Uhrzeit, Ort und Art sind beim Anlegen von
	 * Hand einzutragen und ohne sie entsteht keine Versammlung. Es fehlt also
	 * nichts, und ein offener Punkt, an dem nichts zu tun ist, hält den ganzen
	 * Ablauf scheinbar auf. Die Pflichttraktanden dagegen legt das System selbst
	 * an — dort wäre das Häkchen eines, das niemand gesetzt hat.
	 */
	vorbereiten?.punkte.unshift({
		titel: 'Angaben und Unterlagen',
		pfad: `/versammlungen/${e.versammlungId}`,
		zustand: 'erledigt'
	});

	if (e.mitgliedsgemeinschaften > 0) {
		vorbereiten?.punkte.push({
			titel: 'Weisungen der Häuser',
			pfad: `/versammlungen/${e.versammlungId}/weisungen`
		});
	}

	/*
	 * «Jederzeit»: Die vier Kapitel sagen alle, **wann** etwas dran ist —
	 * Vorbereiten, Ausgeben, An der Versammlung, Danach. Das fünfte sagt:
	 * unabhängig davon.
	 */
	aus.push({
		titel: 'Jederzeit',
		punkte: [
			{
				titel: 'Für den Beamer (PDF)',
				pfad: `/versammlungen/${e.versammlungId}/traktandenliste.pdf?art=praesentation`,
				extern: true
			},
			/*
			 * **Der Ausweichplan gehört gedruckt, bevor man ihn braucht.** Fällt
			 * der Server aus, gibt es diese Seite nicht mehr — und dann hilft nur,
			 * was schon auf Papier liegt. Deshalb steht er unter «Jederzeit» und
			 * nicht erst bei «An der Versammlung».
			 */
			/*
			 * **Der Ausweichplan besteht aus drei Blättern**, und alle drei gehören
			 * gedruckt oder geladen, bevor man sie braucht: Fällt der Server aus,
			 * gibt es diese Seite nicht mehr.
			 *
			 *   - die Traktandenliste, damit im Saal steht, worüber entschieden wird;
			 *   - die Stimmzettel, um die Stimmen aufzunehmen;
			 *   - die Auszählmappe für das, was Handzählen nicht leisten kann.
			 */
			{
				titel: 'Alle Traktanden (PDF)',
				pfad: `/versammlungen/${e.versammlungId}/traktandenliste.pdf`,
				extern: true
			},
			{
				titel: 'Stimmzettel für den Ausfall (PDF)',
				pfad: `/versammlungen/${e.versammlungId}/stimmzettel.pdf`,
				extern: true
			},
			{
				titel: 'Auszählung für den Ausfall (Excel)',
				pfad: `/versammlungen/${e.versammlungId}/auszaehlung.xlsx`,
				extern: true
			},
			/*
			 * **Über die Zugehörigkeit, nicht über den Gegenstand** (Block 3,
			 * 01.10.2026). `gegenstand` traf nur, was die Kennung der Versammlung
			 * selbst trug: Freigabe, Eröffnung, Schluss. Der grösste Teil des
			 * Abends hängt an Traktandum, Durchgang, Vollmacht und Momentaufnahme
			 * (`gehoertZu`); «Verlauf dieser Versammlung» meint alles davon
			 * (`verlaufsfilter.ts`). Derselbe Fehler stand im Siegelpaket.
			 */
			{ titel: 'Verlauf dieser Versammlung', pfad: `/verlauf?versammlung=${e.versammlungId}` }
		]
	});

	return aus;
}

/** Derselbe Weg, unabhängig davon, ob die Herkunft mitgeschrieben ist. */
function ohneHerkunft(pfad: string): string {
	return pfad.replace(/[?&]zur=[^&]*/, (t) => (t.startsWith('?') ? '?' : '')).replace(/\?$/, '');
}

/**
 * Die Bereiche der Gemeinschaft, ohne das, was der Ablauf schon führt.
 *
 * Sonst stünde «Einheiten und Wertquoten» zweimal in derselben Leiste — und
 * beide Einträge wären als «hier» markiert, weil sie auf dieselbe Seite zeigen.
 * Verglichen wird der ganze Weg samt Abfrageteil: «Verlauf» der Gemeinschaft
 * und «Verlauf dieser Versammlung» führen beide nach `/verlauf` und sind doch
 * zwei verschiedene Ziele.
 */
export function ohneDoppelte(bereiche: Leistengruppe[], ablauf: Leistengruppe[]): Leistengruppe[] {
	const bekannt = new Set(
		ablauf.flatMap((g) => g.punkte).flatMap((p) => (p.pfad ? [ohneHerkunft(p.pfad)] : []))
	);
	return bereiche
		.map((g) => ({ ...g, punkte: g.punkte.filter((p) => !p.pfad || !bekannt.has(p.pfad)) }))
		.filter((g) => g.punkte.length > 0);
}

export interface OffeneVersammlung {
	id: string;
	datum: string;
	zustand: string;
	/**
	 * Der gemeinsame Abend, zu dem diese Versammlung gehört — wenn es einen gibt.
	 *
	 * Gemeldet am 12.08.2026: «Was in den Gemeinschaftsansichten fehlt ist der
	 * Absprung auf die Sammelversammlung, wenn vorhanden. Ich komme von dort nie
	 * wieder zurück auf die Sammelansicht, bzw. nur umständlich.» Der Rückweg
	 * bestand bisher nur, wenn man **mit** `?zur=` gekommen war; wer die
	 * Gemeinschaft direkt öffnete, fand ihn nirgends.
	 */
	gemeinsam?: { id: string; bezeichnung: string } | null;
}

/**
 * Was an den Stammdaten offen ist — je Bereich ein Satz oder nichts.
 *
 * Kommt fertig aus dem Kern (`einheitenluecke`, `zuordnungsluecke`); diese Datei
 * ordnet nur an. Rechnete sie selbst, stünde in der Leiste eines Tages etwas
 * anderes als auf der Seite dahinter.
 */
export interface Stammdatenluecken {
	einheiten?: string | null;
	zuordnung?: string | null;
}

/**
 * Die Bereiche einer Gemeinschaft — die Leiste, wenn keine Versammlung führt.
 *
 * **Die offenen Abende stehen mit drin.** Die Durchgängigkeit gilt in beide
 * Richtungen: Aus der Versammlung führt der Ablauf in die Gemeinschaft, und aus
 * der Gemeinschaft muss er zurückführen. Wer am Reglement war und weitermachen
 * will, soll nicht über die Historie oder das Kopfmenü zurücksuchen.
 */
export function gemeinschaftsgruppen(
	stwegId: string,
	offene: OffeneVersammlung[] = [],
	luecken: Stammdatenluecken = {},
	/**
	 * Die Klammer über mehreren Häusern. Sie hat keine Stimmberechtigten, also
	 * führt «Neue Versammlung» bei ihr in eine Versammlung, an der niemand
	 * teilnehmen kann (A-21). Ihr Weg ist der gemeinsame Abend.
	 *
	 * Der Knopf auf der Übersichtsseite war schon umgestellt — dieser hier nicht,
	 * und damit stand die Sackgasse weiter offen. Zwei Stellen für dieselbe
	 * Sache, wieder einmal.
	 */
	klammer = false
): Leistengruppe[] {
	return [
		{
			titel: 'Stammdaten',
			punkte: [
				/*
				 * Die Lücke steht **an** der Zeile, nicht dahinter (Auftraggeber, 12.08.2026:
				 * «damit der Nutzer es sofort sieht»). Gerechnet wird sie im Kern
				 * (`domain/einheiten.ts`), damit dieselbe Aussage überall gleich
				 * lautet.
				 */
				{
					titel: 'Einheiten und Wertquoten',
					pfad: `/gemeinschaften/${stwegId}/einheiten`,
					warnung: luecken.einheiten ?? undefined
				},
				{
					titel: 'Eigentümer und Stimmkraft',
					pfad: `/gemeinschaften/${stwegId}/eigentuemer`,
					warnung: luecken.zuordnung ?? undefined
				},
				{ titel: 'Nutzniessung', pfad: `/gemeinschaften/${stwegId}/nutzniessung` },
				/*
				 * **Hier, nicht unter «Verwaltung»** (Auftraggeber, 26.08.2026: «ich finde den
				 * Import für den CSV nicht … wenn ich die Frage stellen muss, ist der
				 * Zugang nicht intuitiv»). Der Punkt stand bis dahin in der letzten
				 * Gruppe, zwei Überschriften von den Seiten entfernt, für die es ihn
				 * gibt. Wer dreissig Einheiten von Hand tippt, sucht ihn bei den
				 * Stammdaten — und liest «Verwaltung» als «Einstellungen».
				 *
				 * Die Beschriftung bleibt «Stammdaten übernehmen» und nicht «aus CSV»:
				 * Seit FR-7 kommen die Daten wahlweise aus immotool, und ein Titel, der
				 * nur einen von zwei Wegen nennt, verdeckt den anderen. Ein `stand` mit
				 * «Excel oder CSV» hilft hier nicht: `Seitenleiste.svelte:253` zeichnet
				 * ihn nur an der laufenden oder der offenen Stelle — er stünde also erst
				 * da, wenn man die Seite gefunden hat. Das Wort steht stattdessen auf
				 * dem Knopf oben rechts.
				 */
				{ titel: 'Stammdaten übernehmen', pfad: `/gemeinschaften/${stwegId}/uebernahme` }
			]
		},
		{
			titel: 'Regelwerk',
			punkte: [
				{ titel: 'Reglement und Quoren', pfad: `/gemeinschaften/${stwegId}/reglement` },
				// Eigene Seite, damit die Sitzungsleitung sie umstellen kann, wenn die
				// Gemeinschaft es erlaubt (Migration 169, `rollen.ts`).
				{ titel: 'Lesarten', pfad: `/gemeinschaften/${stwegId}/lesarten` },
				{ titel: 'Beschlussfähigkeit', pfad: `/gemeinschaften/${stwegId}/beschlussfaehigkeit` }
			]
		},
		{
			titel: 'Versammlungen',
			punkte: [
				// Der Zustand steht als Stand darunter, nicht im Titel: Er wechselt,
				// der Titel nicht — und zwei Abende am selben Datum unterscheidet
				// ohnehin erst die Stelle in der Liste, nicht der Text.
				...offene.flatMap((v) => [
					{
						titel: `Versammlung vom ${datumLang(v.datum)}`,
						pfad: `/versammlungen/${v.id}`,
						stand: zustandsname(v.zustand as never)
					},
					/*
					 * Gehört sie zu einem gemeinsamen Abend, steht der Weg dorthin
					 * **unmittelbar darunter** — nicht in einer eigenen Gruppe. Sonst
					 * stünde bei drei Versammlungen dreimal «Gemeinsame Versammlung»
					 * irgendwo, und keine wüsste, zu welcher sie gehört.
					 *
					 * Das Zeichen «↳» statt einer Einrückung: Die Leiste kennt keine
					 * Ebenen, und eine über CSS erfundene wäre für die Sprachausgabe nicht
					 * da.
					 */
					...(v.gemeinsam
						? [
								{
									titel: `\u21b3 ${v.gemeinsam.bezeichnung}`,
									pfad: `/tage/${v.gemeinsam.id}`,
									stand: 'gemeinsamer Abend'
								}
							]
						: [])
				]),
				{ titel: 'Historie und Suche', pfad: `/gemeinschaften/${stwegId}/historie` },
				klammer
					? { titel: 'Gemeinsamen Abend anlegen', pfad: '/versammlungen/neu' }
					: { titel: 'Neue Versammlung', pfad: `/gemeinschaften/${stwegId}/versammlungen/neu` }
			]
		},
		{
			titel: 'Verwaltung',
			punkte: [
				{ titel: 'Angaben der Gemeinschaft', pfad: `/gemeinschaften/${stwegId}/angaben` },
				// Aus demselben Grund wie oben: `gemeinschaft`, nicht `gegenstand`.
				{ titel: 'Verlauf', pfad: `/verlauf?gemeinschaft=${stwegId}` }
			]
		}
	];
}
