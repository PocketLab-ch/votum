<script lang="ts">
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import Wahlliste from '$lib/components/Wahlliste.svelte';
	import Suchauswahl from '$lib/components/Suchauswahl.svelte';
	import Archivschalter from '$lib/components/Archivschalter.svelte';
	import Sortierkopf from '$lib/components/Sortierkopf.svelte';
	import { datumLang } from '$lib/domain/datum';
	import { brauchtSuchfeld, filtereNach } from '$lib/domain/listensuche';
	import { naechsteSortierung, sortiere, type Sortierung } from '$lib/domain/tabellensortierung';
	import { eigentuemerfelder } from '$lib/domain/eigentuemer';
	import { verknuepfungsvorschlaege, vorauswahl } from '$lib/domain/personenabgleich';
	import { anfangswert, angekreuzt, gefuehrteWahl } from '$lib/felder';
	import Personenzeile from '$lib/components/Personenzeile.svelte';
	import Wenfrage from '$lib/components/Wenfrage.svelte';
	import AdresseFuerAlle from '$lib/components/AdresseFuerAlle.svelte';
	import {
		alsWahl,
		leereZeile,
		type Beteiligter,
		type PersonenWahl
	} from '$lib/domain/personenangaben';
	import type { PartyKind } from '$lib/domain/types';
	import Meldung from '$lib/components/Meldung.svelte';
	import Rueckfragefenster from '$lib/components/Rueckfragefenster.svelte';

	let { data, form } = $props();

	/**
	 * Einheiten ohne Eigentümer am Stichtag — die Auswahl beim Erfassen (A-30).
	 *
	 * Nicht alle Einheiten: Wer gerade einen Eigentümer anlegt, meint fast immer
	 * eine, die noch keinen hat. Die vollständige Liste steht weiterhin unten,
	 * wo auch ein Eigentümerwechsel möglich ist.
	 */
	const offeneEinheiten = $derived(data.stimmkraft.einheitenOhneEigentuemer);

	/*
	 * Die Anschrift der Gemeinschaft, als ein Zeile (22.08.2026, Befund A-09).
	 * Leer, solange keine erfasst ist — dann steht auch kein Knopf da, der nichts
	 * einträgt.
	 */
	const gemeinschaftsadresse = $derived(
		[data.gemeinschaft?.strasse, [data.gemeinschaft?.plz, data.gemeinschaft?.ort].filter(Boolean).join(' ')]
			.filter((t) => t && t.trim())
			.join(', ')
	);

	/**
	 * Der Wert des Adressfelds — damit der Knopf ihn setzen kann.
	 *
	 * `bind:value` mit `$state` ist hier richtig und nicht die Hydrierungsfalle:
	 * Das Feld wird programmgeführt gesetzt (docs/gestaltung.md, Doktrin vom
	 * 11.08.2026), und genau dafür ist die Bindung da.
	 */
	let anschrift = $state('');

	/** Wer zur Wahl steht: alle ausser den archivierten (siehe Auswahlfeld unten). */
	const waehlbarePersonen = $derived(data.personen.filter((p) => !p.archiviertAm));

	/**
	 * Dieselbe Menge in der Form, die `Personenzeile` führt.
	 *
	 * Der Baustein bekommt Kennung, Name und die Gemeinschaften als schlichte
	 * Liste, nicht die ganze Personenzeile der Seite: Was er nicht sieht, kann
	 * er auch nicht versehentlich anzeigen.
	 */
	const waehlbareFuerZeile = $derived(
		waehlbarePersonen.map((p) => ({
			id: p.id,
			name: p.name,
			gemeinschaften: p.parteien.map((x) => x.gemeinschaft)
		}))
	);

	/** Was im Namensfeld steht — für die Vorauswahl der Person. */
	let getippterName = $state('');

	// Vorschlagen heisst zur Wahl stellen — archivierte Personen gehören nicht
	// dazu (25.08.2026, zweite Reviewrunde).
	const abgleichPersonen = $derived(
		waehlbarePersonen.map((p) => ({
			id: p.id,
			name: p.name,
			gemeinschaften: p.parteien.map((x) => x.gemeinschaft)
		}))
	);

	/**
	 * Die Person, die beim Tippen vorgeschlagen wird.
	 *
	 * Vorgeschlagen, nicht gesetzt: Ein automatisch gesetzter Treffer wäre bequem
	 * und gefährlich — «Meier» gibt es in einer Überbauung dreimal.
	 */
	const vorgeschlagen = $derived(vorauswahl(getippterName, abgleichPersonen));

	/** Bestehende Zeilen, die zu einer erfassten Person passen könnten. */
	const vorschlaege = $derived(
		verknuepfungsvorschlaege(
			data.eigentuemer.map((e) => ({
				parteiId: e.id,
				name: e.displayName,
				personId: data.personen.find((p) => p.parteien.some((x) => x.parteiId === e.id))?.id ?? null,
				verknuepfbar: e.kind !== 'gemeinschaft' && !e.isCommunity
			})),
			abgleichPersonen
		)
	);

	/*
	 * **Der Stand nach einer Absage** (26.08.2026, im Durchstich gemessen).
	 * Stünden Eigentumsform und Art fest auf ihrer Vorgabe, verschwände nach
	 * jeder Absage die ganze Personenliste samt den getippten Namen: Die Absage
	 * nähme mehr weg, als sie beanstandet.
	 *
	 * Als Funktion und nicht als Ausdruck im Rune: Ein `form` unmittelbar in
	 * `$state(…)` meldet Svelte als «captures only the initial value».
	 */
	function anfangsForm(): Eigentumsform {
		return form?.gemeinschaftlich === true ? 'gemeinschaftlich' : 'allein';
	}

	function anfangsArt(): string {
		return form?.art ?? 'natural';
	}

	/**
	 * Wem die Einheit gehört — die Wahl aus dem ersten Abschnitt (Auftraggeber, 27.08.2026).
	 *
	 * Vorher war es ein Kästchen `isCommunity`, gelesen mit `jaNein()`. Als Wahl
	 * hat auch das Gegenteil einen Namen, und die Maske stellt eine Frage statt
	 * ein Merkmal anzubieten. Das Feld heisst deshalb neu `eigentumsform`; die
	 * Aktion liest es wörtlich (`=== 'gemeinschaftlich'`) und nicht mehr über
	 * `jaNein()`.
	 */
	type Eigentumsform = 'allein' | 'gemeinschaftlich';
	let eigentumsform = $state<Eigentumsform>(anfangsForm());
	const gemeinschaftlich = $derived(eigentumsform === 'gemeinschaftlich');
	let personenart = $state(anfangsArt());

	/**
	 * Gemeinschaftliches Eigentum **an einer Einheit** — Mit- oder Gesamteigentum
	 * mehrerer Menschen (ZGB Art. 712o Abs. 1).
	 *
	 * Nicht zu verwechseln mit `personenart === 'gemeinschaft'`: Dort gehört der
	 * Anteil einer anderen Stockwerkeigentümergemeinschaft (Story 7.1). Das
	 * Häkchen steht in diesem Fall gar nicht erst da — sein alter Wert bliebe
	 * aber im Zustand stehen, und ohne diese zweite Bedingung erschiene die
	 * Personenliste an der falschen Stelle.
	 */
	const gemeinschaftlichesEigentum = $derived(gemeinschaftlich && personenart !== 'gemeinschaft');

	/**
	 * Der Wert des Auswahlknopfs «Niemand bezeichnet».
	 *
	 * Leer, damit der Server ihn in keiner Kennungsliste findet und den Index
	 * auf −1 setzt. Als eigene Grösse, weil er an vier Stellen steht.
	 */
	const NIEMAND = '';

	/**
	 * Die Personen der gemeinschaftlichen Zeile.
	 *
	 * **Zwei von Anfang an** — weniger ist kein gemeinschaftliches Eigentum,
	 * sondern eine gewöhnliche Zeile mit einem irreführenden Haken.
	 *
	 * Nach einer Absage kommen die getippten Angaben zurück: Wer drei Personen
	 * erfasst hat und an der letzten scheitert, tippt sonst alles noch einmal.
	 * Die Felder selbst führt der Browser (`anfangswert`); im Zustand steht nur,
	 * **welche** Zeilen es gibt — das ist die Angabe, die das Programm braucht,
	 * um eine hinzuzufügen oder wegzunehmen.
	 */
	function anfangsZeilen(): Beteiligter[] {
		/*
		 * **Nur die eigene Absage** (27.08.2026, aus dem Code-Review).
		 * `miteigentumEintragen` schickt dieselben zwei Felder zurück; ohne die
		 * Quelle stünden nach einer Absage dort die Personen von A's Ausklapper
		 * plötzlich in der Erfassungsmaske daneben.
		 */
		const zurueck = form?.quelle === 'anlegen' ? (form.beteiligte ?? []) : [];
		/*
		 * **Die Kennung wird hier gestellt, nicht zurückgetragen.** Der Server
		 * bildet den gewählten Vertreter als Stellung ab (`vertreterIndex`), und
		 * `vertreterAnfang` liest ihn als `p<Stellung>`. Beide Seiten müssen
		 * dieselbe Regel benutzen, sonst zeigt der Auswahlknopf nach einer Absage
		 * auf niemanden. Deshalb trägt `Beteiligtenwahl` gar keine Kennung.
		 */
		return zurueck.length >= 2
			? zurueck.map((b, i) => ({ kennung: `p${i}`, ...b }))
			: [leereZeile('p0'), leereZeile('p1')];
	}

	const anfang = anfangsZeilen();
	let beteiligteZeilen = $state<Beteiligter[]>(anfang);

	/** Woher die nächste Kennung kommt. Kennungen werden nie wiederverwendet. */
	let naechsteKennung = anfang.length;

	/**
	 * Wer beim Aufbau die Stimme ausübt.
	 *
	 * `angekreuzt()` setzt im Browser nur den **Anfangs**zustand; wer danach
	 * einen anderen Knopf wählt, behält seine Wahl auch dann, wenn eine Zeile
	 * dazukommt oder wegfällt.
	 *
	 * **Vorgewählt ist «Niemand bezeichnet»** (Produktentscheid 27.08.2026). Die
	 * Bezeichnung ist freiwillig; die erste Person still vorzuwählen hiesse, eine
	 * Ordnung zu behaupten, die niemand getroffen hat. Nach einer Absage kommt
	 * `-1` zurück, wenn niemand gewählt war.
	 */
	const vertreterAnfang = $derived(
		form?.quelle === 'anlegen' && form.vertreterIndex !== undefined && form.vertreterIndex >= 0
			? `p${form.vertreterIndex}`
			: NIEMAND
	);

	function personDazu() {
		beteiligteZeilen = [...beteiligteZeilen, leereZeile(`p${naechsteKennung++}`)];
	}

	function personWeg(kennung: string) {
		beteiligteZeilen = beteiligteZeilen.filter((z) => z.kennung !== kennung);
	}

	/**
	 * «Wen tragen Sie ein?» je Personenzeile.
	 *
	 * Die Wahl steht im Zustand und nicht bloss im Feld, weil sie entscheidet,
	 * welche Felder darunter überhaupt gelten. Gemeldet wird sie über
	 * `gefuehrteWahl` und nicht über `bind:value`: Ein `<select>`, an das
	 * gebunden ist, bekommt beim Aufbau den gebundenen Wert zurückgeschrieben und
	 * löscht eine Wahl aus dem Fenster vor der Hydration.
	 */
	function wahlSetzen(kennung: string, wahl: string) {
		beteiligteZeilen = beteiligteZeilen.map((z) =>
			z.kennung === kennung ? { ...z, wahl: alsWahl(wahl) } : z
		);
	}

	/*
	 * **Der Weg «Miteigentum eintragen» steht seit dem 27.08.2026 auf der Seite
	 * der Zeile** (`eigentuemer/[partei]`). Er war einer von sechs Einstiegen in
	 * einer einzigen Tabellenzelle; die Begründung steht dort im Kopf.
	 */

	/**
	 * Der Feldname der Frage «Wen tragen Sie ein?» im Zweig für eine einzelne
	 * Person. Er ist zugleich die Kennung des Auswahlfelds, weil der Knopf
	 * «Ja, diese nehmen» den Wert von aussen hineinschreiben muss.
	 */
	const WENFRAGE_EINZELN = 'personwahl';

	/**
	 * Die Kennung der Zuordnungsmaske.
	 *
	 * Das Bestätigungsformular der Rückfrage steht in einem eigenen Fenster und
	 * muss die Maske dahinter leeren, wenn es durchgeht — über die Kennung, nicht
	 * über Klasse und Aktion: Derselbe Selektor passt auch auf der Personenseite,
	 * und ein Griff, der dort landet, nähme jemandem seine Tipparbeit weg.
	 */
	const ZUORDNUNGSMASKE = 'zuordnungsmaske';

	let personwahl = $state<PersonenWahl>('neu');
	let gewaehltePerson = $state('');

	/** Welche Felder diese Art überhaupt führt — dieselbe Regel wie auf dem Server. */
	const felder = $derived(eigentuemerfelder(personenart as PartyKind, gemeinschaftlich));
	const nimmtBestehende = $derived(felder.personenklammer && personwahl === 'bestehend');

	/** Die Parteien, die auf eine andere Gemeinschaft lauten (Story 7.1). */
	/** Welche Gemeinschaften als Mitglieder gewählt sind — für den Sammelweg. */
	let mitgliedswahl = $state<string[]>([]);

	/**
	 * Der vorbelegte Anteil je Haus: gleiche Teile.
	 *
	 * Fünf Häuser an einem Nenner von 5 ergeben je 1. Das ist der Regelfall am
	 * Verbund; wo das Reglement ungleich verteilt, steht die Zahl im Formular und
	 * lässt sich ändern. **Vorbelegt heisst nicht erraten** — sie steht sichtbar
	 * da, bevor gespeichert wird.
	 */
	const anteilVorschlag = $derived(
		mitgliedswahl.length > 0
			? Math.round((data.gemeinschaft.quotaDenominator / mitgliedswahl.length) * 100) / 100
			: 0
	);

	/**
	 * Wem eine Einheit **am Stichtag der Seite** gehört (Auftraggeber, 27.08.2026: «Bei 2
	 * Einheiten zuordnen braucht es noch den Filter. Bei 50 Parteien wird es sonst
	 * unübersichtlich. Und wenn Personen einer Einheit zugeordnet sind, sollte
	 * diese das auch anzeigen»).
	 *
	 * **Die Suche war schon da**, beide Felder sind `Suchauswahl`. Was fehlte, war
	 * Inhalt: Die Einträge trugen nur die Bezeichnung, und damit liess sich weder
	 * über den Namen des Eigentümers suchen noch **vor** dem Klick sehen, dass die
	 * Einheit längst vergeben ist. Das merkte man erst an der Rückfrage «Diese
	 * Zuordnung wirkt in die Vergangenheit».
	 *
	 * Keine zweite Abfrage: Beide Angaben stehen in `data.stimmkraft.zeilen`, aus
	 * der auch die Tabelle links gebaut wird.
	 */
	const eigentuemerJeEinheit = $derived(
		new Map(
			data.stimmkraft.zeilen.flatMap((z) =>
				z.einheiten.map((e) => [e.unitId, z.displayName] as const)
			)
		)
	);

	/** Welche Einheiten eine Zeile am Stichtag hält. */
	const einheitenJePartei = $derived(
		new Map(data.stimmkraft.zeilen.map((z) => [z.partyId, z.einheiten.map((e) => e.label)]))
	);

	/**
	 * Eine Aufzählung, die eine Zeile nicht sprengt.
	 *
	 * Ein Eigentümer mit acht Einheiten trüge sonst acht Bezeichnungen in einem
	 * Auswahleintrag; auf 390 px läuft die Liste dann quer. Zwei genügen, um die
	 * Zeile wiederzuerkennen, der Rest wird gezählt.
	 */
	function bisZwei(teile: string[], leer: string): string {
		if (teile.length === 0) return leer;
		if (teile.length <= 2) return teile.join(', ');
		return `${teile.slice(0, 2).join(', ')} und ${teile.length - 2} weitere`;
	}

	/** Heute, als Vorbelegung für «ab wann» — die Schale liest die Uhr, nicht der Kern. */
	const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });

	const mitgliedsgemeinschaften = $derived(
		data.eigentuemer.filter((e) => e.kind === 'gemeinschaft')
	);

	/**
	 * Welche Person hinter einer Zeile steht — mit ihrer Kennung, damit die Zeile
	 * einen Weg dorthin trägt.
	 *
	 * Dort stehen alle Einheiten dieses Menschen über die Gemeinschaften hinweg,
	 * und dort lassen sich weitere zuordnen. Ohne den Verweis war die Klammer nur
	 * eine Textzeile, und der Weg zur Person führte über die Hauptnavigation.
	 */
	/**
	 * Welche Zeilen an einer Hülle hängen — als Menge der Kennungen.
	 *
	 * Gebraucht wird sie, damit an einer mitberechtigten Zeile kein Knopf steht,
	 * den der Server abweist: `pruefeZeileTilgbar` sagt dort «ist Mitberechtigte
	 * oder Mitberechtigter an gemeinschaftlichem Eigentum» ab. Einen Knopf
	 * anzubieten, der in eine Absage führt, ist auch mit schöner Meldung ein
	 * Fehler (Lehre vom 21.08.2026).
	 */
	const mitberechtigteZeilen = $derived(
		new Set(
			Object.values(data.mitberechtigte)
				.flat()
				.map((m) => m.partyId)
		)
	);

	/**
	 * Die Zeilen, die **nicht** eigenständig in der Tabelle stehen (Aufgabe 4).
	 *
	 * Sie erscheinen unter ihrer Hülle. Als eigene Zeilen sähen sie aus wie eine
	 * halbfertige Erfassung — «noch keine zugeordnet», null Köpfe, null Quote —,
	 * und genau daran ist die Laienprüfung am 26.08.2026 hängengeblieben.
	 *
	 * **Wer selbst eine Einheit hält, bleibt stehen.** Die Menge kommt vom
	 * Server (`holeNurMitberechtigte`) und enthält nur Zeilen, die ausser der
	 * Mitberechtigung nichts halten. Der Doppelfall — eigene Wohnung plus Anteil
	 * am Paar — behält seine Zeile und seine Kopfstimme, sonst ginge die Summe
	 * im Fuss der Tabelle nicht mehr auf.
	 */
	const nurMitberechtigt = $derived(new Set(data.nurMitberechtigte));

	/**
	 * Die Hüllen, in denen eine Zeile steckt — mit Kennung und Namen.
	 *
	 * **Als Kennung geschlüsselt, nicht als Name** (26.08.2026, aus dem
	 * Code-Review). Ein Paar mit zwei gemeinsamen Wohnungen hat zwei Hüllen mit
	 * demselben Sammelnamen; über den Namen geschlüsselt wäre das ein doppelter
	 * Schlüssel im `{#each}`.
	 */
	function huellenVon(parteiId: string): { id: string; name: string }[] {
		return Object.entries(data.mitberechtigte)
			.filter(([, mitglieder]) => mitglieder.some((m) => m.partyId === parteiId))
			.map(([huelleId]) => ({
				id: huelleId,
				name: data.eigentuemer.find((e) => e.id === huelleId)?.displayName ?? ''
			}))
			.filter((h) => h.name.length > 0);
	}


	/**
	 * Der Zusatz «gehört zu …» für die Auswahl — leer, wo es nichts zu sagen gibt.
	 *
	 * Mehrere Hüllen sind möglich (zwei Erbengemeinschaften mit derselben
	 * Person), deshalb aufgezählt statt die erste genommen.
	 */
	/**
	 * Welche Zusagen das Rückfragefenster mitschickt.
	 *
	 * **Beide, nicht nur die gerade gestellte** (Sicherheitsdurchgang
	 * 06.09.2026). Diese Aktion fragt aus zwei Gründen zurück, und der Server
	 * prüft bei jeder Anfrage beide. Schickte das Fenster nur die Antwort auf
	 * die Frage, die es gerade zeigt, löschte die zweite Zusage die erste: Wer
	 * die Gemeinschaftsfrage bejaht und dann die Verdrängungsfrage, bekäme
	 * wieder die erste vorgelegt — endlos, ohne dass die Zuordnung je zustande
	 * käme.
	 *
	 * Die gerade gestellte Frage gilt mit dem Klick als beantwortet, die andere
	 * behält, was sie vorher hatte.
	 */
	const zusagen = $derived.by(() => {
		const r = form?.rueckfrage;
		const gefragtWirdGemeinschaft = Boolean(r?.teilEinerGemeinschaft?.length);
		return {
			gemeinschaft:
				gefragtWirdGemeinschaft || r?.schonGemeinschaftBestaetigt ? 'true' : 'false',
			verdraengung: !gefragtWirdGemeinschaft || r?.schonBestaetigt ? 'true' : 'false'
		};
	});

	function zugehoerigkeit(parteiId: string): string {
		const huellen = huellenVon(parteiId);
		if (huellen.length === 0) return '';
		return ` (gehört zu ${huellen.map((h) => h.name).join(', ')})`;
	}

	function personVon(parteiId: string): { id: string; name: string } | null {
		const p = data.personen.find((x) => x.parteien.some((y) => y.parteiId === parteiId));
		return p ? { id: p.id, name: p.name } : null;
	}

	/**
	 * Ob zu dieser Partei eine Authentik-Kennung hinterlegt ist.
	 *
	 * **Sie steht da, weil sie sonst nirgends steht.** Die Übernahme aus immotool
	 * bringt sie mit (seit 20.08.2026), und ohne Anzeige liesse sich «ist sie
	 * angekommen?» nur in der Datenbank beantworten. Dieselbe Lehre wie bei den
	 * äusseren Diensten: Ein Zustand, den niemand sieht, fällt erst auf, wenn es
	 * darauf ankommt.
	 *
	 * **Was hier bewusst NICHT steht:** «kann sich selbst anmelden». Den
	 * Anmeldeweg für Eigentümer gibt es noch nicht; die Kennung ist die
	 * Vorbereitung darauf und heute eine reine Tatsache.
	 */
	function hatKennung(parteiId: string): boolean {
		return Boolean(data.eigentuemer.find((e) => e.id === parteiId)?.authentikSubject);
	}

	/**
	 * Suchen und Sortieren in der Eigentümertabelle (Auftraggeber, 12.08.2026).
	 *
	 * Beides im Browser und nicht über den Server: Die Tabelle liegt vollständig
	 * vor — es sind Dutzende Zeilen, nicht Tausende —, und ein Neuladen je
	 * Tastendruck brächte den Stichtag durcheinander, der im Abfrageteil steht.
	 */
	let suche = $state('');
	let sortierung = $state<Sortierung | null>(null);

	/** Welcher Wert einer Zeile zu welcher Spalte gehört. */
	function wertVon(z: (typeof data.stimmkraft.zeilen)[number], spalte: string): unknown {
		if (spalte === 'name') return z.displayName;
		if (spalte === 'einheiten') return adresse(z);
		if (spalte === 'koepfe') return z.kopfstimmen;
		if (spalte === 'quote') return z.wertquote;
		return null;
	}

	/**
	 * Der Archivstand je Zeile — aus `data.eigentuemer` dazugeholt.
	 *
	 * **Warum nicht aus der Stimmkraft.** Die rechnet, und ihre Struktur wird von
	 * der Freigabe zur Momentaufnahme gemacht. Das Archiv hat dort nichts zu
	 * suchen — sonst verlöre eine archivierte Partei ihre Stimme, lautlos.
	 * Deshalb wird es hier, in der **Anzeige**, danebengelegt.
	 */
	const archivStand = $derived(
		new Map(data.eigentuemer.map((e) => [e.id, { am: e.archiviertAm, notiz: e.archivnotiz }]))
	);

	/** Ob die archivierten Zeilen mitlaufen. */
	let archivZeigen = $state(false);

	const angereichert = $derived(
		data.stimmkraft.zeilen.map((z) => ({
			...z,
			archiviertAm: archivStand.get(z.partyId)?.am ?? null,
			archivnotiz: archivStand.get(z.partyId)?.notiz ?? null
		}))
	);
	/**
	 * **Die Mitgliedszeilen stehen nicht eigenständig in der Tabelle**
	 * (Aufgabe 4, Schritt 2) — solange ihre Hülle selbst zu sehen ist.
	 *
	 * **Der Nachsatz ist keine Feinheit** (26.08.2026, aus dem Code-Review).
	 * Eine Hülle ohne zugeordnete Einheit lässt sich archivieren. Ohne die
	 * Bedingung fielen bei ausgeschaltetem Archivschalter Hülle **und** ihre
	 * nicht archivierten Mitglieder aus der Seite — Menschen mit eigenem
	 * Einladungsanspruch nach ZGB Art. 712n wären dann nirgends mehr sichtbar.
	 * Ist die Hülle weg, steht die Person wieder für sich, mit ihrem Zusatz
	 * «auch mitberechtigt an …».
	 *
	 * Der Schnitt sitzt **vor** dem Archivschalter: Eine archivierte
	 * Mitgliedszeile ist genauso wenig eine eigene Zeile wie eine aktive, und
	 * sie soll auch den Archivzähler nicht füllen. Sichtbar bleibt sie unter
	 * ihrer Hülle, dort mit der Marke «archiviert».
	 */
	const sichtbareHuellen = $derived(
		new Set(
			angereichert.filter((z) => archivZeigen || !z.archiviertAm).map((z) => z.partyId)
		)
	);
	const unterDerHuelle = $derived(
		new Set(
			[...nurMitberechtigt].filter((id) =>
				huellenVon(id).some((h) => sichtbareHuellen.has(h.id))
			)
		)
	);
	const eigenstaendig = $derived(angereichert.filter((z) => !unterDerHuelle.has(z.partyId)));
	const bestand = $derived(
		archivZeigen ? eigenstaendig : eigenstaendig.filter((z) => !z.archiviertAm)
	);
	const archiviert = $derived(eigenstaendig.filter((z) => z.archiviertAm));
	/**
	 * Wonach in dieser Liste gesucht wird — eine Stelle, zwei Verwendungen.
	 *
	 * **Die Mitberechtigten gehören dazu** (26.08.2026, aus dem Code-Review).
	 * Seit Aufgabe 4 haben sie keine eigene Zeile mehr; ohne ihre Namen hier
	 * fände die Suche sie auf dieser Seite gar nicht — dieselbe Fehlerklasse
	 * wie «eine Suche, die 4 von 5 findet». Im Sammelnamen stehen sie nur,
	 * solange niemand jemanden nachträglich aufgenommen oder den Namen von Hand
	 * berichtigt hat.
	 */
	function suchtextZeile(z: {
		partyId?: string;
		displayName: string;
		representativeName?: string | null;
		einheiten: { label: string }[];
	}): string {
		const mitglieder = z.partyId
			? (data.mitberechtigte[z.partyId] ?? []).map((m) => `${m.displayName} ${m.email ?? ''}`)
			: [];
		return `${z.displayName} ${adresse(z)} ${z.representativeName ?? ''} ${mitglieder.join(' ')}`;
	}

	/**
	 * **Dieselbe Suche wie die Liste** (25.08.2026, aus dem Code-Review): in
	 * Wörter zerlegt, mit Und verknüpft, ohne Akzente verglichen. Ein eigenes
	 * `includes` fand «Petrović» nicht, wenn jemand «petrovic» tippte.
	 */
	/**
	 * Wie viele Namen dieser Suchbegriff erreicht.
	 *
	 * **Nicht `bestand.length`** (27.08.2026, aus dem Code-Review): Die
	 * Mitberechtigten haben seit Aufgabe 4 keine eigene Zeile mehr, sie stehen in
	 * der Zelle ihrer Hülle und werden von [suchtextZeile] ausdrücklich
	 * mitdurchsucht. Fünf Gemeinschaften mit je vier Mitberechtigten sind
	 * fünfundzwanzig Namen auf dem Bildschirm und trotzdem nur fünf Zeilen. Und
	 * die Suche ist der einzige Weg zu einem Mitberechtigten: eine eigene Seite
	 * hat er nicht.
	 */
	const durchsuchbar = $derived(
		bestand.reduce((n, z) => n + 1 + (data.mitberechtigte[z.partyId] ?? []).length, 0)
	);

	const imArchivGefunden = $derived(filtereNach(archiviert, suche, suchtextZeile).length);

	const gefiltert = $derived(filtereNach(bestand, suche, suchtextZeile));
	const zeilen = $derived(sortiere(gefiltert, sortierung, wertVon));

	function sortiereNach(spalte: string) {
		sortierung = naechsteSortierung(sortierung, spalte);
	}

	const jeEinheit = $derived(data.stimmkraft.headCountMode === 'per_unit');
	const historisch = $derived(data.stichtag !== data.heute);

	function adresse(z: { einheiten: { label: string }[] }): string {
		return z.einheiten.map((e) => e.label).join(', ');
	}
</script>

<div class="kopf">
	<h1>Eigentümer und Stimmkraft</h1>
	{#if data.darfStammdaten}
		<a class="knopf" href="/gemeinschaften/{data.gemeinschaft.id}/uebernahme?quelle=datei"
			>Aus Datei übernehmen</a
		>
	{/if}
</div>

<!--
	Die drei Begriffe gehen leicht durcheinander — gefragt am 11.08.2026: «Was
	wird bei Person erfasst. Müsste man da nicht die Einheiten zuweisen statt
	Personen?» Die Antwort gehört auf diese Seite und nicht nur ins Handbuch;
	zugeklappt, weil sie nur beim ersten Mal gebraucht wird
	(docs/gestaltung.md, «Der Hintergrund wartet zugeklappt»).
-->
<details class="begriffe">
	<summary>Eigentümer, Person, Einheit — wer ist was?</summary>
	<dl>
		<dt>Einheit</dt>
		<dd>Wohnung, Estrich, Parkplatz — mit ihrer Wertquote.</dd>
		<dt>Eigentümer</dt>
		<dd>
			Wer in <strong>dieser einen</strong> Gemeinschaft stimmberechtigt ist. Die Kopfstimme gilt je
			Gemeinschaft (ZGB Art. 712o), und die Zählweise ist von Haus zu Haus verschieden — deshalb
			gibt es diese Zeile in jeder Gemeinschaft eigens.
		</dd>
		<dt>Person</dt>
		<dd>
			Derselbe Mensch <strong>über alle</strong> Gemeinschaften hinweg. Sie beantwortet die eine
			Frage, die sich sonst nicht beantworten lässt: Ist der, der hier am Eingang steht, derselbe
			wie dort? Ohne sie müsste er am Versammlungstag in jedem Haus einzeln angemeldet werden.
		</dd>
		<dt>Gemeinschaftliches Eigentum</dt>
		<dd>
			Gehört eine Einheit mehreren Leuten, etwa Eheleuten oder einer Erbengemeinschaft, ist das
			<strong>eine einzige</strong> Zeile: beim Erfassen unter «Wem gehört die Einheit?»
			gewählt. Zwei getrennte Zeilen wären falsch: Zusammen haben sie eine Stimme, die ein
			Vertreter abgibt (ZGB Art. 712o Abs. 1). Hält heute eine Person allein und kommt jemand
			dazu, steht an ihrer Zeile «Miteigentum eintragen».
		</dd>
	</dl>
	<p>
		Zugeordnet wird die <strong>Einheit</strong>, nie die Person: nicht «Frau Berger gehört zu
		Wohnung 3», sondern «Wohnung 3 gehört ab dem 1. Mai Frau Berger». Mit Datum, damit eine
		vergangene Versammlung weiter zeigt, wer damals stimmte. Vom Menschen aus geht es ebenso: Unter
		<a href="/personen">Personen</a> öffnen Sie ihn und ordnen ihm eine Einheit aus irgendeiner
		Gemeinschaft zu; die Zeile dort entsteht von selbst.
	</p>
</details>

{#if form?.rueckfrage}
	<!-- Eine rückwirkende Korrektur kann eine ganze Zuordnung verdrängen. Nachher
	     liesse sich der entfernte Datensatz nicht mehr sehen, nur noch der
	     Verlauf — deshalb vorher fragen, nicht nachher erklären. -->
	<!--
		**Zwei Anlässe, eine Frage** (06.09.2026). Das Fenster trug bisher nur
		den einen Satz über die Rückwirkung. Seit die Zuordnung an ein Mitglied
		einer Gemeinschaft ebenfalls zurückfragt, muss die Überschrift sagen,
		worum es geht — sonst steht über einer Frage nach der gemeinsamen Stimme
		ein Satz über die Vergangenheit.
	-->
	<Rueckfragefenster
		frage={form.rueckfrage.teilEinerGemeinschaft?.length
			? 'Diese Person gehört zu einer Eigentümergemeinschaft.'
			: 'Diese Zuordnung wirkt in die Vergangenheit.'}
		zurueck="?stichtag={data.stichtag}"
		marke={form}
	>
		{#snippet inhalt()}
			{#if form.rueckfrage.teilEinerGemeinschaft?.length}
				<p>
					Sie ordnet die Einheit <strong>der einzelnen Person</strong> zu, nicht
					{form.rueckfrage.teilEinerGemeinschaft.length === 1 ? 'der' : 'den'} Gemeinschaft{form
						.rueckfrage.teilEinerGemeinschaft.length === 1
						? ''
						: 'en'}
					{form.rueckfrage.teilEinerGemeinschaft.join(', ')}.
				</p>
				<p>
					Für die Abstimmung heisst das: Es zählt die Stimme dieser Person allein. Soll die
					Gemeinschaft gemeinsam stimmen, wählen Sie sie in der Liste statt eines ihrer
					Mitglieder.
				</p>
			{/if}
			<ul>
				{#each form?.rueckfrage?.verdraengt ?? [] as name (name)}
					<li>Die Zuordnung an <strong>{name}</strong> entfällt vollständig.</li>
				{/each}
				{#each form?.rueckfrage?.gekappt ?? [] as name (name)}
					<li>Die Zuordnung an <strong>{name}</strong> endet neu am {form?.rueckfrage?.ab}.</li>
				{/each}
			</ul>
			<!--
				**Der Ausweg gehört an die Stelle des Irrtums** (26.08.2026, Laienprüfung).
				Wer zwei Leute auf eine Wohnung setzen will, nimmt den naheliegenden Weg
				«Einheit zuordnen» und landet genau hier. Das Fenster sagte bisher nur, was
				die Handlung kostet, nicht dass sie das Vorhaben verfehlt — und «Trotzdem
				zuordnen» klingt nach «ja, ich weiss». Danach steht **ein** Eigentümer da,
				wo zwei stehen sollten.

				**Die Bedingung ist die Partei, nicht die Zahl der Zeilen.** Der erste
				Entwurf hängte den Satz an `verdraengt.length > 0` — eine Schranke, die
				nie greift, weil die Aktion die Rückfrage überhaupt nur bei verdrängten
				Zeilen stellt. Die Unterscheidung, die es wirklich gibt: Wer bloss den
				Stichtag **derselben** Zuordnung berichtigt, verdrängt sich selbst, und
				dort wäre «sollen beide zusammen Eigentümer sein» sinnlos.

				**Den stillen Weg fängt er nicht.** Beginnt die bestehende Zuordnung
				früher, wird sie gekappt statt verdrängt — dann kommt gar keine Rückfrage
				(`historie.ts`, `b.validFrom < abStichtag`). Dafür steht der Hinweis
				fest am Formular selbst, auf beiden Wegen.
			-->
			{#if form?.rueckfrage?.fremdeBetroffen}
				<p>
					Sollen beide zusammen Eigentümer sein, brechen Sie hier ab. Gemeinschaftliches
					Eigentum ist eine einzige Zeile, nicht zwei Zuordnungen derselben Einheit. Der Weg
					dazu steht an der Zeile des bisherigen Eigentümers: «Miteigentum eintragen».
				</p>
			{/if}
			<!--
				**Nur wo es etwas zu beruhigen gibt** (23.08.2026, Prüflauf I, A-25). Der
				Satz stand fünfmal hintereinander bei einer Gemeinschaft, die noch nie
				getagt hatte — eine Warnung über etwas, das es nicht gibt. Wer ihn
				fünfmal liest, liest ihn beim sechsten Mal auch dann nicht, wenn er
				zutrifft.
			-->
			{#if data.hatteVersammlung}
				<p>
					Bereits durchgeführte Versammlungen bleiben unberührt: Bei der Freigabe wurde
					festgehalten, wer dort stimmberechtigt war. Daran ändert sich nichts mehr.
				</p>
			{/if}
		{/snippet}
		{#snippet handlung()}
			<!--
				**Nach der Bestätigung wird die Maske dahinter geleert** (03.09.2026,
				aus dem Code-Review).

				Die Rückfrage ist ein **eigenes** Formular mit verborgenen Feldern.
				Der Server hat die erste Absendung mit `fail(409)` beantwortet, und
				bei einer Absage setzt SvelteKit nichts zurück — richtig so, sonst
				verlöre man das Getippte. Nur sieht das Hauptformular deshalb nie ein
				`reset`: Nach «Trotzdem zuordnen» stünden Einheit und Eigentümer
				weiter in der Maske, und der nächste Klick täte dasselbe noch einmal.

				Vor der Umstellung auf `absenden()` fiel das nicht auf, weil die
				erste Absendung die Seite neu lud.
			-->
			<form
				method="POST"
				action="?/zuordnen"
				use:enhance={absenden({
					/*
						**Über die Kennung, nicht über Klasse und Aktion** (aus dem
						Sicherheitsdurchgang). Der erste Anlauf suchte
						`form.felder[action="?/zuordnen"]` — derselbe Selektor passt auch auf
						`personen/[id]/+page.svelte`. Träfe er dort, setzte er ein fremdes
						Formular zurück und nähme jemandem seine Tipparbeit weg.

						`HTMLFormElement.prototype.reset.call` statt `maske.reset()`: Ein Feld
						mit `name="reset"` verdeckt die Methode am Formular (DOM-Clobbering);
						SvelteKit geht denselben Weg und begründet ihn ebenso. Findet der
						Griff nichts, geschieht nichts — der Wächter dafür ist Schritt 14 in
						`e2e/durchspielen.mjs`.
					*/
					beiErfolg: () => {
						const maske = document.getElementById(ZUORDNUNGSMASKE);
						if (maske instanceof HTMLFormElement) HTMLFormElement.prototype.reset.call(maske);
					}
				})}
			>
				<input type="hidden" name="unitId" value={form?.rueckfrage?.unitId} />
				<input type="hidden" name="partyId" value={form?.rueckfrage?.partyId} />
				<input type="hidden" name="ab" value={form?.rueckfrage?.ab} />
				<!--
					**Die Bestätigung gehört zu ihrer Frage** (Code-Review 06.09.2026).
					Ein gemeinsames `bestaetigt` liesse die Zusage zur Gemeinschaftsfrage
					auch die Verdrängungswarnung überspringen — die Zuordnung entfiele
					dann stumm, obwohl das Fenster sie nie genannt hat.
				-->
				<input type="hidden" name="gemeinschaftBestaetigt" value={zusagen.gemeinschaft} />
				<input type="hidden" name="bestaetigt" value={zusagen.verdraengung} />
				<button type="submit" class="ja" data-ton="warnung">Trotzdem zuordnen</button>
			</form>
		{/snippet}
	</Rueckfragefenster>
{:else if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.hinweis}
	<!-- Der Sammelweg nennt die Gemeinschaften beim Namen und, was nicht ging. -->
	<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
{:else if form?.angelegt}
	<Meldung ton="gut" marke={form}>Eigentümer angelegt.</Meldung>
{:else if form?.schonVorhanden}
	<!-- Kein Fehler, aber auch kein Erfolg: Wer «angelegt» läse, suchte die neue
	     Zeile und fände sie schon lange in der Tabelle stehen. -->
	<Meldung ton="gut" marke={form}>
		Diese Person wird in dieser Gemeinschaft bereits geführt — die bestehende Zeile bleibt.
	</Meldung>
{:else if form?.zugeordnet}
	<!--
		**Die Meldung nennt, was geschehen ist** (A-25). «Einheit zugeordnet.» sagt
		nicht, welche und wem — bei fünf Zuordnungen hintereinander weiss man nach
		der dritten nicht mehr, ob die vierte durchging.
	-->
	<Meldung ton="gut" marke={form}>
		{#if form.zugeordnet !== true}
			{form.zugeordnet} zugeordnet.
		{:else}
			Einheit zugeordnet.
		{/if}
	</Meldung>
{:else if data.getilgt}
	<!--
		**Zuletzt in der Kette** (27.08.2026, aus dem Code-Review). Der Weg kommt
		von der Seite der Zeile zurück; die Zeile gibt es nicht mehr, ihr Name
		steht im Abfrageteil.

		`?getilgt=…` bleibt in der Adresse stehen. Stünde die Meldung weiter oben,
		verdeckte sie danach **jede** Absage und jede Quittung derselben Seite:
		Wer als Nächstes einen Eigentümer erfasst und dabei scheitert, läse
		weiterhin «… ist getilgt».

		**Kein `<Meldung>`, und das ist gemessen** (02.09.2026). Der Baustein
		hängt am `marke`-Wert: Weggedrückt bleibt weg, bis sich die Marke ändert.
		Diese Meldung stammt aus der **Adresse**, nicht aus `form` — `form` bliebe
		hier für immer `null`, und nach einem Wegdrücken käme auch die nächste
		Tilgung nicht mehr an. Der Weg dafür wäre `beimSchliessen`, das den
		Abfrageteil streicht; das ist eine eigene Sache und keine Umstellung.
	-->
	<p class="meldung gut" role="status">«{data.getilgt}» ist getilgt.</p>
{/if}

<!--
	**Warum hier ein Datum steht** (23.08.2026, Prüflauf I, A-22). «Stand vom
	[Datum] · Anzeigen» ohne ein Wort dazu — der Prüfer erschloss den Sinn aus
	einer Erklärkarte weiter oben, die von etwas anderem handelt.
-->
<form method="GET" class="stichtag">
	<label>
		Stand vom
		<input type="date" name="stichtag" {...anfangswert(data.stichtag)} />
		<span class="hilfe">
			Eigentum wechselt. Gezeigt wird, wem die Einheiten an <em>diesem</em> Tag gehörten —
			für die Vorbereitung meist heute, für eine Rückfrage zu einer früheren Versammlung
			deren Datum.
		</span>
	</label>
	<button type="submit">Anzeigen</button>
	{#if historisch}
		<span class="hinweis">
			Vergangener Stand. <a href="?stichtag={data.heute}">Zurück zu heute</a>
		</span>
	{/if}
</form>

<!--
	Bestand links, Eintragen rechts (Auftraggeber, 12.08.2026). Bis dahin standen vier
	Blöcke untereinander — Kacheln, Tabelle, zuordnen, erfassen —, zusammen 1780
	px auf einem 900 px hohen Bildschirm. Wer eine Einheit zuordnete, sah dabei
	die Tabelle nicht mehr, gegen die er sie prüft.

	seitenaufbau-ausnahme: Der Bestand wird hier beim Eintragen gebraucht, nicht
	nur davor gelesen.

	**Und dabei bleibt es** (02.09.2026, Task 4 des Stapelplans). Der Plan zählt
	diese Seite zu den vieren, die zuerst umgestellt werden sollen. Nachgemessen
	an einer Gemeinschaft mit 14 Eigentümern, 1440 × 900, die Arbeitsfläche
	probeweise auf eine Spalte gestellt:

	|                            | nebeneinander | als Stapel |
	|----------------------------|---------------|------------|
	| «Einheit zuordnen» beginnt | 1377 px       | 2596 px    |
	| Tabelle endet              | 2676 px       | 1778 px    |
	| Seitenhöhe                 | 3355 px       | 3778 px    |

	Nebeneinander liegt das Zuordnungsformular **innerhalb** der Tabellenhöhe: Wer
	es ausfüllt, hat die Einheiten und ihre bisherigen Eigentümer daneben. Im
	Stapel läge es 818 px unter dem Tabellenende — auf einem 900 px hohen
	Bildschirm sieht dann niemand mehr, wogegen er prüft. Und die Seite würde
	dabei länger, nicht kürzer.

	Das ist derselbe Einwand wie 2026-08-12, nur diesmal in Zahlen. Bei dreissig
	Eigentümern verdoppelt sich der Abstand.

	Der Plan lässt das ausdrücklich offen: «Ob alle 61 Seiten umgestellt werden.
	Vermutlich nicht. Der Wächter mit seiner Ausnahmemöglichkeit ist dafür der
	richtige Ort, nicht eine Vorabentscheidung.»
-->
<div class="arbeitsflaeche">
<div class="spalte">
<!--
	**Die Bestandsspalte braucht ihre Überschrift** (Auftraggeber, 28.08.2026): «unter
	‹Eigentümer und Stimmkraft› der Eigentümer-Spalte ebenfalls.» Rechts tragen
	beide Kacheln eine — «1 Eigentümer erfassen», «2 Einheit zuordnen» —, links
	begann alles ohne Ansage.

	Sie steht **vor** den Kennzahlen und nicht über der Tabelle: Kennzahlen,
	Suche, Zähler und Tabelle gehören zusammen zum Bestand. Über der Tabelle
	stünde sie hinter der Suchleiste und bei einer Suche ohne Treffer sogar
	hinter deren Leermeldung.
-->
<h2 class="spaltentitel">Erfasste Eigentümer</h2>

<section class="kopfzeile">
	<div class="kennzahl">
		<span class="wert">{data.stimmkraft.summeKopfstimmen}</span>
		<span class="marke">
			Kopfstimmen
			<span class="hilfe">
				{jeEinheit ? 'je Einheit' : 'je Eigentümer'}
				{#if jeEinheit && data.gemeinschaft.headCountRuleSource}
					· {data.gemeinschaft.headCountRuleSource}
				{/if}
			</span>
		</span>
	</div>
	<div class="kennzahl">
		<span class="wert">{data.stimmkraft.summeWertquote}</span>
		<span class="marke">
			Wertquoten
			<span class="hilfe">von {data.gemeinschaft.quotaDenominator} — Stammquote</span>
		</span>
	</div>
</section>

{#if data.stimmkraft.einheitenOhneEigentuemer.length > 0}
	<!-- Ausdrücklich benannt statt still übergangen: Diese Einheiten fehlen in
	     jeder Zählung, und die Summe oben sähe trotzdem plausibel aus. -->
	<p class="meldung warnung">
		<strong>{data.stimmkraft.einheitenOhneEigentuemer.length} Einheiten ohne Eigentümer</strong>
		<!-- Ausgeschrieben, wie überall sonst: «2025-06-01» liest im Fliesstext
		     niemand (Nachprüfung 23.08.2026). -->
		zum {datumLang(data.stichtag)}: {data.stimmkraft.einheitenOhneEigentuemer
			.map((e) => e.label)
			.join(', ')}.
		Sie zählen in keiner Abstimmung mit.
	</p>
{/if}

{#if data.stimmkraft.zeilen.length > 0}
	<!-- Die Suchleiste steht über der Tabelle, im selben Muster wie in der
	     Personen- und Versammlungsliste (`.suchleiste` in app.css) — und seit dem
	     27.08.2026 auch unter derselben Schwelle. Der äussere Block bleibt bei
	     «sobald es Zeilen gibt», denn er trägt die Tabelle selbst. -->
	{#if brauchtSuchfeld({ durchsuchbar, archiviert: archiviert.length })}
		<div class="suchleiste">
			<label class="suchfeld">
				<span class="nurLeser">In dieser Tabelle suchen</span>
				<input
					type="search"
					placeholder="Name, Einheit oder Vertreter"
					{...anfangswert(suche)}
					oninput={(e) => (suche = e.currentTarget.value)}
					autocomplete="off"
				/>
			</label>
			<Archivschalter
				art="eigentuemer"
				archiviert={archiviert.length}
				trefferImArchiv={imArchivGefunden}
				gesucht={suche.trim().length > 0}
				aktivLeer={zeilen.length === 0}
				bind:zeigen={archivZeigen}
			/>
			<p class="zaehler">{zeilen.length} von {bestand.length}</p>
		</div>
	{/if}

	{#if zeilen.length === 0}
		<p class="hilfe">
			{#if suche.trim()}
				Niemand passt zu «{suche}».
			{:else}
				<!-- Ohne Suchbegriff hiesse «passt zu «»» nichts (25.08.2026). -->
				Keine Eigentümerzeile in der Anzeige — alle liegen im Archiv.
			{/if}
		</p>
		<Archivschalter
			art="eigentuemer"
			archiviert={archiviert.length}
			trefferImArchiv={imArchivGefunden}
			gesucht={suche.trim().length > 0}
			aktivLeer={true}
			mitSchalter={false}
			bind:zeigen={archivZeigen}
		/>
	{/if}

	<div class="tabellenrahmen">
		<!-- svelte-ignore a11y_no_redundant_roles -->
		<table role="table" class="karten">
			<thead>
				<!-- svelte-ignore a11y_no_redundant_roles -->
				<tr role="row">
					<Sortierkopf spalte="name" {sortierung} klick={sortiereNach}>Eigentümer</Sortierkopf>
					<Sortierkopf spalte="einheiten" {sortierung} klick={sortiereNach}>Einheiten</Sortierkopf>
					<!-- Kurze Köpfe: «Kopfstimmen» ist mit `white-space: nowrap` 96 px breit
					     und zwingt die Namensspalte enger, als sie sein müsste. -->
					<Sortierkopf spalte="koepfe" zahl {sortierung} klick={sortiereNach} titel="Kopfstimmen">
						Köpfe
					</Sortierkopf>
					<Sortierkopf
						spalte="quote"
						zahl
						{sortierung}
						klick={sortiereNach}
						titel="Wertquote nach Stammquote"
					>
						Quote
					</Sortierkopf>
				</tr>
			</thead>
			<tbody>
				{#each zeilen as z (z.partyId)}
					<!-- svelte-ignore a11y_no_redundant_roles -->
					<tr role="row" class:ohne={z.einheiten.length === 0}>
						<td role="cell" class="kopfzelle">
							<!--
								Der **Name selbst** ist der Weg zur Person, nicht eine zusätzliche
								Zeile darunter. Gemessen am 12.08.2026: Bei vierzehn Eigentümern
								kostete die Zeile «Alle Einheiten von …» 14 × 21 px, und in einer
								halben Bahn brach sie zweizeilig um.
							-->
							{#if personVon(z.partyId)}
								{@const person = personVon(z.partyId)!}
								<a href="/personen/{person.id}" title="Alle Einheiten dieses Eigentümers">
									{z.displayName}
								</a>
							{:else}
								{z.displayName}
							{/if}
							<!--
								**Die Marke steht an der Zeile, nicht erst im Ausklapper**
								(25.08.2026, aus dem Code-Review). Mit eingeschaltetem Schalter
								stand die archivierte Zeile bis dahin wie jede andere in der
								Tabelle — man musste sie aufklappen, um es zu sehen.
							-->
							{#if z.archiviertAm}
								<span class="archivmarke" title={z.archivnotiz ?? 'Archiviert'}>archiviert</span>
							{/if}
							<!--
								**Der Zusatz muss ohne Vertretung tragen** (27.08.2026). Seit die
								Bezeichnung freiwillig ist, kann `representativeName` leer sein;
								unverzweigt stünde dann «gemeinschaftlich, vertreten durch » mit
								nichts dahinter. Der Satz nennt stattdessen, was gilt: Am Abend
								darf die anwesende Person zählen.
							-->
							{#if z.isCommunity && z.representativeName}
								<span class="zusatz">
									gemeinschaftlich, vertreten durch {z.representativeName}
									<span class="hilfe">Eine Stimme nach ZGB Art. 712o Abs. 1</span>
								</span>
							{:else if z.isCommunity}
								<span class="zusatz">
									gemeinschaftlich, keine Vertretung bezeichnet
									<span class="hilfe">
										Eine Stimme nach ZGB Art. 712o Abs. 1. Wer am Abend erscheint, darf sie
										abgeben.
									</span>
								</span>
							{:else if z.representativeName}
								<span class="zusatz">vertreten durch {z.representativeName}</span>
							{/if}
							{#if hatKennung(z.partyId)}
								<span
									class="zusatz"
									title="Aus der Übernahme: Diese Partei ist mit einer Authentik-Identität verknüpft."
								>
									Authentik-Kennung hinterlegt
								</span>
							{/if}
							<!--
								**Die Mitberechtigten stehen unter ihrer Hülle** (26.08.2026,
								Aufgabe 4). Nicht als eigene Tabellenzeilen: Die Tabelle führt
								eine Zeile je Stimme, und die Stimme hängt an der Hülle (ZGB
								Art. 712o Abs. 1). Als eigene `<tr>` wären es auf dem Telefon
								ausserdem eigene Karten — drei Karten für eine Wohnung.

								Wer wen einlädt, entscheidet die Marke: ohne gemeldete
								Zustelladresse alle einzeln (ZGB Art. 712n), mit ihr genügt die
								eine.
							-->
							{#if z.isCommunity && (data.mitberechtigte[z.partyId] ?? []).length > 0}
								<ul class="mitberechtigte">
									{#each data.mitberechtigte[z.partyId] as m (m.partyId)}
										<li>
											{#if personVon(m.partyId)}
												{@const person = personVon(m.partyId)!}
												<a href="/personen/{person.id}">{m.displayName}</a>
											{:else}
												{m.displayName}
											{/if}
											{#if m.istVertreter}
												<span class="mitmarke" title="ZGB Art. 712o Abs. 1">
													übt die Stimme aus
												</span>
											{/if}
											{#if m.istZustelladresse}
												<span
													class="mitmarke"
													title="ZGB Art. 712n: die Einladung genügt hierhin"
												>
													Zustelladresse
												</span>
											{/if}
											{#if m.archiviertAm}
												<span class="archivmarke">archiviert</span>
											{/if}
											{#if m.email}<span class="hilfe">{m.email}</span>{/if}
										</li>
									{/each}
								</ul>
							{/if}
							<!--
								**Der Doppelfall bekommt seinen Zusatz** (Aufgabe 4, Schritt 2).
								Wer selbst eine Einheit hält und zusätzlich an einer zweiten
								mitberechtigt ist, behält seine Zeile samt Kopfstimme — sonst
								ginge die Summe im Fuss nicht mehr auf. Ohne diesen Satz stünde
								er zweimal auf der Seite, ohne dass etwas den Zusammenhang nennt.
							-->
							{#if !z.isCommunity && mitberechtigteZeilen.has(z.partyId)}
								{#each huellenVon(z.partyId) as h (h.id)}
									<span class="zusatz">auch mitberechtigt an «{h.name}»</span>
								{/each}
							{/if}
						</td>
						<td role="cell" data-spalte="Einheiten" class="einheiten">
							<!--
								**Der Schnitt sitzt hier, nicht am Ende der Zelle** (23.08.2026,
								zweiter Anlauf). Bis eben stand alles Folgende im `{:else}` —
								Berichtigen und Tilgen also nur für Zeilen, die schon eine Einheit
								halten. Ausgerechnet die leere Zeile, die beides am nötigsten
								braucht, bekam nichts als den Satz «noch keine zugeordnet». Im
								Browser gemessen: «Margrit Grossenbacher-Zulauf» hatte keinen
								einzigen Knopf, und der Berichtigen-Weg von gestern war für genau
								den Fall unerreichbar, für den er gebaut wurde.
							-->
							{#if z.einheiten.length === 0}
								<span class="hilfe">noch keine zugeordnet</span>
							{:else}
								{adresse(z)}
							{/if}

							<!--
								**Ein Einstieg je Zeile, nicht sechs** (Auftraggeber, 27.08.2026).

								In dieser Zelle standen zuletzt «Angaben berichtigen» dreimal
								(für die Zeile und je mitberechtigter Person), «Vertretung
								wechseln», «Mitberechtigte» mit weiteren Ausklappern darin,
								«Weitere Person aufnehmen» und die Wahl «Wohin geht die
								Einladung?». Das war eine Seite in einer Tabellenzelle, und ein
								Ausklapper im Ausklapper dazu.

								**Der Ursprung war eine richtige Entscheidung** (Aufgabe 4): Die
								Mitberechtigten stehen **in** der Kopfzelle der Hülle statt als
								eigene `<tr>`, weil `class="karten"` auf dem Telefon aus jeder
								Zeile eine Karte macht und die Zählung «eine Zeile je Hülle» nur
								so aufgeht. Nicht absehbar war, dass in der Zelle später
								**gehandelt** wird und nicht nur angezeigt.

								**Die Tabelle zeigt jetzt nur noch den Bestand.** Alles, was
								etwas tut, steht auf der Seite der Zeile. Das Muster gibt es im
								Haus schon: `/personen/[id]` ist genau das, eine Seite je
								Gegenstand mit allem, was an ihm hängt. Ein Fenster wäre der
								kürzere Weg gewesen und wurde verworfen — ein `<dialog>` wirkt
								ohne JavaScript nicht, und im Saal wird die Anwendung auf fremden
								Geräten benutzt.
							-->
							<!--
								**«Angaben ändern» statt «Zeile öffnen»** (UI-Durchgang
								06.10.2026): Was sich öffnet, ist die Seite mit den Angaben der
								Zeile, und «Zeile» sagt einem Laien nichts. Der Verweis steht
								auf eigener Zeile unter der Einheit; vorher stand er je nach
								Länge der Adresse mal dahinter, mal darunter.
							-->
							<a class="bearbeiten" href="/gemeinschaften/{data.gemeinschaft.id}/eigentuemer/{z.partyId}">
								Angaben ändern
							</a>
						</td>
						<td role="cell" data-spalte="Köpfe" class="zahl">{z.kopfstimmen}</td>
						<td role="cell" data-spalte="Quote" class="zahl">{z.wertquote}</td>
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr>
					<td role="cell" class="kopfzelle" colspan="2">Zusammen</td>
					<td role="cell" data-spalte="Köpfe" class="zahl">{data.stimmkraft.summeKopfstimmen}</td>
					<td role="cell" data-spalte="Quote" class="zahl">{data.stimmkraft.summeWertquote}</td>
				</tr>
			</tfoot>
		</table>
	</div>
{/if}

{#if vorschlaege.length > 0}
	<!--
		Was der Anwendung auffällt — vorgeschlagen, nicht gesetzt. Nur bei
		**gleichem** Namen und nur, wenn es genau eine gleichnamige Person gibt.

		Steht links beim Bestand, nicht rechts beim Eintragen: Es ist eine Aussage
		darüber, was in der Tabelle darüber schon steht.
	-->
	<section class="vorschlaege">
		<h2>Dieselbe Person?</h2>
		<p class="hilfe">
			Diese Zeilen tragen denselben Namen wie eine bereits erfasste Person. Verknüpft wird nur,
			was Sie bestätigen — eine falsche Klammer gäbe am Versammlungstag jemandem Zutritt zu einer
			Versammlung, in der er nichts zu suchen hat.
		</p>
		{#each vorschlaege as v (v.parteiId)}
			<form method="POST" action="?/verknuepfen" class="vorschlag">
				<input type="hidden" name="parteiId" value={v.parteiId} />
				<input type="hidden" name="personId" value={v.personId} />
				<span>
					<strong>{v.parteiName}</strong>
					<span class="hilfe">{v.hinweis}</span>
				</span>
				<button type="submit" class="leise">Als dieselbe Person führen</button>
			</form>
		{/each}
	</section>
{/if}
</div>

{#if !historisch}
	<!--
		Die rechte Spalte: **erst erfassen, dann zuordnen** (Auftraggeber, 12.08.2026:
		«müsste die Reihenfolge gedreht werden, da zuerst die Eigentümer erfasst
		und dann zugeordnet werden müssen»). Vorher stand das Zuordnen oben und
		verwies für den fehlenden Eigentümer nach unten — wer eine Gemeinschaft
		aufbaut, arbeitet aber von oben nach unten.

		Zwei Abschnitte, zwei Rahmen (Auftraggeber, 11.08.2026: «fehlt … eine
		Unterteilung. Als dass man sieht, dass das zwei unterschiedliche
		Funktionen sind»).
	-->
	<div class="spalte">
	{#if data.gemeinschaft.quotaDenominator === 0}
		<!--
			**Erfassen ohne Ziel** (23.08.2026, A-22). Eine Klammer hat keine
			eigenen Einheiten, also ist das Auswahlfeld unter «Einheit zuordnen»
			leer. Das Formular darüber stand trotzdem offen: Man konnte Eigentümer
			anlegen, die man nie zuordnen kann — Zeilen, die niemandem gehören und
			an keiner Abstimmung teilnehmen. Erst beim Zuordnen fiel es auf.

			Wer hier landet, sucht meist eines von zwei Dingen; beide stehen da.
		-->
		<section class="neu kachel">
			<h2>Hier wird nicht erfasst</h2>
			<p class="hilfe lesebreite">
				Diese Gemeinschaft ist die Klammer über den Häusern und führt keine eigenen
				Einheiten. Eine Eigentümerzeile hier hätte nichts, dem sie zugeordnet werden
				könnte.
			</p>
			<ul class="wohin">
				<li>
					Die Eigentümer stehen bei den Häusern — über
					<a href="/gemeinschaften/{data.gemeinschaft.id}">die Übersicht</a> erreichbar.
				</li>
				<li>
					Soll diese Gemeinschaft <em>eigene</em> Anteile führen (je einen pro Haus an
					Umgebung, Zufahrt und Tiefgarage), geben Sie ihr zuerst unter
					<a href="/gemeinschaften/{data.gemeinschaft.id}/angaben">Angaben der Gemeinschaft</a>
					einen Nenner und erfassen die Anteile als Einheiten. Dann sind ihre Eigentümer
					die Häuser.
				</li>
			</ul>
		</section>
	{:else}
	<section class="neu kachel">
		<h2><span class="ziffer" aria-hidden="true">1</span> Eigentümer erfassen</h2>
		<!--
			**Der Weg für viele auf einmal stand nur bei den Einheiten**
			(25.08.2026, Auftraggeber: «und wie kann ich den CSV oder Excel Import
			machen?»). Wer vierzehn Eigentümer erfasst, sucht ihn hier — nicht eine
			Seite weiter.
		-->
		<p class="hilfe">
			Mehrere auf einmal?
			<a href="/gemeinschaften/{data.gemeinschaft.id}/uebernahme?quelle=datei">
				Aus einer Datei übernehmen
			</a> — Excel oder CSV.
		</p>
		<!-- Kurz, weil die Langfassung im Aufklapper «wer ist was?» steht. Derselbe
		     Satz zweimal auf einer Seite kostet hier drei Zeilen Höhe. -->
		<p class="hilfe">Legt eine Zeile in <strong>dieser</strong> Gemeinschaft an.</p>
		<!--
			**Die Personenliste bei gemeinschaftlichem Eigentum** (26.08.2026,
			Aufgabe 3 des Plans).

			Vorher stand hier **ein** Namensfeld und daneben ein Textfeld
			«Vertreter, der die Stimme ausübt». Die übrigen Miteigentümer waren ein
			Stück Text im Namen — nicht erreichbar, nicht anschreibbar. Nach ZGB
			Art. 712n bekommt aber jeder von ihnen eine eigene Einladung, und eine
			unterbliebene macht den Beschluss anfechtbar.

			Das Namensfeld der Zeile entfällt deshalb: Der Name entsteht aus den
			Personen. Ein Feld, das die Anwendung ohnehin überschriebe, gehört nicht
			auf den Bildschirm.
		-->
		{#snippet beteiligte()}
			<div class="abschnitt beteiligte">
				<h3>Wer ist beteiligt?</h3>
				<p class="hilfe">
					Der Name der Zeile entsteht aus den Personen — «Anna Muster und Beat Muster».
					Jede Person bekommt ihre eigene Einladung.
				</p>
				<!--
					**Der Verweis auf den anderen Weg** (27.08.2026). Hier lässt sich nur
					eine Einheit zuordnen, die noch **keinen** Eigentümer hat. Wer den
					Heiratsfall vor sich hat, sucht die Wohnung von A in der Liste unten
					vergeblich und legte sonst eine zweite Zeile für A an. Ein Weg, den es
					gibt und den niemand findet, ist keiner.
				-->
				<p class="hilfe">
					Hält eine der Personen die Einheit heute allein? Dann steht der Weg an ihrer Zeile
					in der Tabelle: «Miteigentum eintragen». Dort wandert die Einheit mit Datum mit.
				</p>
				{#each beteiligteZeilen as z, i (z.kennung)}
					<Personenzeile
						zeile={z}
						vertreterWert={z.kennung}
						nummer={i + 1}
						entfernbar={beteiligteZeilen.length > 2}
						weg={personWeg}
						{wahlSetzen}
						vertritt={z.kennung === vertreterAnfang}
						waehlbare={waehlbareFuerZeile}
					/>
				{/each}
				<!--
					**Der sichtbare Weg, niemanden zu bezeichnen** (Produktentscheid
					27.08.2026). Ohne ihn wäre «freiwillig» nur die Abwesenheit eines
					Sterns: Wer schon geklickt hat, käme nicht mehr zurück, und ein
					Auswahlknopf lässt sich nicht abwählen.
				-->
				<label class="niemand">
					<input
						type="radio"
						name="vertreter"
						value={NIEMAND}
						{...angekreuzt(vertreterAnfang === NIEMAND)}
					/>
					<span>
						Niemand bezeichnet
						<span class="hilfe">
							Freiwillig. Ist am Abend nur eine der Personen da, darf die Sitzungsleitung sie
							als Vertretung zählen, auch ohne Vollmacht.
						</span>
					</span>
				</label>
				<AdresseFuerAlle adresse={gemeinschaftsadresse} />
				<button type="button" class="leise weitere" onclick={personDazu}>Weitere Person</button>
				<!--
					Regel 4 aus `docs/gestaltung.md`: Der Hintergrund wartet zugeklappt.
					Kein `display: flex` an der Zusammenfassung — das nähme ihr das
					Dreieck, und der Wächter `versammlung/dreieck-am-summary` weist es ab.
				-->
				<details class="erklaerung">
					<summary>Was heisst das?</summary>
					<p>
						Die Einheit gehört den Beteiligten zusammen. Sie haben zusammen
						<strong>eine</strong> Stimme, die eine von ihnen abgibt (ZGB Art. 712o Abs. 1).
					</p>
					<p>
						Eingeladen wird trotzdem jede einzeln (ZGB Art. 712n). Deshalb steht hier je
						eine Anschrift und nicht nur eine für alle.
					</p>
					<p>
						Die Personen erscheinen anschliessend als eigene Zeilen ohne Einheit. Sie
						tragen keine Kopfstimme — gezählt wird die gemeinschaftliche Zeile.
					</p>
				</details>
			</div>
		{/snippet}

		<!--
			**Abschnitte statt einer Reihe** (`docs/gestaltung.md`, «Ein
			Erfassungskasten ordnet nach Fragen, nicht nach Platz»). Bis zum
			26.08.2026 war das Formular selbst das Feldraster, und die Felder füllten
			es der Reihe nach auf — dieselbe Unruhe, die an der Kachel «Einheit
			hinzufügen» gemessen wurde. Jetzt sind es drei Fragen in der Reihenfolge,
			in der man sie beantwortet: **Was für eine Zeile ist es?** — **Wer ist
			es?** — **Welche Einheit?**

			Das war hier nicht Kosmetik, sondern nötig: Bei gemeinschaftlichem
			Eigentum steht im zweiten Abschnitt eine **Liste** von Personen. In einem
			einzigen Raster hinge deren Anordnung an der Zahl der Beteiligten.
		-->
		<form method="POST" action="?/anlegen">
			<div class="felder">
				<label>
					Art
					<!--
						`use:gefuehrteWahl` und `selected` statt `bind:value`: Die Wahl treibt
						die Felder darunter, sie muss dem Programm also bekannt sein — aber
						`bind:value` schriebe beim Aufbau den gebundenen Wert zurück und
						löschte eine Wahl, die vor der Hydration getroffen wurde. Die
						Begründung steht bei `gefuehrteWahl` in `$lib/felder`, gemessen wird
						sie in `e2e/wahl-vor-hydration.mjs`.
					-->
					<select name="kind" use:gefuehrteWahl={(w) => (personenart = w)}>
						<option value="natural" selected={personenart === 'natural'}>natürliche Person</option>
						<option value="legal" selected={personenart === 'legal'}>juristische Person</option>
						<option value="gemeinschaft" selected={personenart === 'gemeinschaft'}>
							eine andere Gemeinschaft
						</option>
					</select>
				</label>
				{#if personenart !== 'gemeinschaft'}
					<!--
						**Eine Wahl, kein Häkchen** (Auftraggeber, 27.08.2026).

						Bis hierher stand neben «Art» ein Kästchen «Gemeinschaftliches
						Eigentum». Ein Kästchen versteckt die Entscheidung: Sein Gegenteil
						hat keinen Namen, es steht nur nicht angekreuzt da. Wer die Maske
						zum ersten Mal sieht, liest ein Zusatzmerkmal und nicht die Frage,
						die es in Wahrheit ist. Beide Antworten haben jetzt einen Namen.

						**Der Oberbegriff heisst «gemeinschaftlich», nicht
						«Gesamteigentum».** Gesamteigentum ist eine einzelne Form (Eigentum
						ohne Quoten, etwa die Erbengemeinschaft); das gewöhnliche Ehepaar
						mit hälftigem Miteigentum wäre darunter falsch einsortiert. ZGB
						Art. 712o Abs. 1 selbst sagt «gemeinschaftlich» und meint damit
						beide.
					-->
					<div class="wahlen voll">
						<fieldset>
							<legend>Wem gehört die Einheit?</legend>
							<label class="wahl">
								<input
									type="radio"
									name="eigentumsform"
									value="allein"
									bind:group={eigentumsform}
								/>
								<span>
									<strong>Alleineigentum</strong>
									<span class="hilfe">Einer Person.</span>
								</span>
							</label>
							<label class="wahl">
								<input
									type="radio"
									name="eigentumsform"
									value="gemeinschaftlich"
									bind:group={eigentumsform}
								/>
								<span>
									<strong>Gemeinschaftliches Eigentum</strong>
									<span class="hilfe">
										Mehreren Personen zusammen: Miteigentum, Erbengemeinschaft, einfache
										Gesellschaft. Zusammen eine Stimme (ZGB Art. 712o Abs. 1).
									</span>
								</span>
							</label>
						</fieldset>
					</div>
					<!--
						**Warum die Form darunter nicht weiter aufgeteilt wird**
						(23.08.2026, Prüflauf II, A-33).
						Der Prüfer vermisste die Unterscheidung zwischen Mit- und
						Gesamteigentum — die CSV-Spalte `ownership_type` zählt beide auf, und
						die Maske «kann weniger als die Datei».

						Nachgesehen: Sie kann nicht weniger. Die Datei-Angabe wird beim
						Einlesen ebenfalls auf «gemeinschaftlich ja/nein» zurückgeführt und
						nirgends gespeichert; die Datenbank kennt nur `is_community`. Für die
						Versammlung ist das richtig — beide Formen üben die Stimme gemeinsam
						durch einen Vertreter aus, und für die Zählung macht der Unterschied
						nichts. Er macht ihn bei Verfügung und Haftung, und dort steht er im
						Grundbuch, nicht hier.

						Der Satz nimmt die Frage weg, statt ein Feld einzuführen, das nichts
						entscheidet.
					-->
					{#if gemeinschaftlich}
						<p class="hilfe eigentumsform voll">
							Welche Form es genau ist, wird hier nicht unterschieden: Für die Zählung macht
							es nichts. Die Stimme übt in jedem Fall die vertretende Person aus. Wer wie
							beteiligt ist, steht im Grundbuch.
						</p>
					{/if}
				{/if}
			</div>

			{#if gemeinschaftlichesEigentum}
				{@render beteiligte()}
			{:else}
			<div class="felder abschnitt">
				<!--
					Entweder oder — nicht beides (Auftraggeber, 11.08.2026). Die Wahl steht vor den
					Feldern, weil sie entscheidet, welche überhaupt gelten.
				-->
				{#if felder.personenklammer}
					<Wenfrage
						feldname={WENFRAGE_EINZELN}
						kennung={WENFRAGE_EINZELN}
						wahl={personwahl}
						hatWaehlbare={waehlbarePersonen.length > 0}
						melden={(w) => (personwahl = alsWahl(w))}
					/>
				{/if}

				{#if nimmtBestehende}
					<label class="breit voll">
						Welche Person
						<!--
							**Auswahl, kein Nachschlagen** (25.08.2026, zweite Reviewrunde).
							`data.personen` kommt bewusst vollständig (die Seite schlägt damit
							zu jeder Zeile ihre Person nach); zur **Wahl** gehört aber nur, wer
							nicht im Archiv liegt. Sonst verknüpfte man eine neue Zeile mit
							einer stillgelegten Person, und die hielte anschliessend Einheiten.
						-->
						<Suchauswahl
							name="personId"
							beschriftung="Welche Person"
							leerText="— wählen —"
							pflicht
							bind:wert={gewaehltePerson}
							eintraege={waehlbarePersonen.map((p) => ({
								wert: p.id,
								text:
									p.name +
									(p.parteien.length > 0
										? ` (${p.parteien.map((x) => x.gemeinschaft).join(', ')})`
										: '')
							}))}
						/>
						<span class="hilfe">
							Name und Anschrift kommen von dort. Steht die Person in dieser Gemeinschaft schon,
							entsteht keine zweite Zeile.
						</span>
					</label>
				{:else}
					<label class="breit">
						Name
						<input
							name="displayName"
							required
							placeholder="Renate Berger"
							oninput={(e) => (getippterName = e.currentTarget.value)}
						/>
					</label>
				{/if}

				<!--
					Story 7.1: Der Anteil einer Miteigentümerschaft gehört oft nicht einem
					Menschen, sondern einem Haus — MEG Umgebung Art. 7 Ziff. 3. Die Stimme
					übt ein bezeichneter Vertreter aus.
				-->
				{#if felder.mitgliedsgemeinschaft}
					<label class="breit">
						Welche Gemeinschaft
						<Suchauswahl
							name="memberStwegId"
							beschriftung="Welche Gemeinschaft"
							leerText="— wählen —"
							pflicht
							eintraege={data.moeglicheMitglieder.map((m) => ({ wert: m.id, text: m.name }))}
						/>
						<span class="hilfe">
							Der Anteil lautet auf diese Gemeinschaft. Ihre eigenen Eigentümer stimmen dort ab;
							hier zählt die eine Stimme, die ihr Vertreter abgibt.
						</span>
					</label>
				{/if}

				{#if felder.vertreter}
					<label class="breit voll">
						{personenart === 'gemeinschaft'
							? 'Bezeichneter Vertreter'
							: gemeinschaftlich
								? 'Vertreter, der die Stimme ausübt'
								: 'Vertretungsberechtigte Person'}
						<input name="representativeName" required />
						<span class="hilfe">
							{#if personenart === 'gemeinschaft'}
								Die beteiligten Stockwerkeigentümer haben zusammen eine Stimme, die sie durch einen
								von ihnen bezeichneten Vertreter ausüben. Wechselt er, halten Sie das unten mit
								Zeitraum fest — eine vergangene Versammlung muss weiter zeigen, wer damals stimmte.
							{:else if gemeinschaftlich}
								Mehrere Personen an einer Einheit haben zusammen eine Stimme, die ein Vertreter abgibt
								(ZGB Art. 712o Abs. 1). Ohne die Angabe wäre im Moment der Abstimmung offen, wen die
								Sitzungsleitung zählen darf.
							{:else}
								Eine juristische Person handelt nie selbst. Ohne benannte Person ist am Eingang nicht
								prüfbar, wer für sie auftreten darf.
							{/if}
						</span>
					</label>
				{/if}

				<!--
					Der Namenstreffer bleibt — er beantwortet die eine Frage, die sich sonst
					nicht beantworten lässt: Ist der Mensch hier derselbe wie dort? Er wird
					aber nicht mehr still vorausgewählt, sondern angeboten: Ein Klick
					schaltet auf den anderen Weg um. «Meier» gibt es in einer Überbauung
					dreimal — vorgeschlagen, nie gesetzt.
				-->
				{#if !nimmtBestehende && vorgeschlagen}
					<p class="treffer voll">
						<strong>{vorgeschlagen.name}</strong> ist bereits erfasst{vorgeschlagen.gemeinschaften
							.length > 0
							? ` (${vorgeschlagen.gemeinschaften.join(', ')})`
							: ''}. Dieselbe Person?
						<button
							type="button"
							class="leise"
							onclick={() => {
								personwahl = 'bestehend';
								gewaehltePerson = vorgeschlagen!.id;
								/*
								 * **Der Wert muss ins Feld, nicht nur in den Zustand**
								 * (27.08.2026, beim Umbau auf das Auswahlfeld gemessen).
								 * `selected` an der Option wirkt nur beim **Erzeugen**; ein
								 * angefasstes Auswahlfeld folgt ihm nicht mehr. Ohne diese
								 * Zeile schaltete der Knopf die Felder um, das Auswahlfeld
								 * darüber zeigte weiter «jemanden, den es hier noch nicht
								 * gibt» — und abgeschickt würde genau dieser Wert. Dieselbe
								 * Stelle löst `Suchauswahl.svelte` mit demselben Griff.
								 */
								const feld = document.getElementById(WENFRAGE_EINZELN);
								if (feld instanceof HTMLSelectElement) feld.value = 'bestehend';
							}}
						>
							Ja, diese nehmen
						</button>
						<span class="hilfe">
							Bei häufigen Namen ist es oft nicht dieselbe — dann tippen Sie einfach weiter.
						</span>
					</p>
				{/if}

				{#if !nimmtBestehende}
					<!-- Je eine Spur, nicht `.breit`: In einer halben Bahn hat das Raster zwei
					     Spuren, und ein breites Feld nimmt beide. E-Mail und Telefon
					     nebeneinander sparen eine Zeile. -->
					<label>
						E-Mail
						<input name="email" type="email" />
					</label>
					<label>
						Telefon
						<input name="phone" />
					</label>
					<!--
						**«Adresse der Gemeinschaft übernehmen»** (22.08.2026, Befund A-09).
						Bei einer Stockwerkeigentümergemeinschaft wohnen die meisten Eigentümer
						an der Liegenschaftsadresse; im Prüflauf wurde «Probehalde 14,
						9999 Nirgendheim» viermal von Hand getippt, obwohl die Anwendung sie
						kennt.

						**Ein Knopf und kein Häkchen:** Ein Häkchen «wie die Gemeinschaft»
						müsste bei jeder späteren Adressänderung mitwandern oder lügen. Der
						Knopf trägt den Wert einmal ein; danach gehört er dem Eigentümer, und
						wer wegzieht, ändert nur seine eigene Zeile.

						Nur da, wo die Gemeinschaft überhaupt eine Adresse hat.
					-->
					<label class="voll">
						Adresse
						<input name="address" bind:value={anschrift} />
						{#if gemeinschaftsadresse}
							<button type="button" class="leise uebernehmen" onclick={() => (anschrift = gemeinschaftsadresse)}>
								Adresse der Gemeinschaft übernehmen
							</button>
						{/if}
					</label>
				{/if}

			</div>
			{/if}

			<!--
				**Die Zuordnung gleich mit** (23.08.2026, Prüflauf II, A-30). Zwei
				Formulare bedeuteten zwei Absendungen je Einheit: erfassen, absenden,
				hinunterscrollen, Einheit wählen, Eigentümer wählen, absenden.
				Gemessen für Haus A achtzig plus achtzig Handgriffe, für die ganze
				Anlage 243.

				Freiwillig, weil beide Wege vorkommen: Wer aus einer Liste abtippt,
				erfasst erst alle Namen. Wer eine Einheit im Kopf hat, ist mit einem
				Formular fertig. Der Weg unten bleibt — eine Zuordnung ohne neuen
				Eigentümer braucht es weiterhin.

				**In beiden Zweigen** (Auftraggeber, 27.08.2026). Bis hierher stand das Feld
				nur bei «jemanden, den es hier noch nicht gibt»; wer eine bestehende
				Person übernahm, musste über Schritt 2 gehen. Einen Grund dafür gab es
				weder im Code noch im Kommentar, und die Ungleichheit traf ausgerechnet
				den Fall, in dem der kurze Weg am meisten wert ist.
			-->
			{#if offeneEinheiten.length > 0}
				<div class="felder abschnitt">
					<label class="breit gleich">
						Einheit gleich zuordnen <span class="hilfe">(freiwillig)</span>
						<Suchauswahl
							name="gleichEinheit"
							beschriftung="Einheit gleich zuordnen"
							leerText="— später zuordnen —"
							eintraege={offeneEinheiten.map((e) => ({ wert: e.unitId, text: e.label }))}
						/>
					</label>
					<label>
						gültig ab
						<input type="date" name="gleichAb" {...anfangswert(data.heute)} />
					</label>
				</div>
			{/if}

			<button type="submit">
				{nimmtBestehende ? 'Übernehmen' : 'Hinzufügen'}
			</button>
		</form>
	</section>

	<section class="zuordnen kachel">
		<h2><span class="ziffer" aria-hidden="true">2</span> Einheit zuordnen</h2>
		<p class="hilfe">Verbindet eine Einheit mit einem Eigentümer aus Schritt 1.</p>
		<!--
			**Erst seit `gefuehrteWahl` auf das Zurücksetzen hört** (03.09.2026).
			Am 03.09. stand dieses Formular schon einmal auf `absenden()` und wurde
			zurückgenommen: Nach dem Zuordnen blieb die Einheit in der Auswahl
			stehen, und der nächste Klick ordnete dieselbe ein zweites Mal zu.

			Die Ursache lag nicht hier, sondern eine Ebene tiefer — `form.reset()`
			löst kein `change` aus, also meldete `gefuehrteWahl` nichts, und beim
			nächsten Zeichnen schrieb Svelte die alte Wahl über `selected={…}`
			zurück. Die Begründung steht dort.
		-->
		<form method="POST" action="?/zuordnen" class="felder" id={ZUORDNUNGSMASKE} use:enhance={absenden()}>
			<!--
				**Der Eintrag sagt, was schon vergeben ist** (Auftraggeber, 27.08.2026). Weil
				`Suchauswahl` über den **sichtbaren** Text filtert, findet man die
				Wohnung damit auch über den Namen ihres Eigentümers und umgekehrt. Ein
				Mittelpunkt statt eines Gedankenstrichs (Vorgabe des Auftraggebers).
			-->
			<label class="breit">
				Einheit
				<Suchauswahl
					name="unitId"
					beschriftung="Einheit"
					leerText="— wählen —"
					pflicht
					eintraege={data.einheiten.map((e) => ({
						wert: e.id,
						text: `${e.label} · ${eigentuemerJeEinheit.get(e.id) ?? 'noch ohne Eigentümer'}`
					}))}
				/>
			</label>
			<label class="breit">
				Eigentümer
				<!--
					Archivierte stehen nicht zur Wahl: Eine archivierte Zeile hält
					keine Einheiten — das weist der Server ohnehin ab, und was er
					abweist, gehört gar nicht erst angeboten.
				-->
				<Suchauswahl
					name="partyId"
					beschriftung="Eigentümer"
					leerText="— wählen —"
					pflicht
					eintraege={data.eigentuemer
						.filter((p) => !p.archiviertAm)
						.map((p) => ({
							wert: p.id,
							/*
								**Wer zu einer Gemeinschaft gehört, steht mit ihr da**
								(Bedienbarkeitsprüfung 05.09.2026, Befund 16). Bei einem
								Ehepaar bietet diese Liste drei Einträge an: die Gemeinschaft
								«Beat und Corinne» und die beiden einzeln. Alle drei sind
								zulässig — jemand kann daneben eine eigene Einheit besitzen —,
								aber sie sahen gleich aus. Wer die einzelne Person wählte,
								zerlegte die gemeinsame Stimme, ohne dass ein Wort dazu fiel.
							*/
							text: `${p.displayName}${zugehoerigkeit(p.id)} · ${bisZwei(
								einheitenJePartei.get(p.id) ?? [],
								'noch keine Einheit'
							)}`
						}))}
				/>
			</label>
			<label class="schmal">
				Gültig ab
				<input type="date" name="ab" {...anfangswert(data.heute)} required />
			</label>
			<button type="submit">Zuordnen</button>
			<!--
				**Der Eintrag darf nicht lügen.** Er zeigt den Stand zum Stichtag der
				Seite, nicht zu dem Datum, das gleich daneben getippt wird. Wer im
				Februar rückwirkend erfasst, sähe sonst «noch ohne Eigentümer» und
				bekäme trotzdem die Rückfrage über die Vergangenheit.
			-->
			<p class="hilfe voll">
				Was neben Einheit und Eigentümer steht, ist der Stand vom {datumLang(data.stichtag)}.
				Für ein früheres «gültig ab» kann er ein anderer gewesen sein.
			</p>
		</form>
		<p class="hilfe">
			Besteht bereits eine Zuordnung, wird sie auf dieses Datum beendet statt überschrieben — der
			frühere Eigentümer bleibt für vergangene Versammlungen sichtbar. Das ist ein
			<strong>Wechsel</strong>, kein Hinzufügen: Sollen zwei Leute eine Einheit zusammen halten,
			gehört das in eine einzige Eigentümerzeile. Der Weg dazu steht oben an der Zeile des
			bisherigen Eigentümers: «Miteigentum eintragen».
		</p>
	</section>
	{/if}
	</div>
{/if}
</div>

{#if !historisch}
	<!--
		**Die Mitglieder sind Gemeinschaften — alle auf einmal** (Auftraggeber,
		25.08.2026: «Die MEG Umgebung gehört den 5 Häusern. Also müsste ich dort
		doch sagen können, dass die Häuser zur MEG Umgebung gehören»).

		Möglich war es schon, nur einzeln: je Haus ein Anteil, eine
		Eigentümerzeile und eine Zuordnung — bei fünf Häusern fünfzehn Formulare.
		Hier steht dasselbe in einem, mit Anteil und Vertretung je Haus. Erraten
		wird nichts: Der Anteil steht vorbelegt da (gleiche Teile), und wer eine
		andere Aufteilung hat, ändert die Zahl.

		**Nur, solange es noch nichts zu ändern gibt.** Sobald Mitglieder stehen,
		führt der gewöhnliche Weg darunter weiter — sonst gäbe es zwei Wege für
		dasselbe, und einer davon legte Anteile ein zweites Mal an.
	-->
	{#if mitgliedsgemeinschaften.length === 0 && data.moeglicheMitglieder.length > 0}
		<section class="neu mitglieder">
			<h2>Gehört diese Gemeinschaft anderen Gemeinschaften?</h2>
			<p class="hilfe">
				Der Fall der Miteigentümergemeinschaft, deren Mitglieder die Häuser sind — jedem Haus
				kommt eine Stimme zu, ausgeübt durch einen bezeichneten Vertreter. Für jede gewählte
				Gemeinschaft entsteht ein Anteil, eine Eigentümerzeile und die Zuordnung.
				<strong>Beim Anlegen geht das gleich mit</strong>; hier kommt später eines dazu.
			</p>
			<form method="POST" action="?/mitgliederAnlegen" class="felder" use:enhance={absenden()}>
				<div class="breit voll">
					<Wahlliste
						name="mitglied"
						mehrfach
						bind:gewaehlt={mitgliedswahl}
						suchbeschriftung="Gemeinschaft suchen"
						leerhinweis="Noch keine gewählt."
						eintraege={data.moeglicheMitglieder.map((m) => ({ id: m.id, name: m.name }))}
					/>
				</div>

				{#if mitgliedswahl.length > 0}
					<!--
						Je gewähltem Haus eine Zeile: Anteil und Vertretung. Der Vertreter ist
						Pflicht — Art. 7 Ziff. 3 verlangt ihn, und ohne ihn stünde die
						Sitzungsleitung im Moment der Abstimmung vor der Frage, wen sie
						zählen darf.
					-->
					<table class="voll mitgliedszeilen">
						<thead>
							<tr>
								<th scope="col">Gemeinschaft</th>
								<th scope="col">Anteil</th>
								<th scope="col">Vertretung</th>
							</tr>
						</thead>
						<tbody>
							{#each mitgliedswahl as id (id)}
								{@const m = data.moeglicheMitglieder.find((x) => x.id === id)}
								<tr>
									<td>{m?.name ?? id}</td>
									<td>
										<input
											type="number"
											name="quote:{id}"
											min="0"
											step="any"
											required
											aria-label="Anteil {m?.name ?? ''}"
											{...anfangswert(String(anteilVorschlag))}
										/>
									</td>
									<td>
										<input
											name="vertretung:{id}"
											maxlength="200"
											required
											aria-label="Vertretung {m?.name ?? ''}"
											{...anfangswert('')}
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
					<p class="hilfe voll">
						Vorbelegt sind gleiche Teile: {mitgliedswahl.length} von {data.gemeinschaft
							.quotaDenominator} des Nenners. Steht im Reglement etwas anderes, ändern Sie die
						Zahlen.
					</p>
				{/if}

				<label>
					Ab wann
					<input type="date" name="ab" required {...anfangswert(heute)} />
					<span class="hilfe">Seit wann die Anteile auf diese Gemeinschaften lauten.</span>
				</label>

				<div class="voll">
					<button type="submit" disabled={mitgliedswahl.length === 0}>
						Mitglieder anlegen
					</button>
				</div>
			</form>
		</section>
	{/if}

	<!--
		Story 7.2: Wer die eine Stimme einer Mitgliedsgemeinschaft abgibt.

		Ein eigener Abschnitt und kein Feld am Eigentümer, weil der Vertreter
		wechselt und der Wechsel einen Zeitpunkt hat: Wer im März wechselt, darf
		die Versammlung vom Februar nicht verändern.

		Unter der Arbeitsfläche über die volle Breite: Die Tabelle führt fünf
		Spalten und ein Datumsfeld je Zeile — in einer halben Bahn liefe sie quer.
	-->
	{#if mitgliedsgemeinschaften.length > 0}
		<section class="neu">
			<h2>Bezeichnete Vertreter</h2>
			<p class="lesebreite hilfe">
				Die Mitgliedsgemeinschaften üben ihre Stimme durch einen von ihnen bezeichneten
				Vertreter aus. Ein Wechsel wird nicht überschrieben, sondern auf ein Datum beendet —
				eine vergangene Versammlung zeigt weiter, wer damals gestimmt hat.
			</p>

			<!-- svelte-ignore a11y_no_redundant_roles -->
			<table role="table" class="vertreter karten">
				<thead>
					<tr>
						<th scope="col">Gemeinschaft</th>
						<th scope="col">Vertreter</th>
						<th scope="col">Zeitraum</th>
						<th scope="col">Grundlage</th>
						<th scope="col"><span class="nurLeser">Beenden</span></th>
					</tr>
				</thead>
				<tbody>
					{#each mitgliedsgemeinschaften as m (m.id)}
						{@const meine = data.vertretungen.filter((v) => v.parteiId === m.id)}
						{#if meine.length === 0}
							<tr>
								<td role="cell" class="kopfzelle">{m.displayName}</td>
								<td role="cell" colspan="4" class="fehlt">
									Noch niemand bezeichnet — im Saal wäre offen, wer die Stimme abgibt.
								</td>
							</tr>
						{:else}
							{#each meine as v (v.id)}
								<tr>
									<td role="cell" class="kopfzelle">{v === meine[0] ? m.displayName : ''}</td>
									<td role="cell" data-spalte="Vertreter">{v.personName}</td>
									<td role="cell" data-spalte="Zeitraum" class="zeitraum">
										{datumLang(v.ab)} {v.bis ? `bis ${datumLang(v.bis)}` : '— bis auf Weiteres'}
									</td>
									<td role="cell" data-spalte="Grundlage">{v.grundlage ?? '—'}</td>
									<td>
										{#if !v.bis}
											<form method="POST" action="?/vertretungBeenden" class="beenden">
												<input type="hidden" name="id" value={v.id} />
												<input type="date" name="bis" required {...anfangswert(data.heute)} />
												<button type="submit" class="leise">Beenden</button>
											</form>
										{/if}
									</td>
								</tr>
							{/each}
						{/if}
					{/each}
				</tbody>
			</table>

			<h3>Vertreter bezeichnen</h3>
			<form method="POST" action="?/vertreterBezeichnen" class="felder">
				<label class="breit">
					Gemeinschaft
					<Suchauswahl
						name="parteiId"
						beschriftung="Gemeinschaft"
						leerText="— wählen —"
						pflicht
						eintraege={mitgliedsgemeinschaften.map((m) => ({
							wert: m.id,
							text: m.displayName
						}))}
					/>
				</label>
				<label class="breit">
					Vertreter
					<input name="personName" required minlength="2" placeholder="Anna Muster" />
				</label>
				<label>
					Ab
					<input type="date" name="ab" required {...anfangswert(data.heute)} />
				</label>
				<label class="breit">
					Grundlage im Reglement
					<input name="grundlage" placeholder="z. B. Art. 7 Ziff. 3" maxlength="200" />
					<span class="hilfe">
						Wer den Beschluss anficht, greift zuerst die Vertretungsmacht an.
					</span>
				</label>
				<button type="submit">Bezeichnen</button>
			</form>
		</section>
	{/if}
{/if}

<!-- ── Eigentum im Zeitverlauf (Auftraggeber, 01.09.2026) ──────────────────────────── -->
<!--
	**Der Gedanke war «eine Historie wer von wann bis wann Eigentümer war».**
	Die Tabelle dafür gibt es seit Migration 006 — was fehlte, war die Sicht: Der
	Verlauf erschien in keiner einzigen Ansicht, sondern nur in der Rückfrage,
	also erst dann, wenn man ihn gerade beschädigen wollte.

	**Zugeklappt und ganz unten.** Die Seite beantwortet die häufige Frage
	(«wem gehört was heute») ganz oben; dies ist die seltenere. Zugeklappt heisst
	nicht versteckt: Die Zusammenfassung nennt die Zahl der Zeilen, damit man
	sieht, dass es etwas zu sehen gibt.

	**Nach Einheit gegliedert.** An ihr ist die Reihe lückenlos — eine Einheit
	hat zu jedem Zeitpunkt genau einen Eigentümer, dafür sorgt eine Schranke der
	Datenbank. Von der Partei aus gesehen wäre es ein Ausschnitt.
-->
{#if data.verlauf.length > 0}
	<details class="verlauf">
		<summary>
			Eigentum im Zeitverlauf ({data.verlauf.length}
			{data.verlauf.length === 1 ? 'Eintrag' : 'Einträge'})
		</summary>
		<p class="hilfe">
			Alle Zuordnungen dieser Gemeinschaft, unabhängig vom gewählten Stichtag. «bis auf
			Weiteres» heisst: Diese Zuordnung gilt heute.
		</p>
		<div class="tabellenrahmen">
			<table class="voll">
				<thead>
					<tr>
						<th scope="col">Einheit</th>
						<th scope="col">Eigentümer</th>
						<th scope="col">von</th>
						<th scope="col">bis</th>
					</tr>
				</thead>
				<tbody>
					{#each data.verlauf as z, i (z.unitId + z.partyId + z.von)}
						{@const ersteDerEinheit = i === 0 || data.verlauf[i - 1].unitId !== z.unitId}
						<tr class:einheitsanfang={ersteDerEinheit}>
							<!--
								Die Einheit steht nur an ihrer ersten Zeile. Bei acht Wechseln
								stünde sie sonst achtmal untereinander, und die Kette, um die es
								geht, verschwände zwischen den Wiederholungen.
							-->
							<td>{ersteDerEinheit ? z.einheit : ''}</td>
							<td>{z.eigentuemer}</td>
							<td>{datumLang(z.von)}</td>
							<td>{z.bis ? datumLang(z.bis) : 'auf Weiteres'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>
{/if}

<style>

	.eigentumsform {
		flex-basis: 100%;
		margin: 0.2rem 0 0;
	}

	/*
		**Ein Abschnitt je Frage, getrennt durch eine Haarlinie**
		(`docs/gestaltung.md`, «Ein Erfassungskasten ordnet nach Fragen, nicht nach
		Platz»). Ohne Trennung stünden Art, Person und Einheit in einem Fluss, und
		der Kasten sähe wieder aufgereiht aus; Zwischenüberschriften über allen
		dreien wären lauter, als er sein muss.
	*/
	.abschnitt {
		border-top: 1px solid var(--linie);
		margin-top: 1.25rem;
		padding-top: 1.1rem;
	}

	.beteiligte h3 {
		font-size: 0.95rem;
		margin: 0 0 0.35rem;
	}

	.beteiligte > .hilfe {
		margin: 0 0 0.9rem;
		max-width: var(--lesebreite);
		font-size: 0.875rem;
		font-weight: 400;
		color: var(--text-leise);
	}

	/* Kasten und Kopfzeile einer Person stehen in `Personenzeile.svelte`. */

	.weitere {
		margin-top: 0.75rem;
	}

	/*
		«Niemand bezeichnet» gehört zur Liste darüber, steht aber ausserhalb der
		Personenkästen. `.kasten` aus `app.css` greift hier nicht: Die Regel ist
		auf ein **direktes** Kind eines `.felder`-Rasters festgeschrieben.
	*/
	.niemand {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		margin-top: 0.75rem;
		min-height: var(--ziel-min);
		font-size: 0.9rem;
	}

	.niemand > span {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.niemand .hilfe {
		max-width: var(--lesebreite);
	}

	/*
		Regel 4: Der Hintergrund wartet zugeklappt. Kein `display: flex` am
		`summary` — das nähme ihm das Dreieck (Stylelint-Regel `versammlung/dreieck-am-summary`).
	*/
	.erklaerung {
		margin-top: 0.9rem;
		max-width: var(--lesebreite);
	}

	.erklaerung summary {
		cursor: pointer;
		color: var(--text-leise);
		font-size: 0.9rem;
		min-height: var(--ziel-min);
		padding: 0.7rem 0;
	}

	.erklaerung p {
		color: var(--text-leise);
		font-size: 0.9rem;
		font-weight: 400;
		margin: 0 0 0.4rem;
	}


	/* Die zwei Auswege einer Klammer — Fliesstext, keine Kacheln: Es sind
	   Erklärungen, keine Handlungen. */
	.wohin {
		margin: 0.6rem 0 0;
		padding-left: 1.1rem;
		color: var(--text-leise);
		font-size: 0.95rem;
	}

	.wohin li + li {
		margin-top: 0.45rem;
	}

	/*
	 * Kein eigener Aussenabstand mehr: Den Abstand zwischen den Blöcken setzt
	 * jetzt die Spalte (`.arbeitsflaeche > .spalte`, `gap`). Ein `margin` daneben
	 * ergäbe zwei Abstände übereinander und liesse die beiden Spalten auf
	 * verschiedener Höhe beginnen.
	 */
	.vorschlaege {
		border: 1px solid var(--linie);
		border-left: 3px solid var(--warnung);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 1rem 1.15rem;
		margin: 0;
	}

	.vorschlaege h2 {
		margin: 0 0 0.35rem;
		font-size: 1.05rem;
	}

	.vorschlag {
		display: flex;
		gap: 1rem;
		align-items: start;
		justify-content: space-between;
		flex-wrap: wrap;
		border-top: 1px solid var(--linie);
		padding: 0.6rem 0 0;
		margin-top: 0.6rem;
	}

	/*
	 * Der Namenstreffer beim Erfassen: ein Angebot, keine Warnung — aber sichtbar,
	 * weil eine falsche Klammer am Versammlungstag jemandem Zutritt gäbe.
	 */
	.treffer {
		color: var(--warnung);
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin: 0;
	}

	.treffer .hilfe {
		flex-basis: 100%;
	}

	/*
	 * Wie in `Karte.svelte`: Akzentfarbe und das Dreieck des Browsers. Kein
	 * `display: flex` am `summary` — das nimmt ihm den Marker, und dann sieht man
	 * dem Satz nicht an, dass er sich öffnen lässt.
	 */
	.begriffe {
		margin: 0 0 1.25rem;
		max-width: var(--lesebreite);
		font-size: 0.9rem;
	}

	.begriffe summary {
		cursor: pointer;
		color: var(--akzent);
		min-height: var(--ziel-min);
		padding: 0.7rem 0;
	}

	.begriffe dl {
		margin: 0;
	}

	.begriffe dt {
		font-weight: 550;
		margin-top: 0.6rem;
	}

	.begriffe dd,
	.begriffe p {
		margin: 0.15rem 0 0;
		color: var(--text-leise);
	}

	.begriffe p {
		margin-top: 0.8rem;
	}

	button.leise {
		background: none;
		color: var(--text-leise);
		border: 1px solid var(--linie);
		font-weight: 400;
		padding: 0 0.9rem;
	}

	.vertreter {
		width: 100%;
		border-collapse: collapse;
		margin: 0.5rem 0 1.5rem;
		font-size: 0.95rem;
	}

	.vertreter th {
		text-align: left;
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		color: var(--text-leise);
		padding: 0.35rem 0.5rem;
		border-bottom: 1px solid var(--linie);
	}

	.vertreter td {
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid var(--linie);
		vertical-align: top;
	}

	.zeitraum {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	/* Keine Farbe allein: Der Satz sagt dasselbe. */
	.fehlt {
		color: var(--warnung);
	}

	.beenden {
		display: flex;
		gap: 0.35rem;
		align-items: center;
	}

	/* Sichtbar nur für Vorlesehilfen — eine Spalte ohne Titel ist keine Spalte. */
	.nurLeser {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}


	.meldung {
		padding: 0.6rem 0.75rem;
		border-radius: var(--radius);
	}

	.meldung.gut {
		background: color-mix(in srgb, var(--akzent) 15%, transparent);
	}


	.meldung.warnung {
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
	}

	.stichtag {
		display: flex;
		align-items: flex-end;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin: 1.25rem 0;
	}

	.stichtag .hinweis {
		color: var(--warnung);
		font-size: 0.9rem;
		align-self: center;
	}

	/* Der Abstand kommt von der Spalte, nicht vom Block — siehe `.vorschlaege`. */
	/*
		Wie die Überschriften der Kacheln rechts — sonst tritt der Bestand mit der
		Browservorgabe von 1.5em lauter auf als «1 Eigentümer erfassen» daneben.
	*/
	.spaltentitel {
		margin: 0 0 0.75rem;
		font-size: 1rem;
	}

	.kopfzeile {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		margin: 0;
	}

	.kennzahl {
		flex: 1 1 10rem;
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
	}

	.wert {
		font-size: 1.75rem;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
	}

	.marke {
		display: flex;
		flex-direction: column;
	}

	.hilfe {
		display: block;
		font-size: 0.875rem;
		color: var(--text-leise);
		font-weight: 400;
	}

	.tabellenrahmen {
		overflow-x: auto;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		text-align: left;
		padding: 0.55rem 0.75rem;
		border-bottom: 1px solid var(--linie);
		vertical-align: top;
	}

	th {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--text-leise);
		white-space: nowrap;
	}

	tfoot td {
		border-bottom: none;
		border-top: 2px solid var(--linie);
		font-weight: 600;
	}

	/*
	 * **Die Summenzeile als eigene Karte** (UI-Durchgang 06.10.2026, bei
	 * 390 px gemessen). `table.karten` setzt in app.css `tbody`, die Zeilen und
	 * die Zellen auf Block, nicht aber `tfoot` selbst; der Fuss blieb eine Tabellengruppe von 107 px Breite
	 * und stand ohne Rahmen am Seitenrand. Hier und nicht in app.css, weil es
	 * die einzige Kartentabelle mit Fuss ist.
	 */
	@media (max-width: 46rem) {
		table.karten tfoot,
		table.karten tfoot tr {
			display: block;
		}

		table.karten tfoot tr {
			border: 1px solid var(--linie);
			border-top-width: 2px;
			border-radius: var(--radius);
			padding: 0.6rem 0.8rem;
		}

		table.karten tfoot td {
			border-top: 0;
		}
	}

	/*
	 * Was unter der Arbeitsfläche steht, braucht Abstand zu ihr: Die
	 * Überschrift «Gehört diese Gemeinschaft anderen Gemeinschaften?» stand
	 * 0 px unter der Tabelle (UI-Durchgang 06.10.2026).
	 */
	section.neu:not(.kachel) {
		margin-top: 2rem;
	}

	/* Der Absendeknopf unter dem letzten Feldblock, nicht an ihm: Ohne offene
	   Einheiten stand «Hinzufügen» 0 px unter dem Feld «Adresse». */
	form[action='?/anlegen'] > button {
		margin-top: 1.25rem;
	}

	/*
	 * Die Feldgruppe «Wem gehört die Einheit?» stand im Browserstandard
	 * (eckig, grau gefurcht), ihre Legende in 400. Dieselbe Form wie «Was legen
	 * Sie an?» in `GemeinschaftFormular.svelte`. `min-width: 0`, weil ein
	 * `fieldset` sonst nicht schmaler wird als sein Inhalt.
	 */
	.wahlen fieldset {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.85rem 1rem;
		margin: 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.wahlen legend {
		font-weight: 550;
		padding: 0 0.35rem;
	}

	tr.ohne td {
		color: var(--text-leise);
	}

	.zahl {
		text-align: right;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.zusatz {
		display: block;
		font-size: 0.875rem;
		color: var(--text-leise);
	}

	.einheiten {
		font-size: 0.9rem;
	}

	/*
		**Der eine Einstieg je Zeile** (27.08.2026). Er steht als Verweis und nicht
		als Knopf: Er führt woandershin, er tut nichts — «Ein Wort für den Weg,
		eines für die Sache» (`docs/gestaltung.md`). Die Tippfläche ist trotzdem
		gross genug, weil die Tabelle auf dem Telefon zu Karten wird.
	*/
	.bearbeiten {
		display: block;
		width: fit-content;
		margin-top: 0.35rem;
		min-height: var(--ziel-min);
		padding: 0.7rem 0;
		font-size: 0.9rem;
	}

	/*
	 * **Die Mitberechtigten unter ihrer Hülle.** Eingerückt mit einer Haarlinie
	 * an der linken Kante: Sie sagt, dass die Zeilen zur Hülle darüber gehören,
	 * ohne dafür eine eigene Tabellenzeile zu brauchen. Ein Aufzählungspunkt
	 * stünde für eine Liste gleichrangiger Dinge — hier sind sie untergeordnet.
	 */
	.mitberechtigte {
		margin: 0.35rem 0 0;
		padding: 0 0 0 0.7rem;
		list-style: none;
		border-left: 2px solid var(--linie);
		font-size: 0.875rem;
	}

	.mitberechtigte li {
		padding: 0.1rem 0;
	}

	.mitberechtigte .hilfe {
		display: inline;
		margin-left: 0.35rem;
	}

	/*
	 * **Die zwei Marken sind Tatsachen, keine Handlungen** — deshalb ruhig und
	 * ohne Farbe, die nach Warnung aussieht. `--ziel-min` gilt hier nicht: Es
	 * ist nichts zum Antippen.
	 */
	.mitmarke {
		display: inline-block;
		margin-left: 0.35rem;
		padding: 0.05rem 0.4rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		font-size: 0.75rem;
		color: var(--text-leise);
		white-space: nowrap;
	}

	/*
	 * **`:global(…)` für die Felder, die in `Suchauswahl.svelte` stehen.** Svelte
	 * gestaltet nur Elemente aus dieser Datei; ohne diese Zeilen fielen die
	 * umgestellten Auswahlfelder auf das Hausmass aus `app.css` zurück und sähen
	 * anders aus als die Textfelder daneben. Die rohe `select`-Zeile darüber
	 * bleibt: Auf beiden Seiten stehen noch kurze feste Aufzählungen.
	 */
	input:not([type='checkbox']),
	select,
	.felder :global(select),
	.felder :global(.auswahlsuche) {
		min-height: var(--ziel-min);
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--grund);
		color: var(--text);
		font: inherit;
		font-weight: 400;
	}

	input[type='checkbox'] {
		width: 1.1rem;
		height: 1.1rem;
	}

	.verlauf {
		margin: 2rem 0 1rem;
		max-width: 46rem;
	}

	/* Eine Linie je Einheit: Sie trennt die Ketten, ohne eine Spalte zu kosten. */
	.verlauf tr.einheitsanfang td {
		border-top: 1px solid var(--linie);
	}

	.verlauf td:first-child {
		font-weight: 550;
	}

	button {
		min-height: var(--ziel-min);
		padding: 0 1.25rem;
		border: none;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font: inherit;
		font-weight: 550;
		cursor: pointer;
		flex: none;
	}

	/* In der Karte richtet die rechte Kante nicht aus, sie trennt. */
	@media (max-width: 46rem) {
		td.zahl {
			text-align: left;
		}

		/* Die Zeile ohne Vertreter trägt keine Beschriftung — der Satz steht für
		   sich und ist keine Angabe zu einer Spalte. */
		td.fehlt::before {
			content: none;
		}
	}
	/*
		**Der Weg zur Datei gehört nach oben** (Auftraggeber, 26.08.2026: «ich finde den
		Import für den CSV nicht. Wo finde ich den? und wenn ich die Frage stellen
		muss, ist der Zugang nicht intuitiv»). Er stand nur als graue Hilfezeile
		mitten im Erfassungsformular — bei einer vollen Tabelle darüber also
		unterhalb des Bildrands. Dieselbe Form wie auf der Gemeinschafts- und der
		Eigentümerliste: Überschrift links, Handlung rechts.
	*/
	.kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.kopf .knopf {
		min-height: var(--ziel-min);
		display: inline-flex;
		align-items: center;
		padding: 0 1.1rem;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font-weight: 550;
		text-decoration: none;
	}
</style>
