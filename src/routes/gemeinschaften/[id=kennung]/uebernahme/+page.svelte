<script lang="ts">
	import { page } from '$app/state';
	import { anfangswert } from '$lib/felder';
	import { datumLang } from '$lib/domain/datum';
	import Meldung from '$lib/components/Meldung.svelte';
	import Suchauswahl from '$lib/components/Suchauswahl.svelte';
	let { data, form } = $props();

	const plaene = $derived(form?.plaene ?? []);

	/**
	 * Woher die Stammdaten kommen — **eines von beidem**, nicht beides nebeneinander.
	 *
	 * Die Wahl steht vor den Feldern, weil sie entscheidet, welche überhaupt
	 * gelten (`docs/gestaltung.md`). Ist immotool nicht eingerichtet oder führt es
	 * keine Liegenschaft, gibt es nichts zu wählen und die Datei steht allein da:
	 * Ein Schalter mit einer einzigen bedienbaren Stellung ist eine Frage, die
	 * sich nicht stellt.
	 */
	const zurWahl = $derived(data.immotool.eingerichtet && data.immotool.liegenschaften.length > 0);
	// Vorgabe ist der bequemere Weg. Steht er nicht zur Wahl, greift überall
	// `&& zurWahl` und die Datei führt — deshalb braucht der Anfangswert den
	// Bestand nicht zu kennen und veraltet auch nicht, wenn die Seite für eine
	// andere Gemeinschaft neu geladen wird.
	/*
		**Der Link sagt, was er meint** (23.08.2026, Prüflauf II, A-04). Von der
		Einheitenseite führt «Aus einer Datei übernehmen» hierher — und die
		Seite stand auf «Aus immotool». Wer dem Link folgte, musste den Schalter
		von Hand umlegen, obwohl er ihn eben schon gewählt hatte.

		Die Quelle reist deshalb in der Adresse mit. Ohne Angabe bleibt es beim
		bequemeren Weg.
	*/
	let quelle = $state<'immotool' | 'datei'>(
		page.url.searchParams.get('quelle') === 'datei' ? 'datei' : 'immotool'
	);

	function ueberschrift(art: string): string {
		return art === 'eigentuemer' ? 'Eigentümer' : 'Einheiten';
	}

	/** Wie viele Zeilen nach Abzug der fehlerhaften übrig bleiben. */
	const uebernehmbar = $derived(
		(form?.plaene ?? []).reduce(
			(summe: number, p: { zusammenfassung: { neu: number; geaendert: number } }) =>
				summe + p.zusammenfassung.neu + p.zusammenfassung.geaendert,
			0
		)
	);

	function vorgangInWorten(v: string): string {
		return (
			{ neu: 'neu', geaendert: 'geändert', unveraendert: 'unverändert', fehlerhaft: 'fehlerhaft' }[
				v
			] ?? v
		);
	}

	function bezeichnung(z: { satz: unknown }): string {
		const satz = z.satz as { displayName?: string; label?: string } | null;
		if (!satz) return '—';
		return satz.displayName ?? satz.label ?? '—';
	}

	/**
	 * Die Felder unter dem Namen, den sie auf dem Bildschirm tragen.
	 *
	 * Bisher stand hier der Bezeichner aus dem Kern — `representativeName`,
	 * `isCommunity`. Wer die Vorschau liest, entscheidet damit über seine
	 * Stammdaten und liest englische Feldnamen aus einer Datenstruktur, die er
	 * nie zu sehen bekommen sollte. Was nicht in der Tabelle steht, erscheint
	 * unverändert — eine Quotenspalte heisst `quote.aufzug` und sagt das schon
	 * selbst.
	 */
	const FELDNAMEN: Record<string, string> = {
		displayName: 'Anzeigename',
		kind: 'Art',
		isCommunity: 'Gemeinschaft',
		representativeName: 'Vertretung',
		authentikSubject: 'Authentik-Kennung',
		label: 'Bezeichnung',
		countsAsHead: 'Kopfstimme',
		nutzniessung: 'Nutzniessung',
		// **Der Eigentümerwechsel** (01.09.2026): Er stand bis dahin nirgends —
		// die Vorschau las das Eigentum gar nicht, und eine Handänderung galt
		// als «unverändert».
		eigentuemer: 'Eigentümer'
	};

	/**
	 * Eine Kennung ist 36 Zeichen lang und in der Zeile nicht zu lesen.
	 *
	 * Gezeigt werden die ersten acht — genug, um zwei Kennungen auseinanderzu-
	 * halten, und mehr braucht die Vorschau nicht: Verglichen wird drüben, nicht
	 * mit dem Auge.
	 */
	function kurz(wert: unknown): string {
		if (wert === null || wert === undefined || wert === '') return '—';
		const text = String(wert);
		return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(text) ? `${text.slice(0, 8)}…` : text;
	}

	function aenderungsText(a: Record<string, { vorher: unknown; nachher: unknown }>): string {
		return Object.entries(a)
			.map(([feld, w]) => `${FELDNAMEN[feld] ?? feld}: ${kurz(w.vorher)} → ${kurz(w.nachher)}`)
			.join(', ');
	}
</script>

<h1>Stammdaten übernehmen</h1>

{#if form?.ergebnis}
	<!--
		**Die Meldung nannte Zahlen ohne Gegenstand** (23.08.2026, A-45): «15
		angelegt, 0 geändert». Wer nach einer Übernahme von Eigentümern UND
		Einheiten hierher kommt, weiss nicht, wovon die Rede ist — der Prüfer
		notierte «keine Erfolgsmeldung», obwohl eine dastand.
	-->
	<!--
		**Ein stehender Kasten, keine Einblendung** (23.08.2026, A-45). `Meldung`
		mit `ton="gut"` reicht den Text an den Einblender weiter und lässt die
		Stelle leer — sechs Sekunden, dann ist er weg. Für «Einheit angelegt» ist
		das richtig. Nach einer Übernahme von fünfzehn Zeilen sieht die Seite
		danach aus wie vorher, und der Prüfer notierte «keine Erfolgsmeldung,
		als hätte man nie etwas getan».

		Deshalb hier ein Kasten, der bleibt: Was übernommen wurde, will nachgelesen
		werden, und die Wege zu den Daten gehören daneben.
	-->
	<section class="uebernommen">
		<h2>Übernommen</h2>
		<p>
			{form.ergebnis.angelegt}
			{form.ergebnis.angelegt === 1 ? 'Zeile' : 'Zeilen'} neu angelegt, {form.ergebnis.geaendert}
			geändert{#if form.ergebnis.uebersprungen > 0}, <strong
					>{form.ergebnis.uebersprungen} übersprungen</strong
				>{/if}.
		</p>
		<!--
			**Berührte Archivzeilen werden genannt** (25.08.2026). Sie bleiben im
			Archiv — die Übernahme ändert nur ihre Angaben. Ohne diesen Satz sucht
			jemand hinterher eine Zeile aus der Datei und findet sie nirgends.
		-->
		{#if form.ergebnis.imArchiv > 0}
			<p class="warnung">
				{form.ergebnis.imArchiv}
				{form.ergebnis.imArchiv === 1 ? 'Zeile liegt' : 'Zeilen liegen'} im Archiv und
				{form.ergebnis.imArchiv === 1 ? 'bleibt' : 'bleiben'} dort. Wenn
				{form.ergebnis.imArchiv === 1 ? 'sie' : 'sie'} wieder in der Liste stehen
				{form.ergebnis.imArchiv === 1 ? 'soll' : 'sollen'}, holen Sie
				{form.ergebnis.imArchiv === 1 ? 'sie' : 'sie'} auf der Eigentümerseite hervor.
			</p>
		{/if}
		<p class="hilfe">
			Die Stammdaten stehen jetzt unter
			<a href="/gemeinschaften/{data.gemeinschaft.id}/einheiten">Einheiten und Wertquoten</a>
			und
			<a href="/gemeinschaften/{data.gemeinschaft.id}/eigentuemer">Eigentümer und Stimmkraft</a>.
			Gehen Sie sie einmal durch: Was die Datei nicht führt — Kontaktdaten etwa —, fehlt jetzt
			auch hier.
		</p>
	</section>
{:else if form?.warnungQuoten}
	<!--
		**Die Absage stand ausserhalb des Sichtfelds** (23.08.2026, Prüflauf II,
		A-41). Der Klick auf «Übernehmen» kam mit HTTP 409 zurück, die Seite sah
		praktisch gleich aus, und die Begründung stand bei 1695 von 1939 px — kein
		Sprung dorthin, keine Meldung oben. Man klickt und glaubt, nichts sei
		passiert.

		Die Meldung steht jetzt dort, wo der Blick nach einem Klick hingeht, und
		führt an die Stelle, an der es weitergeht.
	-->
	<Meldung ton="warnung" marke={form}>
		<strong>Noch nicht übernommen.</strong> Die Stammquote ginge nach dieser Übernahme nicht
		auf. <a href="#zweitfrage">Weiter unten steht, was das heisst</a> — dort bestätigen Sie es
		ausdrücklich oder bereinigen zuerst die Datei.
	</Meldung>
{:else if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{/if}

{#if plaene.length === 0}
	{#if zurWahl}
		<fieldset class="wahlen">
			<legend>Woher kommen die Stammdaten?</legend>
			<label class="wahl">
				<input type="radio" name="quelle" value="immotool" bind:group={quelle} />
				<span>
					<strong>Aus immotool</strong>
					<span class="hilfe">
						Eigentümer, Einheiten und Wertquoten einer Liegenschaft, so wie sie dort am
						Stichtag stehen.
					</span>
				</span>
			</label>
			<label class="wahl">
				<input type="radio" name="quelle" value="datei" bind:group={quelle} />
				<span>
					<strong>Aus einer Datei</strong>
					<span class="hilfe">
						Excel (.xlsx) oder CSV. Eine Datei je Art — Eigentümer und Einheiten.
					</span>
				</span>
			</label>
		</fieldset>
	{/if}

	{#if data.immotool.fehler}
		<p class="meldung warnung" role="status">
			{data.immotool.fehler} Die Übernahme aus einer Datei und die Erfassung von Hand sind davon
			nicht betroffen.
		</p>
	{/if}

	{#if quelle === 'immotool' && zurWahl}
		<p class="einleitung">
			Geschrieben wird nichts, bevor Sie die Vorschau gesehen und bestätigt haben. Übernommen
			werden Eigentümer, Einheiten, Wertquoten und die Verteiler, die es hier auch gibt — nicht
			die Nutzniessung und nicht, wer für eine Gemeinschaft die Stimme ausübt.
		</p>

		<!--
			Untereinander statt nebeneinander: Die beiden Felder tragen verschieden
			lange Hilfetexte, und in einer Zeile mit `align-items: flex-end` standen
			ihre Beschriftungen dadurch auf zwei Linien. Gemessen am 13.08.2026.
		-->
		<form method="POST" action="?/ausImmotool" class="untereinander kachel">
			<label>
				Liegenschaft in immotool
				<Suchauswahl
					name="liegenschaft"
					beschriftung="Liegenschaft"
					leerText="— wählen —"
					pflicht
					eintraege={data.immotool.liegenschaften.map((l) => ({
						wert: l.id,
						text:
							(l.short_code ? `${l.short_code} — ` : '') +
							`${l.name} (${l.mandant}, ${l.einheiten} ` +
							`${l.einheiten === 1 ? 'Einheit' : 'Einheiten'})`
					}))}
				/>
			</label>
			<label class="schmal">
				Stichtag
				<input type="date" name="stichtag" {...anfangswert(data.heute)} required />
				<span class="hilfe">
					immotool führt Eigentum mit Gültigkeitszeitraum. Übernommen wird, wer an diesem Tag
					eingetragen ist — und ab diesem Tag gilt die Zuordnung auch hier.
				</span>
			</label>
			<div class="knoepfe">
				<button type="submit">Holen und prüfen</button>
			</div>
		</form>
	{:else}
		<!--
			**Jeder Weg sagt, was ER überträgt** (23.08.2026, Prüflauf II, A-10). Der
			Satz «nicht die Nutzniessung» gilt für den Weg aus immotool und stand
			auch beim Dateiweg im Blick — der die Nutzniessung sehr wohl übernimmt.
			Der Prüfer las ihn, spielte eine Datei mit `usufruct_holder` ein und fand
			die Nutzniessung danach vollständig erfasst.
		-->
		<p class="einleitung">
			Das Format entspricht dem des Vorgängerprojekts: eine Datei für Eigentümer mit der Spalte
			<code>voter_ref</code>, eine für Einheiten mit <code>holding_ref</code>. <strong>Wählen Sie
			beide auf einmal</strong> — erkannt werden sie an den Spaltennamen, und die Eigentümer
			kommen von selbst zuerst an die Reihe. Trennzeichen und Kodierung müssen nicht
			eingestellt werden.
		</p>
		<p class="einleitung">
			Übernommen werden Eigentümer, Einheiten, Wertquoten, die Verteiler <em>und</em> die
			Nutzniessung, soweit die Datei die Spalten dafür führt. Geschrieben wird nichts, bevor
			Sie die Vorschau gesehen und bestätigt haben. <strong>Jede Einheit braucht dabei einen
			Eigentümer</strong> (<code>owner_voter_ref</code>) — anders als beim Erfassen von Hand,
			wo eine Einheit vorerst ohne bleiben darf.
		</p>

		<form method="POST" action="?/pruefen" enctype="multipart/form-data" class="felder kachel">
			<label class="breit">
				Excel- oder CSV-Datei
				<input
					type="file"
					name="datei"
					accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
					multiple
					required
				/>
			</label>
			<button type="submit">Prüfen</button>
		</form>

		<details class="format">
			<summary>Welche Spalten gelesen werden</summary>
			<h3>Eigentümer</h3>
			<ul>
				<li><code>voter_ref</code> — Kennung, damit eine zweite Übernahme denselben Datensatz wiederfindet statt eine Kopie anzulegen</li>
				<li>
					<code>display_name</code>, <code>person_names</code> (getrennt durch <code>|</code>)
					— ab zwei Personen entsteht eine Zeile «Gemeinschaftliches Eigentum» und
					darunter je eine Zeile pro Person. Die Einheit und damit die eine Stimme hält
					die gemeinschaftliche Zeile (ZGB Art. 712o Abs. 1); die Einladung geht an alle
					einzeln (Art. 712n). Ohne <code>display_name</code> heisst sie «Anna Muster und
					Beat Muster».
				</li>
				<li><code>ownership_type</code> — alleineigentum, miteigentum, gesamteigentum</li>
				<li>
					<code>party_type</code> — <code>natural</code> (Mensch) oder <code>legal</code>
					(Firma, Verein, Stiftung). Leer heisst <code>natural</code>.
				</li>
				<li>
					<code>legal_representatives</code> — wer die Stimme ausübt. Ab zwei Personen muss
					es eine von ihnen sein; fehlt die Angabe, gilt die erstgenannte.
				</li>
				<li><code>person_count</code></li>
				<li>
					<code>person_authentik</code> — die Authentik-Kennung (UUID) der Person, die sich
					später selbst anmelden können soll. Wahlfrei, höchstens eine je Zeile; eine
					angebundene Verwaltungssoftware bringt sie mit.
				</li>
			</ul>
			<h3>Einheiten</h3>
			<ul>
				<li>
					<code>holding_ref</code>, <code>label</code> — Kennung und Bezeichnung
				</li>
				<li>
					<code>holding_type</code> — <code>unit</code> (Wohnung, Gewerbe) oder
					<code>parking</code> (Einstellplatz, Kellerabteil und Ähnliches). Leer heisst
					<code>unit</code>.
				</li>
				<li><code>owner_voter_ref</code> — verweist auf die Kennung des Eigentümers</li>
				<li><code>quota_units</code> — die Stammquote</li>
				<li>
					<code>quota_&lt;schlüssel&gt;</code> — je weiterer Verteiler, etwa
					<code>quota_lift</code>. Leeres Feld heisst «nicht beteiligt».
				</li>
				<li>
					<code>counts_as_head</code> — trägt eine Kopfstimme: <code>true</code> oder
					<code>false</code>. Leer heisst <code>true</code>. Bei einem Nebenobjekt wirkt
					der Wert nur, wenn die Gemeinschaft Nebenobjekten überhaupt eine Kopfstimme
					zugesteht.
				</li>
				<li>
					<!--
						**Der Name, nicht die Kennung** (23.08.2026, Prüflauf II, A-11). Im
						Prüflauf stand in dieser Spalte «BNUT» — eine Referenz aus der
						Tabelle —, und die Anwendung schrieb daraufhin «zugunsten von BNUT»
						in einen Satz, der so ins Protokoll geht. Die Spalte nimmt einen
						Namen entgegen und kann ihn nicht nachschlagen; das gehört hier
						hingeschrieben, bevor jemand eine Kennung einträgt.
					-->
					<code>usufruct_holder</code> — der <strong>Name</strong> der nutzniessenden Person,
					so wie er im Protokoll stehen soll («Hedwig Berger-Stucki»). Eine Kennung aus
					Ihrer Tabelle wird <em>nicht</em> nachgeschlagen; sie stünde danach wörtlich im
					Satz.
				</li>
				<li>
					<code>usufruct_from</code>, <code>usufruct_to</code> — Beginn und Ende,
					<code>JJJJ-MM-TT</code>. Leeres Ende heisst «auf Weiteres».
				</li>
				<li><code>usufruct_agreement</code> — die Fundstelle der Vereinbarung</li>
			</ul>
		</details>
	{/if}
{:else}
	<h2>Vorschau: {form?.herkunft ?? 'Datei'}</h2>

	{#if form?.hinweise && form.hinweise.length > 0}
		<!--
			Was **nicht** in der Vorschau steht, kann die Vorschau nicht zeigen. Eine
			übergangene Einheit oder ein weggelassener Verteiler wäre sonst erst nach
			der Übernahme zu bemerken — an einer Wertquote, die nicht aufgeht.

			Die Überschrift nennt den Zeitpunkt, nicht die Art: Hier steht dreierlei
			nebeneinander — was wegbleibt, was in immotool widersprüchlich ist und
			was auf einem Vorgabewert landet. «Das kommt nicht mit» stimmte nur für
			das erste.
		-->
		<div class="meldung warnung">
			<p><strong>Bevor Sie übernehmen:</strong></p>
			<ul>
				{#each form.hinweise as h (h)}
					<li>{h}</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#each plaene as plan (plan.art)}
		{@const zeilen = plan.art === 'eigentuemer' ? plan.eigentuemer : plan.einheiten}
		<section class="teil">
			<h3>{ueberschrift(plan.art)}</h3>

			<p class="zusammenfassung">
				<span class="marke neu">{plan.zusammenfassung.neu} neu</span>
				<span class="marke geaendert">{plan.zusammenfassung.geaendert} geändert</span>
				<span class="marke">{plan.zusammenfassung.unveraendert} unverändert</span>
				{#if plan.zusammenfassung.fehlerhaft > 0}
					<span class="marke fehlerhaft">{plan.zusammenfassung.fehlerhaft} fehlerhaft</span>
				{/if}
			</p>

			<!--
				**Was gesagt gehört, ohne dass es jemanden aufhält** (27.08.2026,
				Aufgabe 6). Der Kasten darunter heisst «Diese Zeilen werden
				übersprungen» — dort stünde ein Hinweis, der genau das nicht meint,
				am falschen Platz. Hier steht, was die Übernahme absichtlich nicht
				anfasst: die Mitberechtigten einer Hülle.
			-->
			{#if plan.hinweise.length > 0}
				<div class="meldung warnung">
					<p><strong>Das bleibt, wie es ist:</strong></p>
					<ul>
						{#each plan.hinweise as h (h)}
							<li>{h}</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if plan.befunde.length > 0}
				<div class="meldung warnung">
					<p><strong>Diese Zeilen werden übersprungen:</strong></p>
					<ul>
						{#each plan.befunde as b (b.zeile + b.grund)}
							<li>
								Zeile {b.zeile}{#if b.spalte}, Spalte <code>{b.spalte}</code>{/if}: {b.grund}
							</li>
						{/each}
					</ul>
					<!--
						**Nur wenn es übrige gibt** (23.08.2026, Prüflauf II, A-40). Bei
						vierzehn von vierzehn fehlerhaften Zeilen stand hier «Die übrigen
						Zeilen bleiben übernehmbar» — es gab keine übrigen — und darunter
						ein aktiver Knopf «Übernehmen».
					-->
					{#if uebernehmbar > 0}
						<p class="hilfe">Die übrigen Zeilen bleiben übernehmbar.</p>
					{:else}
						<p class="hilfe">
							<strong>Damit bleibt nichts zum Übernehmen.</strong> Berichtigen Sie die Datei
							und laden Sie sie erneut.
						</p>
					{/if}
				</div>
			{/if}

			{#if plan.quotensummen.length > 0}
				<div class="meldung" class:warnung={plan.bringtQuotenAusDemGleichgewicht}>
					<p><strong>Wertquoten nach der Übernahme</strong></p>
					<ul>
						{#each plan.quotensummen as q (q.key)}
							<li>
								{q.key}: {q.summe} von {q.soll}
								{#if q.abweichung !== 0}
									— <strong
										>{Math.abs(q.abweichung)} {q.abweichung > 0 ? 'fehlen' : 'zu viel'}</strong
									>
								{:else}
									— geht auf
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if zeilen.length > 0}
				<div class="tabellenrahmen">
					<table>
						<thead>
							<tr>
								<!--
									Die Zeilennummer nur beim Dateiweg: Dort führt sie zur
									Fundstelle. Bei der Übernahme aus immotool gibt es keine Datei,
									in der sich nachschlagen liesse — die Zahl zeigte auf nichts.
								-->
								{#if form?.ausDatei}
									<th>Zeile</th>
								{/if}
								<th>Vorgang</th>
								<th>Bezeichnung</th>
								<th>Was sich ändert</th>
							</tr>
						</thead>
						<tbody>
							{#each zeilen as z (z.zeile)}
								<tr class={z.vorgang}>
									{#if form?.ausDatei}
										<td class="zahl">{z.zeile}</td>
									{/if}
									<!--
										**Der Schlüssel ist kein Wort** (23.08.2026, A-44). Hier stand
										«geaendert» und «unveraendert» — die technischen Werte ohne
										Umlaut, direkt unter der Zusammenfassung, die sie korrekt
										schreibt.
									-->
									<td>{vorgangInWorten(z.vorgang)}</td>
									<td>{bezeichnung(z)}</td>
									<td class="klein">
										{#if z.befund}
											{z.befund.grund}
										{:else if z.aenderungen}
											{aenderungsText(z.aenderungen)}
										{:else}
											—
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	{/each}

	<form method="POST" action="?/uebernehmen" class="bestaetigen">
		<!--
			Die Reihenfolge trägt: Eigentümer zuerst, dann die Einheiten, die über
			`owner_voter_ref` auf sie verweisen. Umgekehrt fände die Zuordnung
			niemanden — ohne Fehlermeldung, weil eine Einheit ohne Eigentümer ein
			zulässiger Zustand ist.
		-->
		{#each form?.inhalte ?? [] as inhalt, i (i)}
			<input type="hidden" name="inhalt" value={inhalt} />
		{/each}
		<!--
			Herkunft und Hinweise reisen mit: Kommt die Rückfrage wegen einer
			ungleichen Wertquote, muss weiter dastehen, was nicht mitkommt. Genau
			dann wird es gebraucht.
		-->
		<input type="hidden" name="ausDatei" value={form?.ausDatei ? 'true' : ''} />
		{#each form?.hinweise ?? [] as h, i (i)}
			<input type="hidden" name="hinweis" value={h} />
		{/each}
		<label class="schmal">
			Eigentum gültig ab
			<input
				type="date"
				name="stichtag"
				{...anfangswert(form?.stichtag ?? data.heute)}
				required
			/>
			<span class="hilfe">
				Ab wann die Zuordnung von Einheit zu Eigentümer gilt.
				<!--
					**Worauf sich die Spalte «Änderung» bezieht** (01.09.2026). Die
					Vorschau vergleicht den Eigentümer gegen den Stand eines Tages, und
					das ist beim ersten Rechnen der heutige — gewählt wird der Stichtag
					erst hier. Wer ihn ändert, verschiebt damit auch, was als Wechsel
					gilt; gerechnet wird beim Übernehmen neu. Das gehört dazugesagt,
					statt eine Zahl stehen zu lassen, die sich unter der Hand ändert.
				-->
				{#if form?.vorschautag}
					Die Spalte «Änderung» oben vergleicht den Eigentumsstand vom
					{datumLang(form.vorschautag)}; beim Übernehmen gilt der Tag, der hier steht.
				{/if}
			</span>
		</label>

		{#if form?.warnungQuoten}
			<!-- Zweite Bestätigung. Ein stilles Durchlaufen findet nie statt. -->
			<div class="meldung warnung zweitfrage" id="zweitfrage">
				<p>
					<strong>Die Stammquote geht nach dieser Übernahme nicht auf.</strong> Solange sie nicht
					aufgeht, ist jede Zählung nach Wertquoten falsch — und zwar unauffällig falsch, weil sie
					trotzdem eine Zahl liefert.
				</p>
				<label class="kasten">
					<input type="checkbox" name="trotzUngleichgewicht" value="true" required />
					Ich übernehme trotzdem und bereinige die Wertquoten vor der nächsten Versammlung.
				</label>
			</div>
		{/if}

		<div class="knoepfe">
			<button type="submit" disabled={uebernehmbar === 0}>Übernehmen</button>
			<a href="/gemeinschaften/{data.gemeinschaft.id}/uebernahme">Von vorn</a>
		</div>
	</form>
{/if}

<style>

	.uebernommen {
		border: 1px solid var(--akzent);
		border-radius: var(--radius);
		padding: 0.9rem 1.1rem;
		margin-bottom: 1.25rem;
	}

	.uebernommen h2 {
		margin: 0 0 0.3rem;
		font-size: 1.1rem;
	}

	.uebernommen p {
		margin: 0.25rem 0 0;
	}

	code {
		font-family: ui-monospace, monospace;
		font-size: 0.9em;
		background: var(--flaeche-2);
		padding: 0.05em 0.3em;
		border-radius: 0.25rem;
	}

	.meldung {
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		background: var(--flaeche);
		margin: 1rem 0;
	}

	.meldung.gut {
		background: color-mix(in srgb, var(--akzent) 15%, transparent);
	}

	.meldung.fehler {
		background: color-mix(in srgb, var(--fehler) 12%, transparent);
		color: var(--fehler);
	}

	.meldung.warnung {
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
	}

	.meldung p {
		margin: 0 0 0.4rem;
	}

	.meldung ul {
		margin: 0;
		padding-left: 1.25rem;
	}

	.wahlen {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 0.75rem 1rem 1rem;
		margin: 1.25rem 0 0;
		max-width: 46rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	legend {
		font-size: 0.9rem;
		font-weight: 550;
		padding: 0 0.3rem;
	}

	.wahl {
		flex-direction: row;
		align-items: flex-start;
		gap: 0.6rem;
		font-weight: 400;
		min-height: var(--ziel-min);
	}

	.wahl span {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.teil {
		margin-top: 1.5rem;
	}

	.teil h3 {
		font-size: 1rem;
		margin: 0;
	}

	.zusammenfassung {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin: 0.6rem 0 1rem;
	}

	.marke {
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		background: var(--flaeche-2);
		font-size: 0.9rem;
	}

	.marke.neu {
		background: color-mix(in srgb, var(--akzent) 20%, transparent);
	}

	.marke.geaendert {
		background: color-mix(in srgb, var(--warnung) 20%, transparent);
	}

	.marke.fehlerhaft {
		background: color-mix(in srgb, var(--fehler) 15%, transparent);
		color: var(--fehler);
	}

	.tabellenrahmen {
		overflow-x: auto;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		margin: 1rem 0;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	th,
	td {
		text-align: left;
		padding: 0.45rem 0.75rem;
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

	tr.fehlerhaft td {
		color: var(--fehler);
	}

	tr.unveraendert td {
		color: var(--text-leise);
	}

	.zahl {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.klein {
		font-size: 0.85rem;
	}

	.felder,
	.bestaetigen {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		align-items: flex-end;
		margin-top: 1.25rem;
	}

	.bestaetigen,
	.untereinander {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.9rem;
		max-width: 46rem;
		margin-top: 1.25rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.9rem;
		font-weight: 550;
	}

	.breit {
		flex: 2 1 16rem;
	}

	.schmal {
		max-width: 20rem;
	}

	.kasten {
		flex-direction: row;
		align-items: flex-start;
		gap: 0.5rem;
		font-weight: 400;
		min-height: var(--ziel-min);
	}

	.hilfe {
		font-size: 0.875rem;
		color: var(--text-leise);
		font-weight: 400;
	}

	.zweitfrage {
		margin-top: 0.5rem;
	}

	/*
	 * **`:global(…)`, weil das Auswahlfeld jetzt in `Suchauswahl.svelte` steht.**
	 * Svelte gestaltet nur Elemente, die in dieser Datei stehen; ohne `:global`
	 * fiele die Regel lautlos aus, und das Feld sähe anders aus als seine
	 * Nachbarn. Die Verankerung an der Klasse hält sie trotzdem auf dieser Seite.
	 */
	input[type='date'],
	.untereinander :global(select),
	.untereinander :global(.auswahlsuche) {
		min-height: var(--ziel-min);
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--grund);
		color: var(--text);
		font: inherit;
		font-weight: 400;
	}

	input[type='file'] {
		font: inherit;
		font-weight: 400;
		padding: 0.4rem 0;
	}

	input[type='checkbox'],
	input[type='radio'] {
		width: 1.1rem;
		height: 1.1rem;
		margin-top: 0.15rem;
		flex: none;
	}

	.knoepfe {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 0.75rem;
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

	.format {
		margin-top: 2rem;
		max-width: 46rem;
	}

	summary {
		cursor: pointer;
		min-height: var(--ziel-min);
		padding: 0.7rem 0;
		color: var(--text-leise);
	}

	.format h3 {
		font-size: 0.95rem;
		margin: 1rem 0 0.4rem;
	}
</style>
