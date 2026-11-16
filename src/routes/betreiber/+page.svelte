<script lang="ts">
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import { anfangswert, angekreuzt } from '$lib/felder';
	import Meldung from '$lib/components/Meldung.svelte';
	import Sortierkopf from '$lib/components/Sortierkopf.svelte';
	import { begrenzt, filtereNach, punktdatum } from '$lib/domain/listensuche';
	import { datumKurz, datumLang, tagVon } from '$lib/domain/datum';
	import { naechsteSortierung, sortiere, type Sortierung } from '$lib/domain/tabellensortierung';
	/**
	 * Die Seite der Bewirtschaftung.
	 *
	 * **Kacheln statt Stapel** (Punkt 6 vom 10.08.2026): Vier Kästen à 42rem
	 * standen untereinander und liessen auf einem breiten Bildschirm 900 Pixel
	 * leer; die Seite war vier Bildschirme lang, obwohl drei der vier Kästen aus
	 * je drei Zeilen bestehen.
	 *
	 * **Und Inhalt statt nur Formularen:** Oben stehen jetzt die vier Zahlen, die
	 * man hier tatsächlich sucht — was sich schon löschen liesse, wie viele Pakete
	 * das betrifft, wo noch Betriebsdaten hängen, ob ein Briefkopf hinterlegt
	 * ist. Vorher musste man dafür bis ans Seitenende scrollen und zwei Tabellen
	 * abzählen.
	 */
	let { data, form } = $props();

	/**
	 * Die eben abgewiesene Eingabe je Formular — `null`, wenn nichts abgewiesen
	 * wurde (01.09.2026, aus dem Code-Review).
	 *
	 * **Über `in` statt über `form.werte?.x`**: `ActionData` ist die Vereinigung
	 * aller Aktionen dieser Seite, und `werte` trägt je Aktion eine andere Form.
	 * Der Vergleich auf `quelle` allein grenzt sie dem Typprüfer nicht ein —
	 * solange nur **eine** Aktion `werte` zurückgab, fiel das nicht auf, und die
	 * zweite machte die bestehende Zeile rot.
	 */
	const abgewiesenerName = $derived(
		form?.quelle === 'bezeichnung' && form.werte && 'name' in form.werte ? form.werte.name : null
	);

	const abgewieseneAdresse = $derived(
		form?.quelle === 'erinnerungsadresse' && form.werte && 'erinnerungsadresse' in form.werte
			? form.werte.erinnerungsadresse
			: null
	);

	/*
	 * **Die beiden Tabellen bekommen Suche und Sortierung** (Auftraggeber, 25.08.2026:
	 * «Es fehlen bei Betriebsdaten geschlossener Versammlungen und Versiegelte
	 * Pakete jeweils die Suchfunktion»). Hausregel aus `docs/gestaltung.md`:
	 * Jede Tabelle mit mehr als einer Handvoll Zeilen bekommt beides — gesucht
	 * über `filtereNach`, sortiert über `Sortierkopf`.
	 */
	let suchePakete = $state('');
	let sucheBetriebsdaten = $state('');
	let sortPakete = $state<Sortierung | null>(null);
	let sortBetriebsdaten = $state<Sortierung | null>(null);

	type Paket = (typeof data.aufbewahrung.pakete)[number];
	type Offen = (typeof data.aufbewahrung.offen)[number];

	/*
		**Das Datum steht dreimal im Suchtext** — so wie `suchtextVersammlung` in
		`domain/versammlungsliste.ts`, und aus demselben Grund: Getippt wird
		«05.01.2026» aus dem Kalender, «2026-01-05» aus einer Datei und
		«5. Januar 2026» aus der Einladung. Die erste Fassung baute den Schlüssel
		aus `toLocaleDateString('de-CH')` und lieferte damit «5.1.2026» — eine
		Schreibweise, die die Anwendung nirgends anzeigt. Wer «05.01.2026» tippte,
		bekam null Treffer auf genau der Funktion, die das Suchfeld verspricht
		(26.08.2026, aus dem Code-Review; nachgemessen).
	*/
	/*
		**Vor der Genehmigung gibt es kein «löschbar ab»** (Migration 115). Das
		Datum aus dem Versandtag wäre sonst eine Zusage, die der Löschweg nicht
		hält: Bis die nächste Versammlung das Protokoll genehmigt hat, lässt es
		sich berichtigen.
	*/
	function loeschbarAbPaket(p: Paket): string | null {
		return p.genehmigung === 'genehmigt' ? p.loeschbarAb : null;
	}

	function suchtextPaket(p: Paket): string {
		const ab = loeschbarAbPaket(p);
		const tage = [p.datum, tagVon(p.versiegeltAm), ...(ab ? [ab] : [])];
		return [
			p.bezeichnung,
			p.ort,
			p.sitzungsleitung ?? '',
			p.versiegeltDurch ?? '',
			...tage,
			...tage.map(punktdatum),
			...tage.map(datumLang)
		].join(' ');
	}

	/*
		Benannt und mit `null` als Rückfall — die Hausform (`personen`,
		`einheiten`, `eigentuemer`). Eine Kette mit `x.bis` am Schluss sortiert
		jede unbekannte Spaltenkennung still nach «Aufzubewahren bis», mitsamt
		richtig gezeichnetem Pfeil; `null` schiebt sie über `istLeer` nach hinten,
		statt eine falsche Ordnung zu behaupten.
	*/
	function wertVonPaket(p: Paket, spalte: string): unknown {
		if (spalte === 'gemeinschaft') return p.bezeichnung;
		if (spalte === 'datum') return p.datum;
		if (spalte === 'ort') return p.ort;
		if (spalte === 'leitung') return p.sitzungsleitung;
		if (spalte === 'versiegelt') return p.versiegeltAm;
		if (spalte === 'durch') return p.versiegeltDurch;
		if (spalte === 'loeschbar') return loeschbarAbPaket(p);
		return null;
	}

	/*
	 * **Beide Archive werden gekürzt** (03.09.2026). Die Seite war 10841 px hoch,
	 * davon 8504 px diese zwei Tabellen mit zusammen 180 Zeilen; die
	 * Einstellungen, wegen derer man herkommt, machten 1789 px aus. Und beide
	 * wachsen mit jeder Versammlung weiter.
	 *
	 * `begrenzt()` und keine eigene Kürzung: Die Funktion gibt es seit dem
	 * Prüflauf II für genau diese Frage, sie steht auf der Startseite, den
	 * Personen und den Gemeinschaften, und sie trägt die Regel, auf die es
	 * ankommt — **gekürzt wird nur, solange niemand sucht.** Wer sucht, hat
	 * schon eingegrenzt; ihm die Treffer zu beschneiden wäre die zweite Hürde
	 * nach der ersten. Eine eigene Schwelle daneben hiesse ausserdem, dass
	 * dieselbe Frage im Haus zwei Antworten hat.
	 */
	let allePakete = $state(false);
	let alleBetriebsdaten = $state(false);

	const pakete = $derived(
		sortiere(
			filtereNach(data.aufbewahrung.pakete, suchePakete, suchtextPaket),
			sortPakete,
			wertVonPaket
		)
	);

	const offen = $derived(
		sortiere(
			filtereNach(
				data.aufbewahrung.offen,
				sucheBetriebsdaten,
				(x: Offen) => `${x.bezeichnung} ${datum(x.datum)}`
			),
			sortBetriebsdaten,
			(x: Offen, spalte: string) =>
				spalte === 'versammlung'
					? x.bezeichnung
					: spalte === 'zugaenge'
						? x.zugaenge
						: spalte === 'sitzungen'
							? x.sitzungen
							: x.saalmeldungen
		)
	);

	const paketeSichtbar = $derived(begrenzt(pakete, suchePakete, allePakete));
	const offenSichtbar = $derived(begrenzt(offen, sucheBetriebsdaten, alleBetriebsdaten));

	function sortierePakete(spalte: string) {
		sortPakete = naechsteSortierung(sortPakete, spalte);
	}
	function sortiereBetriebsdaten(spalte: string) {
		sortBetriebsdaten = naechsteSortierung(sortBetriebsdaten, spalte);
	}

	/** «11.09.2026» — einmal geschrieben, viermal gebraucht, in Schweizer Zeit. */
	const datum = datumKurz;

	/*
	 * **Wie viele Pakete sich schon löschen liessen** (17.09.2026). Ersetzt die
	 * Kachel mit der Jahresfrist, die es nicht mehr gibt. Gezählt wird nach dem
	 * Versandtag des Protokolls; ohne festgehaltenen Versand oder ohne
	 * Genehmigung weiss die Seite es nicht und zählt das Paket nicht mit.
	 */
	const loeschbar = $derived(
		data.aufbewahrung.pakete.filter((p: Paket) => {
			const ab = loeschbarAbPaket(p);
			return ab !== null && ab <= data.aufbewahrung.heute;
		}).length
	);

	const offeneBetriebsdaten = $derived(
		data.aufbewahrung.offen.reduce(
			(summe: number, o: { zugaenge: number; sitzungen: number; saalmeldungen: number }) =>
				summe + o.zugaenge + o.sitzungen + o.saalmeldungen,
			0
		)
	);
</script>

<!--
	**Diese Seite bleibt beim Stapelmodell aussen vor** (Auftraggeber, 03.09.2026, nach
	dem Kürzen der Archive).

	**Der Grund:** Die beiden Archive sind kein Bestand, den diese Seite
	verwaltet, sondern ein Nachschlagewerk. Wer herkommt, will eine Einstellung
	ändern.

	**Ohne die Ausnahmemarke des Wächters, und das ist Absicht.** Sie
	entschuldigt das zweispaltige Nebeneinander (`.arbeitsflaeche`); diese Seite
	hat keines, sie ist einspaltig und folgt bloss der Abschnittsreihenfolge
	nicht. Eine Marke ohne Fläche wäre eine Behauptung über einen Zustand, den es
	hier nie gab, und der Wächter weist sie zu Recht ab. Er zählt die Seite
	deshalb als nicht umgestellt, was stimmt.

	Das Modell verlangt Bestand vor Handeln. Hier hiesse das, gut einen
	Bildschirm Archiv vor die Einstellungen zu schieben, wegen derer man die
	Seite öffnet: versiegelte Pakete und geschlossene Versammlungen entstehen
	anderswo, sie werden hier nur nachgeschlagen und aufgeräumt.

	**Die Frage stellte sich erst nach dem Kürzen.** Davor waren die Archive
	8504 der 10841 px, und ein Umbau auf den Stapel hätte acht Bildschirme vor
	die Einstellungen gestellt. Erst mit 1494 px war die Reihenfolge überhaupt
	verhandelbar, und dann fiel die Entscheidung gegen sie.

	Der Plan lässt das ausdrücklich offen: «Ob alle 61 Seiten umgestellt werden.
	Vermutlich nicht.»
-->
<h1>{data.betreiber.name}</h1>
<p class="einleitung">Einstellungen der Bewirtschaftung.</p>

<div class="zahlen">
	<div class="zahl-kachel">
		<span class="wert">{loeschbar}</span>
		<span class="was">{loeschbar === 1 ? 'Paket löschbar' : 'Pakete löschbar'}</span>
	</div>
	<div class="zahl-kachel">
		<span class="wert">{data.aufbewahrung.pakete.length}</span>
		<span class="was">
			{data.aufbewahrung.pakete.length === 1 ? 'versiegeltes Paket' : 'versiegelte Pakete'}
		</span>
	</div>
	<div class="zahl-kachel" class:aufgabe={offeneBetriebsdaten > 0}>
		<span class="wert">{offeneBetriebsdaten}</span>
		<span class="was">
			Betriebsdaten zu löschen
			{#if data.aufbewahrung.offen.length > 0}
				<span class="hilfe">
					in {data.aufbewahrung.offen.length}
					{data.aufbewahrung.offen.length === 1 ? 'Versammlung' : 'Versammlungen'}
				</span>
			{/if}
		</span>
	</div>
	<div class="zahl-kachel">
		<span class="wert">{data.betreiber.briefkopfPruefsumme ? 'ja' : 'nein'}</span>
		<span class="was">Briefkopf hinterlegt</span>
	</div>
</div>

<!--
	**Nur, was keine eigene Stelle hat** (25.08.2026). Die Umbenennung und das
	Löschen der Betriebsdaten zeigen ihre Absage dort, wo geklickt wurde;
	stünde sie hier zusätzlich, läse man denselben Satz zweimal.
	Hausregel: «Eine Fehlermeldung erscheint an genau einer Stelle.»
-->
{#if data.geloescht}
	<p class="meldung gut" role="status">{data.geloescht}</p>
{/if}

{#if form?.fehler && !form?.quelle}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.gespeichert}
	<Meldung ton="gut" marke={form}>Briefkopfvorlage hinterlegt.</Meldung>
{:else if form?.entfernt}
	<Meldung ton="gut" marke={form}>Briefkopfvorlage entfernt.</Meldung>
{:else if form?.hinweis}
	<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
{/if}

<!--
	Die Einstellungen als Kacheln: vier kurze Kästen, die nebeneinander passen.
	Die beiden Tabellen stehen darunter über die ganze Breite — sie tragen je
	vier Spalten und würden in einer Kachel umbrechen, bis nichts mehr lesbar
	ist.
-->
<h2 class="gruppe">Ihre Firma</h2>

<div class="kacheln">
	<section class="kasten">
		<h3>Name</h3>
		{#if form?.quelle === 'bezeichnung' && form?.fehler}
			<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
		{/if}
		<p class="hilfe">
			Steht als Absender auf der Einladung. Schon verschickte Einladungen behalten den alten
			Namen.
		</p>
		<form method="POST" action="?/bezeichnung" class="formular">
			<label class="namensfeld">
				Name Ihrer Firma
				<input
					name="name"
					required
					minlength="2"
					maxlength="120"
					{...anfangswert(abgewiesenerName ?? data.betreiber.name)}
				/>
			</label>
			<p><button type="submit">Namen speichern</button></p>
		</form>
	</section>

	<section class="kasten">
		<h3>Briefkopfvorlage</h3>
		<p class="hilfe">
			Ein einseitiges PDF mit Ihrem Briefkopf. Es wird unter die erzeugten Dokumente gelegt, nicht
			mit ihnen verschmolzen — eine später ausgetauschte Vorlage verändert damit kein bereits
			erzeugtes PDF.
		</p>

		{#if data.betreiber.briefkopfPruefsumme}
			<p>
				Hinterlegt:
				<a href="/anhang/{data.betreiber.briefkopfPruefsumme}" target="_blank" rel="noopener">
					Vorlage ansehen
				</a>
				· oben freigehalten: {data.betreiber.briefkopfHoeheMm} mm ·
				{data.betreiber.briefkopfAlleSeiten ? 'auf allen Seiten' : 'nur auf der ersten Seite'}
			</p>
			<form method="POST" action="?/entfernen">
				<button type="submit" class="leise">Vorlage entfernen</button>
			</form>
		{:else}
			<p class="hilfe">Keine Vorlage hinterlegt — die Dokumente entstehen ohne Briefkopf.</p>
		{/if}

		<form method="POST" action="?/briefkopf" enctype="multipart/form-data" class="formular">
			<label>
				Vorlage als PDF
				<input type="file" name="datei" accept=".pdf" required />
				<span class="hilfe">
					Ein Bild kennt die Seitenränder nicht und sässe falsch — deshalb nur PDF.
				</span>
			</label>

			<label class="schmal">
				Oben freihalten
				<input
					type="number"
					name="hoeheMm"
					min="10"
					max="150"
					{...anfangswert(data.betreiber.briefkopfHoeheMm)}
					required
				/>
				<span class="hilfe">Millimeter, damit der Inhalt den Briefkopf nicht überschreibt.</span>
			</label>

			<label class="kaestchen">
				<input
					type="checkbox"
					name="alleSeiten"
					value="true"
					{...angekreuzt(data.betreiber.briefkopfAlleSeiten)}
				/>
				Auf allen Seiten, nicht nur auf der ersten
			</label>

			<button type="submit">Hinterlegen</button>
		</form>
	</section>

	<section class="kasten">
		<!--
			**Eine Anzeigeeinstellung, keine Schranke** (Nachtrag zu FR-62).
			Die KI-Abschnitte stehen an vier Stellen. Ist die KI nicht zugelassen,
			zeigen sie einen grauen Kasten mit dem Grund — beim ersten Mal eine
			Auskunft, ab dem zehnten Mal Gerümpel.
		-->
		<h3>KI im Protokoll und in der Oberfläche</h3>
		<form method="POST" action="?/kihinweise" class="formular">
			<label class="schalter">
				<input
					type="checkbox"
					name="ausblenden"
					value="true"
					{...angekreuzt(data.betreiber.kiHinweiseAusblenden)}
				/>
				<span>
					Hinweise auf nicht verfügbare KI-Funktionen ausblenden
					<span class="hilfe">
						Betrifft nur die Hinweise in der Oberfläche. <strong>Was zugelassen ist, bleibt
						sichtbar und benutzbar</strong> — ein Anzeigeschalter darf keine Funktion
						verstecken, die läuft. Zugelassen wird die KI je Gemeinschaft unter «Angaben».
					</span>
				</span>
			</label>

			<!--
				**Der Vermerk steht in einem Dokument, das an alle Eigentümer geht.**
				Über den Inhalt des eigenen Protokolls entscheidet die Sitzungsleitung
				und nicht das Werkzeug — dasselbe Verhältnis wie überall sonst.
			-->
			<label class="schalter">
				<input
					type="checkbox"
					name="vermerk"
					value="true"
					{...angekreuzt(data.betreiber.maschinenvermerkImProtokoll)}
				/>
				<span>
					Maschinenvermerk am Schluss des Protokolls ausweisen
					<span class="hilfe">
						«Dieser Entwurf wurde maschinell vorbereitet (…) und von … durchgesehen und
						verantwortet.» Rechtlich nicht zwingend, aber ehrlich — und im Streitfall
						entlastend. Er erscheint ohnehin nur, wenn wirklich ein Absatz übernommen wurde.
						<strong>Der Nachweis bleibt in jedem Fall</strong>: Wer wann was von einer Maschine
						vorbereiten liess, steht am Protokoll der betreffenden Versammlung — abschaltbar
						ist die Zeile im Protokolltext, nicht die Nachvollziehbarkeit.
					</span>
				</span>
			</label>
			<button type="submit">Speichern</button>
		</form>

	</section>

	<!--
		**Die Erinnerung an den Einladungsversand** (Auftraggeber, 28.08.2026;
		Migration 099). Sie geht an die Bewirtschaftung, nicht an ein
		Benutzerkonto: Konten gehören Personen, und Personen sind in den Ferien.
	-->
	<section class="kasten">
		<h3>Erinnerungen</h3>
		{#if form?.quelle === 'erinnerungsadresse' && form?.fehler}
			<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
		{/if}
		<p class="hilfe">
			Läuft die Einberufungsfrist einer Versammlung ab, geht einen Werktag vorher eine
			Erinnerung an diese Adresse. Allgemeine Feiertage (Neujahr, Karfreitag, Ostermontag, Auffahrt, Pfingstmontag, 1. August,
			Weihnachten, Stephanstag) zählen dabei wie ein Wochenende, kantonale nicht. Sie kommt nur, wenn bis dahin keine Einladung erzeugt
			und nicht vermerkt wurde, dass sie verschickt ist. Nach jeder Milderung des Mehrs kommt sie einmal erneut,
			ausser die berichtigte Einladung ist schon als verschickt vermerkt oder das Mehr
			zurückgestellt. Nach einer Rücknahme der Freigabe kommt sie ebenfalls erneut. Und nur, wenn die Gemeinschaft
			unter «Reglement und Quoren» eine Frist hinterlegt hat. Ohne Adresse wird nicht erinnert.
		</p>
		<form method="POST" action="?/erinnerungsadresse" class="formular" use:enhance={absenden()}>
			<label class="namensfeld">
				Adresse für Erinnerungen
				<input
					type="email"
					name="erinnerungsadresse"
					maxlength="254"
					placeholder="bewirtschaftung@example.ch"
					{...anfangswert(abgewieseneAdresse ?? data.betreiber.erinnerungsadresse ?? '')}
				/>
			</label>
			<p><button type="submit">Adresse speichern</button></p>
		</form>
		{#if !data.mailausgangEingerichtet}
			<p class="hilfe">
				Es ist kein Mailausgang eingerichtet (<code>VERSAMMLUNG_SMTP_HOST</code>). Solange
				das so ist, verschickt die Anwendung überhaupt nichts — auch keine Erinnerung.
			</p>
		{/if}
	</section>
</div>

<!--
	**Wohin man weitergeht** — Karten, die nichts einstellen, sondern woanders
	hinführen. Sie standen zwischen den Formularen und liessen die Reihe unruhig
	wirken: zwei kurze Kästen mit einem Satz und einem Knopf neben drei langen
	Formularen (Auftraggeber, 25.08.2026).
-->
<h2 class="gruppe">Wege</h2>

<div class="kacheln">
	<section class="kasten">
		<h3>Konten</h3>
		<p>
			Wer sich anmelden darf, mit welcher Rolle — und Kennwörter setzen, wenn jemand seines
			vergessen hat.
		</p>
		<p><a class="knopfartig" href="/betreiber/benutzer">Konten führen</a></p>
	</section>

	<section class="kasten">
		<h3>Äussere Dienste</h3>
		<p>
			Welches Modell die KI fragt und wer den Abschluss bezeugt — mit Zustand und einem Knopf,
			der die Verbindung prüft, statt sie im Saal zu erproben.
		</p>
		<p><a class="knopfartig" href="/betreiber/dienste">Dienste einrichten</a></p>
	</section>

	<section class="kasten">
		<h3>Saalgeräte</h3>
		<p>
			Das Notebook, an das eine Versammlung abgegeben wird. Und, wenn diese Anwendung selbst im
			Saal steht, ihr eigener Gerätecode.
		</p>
		<p><a class="knopfartig" href="/betreiber/saalgeraete">Geräte führen</a></p>
	</section>

	<!--
		Dieselbe Bauart wie die drei Nachbarn (UI-Durchgang 06.10.2026): Hier
		stand `class="knopf"`, eine Klasse ohne Stil, und der Weg war ein
		Textlink von 160 × 20 px neben drei Knöpfen von 44 px Höhe; die
		Beschreibung stand klein und grau, bei den Nachbarn in Grundschrift.
	-->
	<section class="kasten">
		<h3>Abschlusspaket prüfen</h3>
		<p>
			Ein Paket nachrechnen lassen — auch eines, das von aussen kommt oder dessen Versammlung hier
			nicht mehr steht.
		</p>
		<p><a class="knopfartig" href="/pruefen">Zum Prüfwerkzeug</a></p>
	</section>
</div>

<h2 class="gruppe">Löschen und Aufbewahren</h2>

<div class="kacheln">
	<section class="kasten">
		<h3>Aufbewahrung und Löschung</h3>
		<p class="hilfe">
			Abschlusspaket und unterzeichnetes Protokoll werden bei der Verwaltung aufbewahrt, sonst beim
			Stockwerkeigentümer, der den Vorsitz geführt hat. Bewahren Sie beides auf, solange das
			Stockwerkeigentum besteht. In Votum lässt sich eine Versammlung löschen, sobald die nächste
			Versammlung ihr Protokoll genehmigt hat und niemand ihre Beschlüsse mehr anfechten kann. Wann das
			ist, steht in der Tabelle darunter, unter «Löschbar ab».
		</p>
		<details>
			<summary>Was heisst das?</summary>
			<p>
				Anfechten lässt sich ein Beschluss innert eines Monats (ZGB Art. 75 i.V.m. Art. 712m Abs. 2).
				Wer nicht an der Versammlung war, erfährt davon erst mit dem Protokoll, deshalb zählt die
				<strong>letzte Zustellung</strong> (Wermelinger, Rz. 230 ad Art. 712m). Dazu kommen 30 Tage
				Reserve, weil ein Schlichtungsgesuch oft erst Wochen später eintrifft.
			</p>
			<p>
				Vorher muss die nächste Versammlung das Protokoll genehmigt haben. Bis dahin lässt sich seine
				Berichtigung verlangen, auch nach Ablauf der Anfechtungsfrist (Wermelinger, Rz. 136, 138 ad
				Art. 712n). Bis auf der Protokollseite die Fassung «von der Versammlung genehmigt» festgehalten
				ist, nach einer späteren geschlossenen Versammlung, steht in der Spalte «nach Genehmigung».
			</p>
			<p>
				Die Spalte «Löschbar ab» rechnet mit dem Tag, an dem das Protokoll als versandt festgehalten
				wurde. Beim Löschen fragt Votum den Tag der letzten Zustellung ab. Solange die Frist läuft,
				weist die Datenbank jede Löschung ab, auch an dieser Seite vorbei.
			</p>
		</details>
	</section>
</div>

<section class="kasten breit">
	<h3>Versiegelte Pakete</h3>
	{#if data.aufbewahrung.pakete.length === 0}
		<p class="hilfe">Noch kein Abschlusspaket versiegelt.</p>
	{:else}
		<div class="suchleiste">
			<label class="suchfeld">
				<span class="nurLeser">Pakete suchen</span>
				<input
					type="search"
					placeholder="Gemeinschaft, Datum, Ort oder Person"
					{...anfangswert(suchePakete)}
					oninput={(e) => (suchePakete = e.currentTarget.value)}
					autocomplete="off"
				/>
			</label>
			<!--
				**Der Zaehler nennt, was WIRKLICH dasteht** (03.09.2026, in der
				Sichtprobe gefunden). Er sagte «125 von 125», waehrend die Tabelle
				darunter nur die ersten Zeilen standen: eine Zahl, die dem widerspricht, was man
				im selben Bild sieht. Genannt wird deshalb die Zahl der gezeigten
				Zeilen, und dahinter, worauf sie sich bezieht.
			-->
			<p class="zaehler">
				{paketeSichtbar.zeigen.length} von {data.aufbewahrung.pakete.length}
			</p>
		</div>

		{#if pakete.length === 0}
			<p class="hilfe">Kein Paket passt zu «{suchePakete}».</p>
		{:else}
			<!--
				**Zwei verschiedene Angaben, deshalb zwei Spalten.**
				«Sitzungsleitung» ist der Name, den jemand auf der Protokollseite
				eingetragen hat (Migration 091) — bei Paketen aus der Zeit davor leer.
				«Versiegelt durch» ist das Konto, das die Versiegelung ausgelöst hat
				(`seal.sealed_by_label`), und das ist nicht dasselbe: Versiegeln kann,
				wer Zugang hat, den Vorsitz führte womöglich jemand ganz anderes.

				**Als Karten**, weil die Tabelle mit sieben Spalten auf kein Telefon
				passt — `src/app.css` verlangt dafür `karten` samt `role` und
				`data-spalte`, sonst nimmt `display: block` der Tabelle ihre Bedeutung
				im Zugänglichkeitsbaum.
			-->
			<div class="tabellenbahn">
				<!-- svelte-ignore a11y_no_redundant_roles -->
				<table role="table" class="karten">
					<thead>
						<!-- svelte-ignore a11y_no_redundant_roles -->
						<tr role="row">
							<Sortierkopf spalte="gemeinschaft" sortierung={sortPakete} klick={sortierePakete}>
								Gemeinschaft
							</Sortierkopf>
							<Sortierkopf spalte="datum" sortierung={sortPakete} klick={sortierePakete}>
								Datum
							</Sortierkopf>
							<Sortierkopf spalte="ort" sortierung={sortPakete} klick={sortierePakete}>
								Ort
							</Sortierkopf>
							<Sortierkopf spalte="leitung" sortierung={sortPakete} klick={sortierePakete}>
								Sitzungsleitung
							</Sortierkopf>
							<Sortierkopf spalte="versiegelt" sortierung={sortPakete} klick={sortierePakete}>
								Versiegelt
							</Sortierkopf>
							<Sortierkopf spalte="durch" sortierung={sortPakete} klick={sortierePakete}>
								Versiegelt durch
							</Sortierkopf>
							<Sortierkopf spalte="loeschbar" sortierung={sortPakete} klick={sortierePakete}>
								Löschbar ab
							</Sortierkopf>
						</tr>
					</thead>
					<tbody>
						{#each paketeSichtbar.zeigen as p (p.versammlungId)}
							<!-- svelte-ignore a11y_no_redundant_roles -->
							<tr role="row">
								<td role="cell" data-spalte="Gemeinschaft"
									><a href="/versammlungen/{p.versammlungId}/siegel">{p.bezeichnung}</a></td
								>
								<td role="cell" data-spalte="Datum">{punktdatum(p.datum)}</td>
								<td role="cell" data-spalte="Ort">{p.ort}</td>
								<td role="cell" data-spalte="Sitzungsleitung">{p.sitzungsleitung ?? '—'}</td>
								<td role="cell" data-spalte="Versiegelt">{punktdatum(tagVon(p.versiegeltAm))}</td>
								<td role="cell" data-spalte="Versiegelt durch">{p.versiegeltDurch?.trim() || '—'}</td>
								<!--
									**Dieselbe Form wie bei den Betriebsdaten, aber in derselben Zelle**
									(UI-Durchgang 06.10.2026). «Löschen» stand als Textlink in der
									Datumszelle und brach je nach Datum mit um; die Tabelle darunter
									führt es als umrandeten Knopf. Ein Verweis bleibt es, weil die
									Rückfrage mit Zahlen erst die Zielseite stellt (`docs/gestaltung.md`,
									«Löschen steht leise unten und fragt mit Zahlen»).

									In der Zelle und nicht in einer eigenen Spalte, weil Datum und
									Handlung zusammengehören: `e2e/durchspielen.mjs` liest über die
									Zelle des Verweises, ob dort «nach Genehmigung» steht. Eine eigene
									Spalte trennte beides, und der Schritt würde rot (aus dem Code
									abgeleitet in der Codeprüfung 06.10.2026, nicht gefahren).
								-->
								<td role="cell" data-spalte="Löschbar ab">
									<span class="loeschzelle">
										<span>
											{#if p.genehmigung !== 'genehmigt'}
												nach Genehmigung
											{:else}
												{p.loeschbarAb ? punktdatum(p.loeschbarAb) : '—'}
											{/if}
										</span>
										<a class="knopfartig leise" href="/betreiber/loeschen/{p.versammlungId}">Löschen</a>
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!--
				Der Ausweg aus der Kuerzung. Er steht UNTER der Liste, wo der Blick
				ankommt, wenn die zehnte Zeile nicht die gesuchte war, und nennt die
				Zahl: Ohne sie waere nicht zu sehen, dass ueberhaupt etwas fehlt.
			-->
			{#if paketeSichtbar.verborgen > 0}
				<p class="mehr">
					<strong>{paketeSichtbar.verborgen} weitere</strong> — suchen Sie oben, oder
					<button type="button" class="flach" onclick={() => (allePakete = true)}>
						alle {pakete.length} anzeigen
					</button>.
				</p>
			{/if}
		{/if}
	{/if}
</section>

<section class="kasten breit">
	<h3>Betriebsdaten geschlossener Versammlungen</h3>
	<p class="hilfe">
		Zugangscodes, Gerätesitzungen und Saalmeldungen sind Personendaten ohne Beweiswert. Sie stehen
		nicht im Abschlusspaket und gehören nach der Versammlung gelöscht. <strong>Anwesenheit,
		Stimmen, Vollmachten und Verlauf bleiben</strong> — die Anwesenheit ist der Nachweis, der Code
		war nur der Weg dorthin.
	</p>

	{#if data.aufbewahrung.offen.length === 0}
		<p class="hilfe">Nichts zu löschen: An keiner geschlossenen Versammlung hängen noch Betriebsdaten.</p>
	{:else}
		<div class="suchleiste">
			<label class="suchfeld">
				<span class="nurLeser">Versammlungen suchen</span>
				<input
					type="search"
					placeholder="Gemeinschaft oder Datum"
					{...anfangswert(sucheBetriebsdaten)}
					oninput={(e) => (sucheBetriebsdaten = e.currentTarget.value)}
					autocomplete="off"
				/>
			</label>
			<p class="zaehler">
				{offenSichtbar.zeigen.length} von {data.aufbewahrung.offen.length}
			</p>
		</div>

		{#if offen.length === 0}
			<p class="hilfe">Keine Versammlung passt zu «{sucheBetriebsdaten}».</p>
		{:else}
			<div class="tabellenbahn">
				<!--
					**`karten`, sonst zieht die Tabelle die ganze Seite quer** (26.08.2026
					bei 320 px gemessen: 50 px Überlauf, unsichtbar, weil `body` ihn
					ausblendet). Fünf Spalten passen auf kein Telefon; die Regel dazu steht
					in `app.css`, und die Nachbartabelle darüber folgt ihr längst.
				-->
				<!-- svelte-ignore a11y_no_redundant_roles -->
				<table role="table" class="karten">
					<thead>
						<!-- svelte-ignore a11y_no_redundant_roles -->
						<tr role="row">
							<Sortierkopf
								spalte="versammlung"
								sortierung={sortBetriebsdaten}
								klick={sortiereBetriebsdaten}
							>
								Versammlung
							</Sortierkopf>
							<Sortierkopf
								spalte="zugaenge"
								zahl
								sortierung={sortBetriebsdaten}
								klick={sortiereBetriebsdaten}
							>
								Zugänge
							</Sortierkopf>
							<Sortierkopf
								spalte="sitzungen"
								zahl
								sortierung={sortBetriebsdaten}
								klick={sortiereBetriebsdaten}
							>
								Sitzungen
							</Sortierkopf>
							<Sortierkopf
								spalte="saalmeldungen"
								zahl
								sortierung={sortBetriebsdaten}
								klick={sortiereBetriebsdaten}
							>
								Saalmeldungen
							</Sortierkopf>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each offenSichtbar.zeigen as o (o.versammlungId)}
							<!-- svelte-ignore a11y_no_redundant_roles -->
							<tr role="row">
								<td role="cell" data-spalte="Versammlung">
									<a href="/versammlungen/{o.versammlungId}">{o.bezeichnung}</a>,
									{datum(o.datum)}
									{#if !o.versiegelt}<span class="hilfe">(nicht versiegelt)</span>{/if}
								</td>
								<td role="cell" data-spalte="Zugänge" class="zahl">{o.zugaenge}</td>
								<td role="cell" data-spalte="Sitzungen" class="zahl">{o.sitzungen}</td>
								<td role="cell" data-spalte="Saalmeldungen" class="zahl">{o.saalmeldungen}</td>
								<td role="cell">
									<!--
										**`use:enhance`, damit die Seite nicht nach oben springt**
										(Auftraggeber, 25.08.2026: «Beim Löschen springt der Browser immer
										Top»). Ohne ihn lädt das Formular die Seite neu, und wer die
										vierte von zwölf Zeilen löschte, stand danach wieder am
										Seitenanfang und musste sich seine Stelle neu suchen.

										**Und die Absage steht in ihrer Zeile**: Ohne Neuladen
										springt die Seite auch bei einem Fehlschlag nicht — eine
										Meldung am Seitenkopf sähe niemand, der unten geklickt hat.
									-->
									{#if form?.quelle === 'betriebsdaten' && form?.versammlung === o.versammlungId && form?.fehler}
										<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
									{/if}
									<form method="POST" action="?/betriebsdaten" use:enhance>
										<input type="hidden" name="versammlung" value={o.versammlungId} />
										<button type="submit" class="leise">Löschen</button>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!--
				Der Ausweg aus der Kuerzung. Er steht UNTER der Liste, wo der Blick
				ankommt, wenn die zehnte Zeile nicht die gesuchte war, und nennt die
				Zahl: Ohne sie waere nicht zu sehen, dass ueberhaupt etwas fehlt.
			-->
			{#if offenSichtbar.verborgen > 0}
				<p class="mehr">
					<strong>{offenSichtbar.verborgen} weitere</strong> — suchen Sie oben, oder
					<button type="button" class="flach" onclick={() => (alleBetriebsdaten = true)}>
						alle {offen.length} anzeigen
					</button>.
				</p>
			{/if}
		{/if}
	{/if}
</section>

<style>
	/*
	 * **Gruppenüberschriften** (Auftraggeber, 25.08.2026: «Das auch noch einheitlich und
	 * aufgeräumt darstellen. Jetzt wirkt die Seite unruhig»). Die Seite trug
	 * acht gleichrangige Kästen ohne erkennbare Ordnung: zwei blosse Verweise,
	 * drei Formulare und zwei Tabellen nebeneinander. Jetzt in drei Gruppen —
	 * was man einstellt, wohin man weitergeht, was aufbewahrt wird.
	 */
	.gruppe {
		margin: 2rem 0 0.75rem;
		font-size: 1.05rem;
		color: var(--text-leise);
		font-weight: 600;
	}

	/*
	 * Das Namensfeld nimmt die volle Breite seiner Karte. `.breit` wäre die
	 * naheliegende Klasse gewesen — sie hat hier aber keine Regel: Die globale
	 * gilt nur für `.felder > .breit`, und dieses Formular ist ein `.formular`.
	 * Eine Klasse ohne Stil ist eine Rückmeldung, die niemand sieht.
	 */
	.namensfeld input {
		width: 100%;
		max-width: 28rem;
	}

	/*
	 * Die Zahlen, die man auf dieser Seite sucht — nicht die Formulare.
	 * Eigenes Raster mit schmalerem Mass als `.kacheln`: Eine Zahl braucht keine
	 * 24rem, und vier davon sollen auch auf einem halben Bildschirm in eine
	 * Zeile passen.
	 */
	.zahlen {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(11rem, 100%), 1fr));
		gap: 0.6rem;
		margin: 1rem 0 0.25rem;
	}

	.zahl-kachel {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding: 0.7rem 0.9rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
	}

	/* Etwas zu tun — dieselbe Sprache wie die offenen Punkte der Übersicht. */
	.zahl-kachel.aufgabe {
		border-color: var(--akzent);
		background: color-mix(in srgb, var(--akzent) 8%, var(--flaeche));
	}

	.wert {
		font-size: 1.6rem;
		font-weight: 650;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}

	.was {
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	.kasten {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 1rem 1.15rem;
	}

	/* Die Kästen mit den Tabellen stehen ausserhalb des Rasters. */
	.kasten.breit {
		margin-top: 0.75rem;
	}

	/*
	 * Die Karten tragen jetzt `h3` (25.08.2026): Sie stehen **unter** einer
	 * Gruppenüberschrift, und für eine Vorlesehilfe war «Name» bis dahin ein
	 * Geschwister von «Ihre Firma» statt ein Unterpunkt — die Ordnung, die das
	 * Auge sieht, gab es in der Gliederung nicht.
	 */
	h3 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
	}

	.hilfe {
		font-size: 0.875rem;
		color: var(--text-leise);
		font-weight: 400;
	}

	.formular {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 1.25rem;
		padding-top: 1rem;
		border-top: 1px solid var(--linie);
		align-items: flex-start;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-weight: 550;
		font-size: 0.9rem;
	}

	.schmal input {
		width: 8rem;
	}

	.kaestchen {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		font-weight: 400;
		min-height: var(--ziel-min);
	}

	/*
	 * **Das Kästchen links neben den Titel** (Auftraggeber, 26.08.2026: «Das liest sich
	 * sonst komisch»). Die Regel `label { flex-direction: column }` weiter oben
	 * stapelt alles untereinander — bei einem Textfeld richtig, bei einem Kästchen
	 * nicht: Ein Haken über seiner Beschriftung sieht aus, als gehörte er zum
	 * Absatz darüber. `.kaestchen` daneben hat keine Hilfe darunter und richtet
	 * deshalb mittig aus; hier steht der Titel über mehreren Zeilen Erklärung.
	 */
	.schalter {
		flex-direction: row;
		align-items: flex-start;
		gap: 0.5rem;
		min-height: var(--ziel-min);
	}

	.schalter > span:not(.hilfe) {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		/* Darf schmaler werden als sein längstes Wort — sonst drückt der Text den
		   Block über den Rand, statt in sich umzubrechen. */
		min-width: 0;
	}

	input {
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
		min-height: 0;
		flex: none;
	}

	/*
	 * **`:not(.flach)`, sonst gewinnt diese Regel** (03.09.2026, in der
	 * Sichtprobe gemessen). Svelte haengt den Datei-Hash an, also hat `button`
	 * hier die Spezifitaet 0-1-1 und schlaegt das globale `.flach` (0-1-0) —
	 * der Verweis-Knopf «alle 125 anzeigen» stand gruen und rund da wie ein
	 * Hauptknopf, mitten im Satz. Auf `/personen` faellt das nicht auf, weil es
	 * dort keine seitenlokale `button`-Regel gibt.
	 */
	button:not(.flach) {
		min-height: var(--ziel-min);
		padding: 0 1.25rem;
		border: none;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font: inherit;
		font-weight: 550;
		cursor: pointer;
	}

	button.leise {
		background: transparent;
		border: 1px solid var(--linie);
		color: var(--text-leise);
		padding: 0 0.9rem;
	}

	/* Datum und «Löschen» in einer Zelle: der Knopf hinter dem Datum, und wo
	   der Platz nicht reicht, darunter statt mitten im Datum. `inline-flex`,
	   damit die Kartenbeschriftung «Löschbar ab:» am Telefon auf derselben
	   Zeile bleibt wie in den anderen Zeilen der Karte. */
	.loeschzelle {
		align-items: center;
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.5rem 0.75rem;
	}

	/* In der Karte reicht die Zeile nicht für Beschriftung, Datum und Knopf
	   (gemessen 390 px): Als Ganzes brach die Hülle unter die Beschriftung, und
	   «Löschbar ab:» stand allein. Dort steht der Knopf bündig darunter. */
	@media (max-width: 46rem) {
		.loeschzelle {
			display: inline;
		}

		.loeschzelle > a {
			display: flex;
			margin-top: 0.4rem;
			width: max-content;
		}
	}

	/* Der Verweis «Löschen» bei den versiegelten Paketen sieht aus wie der
	   leise Knopf bei den Betriebsdaten (UI-Durchgang 06.10.2026). */
	a.knopfartig.leise {
		background: transparent;
		color: var(--text-leise);
		padding: 0 0.9rem;
		font-weight: 550;
	}

	/*
	 * Der Hinweis unter einem gekuerzten Archiv, in derselben Form wie auf der
	 * Personen- und der Gemeinschaftsliste: die Zahl der Verborgenen, der
	 * Verweis auf die Suche, und erst dann der Knopf. Wer die Liste ueberfliegt,
	 * soll nicht denken, sie sei zu Ende.
	 */
	.mehr {
		margin: 0.6rem 0 0;
		color: var(--text-leise);
	}

	table {
		border-collapse: collapse;
		margin: 0.5rem 0 1rem;
		/* Kein `max-width` mehr: Mit sieben Spalten liegt die Mindestbreite der
		   Tabelle darüber, der Deckel war damit wirkungslos und drückte nur die
		   Freitextspalte «Ort» auf jeder Fensterbreite auf ihr Minimum
		   (26.08.2026, nachgemessen). */
		width: 100%;
	}

	th,
	td {
		border-bottom: 1px solid var(--linie);
		padding: 0.35rem 0.5rem;
		text-align: left;
		vertical-align: top;
	}

	.zahl {
		text-align: right;
		white-space: nowrap;
	}



</style>
