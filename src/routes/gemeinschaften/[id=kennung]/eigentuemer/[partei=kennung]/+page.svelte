<script lang="ts">
	/**
	 * Eine Eigentümerzeile für sich, mit allem, was an ihr hängt.
	 *
	 * **Wozu diese Seite** (Auftraggeber, 27.08.2026): «Angaben berichtigen» stand
	 * dreimal in einer Tabellenzelle, dazu «Vertretung wechseln»,
	 * «Mitberechtigte» mit Ausklappern darin, «Weitere Person aufnehmen» und die
	 * Wahl «Wohin geht die Einladung?». Die Begründung steht im Kopf von
	 * `+page.server.ts` daneben.
	 *
	 * Die Tabelle in der Liste zeigt seither nur noch den Bestand und führt mit
	 * **einem** Weg hierher.
	 */
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';
	import Suchauswahl from '$lib/components/Suchauswahl.svelte';
	import Meldung from '$lib/components/Meldung.svelte';
	import { anfangswert, angekreuzt, aufgeklappt } from '$lib/felder';
	import Personenzeile from '$lib/components/Personenzeile.svelte';
	import AdresseFuerAlle from '$lib/components/AdresseFuerAlle.svelte';
	import { alsWahl, leereZeile, type Beteiligter } from '$lib/domain/personenangaben';

	let { data, form } = $props();

	const zeile = $derived(data.zeile);

	/** Die Anschrift der Gemeinschaft, als eine Zeile (22.08.2026, Befund A-09). */
	const gemeinschaftsadresse = $derived(
		[
			data.gemeinschaft?.strasse,
			[data.gemeinschaft?.plz, data.gemeinschaft?.ort].filter(Boolean).join(' ')
		]
			.filter((t) => t && t.trim())
			.join(', ')
	);

	/** Wer zur Wahl steht: alle ausser den archivierten. */
	const waehlbarePersonen = $derived(data.personen.filter((p) => !p.archiviertAm));

	/** Dieselbe Menge in der Form, die `Personenzeile` führt. */
	const waehlbareFuerZeile = $derived(
		waehlbarePersonen.map((p) => ({
			id: p.id,
			name: p.name,
			gemeinschaften: p.parteien.map((x) => x.gemeinschaft)
		}))
	);

	/**
	 * Ob diese Zeile selbst irgendwo mitberechtigt ist.
	 *
	 * Gebraucht wird das, damit kein Knopf «Zeile tilgen» dasteht, den der Server
	 * abweist: `pruefeZeileTilgbar` sagt dort «ist Mitberechtigte oder
	 * Mitberechtigter an gemeinschaftlichem Eigentum» ab.
	 */
	const mitberechtigteZeilen = $derived(
		new Set(
			Object.values(data.mitberechtigte)
				.flat()
				.map((m) => m.partyId)
		)
	);

	/** Die Hüllen, in denen diese Zeile steckt — mit Kennung und Namen. */
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
	 * Zeilen, die als Mitberechtigte in Frage kommen — für «Weitere aufnehmen».
	 *
	 * Nicht die Hülle selbst (`party_member_kein_selbstbezug`), keine zweite
	 * Hülle (`party_member_mitglied_ist_keine_huelle`), niemand, der schon
	 * drinsteht (`party_member_einmalig`), und nichts Archiviertes. Alle vier
	 * Schranken hält auch die Datenbank — hier stehen sie, damit die Liste gar
	 * nicht erst anbietet, was in eine Absage führt.
	 */
	function moeglicheMitberechtigte(huelleId: string) {
		const schon = new Set((data.mitberechtigte[huelleId] ?? []).map((m) => m.partyId));
		return data.eigentuemer
			.filter(
				(e) =>
					e.id !== huelleId &&
					!e.isCommunity &&
					e.kind !== 'gemeinschaft' &&
					!e.archiviertAm &&
					!schon.has(e.id)
			)
			.map((e) => ({ wert: e.id, text: e.displayName }));
	}

	/** Welche Person hinter einer Zeile steht. */
	function personVon(parteiId: string): { id: string; name: string } | null {
		const p = data.personen.find((x) => x.parteien.some((y) => y.parteiId === parteiId));
		return p ? { id: p.id, name: p.name } : null;
	}

	/** Der Wert des Auswahlknopfs «Niemand bezeichnet». */
	const NIEMAND = '';


	/**
	 * Die Personen, die bei «Miteigentum eintragen» **dazukommen**.
	 *
	 * **Vorgabe ohne Zustand.** Solange niemand etwas anfasst, gibt `zeilenVon`
	 * eine feste Zeile mit einer aus der Parteikennung abgeleiteten Kennung
	 * zurück. Ein frisch gebautes Objekt je Neuzeichnen bekäme jedes Mal eine
	 * neue Kennung, und der `{#each}`-Schlüssel wechselte unter den Feldern weg.
	 */
	let miteigentum = $state<Record<string, Beteiligter[]>>({});
	/** Woher die nächste Kennung kommt. Kennungen werden nie wiederverwendet. */
	let mitZaehler = 0;

	function zeilenVon(parteiId: string): Beteiligter[] {
		const eigen = miteigentum[parteiId];
		if (eigen) return eigen;
		// Nach einer Absage kommen die getippten Angaben zurück.
		if (form?.quelle === 'miteigentum' && form.beteiligte && form.beteiligte.length > 0) {
			return form.beteiligte.map((b, i) => ({ kennung: `${parteiId}-r${i}`, ...b }));
		}
		return [leereZeile(`${parteiId}-0`)];
	}

	/**
	 * Wer beim Aufbau die Stimme ausübt.
	 *
	 * **Vorgewählt ist niemand** (Produktentscheid 27.08.2026): Die Bezeichnung
	 * ist freiwillig, und die bestehende Zeile still vorzuwählen behauptete eine
	 * Ordnung, die niemand getroffen hat. `vertreterIndex` zählt die bestehende
	 * Zeile als 0 und meldet −1, wenn niemand gewählt war.
	 */
	function mitVertreterAnfang(zeilen: Beteiligter[]): string {
		if (form?.quelle === 'miteigentum') {
			const i = form.vertreterIndex ?? -1;
			if (i === 0) return 'bestehend';
			if (i > 0 && zeilen[i - 1]) return zeilen[i - 1].kennung;
		}
		return NIEMAND;
	}

	function mitPersonDazu(parteiId: string) {
		miteigentum[parteiId] = [
			...zeilenVon(parteiId),
			leereZeile(`${parteiId}-n${mitZaehler++}`)
		];
	}

	function mitPersonWeg(parteiId: string, kennung: string) {
		miteigentum[parteiId] = zeilenVon(parteiId).filter((z) => z.kennung !== kennung);
	}

	function mitWahlSetzen(parteiId: string, kennung: string, wahl: string) {
		miteigentum[parteiId] = zeilenVon(parteiId).map((z) =>
			z.kennung === kennung ? { ...z, wahl: alsWahl(wahl) } : z
		);
	}

	/** Die Einheiten dieser Zeile, als ein Satz. */
	const einheitensatz = $derived(
		zeile.einheiten.length === 0
			? 'noch keine zugeordnet'
			: zeile.einheiten.map((e) => e.label).join(', ')
	);
</script>

<!--
	Der Weg zurück zur Liste steht in der Pfadzeile des Layouts, als Schritt nach
	«Gemeinschaften» (`pfadschritt` aus `+page.server.ts`). Hier stand bis zum
	06.10.2026 eine eigene Zeile darunter, und die Brotkrume las sich zweizeilig.
-->
<h1>{zeile.displayName}</h1>
<!--
	**Der Bestand zuerst, dann die Wege** (`docs/gestaltung.md`, «Die
	Arbeitsfläche: Bestand links, Eintragen rechts» — hier untereinander, weil es
	nur einen Gegenstand gibt).
-->
<!--
	Die Einordnung als Satz, die Zahlen als Reihe darunter (UI-Durchgang
	06.10.2026): In einer Zeile stand «Alleineigentum. · EG links …», ein
	Satzpunkt vor dem Trenner.
-->
<p class="klein">
	{#if zeile.isCommunity}
		Gemeinschaftliches Eigentum, eine Stimme nach ZGB Art. 712o Abs. 1.
		{#if zeile.representativeName}
			Vertreten durch {zeile.representativeName}.
		{:else}
			Keine Vertretung bezeichnet.
		{/if}
	{:else if zeile.kind === 'gemeinschaft'}
		Anteil einer anderen Gemeinschaft{zeile.representativeName
			? `, vertreten durch ${zeile.representativeName}`
			: ''}.
	{:else if zeile.representativeName}
		Vertreten durch {zeile.representativeName}.
	{:else}
		Alleineigentum.
	{/if}
</p>
<p class="klein">
	{einheitensatz} · {zeile.kopfstimmen}
	{zeile.kopfstimmen === 1 ? 'Kopfstimme' : 'Kopfstimmen'} · Wertquote {zeile.wertquote}
</p>
{#if data.archiviertAm}
	<p class="klein">Im Archiv{#if data.archivnotiz}: {data.archivnotiz}{/if}</p>
{/if}
{#if personVon(zeile.partyId)}
	{@const person = personVon(zeile.partyId)!}
	<p class="klein">
		Dieselbe Person über alle Gemeinschaften: <a href="/personen/{person.id}">{person.name}</a>
	</p>
{/if}
{#if (data.mitberechtigte[zeile.partyId] ?? []).length > 0}
	<ul class="mitberechtigte">
		{#each data.mitberechtigte[zeile.partyId] as m (m.partyId)}
			<li>
				{m.displayName}
				{#if m.istVertreter}
					<span class="mitmarke" title="ZGB Art. 712o Abs. 1">übt die Stimme aus</span>
				{/if}
				{#if m.istZustelladresse}
					<span class="mitmarke" title="ZGB Art. 712n: die Einladung genügt hierhin">
						Zustelladresse
					</span>
				{/if}
				{#if m.email}<span class="hilfe">{m.email}</span>{/if}
			</li>
		{/each}
	</ul>
{/if}
{#if !zeile.isCommunity && mitberechtigteZeilen.has(zeile.partyId)}
	{#each huellenVon(zeile.partyId) as h (h.id)}
		<p class="klein">
			Auch mitberechtigt an
			<a href="/gemeinschaften/{data.gemeinschaft.id}/eigentuemer/{h.id}">«{h.name}»</a>
		</p>
	{/each}
{/if}

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.hinweis}
	<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
{/if}

<section class="wege">
	<!--
			**Eine versehentliche Zuordnung tilgen** (23.08.2026, Befund A-13).
			Bis dahin liess sich eine falsch zugeordnete Einheit nur durch eine
			zweite Zuordnung überschreiben — und dann steht im Protokoll ein
			Eigentümerwechsel, den es nie gab.

			**Nur vor der ersten Freigabe.** Danach hält eine Momentaufnahme
			fest, wem was gehörte; der Kern weist das Tilgen dann ab. Einen
			Knopf anzubieten, den der Server abweist, ist auch mit schöner
			Meldung ein Fehler — hier steht er deshalb gar nicht erst da.
		-->
	<!--
		**Die Angaben berichtigen** (23.08.2026, Prüflauf II). Nach der
		CSV-Übernahme standen fünfzehn Eigentümer ohne E-Mail da, und es
		gab keinen Weg, sie nachzutragen: Die Übernahme kennt keine
		Kontaktspalten, und ohne Personenverknüpfung gibt es auch keine
		Personenseite.

		`bearbeiteEigentuemer` stand die ganze Zeit im Kern — nur rief sie
		keine Route auf. Die E-Mail ist dabei nicht irgendein Feld: Sie
		trägt den Zugangscode zur Versammlung.

		Anders als das Tilgen steht dieser Weg **auch nach der Freigabe**
		offen: Eine Schreibweise zu berichtigen ändert nichts an der
		Stimmkraft, und der festgehaltene Stand bleibt ohnehin unberührt.
	-->
	<!--
		**Nach einer Absage steht der Ausklapper wieder offen** — sonst liest man
		die Meldung am Seitenkopf und findet das Formular nicht wieder, auf das
		sie sich bezieht (25.08.2026).

		**Beide Quellen** (27.08.2026, aus dem Code-Review): Der Kasten trägt zwei
		Formulare, das Berichtigen und das Archivieren. Die Bedingung nannte nur
		`archiv`, und eine abgewiesene Berichtigung liess ihn deshalb zu.

		**Was die Absage nicht rettet**, sind die getippten Werte: Die Felder
		füllen sich aus dem gespeicherten Stand. Das ist hier hinnehmbar, weil die
		Absagen dieses Formulars an **einem** Feld hängen (Name zu kurz, E-Mail
		unvollständig) und der Rest unverändert danebensteht.
	-->
	<details
		class="angaben"
		{...aufgeklappt(
			(form?.quelle === 'archiv' || form?.quelle === 'angaben') &&
				form.parteiId === zeile.partyId
		)}
	>
		<summary>Angaben berichtigen</summary>
		<form method="POST" action="?/angabenBerichtigen" class="felder">
			<input type="hidden" name="parteiId" value={zeile.partyId} />
			<input type="hidden" name="kind" value={zeile.kind ?? 'natural'} />
			<input
				type="hidden"
				name="isCommunity"
				value={zeile.isCommunity ? 'true' : 'false'}
			/>
			<label>
				Name
				<input name="displayName" required maxlength="200" {...anfangswert(zeile.displayName)} />
			</label>
			<label>
				E-Mail
				<input name="email" type="email" maxlength="200" {...anfangswert(zeile.email ?? '')} />
			</label>
			<!--
				**Kein freies Namensfeld, wo Mitberechtigte eingetragen
				sind** (26.08.2026, beim Umsetzen von Aufgabe 3 gefunden).

				Die Zeile trägt dann zwei Angaben über dieselbe Sache:
				`representative_name` für die Urkunde und
				`representative_party_id` für die Anwendung. Wer den Namen
				hier überschreibt, verschiebt nur die eine — Unterschriftenliste
				und Stimmzettel nennten danach jemand anderen, als die
				Anwendung zählt, und niemand sähe es.

				Der bisherige Wert reist verborgen mit: Ohne Feld schriebe
				`bearbeiteEigentuemer` den Namen bei jedem Speichern leer, und
				die gedruckten Listen verlören ihn wortlos.
			-->
			{#if zeile.isCommunity && (data.mitberechtigte[zeile.partyId] ?? []).length > 0}
				<input
					type="hidden"
					name="representativeName"
					value={zeile.representativeName ?? ''}
				/>
				<p class="hilfe voll">
					{#if zeile.representativeName}
						Vertreten durch <strong>{zeile.representativeName}</strong>.
					{:else}
						Keine Vertretung bezeichnet.
					{/if}
					Wer die Stimme ausübt, ändern Sie unter «Vertretung wechseln»; dort
					steht, wer mitberechtigt ist.
				</p>
			{:else if zeile.isCommunity || zeile.kind === 'legal'}
				<label>
					Vertreten durch
					<input
						name="representativeName"
						maxlength="200"
						{...anfangswert(zeile.representativeName ?? '')}
					/>
				</label>
			{/if}
			<!--
				**Telefon und Adresse gehörten hierher** (23.08.2026, beim
				Bau von A-12 gefunden).

				Sie liessen sich beim Anlegen erfassen und danach nie mehr
				ändern — es gab kein Feld dafür. Schlimmer: Weil die Aktion
				alle Felder schreibt und das Formular sie nicht schickte,
				LÖSCHTE jedes «Berichtigen» beide. Wer eine falsch
				geschriebene Adresse richtigstellen wollte, hatte danach
				gar keine mehr, und niemand sah es der Zeile an.
			-->
			<label>
				Telefon
				<input name="phone" maxlength="60" {...anfangswert(zeile.phone ?? '')} />
			</label>
			<label class="voll">
				Adresse
				<input name="address" maxlength="300" {...anfangswert(zeile.address ?? '')} />
			</label>
			<!--
				**Die Bemerkung** (23.08.2026, Prüflauf I, A-12): «spricht
				nur Französisch», «Post an die Tochter», «kommt nie und
				bevollmächtigt jedes Jahr denselben Nachbarn».

				**Sie hängt an der PERSON, nicht an dieser Zeile** — so
				sagte es der Befund selbst. Die Bemerkung an der Person gibt
				es seit je; sie stand nur auf der Personenseite, und dorthin
				kommt niemand, der gerade Eigentümer erfasst. Eine eigene
				Spalte an der Eigentümerzeile wäre eine dritte
				Bemerkung gewesen — beklagt wurde gerade, dass es schon zwei
				mit verschiedenem Umfang gibt.

				Deshalb steht hier auch, dass sie in allen Gemeinschaften
				gilt: Wer sie hier ändert, ändert sie überall.
			-->
			{#if personVon(zeile.partyId)}
				{@const person = personVon(zeile.partyId)!}
				{@const stand = data.personen.find((x) => x.id === person.id)}
				<input type="hidden" name="personId" value={person.id} />
				<label class="voll">
					Bemerkung zur Person
					<input
						name="bemerkung"
						maxlength="500"
						{...anfangswert(stand?.bemerkung ?? '')}
					/>
					<span class="hilfe">
						Nur für die Bewirtschaftung: Sie steht auf keiner Liste, in keinem
						Protokoll und in keiner Einladung. Sie gilt für {person.name} in
						<strong>allen</strong> Gemeinschaften.
					</span>
				</label>
			{:else}
				<p class="hilfe voll">
					Eine Bemerkung hängt an der Person. Diese Zeile ist noch mit keiner
					verknüpft — der Weg dazu steht unter «Dieselbe Person?».
				</p>
			{/if}
			<button type="submit">Berichtigen</button>
		</form>

		<!--
			**Archivieren steht leise unten im selben Ausklapper.** Es ist
			eine seltene Handlung an einer einzelnen Zeile; ein Knopf je
			Zeile in der Tabelle wäre bei vierzig Eigentümern vierzig
			Knöpfe für etwas, das man einmal im Jahr tut.

			Der Weg steht nur da, wo der Server ihn auch annimmt: Solange
			Einheiten zugeordnet sind, zählt die Stimme mit, und die Zeile
			gehört in die Liste.
		-->
		{#if data.archiviertAm}
			<form method="POST" action="?/hervorholen" class="archivzeile">
				<input type="hidden" name="parteiId" value={zeile.partyId} />
				<span class="hilfe">
					Im Archiv{#if data.archivnotiz}: {data.archivnotiz}{/if}
				</span>
				<button type="submit" class="leise">Aus dem Archiv holen</button>
			</form>
		{:else if zeile.einheiten.length === 0}
			<form method="POST" action="?/archivieren" class="archivzeile">
				<input type="hidden" name="parteiId" value={zeile.partyId} />
				<input
					name="notiz"
					maxlength="200"
					placeholder="Warum (freiwillig)"
					aria-label="Warum archiviert wird"
					{...anfangswert(
						form?.quelle === 'archiv' && form.parteiId === zeile.partyId
							? form.notiz
							: ''
					)}
				/>
				<button type="submit" class="leise">Archivieren</button>
			</form>
		{:else}
			<p class="hilfe">
				Archivieren geht erst, wenn keine Einheit mehr zugeordnet ist — solange
				zählt die Stimme mit.
			</p>
		{/if}
	</details>

	<!--
		**Miteigentum eintragen** (Auftraggeber, 27.08.2026).

		**Der Fall im Wortlaut:** «wenn A eine Einheit hat und nach einem
		Jahr B heiratet und Miteigentümerin wird, müsste ich dies ja ohne
		grossen Aufwand nachführen können.»

		**Warum der Weg hier steht und nicht in der Erfassungsmaske.**
		Dort bietet «Einheit gleich zuordnen» nur, was am Stichtag
		**keinen** Eigentümer hat (`einheitenOhneEigentuemer`) — A's
		Wohnung ist dort folgerichtig nicht zu finden, der Fall also gar
		nicht erfassbar. Und das Datum gehört an die Zeile, an der es
		gilt: Es ist eine Handänderung, keine Berichtigung.

		**A bekommt keine zweite Zeile.** Seine bestehende wird
		mitberechtigt, mit Anschrift, Zugang und Vorgeschichte; die
		Einheit wandert auf die neue gemeinschaftliche Zeile, ab dem
		Datum. In `unit_ownership` bleibt «A allein» stehen und wird nur
		beendet — eine Versammlung von vorher zeigt weiterhin A allein.

		**Nicht im historischen Stand.** Wer einen früheren Stichtag
		ansieht, liest; der Knopf schriebe in die Gegenwart und stünde in
		einer Ansicht, die das Gegenteil verspricht.
	-->
	{#if !zeile.isCommunity && zeile.kind !== 'gemeinschaft' && !data.archiviertAm && zeile.einheiten.length > 0}
		{@const zeilen = zeilenVon(zeile.partyId)}
		{@const vertreterAn = mitVertreterAnfang(zeilen)}
		<details
			class="angaben"
			{...aufgeklappt(form?.quelle === 'miteigentum' && form.parteiId === zeile.partyId)}
		>
			<summary>Miteigentum eintragen</summary>
			<form method="POST" action="?/miteigentumEintragen">
				<input type="hidden" name="parteiId" value={zeile.partyId} />
				<p class="hilfe">
					Die Einheit gehört künftig mehreren zusammen: Heirat, Erbgang, ein
					verkaufter Anteil. Sie wandert auf eine gemeinschaftliche Zeile, ab dem
					Datum unten. Frühere Versammlungen bleiben, wie sie waren.
				</p>
				<div class="felder">
					{#if zeile.einheiten.length === 1}
						<input type="hidden" name="unitId" value={zeile.einheiten[0].unitId} />
						<p class="hilfe voll">Betrifft «{zeile.einheiten[0].label}».</p>
					{:else}
						<!--
							Mehrere Einheiten, eine Hülle: Ein Paar mit Wohnung und
							Bastelraum soll nicht zwei gemeinschaftliche Zeilen mit
							demselben Namen bekommen. Vorgewählt sind alle, weil das
							der Regelfall ist; abwählen kann, wer nur eine meint.
						-->
						<div class="wahlen voll">
							<fieldset>
								<legend>Welche Einheiten gehen mit?</legend>
								{#each zeile.einheiten as e (e.unitId)}
									<label class="wahl">
										<input
											type="checkbox"
											name="unitId"
											value={e.unitId}
											{...angekreuzt(true)}
										/>
										<span>{e.label}</span>
									</label>
								{/each}
							</fieldset>
						</div>
					{/if}
					<label class="schmal">
						gültig ab
						<input type="date" name="ab" required {...anfangswert(data.heute)} />
					</label>
				</div>

				<div class="abschnitt beteiligte">
					<h3>Wer ist beteiligt?</h3>
					<p class="hilfe">
						Die bestehende Zeile bleibt, wie sie ist. Sie wird mitberechtigt,
						statt ein zweites Mal zu entstehen.
					</p>
					<!--
						Die bestehende Zeile geht durch denselben Baustein wie die neuen
						Personen: gleicher Kasten, gleiche Kopfzeile, gleicher Auswahlknopf.
						Sie trägt nur keine Felder, weil ihre Angaben schon in der Datenbank
						stehen und oben unter «Angaben berichtigen» geändert werden.
					-->
					<Personenzeile
						festerName={zeile.displayName}
						vertreterWert="bestehend"
						nummer={1}
						vertritt={vertreterAn === 'bestehend'}
					/>
					{#each zeilen as m, i (m.kennung)}
						<Personenzeile
							zeile={m}
							vertreterWert={m.kennung}
							nummer={i + 2}
							entfernbar={zeilen.length > 1}
							weg={(kennung) => mitPersonWeg(zeile.partyId, kennung)}
							wahlSetzen={(kennung, wahl) => mitWahlSetzen(zeile.partyId, kennung, wahl)}
							vertritt={m.kennung === vertreterAn}
							waehlbare={waehlbareFuerZeile}
						/>
					{/each}
					<label class="niemand">
						<input
							type="radio"
							name="vertreter"
							value={NIEMAND}
							{...angekreuzt(vertreterAn === NIEMAND)}
						/>
						<span>
							Niemand bezeichnet
							<span class="hilfe">
								Freiwillig. Ist am Abend nur eine der Personen da, darf die
								Sitzungsleitung sie als Vertretung zählen.
							</span>
						</span>
					</label>
					<AdresseFuerAlle adresse={gemeinschaftsadresse} />
					<button
						type="button"
						class="leise weitere"
						onclick={() => mitPersonDazu(zeile.partyId)}
					>
						Weitere Person
					</button>
				</div>
				<button type="submit" class="leise eintragen">Miteigentum eintragen</button>
			</form>
		</details>
	{/if}

	<!--
		**Die Vertretung wechseln** (26.08.2026, Aufgabe 3, Schritt 4b).
		Wer die eine Stimme abgibt, stand bis hierher nur beim Anlegen
		fest. `entferneMitberechtigten` weist das Entfernen der
		vertretenden Person aber ab und nennt als Ausweg «Bestimmen Sie
		zuerst eine andere Vertretung» — den es ohne diesen Weg nicht
		gäbe.

		Zur Wahl steht genau, wer eingetragen ist: Seit Migration 095
		verlangt `party_vertreter_ist_mitglied`, dass der Vertreter in
		`party_member` steht. Ein Feld für einen freien Namen wäre ein
		Angebot, das in eine Absage führte.
	-->
	{#if zeile.isCommunity && (data.mitberechtigte[zeile.partyId] ?? []).length > 0}
		<details
			class="angaben"
			{...aufgeklappt(form?.quelle === 'vertretung' && form.parteiId === zeile.partyId)}
		>
			<summary>Vertretung wechseln</summary>
			<form method="POST" action="?/vertretungWechseln" class="vertretung">
				<input type="hidden" name="parteiId" value={zeile.partyId} />
				<p class="hilfe">
					Wer die eine Stimme abgibt (ZGB Art. 712o Abs. 1). Freiwillig: Ist am
					Abend nur eine der Personen da, darf die Sitzungsleitung sie als
					Vertretung zählen, auch ohne Vollmacht.
				</p>
				<!--
					**Auch hier zurücknehmbar** (Produktentscheid 27.08.2026). Ohne
					diese Wahl wäre der Weg eine Einbahnstrasse: Ein Auswahlknopf
					lässt sich nicht abwählen, und wer einmal jemanden eingetragen
					hat, käme nie mehr auf «niemand» zurück.
				-->
				<!--
					**Der freie Name aus der Zeit vor Migration 094 zählt mit**
					(27.08.2026, aus dem Code-Review). Eine solche Zeile trägt
					`representative_name` ohne `representative_party_id`; ohne diese
					Bedingung stünde «niemand bezeichnet» vorgewählt da, während die
					Tabelle daneben «vertreten durch X» meldet — und ein Absenden
					löschte den eingefrorenen Namen wortlos.
				-->
				{#if !(data.mitberechtigte[zeile.partyId] ?? []).some((m) => m.istVertreter) && zeile.representativeName}
					<p class="hilfe">
						Eingetragen ist heute der freie Name «{zeile.representativeName}». Wählen
						Sie eine der Personen, damit Anzeige und gedruckte Listen dasselbe sagen.
					</p>
				{/if}
				<label>
					<input
						type="radio"
						name="mitgliedId"
						value=""
						{...angekreuzt(
							!(data.mitberechtigte[zeile.partyId] ?? []).some((m) => m.istVertreter) &&
								!zeile.representativeName
						)}
					/>
					niemand bezeichnet
				</label>
				{#each data.mitberechtigte[zeile.partyId] as m (m.partyId)}
					<label>
						<input
							type="radio"
							name="mitgliedId"
							value={m.partyId}
							{...angekreuzt(m.istVertreter)}
						/>
						{m.displayName}
					</label>
				{/each}
				<button type="submit" class="leise">Übernehmen</button>
			</form>
		</details>
	{/if}

	<!--
		**Mitberechtigte pflegen** (26.08.2026, Aufgabe 4).

		Der Weg musste in diese Aufgabe, weil zwei Absagen ihn nennen:
		`pruefeHakenUmlegbar` («Nehmen Sie diese zuerst weg») und seit
		heute auch `pruefeZeileTilgbar` an der Hülle. Ohne ihn wäre eine
		Hülle mit Mitberechtigten weder umzuwidmen noch zu tilgen — für
		immer.

		**Und das Gegenstück dazu**: Wer nur wegnehmen kann, kommt aus
		einer falschen Erfassung nicht heraus. Aufgenommen wird eine
		bestehende Eigentümerzeile; neue Menschen entstehen unter
		«Eigentümer erfassen», sonst gäbe es zwei Wege zu einer Zeile.

		Der Kasten ist nach Fragen geordnet, nicht nach Platz
		(`docs/gestaltung.md`): erst «wer gehört dazu», dann «wohin geht
		die Einladung».
	-->
	{#if zeile.isCommunity}
		{@const mitglieder = data.mitberechtigte[zeile.partyId] ?? []}
		<details
			class="angaben"
			{...aufgeklappt(form?.quelle === 'mitberechtigte' && form.parteiId === zeile.partyId)}
		>
			<summary>Mitberechtigte</summary>

			{#if mitglieder.length === 0}
				<!--
					**Auch die Hülle ohne Eintrag braucht diesen Weg**
					(26.08.2026, aus dem Code-Review). Zeilen aus der Zeit vor
					Migration 094 und alle aus der Übernahme tragen den Haken
					ohne eine einzige `party_member`-Zeile. Hinge der Kasten an
					«hat schon Mitglieder», gäbe es für sie keinen Weg, jemanden
					einzutragen — und der Haken lässt sich im Berichtigen-Formular
					auch nicht mehr wegnehmen, er reist dort nur verborgen mit.
				-->
				<p class="hilfe">
					Hier ist niemand einzeln eingetragen. Tragen Sie die Personen ein,
					damit jede ihre eigene Einladung bekommt (ZGB Art. 712n).
				</p>
			{:else}
				<p class="hilfe">
					Wer an dieser Einheit berechtigt ist. Die Stimme bleibt eine — sie
					hängt an dieser Zeile, nicht an den Personen.
				</p>
				<ul class="mitberechtigtenpflege">
					{#each mitglieder as m (m.partyId)}
						<li>
							<span class="wer">{m.displayName}</span>
							<form method="POST" action="?/mitberechtigtenEntfernen">
								<input type="hidden" name="parteiId" value={zeile.partyId} />
								<input type="hidden" name="mitgliedId" value={m.partyId} />
								<Rueckfrage
									beschriftung="Wegnehmen"
									zeichen="kreuz"
									ton="warnung"
									frage="«{m.displayName}» aus «{zeile.displayName}» nehmen?"
									folge="Die Eigentümerzeile bleibt bestehen. Eine eigene Einladung nach ZGB Art. 712n bekommt diese Person danach aber nicht mehr."
									bestaetigen="Wegnehmen"
								/>
							</form>
							<!--
								**Die Angaben stehen auf der Seite dieser Person, nicht hier**
								(Auftraggeber, 27.08.2026). Vorher war es ein Ausklapper **im**
								Ausklapper «Mitberechtigte», und «Angaben berichtigen» stand
								damit dreimal auf derselben Fläche: einmal für die Hülle,
								einmal je Person.

								Ein Mitberechtigter **ist** eine gewöhnliche Eigentümerzeile
								dieser Gemeinschaft und hat dieselbe Seite wie jede andere.
								Damit steht das Formular genau einmal je Gegenstand, und der
								Weg dorthin ist derselbe wie in der Liste.

								**Warum es den Weg überhaupt braucht:** Diese Personen stehen
								nicht in der Tabelle, weil sie keine Einheit halten, und
								`party.email` trägt die Einladung nach ZGB Art. 712n.
							-->
							<a
								class="bearbeiten"
								href="/gemeinschaften/{data.gemeinschaft.id}/eigentuemer/{m.partyId}"
							>
								Angaben ändern
							</a>
						</li>
					{/each}
				</ul>
			{/if}

			<form method="POST" action="?/mitberechtigtenAufnehmen" class="felder">
				<input type="hidden" name="parteiId" value={zeile.partyId} />
				<label class="voll">
					Weitere Person aufnehmen
					<Suchauswahl
						name="mitgliedId"
						beschriftung="Person"
						leerText="— wählen —"
						eintraege={moeglicheMitberechtigte(zeile.partyId)}
					/>
					<span class="hilfe">
						Zur Wahl stehen bestehende Eigentümerzeilen dieser Gemeinschaft. Wer
						noch keine hat, wird zuerst rechts erfasst.
					</span>
				</label>
				<button type="submit" class="leise">Aufnehmen</button>
			</form>

			{#if mitglieder.length > 0}
				<form method="POST" action="?/zustelladresseSetzen" class="vertretung">
					<input type="hidden" name="parteiId" value={zeile.partyId} />
					<p class="hilfe">
						Wohin geht die Einladung? Ohne gemeldete Zustelladresse an alle
						einzeln — so will es ZGB Art. 712n.
					</p>
					<label>
						<input
							type="radio"
							name="mitgliedId"
							value=""
							{...angekreuzt(!mitglieder.some((m) => m.istZustelladresse))}
						/>
						an alle einzeln
					</label>
					{#each mitglieder as m (m.partyId)}
						<label>
							<input
								type="radio"
								name="mitgliedId"
								value={m.partyId}
								{...angekreuzt(m.istZustelladresse)}
							/>
							nur an {m.displayName}
						</label>
					{/each}
					<button type="submit" class="leise">Übernehmen</button>
				</form>
			{/if}
		</details>
	{/if}

	{#if !data.hatteVersammlung && zeile.einheiten.length === 0 && !mitberechtigteZeilen.has(zeile.partyId) && (data.mitberechtigte[zeile.partyId] ?? []).length === 0}
		<!--
			**Die leere Zeile** (23.08.2026, Prüflauf II). Sie hält
			nichts, gehört zu niemandem und war bis heute
			unauslöschlich: Haus B führte sechzehn Zeilen für vierzehn
			Einheiten, zwei davon Karteileichen aus einer doppelten
			Erfassung.

			Der Knopf steht nur da, wo der Server ihn auch annimmt —
			keine Einheit, keine Person, keine Versammlung gewesen.
			Sonst wäre er ein Angebot, das in eine Absage führt.
		-->
		<span class="tilgen">
			<form method="POST" action="?/eigentuemerTilgen">
				<input type="hidden" name="parteiId" value={zeile.partyId} />
				<Rueckfrage
					beschriftung="Zeile tilgen"
					zeichen="kreuz"
					ton="warnung"
					frage="Eigentümerzeile «{zeile.displayName}» tilgen?"
					folge="Die Zeile verschwindet aus dieser Gemeinschaft. Sie hält keine Einheit und war an keiner Versammlung dabei. Ist eine Person dahinter, bleibt sie erfasst — mit allem, was sie anderswo hält."
					bestaetigen="Tilgen"
				/>
			</form>
		</span>
	{/if}

	{#if !data.hatteVersammlung && zeile.einheiten.length > 0}
		<span class="tilgen">
			{#each zeile.einheiten as e (e.unitId)}
				<form method="POST" action="?/zuordnungTilgen">
					<input type="hidden" name="unitId" value={e.unitId} />
					<!--
						**Ein Wort für einen Vorgang** (Bedienbarkeitsprüfung 05.09.2026,
						Befund 19): Der Knopf hiess «lösen», die Rückfrage fragte nach
						«tilgen», der bestätigende Knopf hiess «Tilgen» — dreimal
						dasselbe, dreimal anders benannt.

						«Tilgen» ist das richtige Wort: Die Zuordnung ist danach weg, als
						hätte es sie nie gegeben. «Lösen» heisst in dieser Anwendung
						etwas anderes, nämlich eine Verbindung trennen, bei der beide
						Seiten bleiben («Aus der Versammlung lösen» am gemeinsamen
						Abend).
					-->
					<Rueckfrage
						beschriftung="«{e.label}» tilgen"
						zeichen="kreuz"
						ton="warnung"
						frage="Zuordnung von «{e.label}» tilgen?"
						folge="Die Zuordnung wird entfernt, als hätte es sie nie gegeben — kein Eigentümerwechsel im Protokoll. Gab es vorher einen anderen Eigentümer, gilt er wieder."
						bestaetigen="Tilgen"
					/>
				</form>
			{/each}
		</span>
	{/if}
</section>

<style>
	/* Feld und Knopf nebeneinander im Ausklapper; auf dem Telefon untereinander. */
	.archivzeile {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		margin-top: 0.6rem;
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
	/*
		**Jede Person ein eigener Kasten, jeder Kasten dasselbe Raster.** Damit
		sieht die Maske bei zwei Beteiligten aus wie bei fünf — dieselbe Lehre wie
		bei den Wertquoten der Einheitenkachel: Läge alles in einem Raster, hinge
		die Anordnung an der Zahl der Beteiligten.
	*/
	/* Kasten und Kopfzeile einer Person stehen in `Personenzeile.svelte`. */
	.weitere {
		margin-top: 0.75rem;
	}
	/* Der Name der bestehenden Zeile steht jetzt in `Personenzeile.svelte`. */
	.eintragen {
		margin-top: 0.9rem;
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
		Die Wahl steht untereinander, jede Zeile mit voller Tippfläche. `.kasten`
		aus `app.css` greift hier nicht: Die Regel ist auf ein **direktes** Kind
		eines `.felder`-Rasters festgeschrieben, und dieses Formular ist keines.
	*/
	.vertretung {
		display: flex;
		flex-direction: column;
		align-items: start;
		gap: 0.2rem;
		margin-top: 0.4rem;
	}
	.vertretung label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: var(--ziel-min);
		font-size: 0.9rem;
	}
	.vertretung .hilfe {
		margin: 0 0 0.3rem;
		max-width: var(--lesebreite);
	}
	button.leise {
		background: none;
		color: var(--text-leise);
		border: 1px solid var(--linie);
		font-weight: 400;
		padding: 0 0.9rem;
	}
	.hilfe {
		display: block;
		font-size: 0.875rem;
		color: var(--text-leise);
		font-weight: 400;
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
	/* Name links, Rückweg rechts — auf schmalem Schirm untereinander. */
	.mitberechtigtenpflege {
		margin: 0.35rem 0 0.75rem;
		padding: 0;
		list-style: none;
	}
	.mitberechtigtenpflege li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		padding: 0.2rem 0;
	}
	/* Der Name nimmt den Platz, die zwei Wege stehen rechts daneben. */
	.mitberechtigtenpflege .wer {
		flex: 1 1 8rem;
	}
	/* Der Weg zur Seite der Person steht rechts neben «Wegnehmen». */
	.bearbeiten {
		white-space: nowrap;
		font-size: 0.85rem;
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
	/*
	 * Der Weg zum Tilgen steht klein unter den Einheiten — er wird selten
	 * gebraucht und darf die Zeile nicht dominieren.
	 */
	.tilgen {
		display: block;
		font-size: 0.85rem;
		margin-top: 0.25rem;
	}
	.angaben {
		margin-top: 0.25rem;
	}
	/* Kein `display: flex` am summary (Stylelint-Regel `versammlung/dreieck-am-summary`). */
	.angaben summary {
		cursor: pointer;
		font-size: 0.85rem;
		min-height: var(--ziel-min);
		padding: 0.7rem 0;
	}

	.klein {
		margin: 0 0 0.35rem;
		font-size: 0.9rem;
		color: var(--text-leise);
	}

	/* Die Wege stehen unter dem Bestand, mit einer Haarlinie dazwischen. */
	.wege {
		margin-top: 1.5rem;
		border-top: 1px solid var(--linie);
		padding-top: 1rem;
	}
</style>
