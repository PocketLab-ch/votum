<script lang="ts">
	/**
	 * Ein Eigentümer über die Gemeinschaften hinweg.
	 *
	 * Die Zeile in der jeweiligen Gemeinschaft entsteht bei der Zuordnung von
	 * selbst. Sie bleibt nötig — sie trägt die Stimmkraft dort, und die Zählweise
	 * ist von Gemeinschaft zu Gemeinschaft verschieden.
	 */
	import { datumLang, tagVon } from '$lib/domain/datum';
	import { anfangswert, aufgeklappt } from '$lib/felder';
	import Meldung from '$lib/components/Meldung.svelte';
	import Suchauswahl from '$lib/components/Suchauswahl.svelte';
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';
	import Rueckfragefenster from '$lib/components/Rueckfragefenster.svelte';

	let { data, form } = $props();
	const p = $derived(data.person);
</script>

<p class="pfad"><a href="/personen">Personen</a></p>
<h1>{p.name}</h1>
<p class="klein">
	{p.art === 'legal' ? 'Juristische Person' : 'Natürliche Person'}{p.email ? ` · ${p.email}` : ''}{p.telefon
		? ` · ${p.telefon}`
		: ''}
</p>
{#if p.adresse}<p class="klein">{p.adresse}</p>{/if}

<!--
	**Gehört in eine gemeinschaftliche Zeile** (26.08.2026, Aufgabe 4).

	Ohne diesen Satz sagt die Seite «Diesem Eigentümer ist noch keine Einheit
	zugeordnet» — richtig gerechnet und trotzdem irreführend: Die Einheit hält
	die Hülle, die Person ist an ihr mitberechtigt (ZGB Art. 712o Abs. 1). Wer
	das liest, hält die Zeile für eine Karteileiche und räumt sie weg.
-->
{#each data.huellen as h (h.huellePartyId)}
	<p class="klein">
		Gehört in «<a href="/gemeinschaften/{h.stwegId}/eigentuemer">{h.huelle}</a>» ({h.gemeinschaft})
		— gemeinschaftliches Eigentum, eine Stimme.{#if h.istVertreter}
			Diese Person übt sie aus.{/if}
	</p>
{/each}

{#if form?.rueckfrage}
	<Rueckfragefenster
		frage="«{form.rueckfrage.einheit}» ab dem {datumLang(form.rueckfrage.ab)} {form.rueckfrage.person} zuordnen?"
		zurueck="/personen/{p.id}?stichtag={data.stichtag}"
		marke={form}
	>
		{#snippet inhalt()}
			<!--
				**Die Gemeinschaft zuerst** (Code-Review 06.09.2026). Sie betrifft
				nicht den Datenbestand, sondern die Stimme: Wer die Einheit dem
				einzelnen Mitglied zuordnet, zerlegt eine gemeinsame Stimme in eine
				einzelne. Was darunter steht, sagt nur, was dabei verdrängt wird.
			-->
			{#if form.rueckfrage.teilEinerGemeinschaft?.length}
				<p>
					<strong>{form.rueckfrage.person}</strong> gehört zu
					{form.rueckfrage.teilEinerGemeinschaft.join(', ')}. Die Einheit geht damit an
					<strong>die einzelne Person</strong>, nicht an die Gemeinschaft — für die
					Abstimmung zählt dann ihre Stimme allein.
				</p>
			{/if}
			{#if form.rueckfrage.bisherigerEigentuemer}
				<p>
					Am {datumLang(form.rueckfrage.ab)} ist <strong>{form.rueckfrage.bisherigerEigentuemer}</strong>
					als Eigentümer eingetragen. Die Zuordnung wechselt zu
					<strong>{form.rueckfrage.person}</strong>.
				</p>
			{:else}
				<p>
					Die Zuordnung wechselt ab dem {datumLang(form.rueckfrage.ab)} zu
					<strong>{form.rueckfrage.person}</strong>.
				</p>
			{/if}
			{#if form.rueckfrage.gekappt.length > 0 || form.rueckfrage.verdraengt.length > 0}
				<ul>
					{#each form.rueckfrage.gekappt as z (z.name + z.von)}
						<li>
							<strong>{z.name}</strong>: bisher ab {datumLang(z.von)}
							{z.bisherBis ? ` bis ${datumLang(z.bisherBis)}` : ' bis auf Weiteres'}, neu bis
							{datumLang(z.neuBis)}.
						</li>
					{/each}
					{#each form.rueckfrage.verdraengt as z (z.name + z.von)}
						<li>
							<strong>{z.name}</strong>: Der ganze Zeitraum ab {datumLang(z.von)}
							{z.bis ? ` bis ${datumLang(z.bis)}` : ' bis auf Weiteres'} entfällt.
						</li>
					{/each}
				</ul>
			{/if}
			<!--
				**Der Satz gilt nur, wo zwei Personen im Spiel sind** (01.09.2026).
				Wer den Stichtag derselben Zuordnung berichtigt, verdrängt sich
				selbst — «sollen beide zusammen Eigentümer sein» wäre dort eine Frage
				nach zwei Menschen, wo nur einer steht. Der Eigentümerweg
				unterscheidet das seit dem 26.08.2026 über dasselbe Merkmal.
			-->
			{#if form.rueckfrage.fremdeBetroffen}
				<p>
					Sollen beide zusammen Eigentümer sein, brechen Sie ab. Gemeinschaftliches Eigentum
					ist eine einzige Eigentümerzeile, nicht zwei Zuordnungen derselben Einheit.
				</p>
			{:else}
				<p>
					Es ist dieselbe Person: Die bestehende Zuordnung wird durch die neue ersetzt.
				</p>
			{/if}
		{/snippet}
		{#snippet handlung()}
			<form method="POST" action="?/zuordnen">
				<input type="hidden" name="unitId" value={form.rueckfrage.unitId} />
				<input type="hidden" name="ab" value={form.rueckfrage.ab} />
				<input type="hidden" name="notiz" value={form.rueckfrage.notiz} />
				<input type="hidden" name="bestaetigt" value="true" />
				<button type="submit" class="ja" data-ton="warnung">Wechsel bestätigen</button>
			</form>
		{/snippet}
	</Rueckfragefenster>
{:else if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.hinweis}
	<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
{/if}

<!--
	**Die Angaben sind änderbar** (22.08.2026, Befund A-03 des Prüflaufs). Bis
	dahin standen sie als reiner Text da, und im ganzen Servercode gab es kein
	`UPDATE person`: Ein Tippfehler im Namen blieb für immer, eine neue
	E-Mail-Adresse liess sich nicht nachtragen — obwohl genau sie den Zugangscode
	zur Versammlung trägt.

	**Zugeklappt**, weil Berichtigen der seltenere Weg ist: Meist kommt man auf
	diese Seite, um eine Einheit zuzuordnen. Aufgeklappt, sobald der Server
	widerspricht — sonst stünde die Absage über einem geschlossenen Kasten.
-->
<details class="berichtigen" {...aufgeklappt(form?.fehler?.feld === 'name')}>
	<summary>Angaben berichtigen</summary>
	<form method="POST" action="?/aendern" class="felder">
		<label>
			Name
			<input name="name" required maxlength="200" {...anfangswert(p.name)} />
		</label>
		<label>
			E-Mail
			<input name="email" type="email" maxlength="200" {...anfangswert(p.email ?? '')} />
		</label>
		<label>
			Telefon
			<input name="telefon" maxlength="60" {...anfangswert(p.telefon ?? '')} />
		</label>
		<label>
			Adresse
			<input name="adresse" maxlength="300" {...anfangswert(p.adresse ?? '')} />
		</label>
		<label>
			Bemerkung
			<input name="bemerkung" maxlength="500" {...anfangswert(p.bemerkung ?? '')} />
		</label>
		<button type="submit">Berichtigen</button>
	</form>
	<p class="klein">
		Natürliche oder juristische Person lässt sich hier nicht wechseln — das ist
		kein Schreibfehler, sondern ein anderer Sachverhalt, und daran hängen
		Zuordnungen und Vertretungen.
	</p>
</details>

<h2>Einheiten am {datumLang(data.stichtag)}</h2>
{#if data.einheiten.length === 0}
	{#if data.huellen.length > 0}
		<!--
			**Nicht «noch keine zugeordnet»**, wo eine Hülle die Einheit hält: Der
			Satz stimmte für die Zeile und war für den Menschen falsch.
		-->
		<p class="leer">
			Die Einheit hält die gemeinschaftliche Zeile oben — diesem Eigentümer ist daneben
			keine eigene zugeordnet.
		</p>
	{:else}
		<p class="leer">Diesem Eigentümer ist noch keine Einheit zugeordnet.</p>
	{/if}
{:else}
	<!--
		**Am Telefon Karten statt Spalten** (UI-Durchgang 06.10.2026). Die Tabelle
		stand ohne Bahn und ohne Kartenform da, und «Gültig ab» bricht nicht um: Bei
		390 px lief die Seite 17 px quer. Jetzt das Hausmuster aus `app.css`,
		`.tabellenbahn` mit `table.karten`, wie auf der Personenliste.
	-->
	<div class="tabellenbahn">
		<!-- svelte-ignore a11y_no_redundant_roles -->
		<table role="table" class="liste karten">
			<thead>
				<!-- svelte-ignore a11y_no_redundant_roles -->
				<tr role="row">
					<th scope="col">Gemeinschaft</th>
					<th scope="col">Einheit</th>
					<th scope="col">Gültig ab</th>
				</tr>
			</thead>
			<tbody>
				{#each data.einheiten as e (e.unitId)}
					<!-- svelte-ignore a11y_no_redundant_roles -->
					<tr role="row">
						<td role="cell" class="kopfzelle"><a href="/gemeinschaften/{e.stwegId}">{e.gemeinschaft}</a></td>
						<td role="cell" data-spalte="Einheit">{e.label}</td>
						<td role="cell" data-spalte="Gültig ab" class="zeitraum">{datumLang(e.ab)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<!--
	**Was diese Person früher hielt** (Auftraggeber, 01.09.2026).

	Die Liste darüber zeigt den Stand zum Stichtag — eine verkaufte Wohnung
	verschwindet daraus spurlos, und ob es sie je gab, sah man nirgends. Hier
	steht sie mit ihrem Zeitraum, zugeklappt: Es ist die seltenere Frage, aber
	die einzige Stelle, an der sie überhaupt zu beantworten ist.
-->
{#if data.frueher.length > 0}
	<details class="frueher">
		<summary>
			<!--
				**«Einträge», nicht «Einheiten»** (01.09.2026, aus dem Code-Review):
				Wer dieselbe Wohnung verkauft und zurückkauft, hat zwei Zeiträume an
				einer Einheit. «2 Einheiten» wäre schlicht falsch gezählt.
			-->
			Früher gehalten ({data.frueher.length}
			{data.frueher.length === 1 ? 'Eintrag' : 'Einträge'})
		</summary>
		<!-- Dasselbe Muster wie oben; der Zeitraum ist hier noch länger. -->
		<div class="tabellenbahn">
			<!-- svelte-ignore a11y_no_redundant_roles -->
			<table role="table" class="liste karten">
				<thead>
					<!-- svelte-ignore a11y_no_redundant_roles -->
					<tr role="row">
						<th scope="col">Gemeinschaft</th>
						<th scope="col">Einheit</th>
						<th scope="col">Zeitraum</th>
					</tr>
				</thead>
				<tbody>
					{#each data.frueher as e (e.unitId + e.ab)}
						<!-- svelte-ignore a11y_no_redundant_roles -->
						<tr role="row">
							<td role="cell" class="kopfzelle"><a href="/gemeinschaften/{e.stwegId}">{e.gemeinschaft}</a></td>
							<td role="cell" data-spalte="Einheit">{e.label}</td>
							<td role="cell" data-spalte="Zeitraum" class="zeitraum">{datumLang(e.ab)} bis {datumLang(e.bis)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>
{/if}

<h2>Einheit zuordnen</h2>
{#if data.auswahl.length === 0}
	<p class="leer">Es gibt keine Einheit, die diesem Eigentümer noch nicht gehört.</p>
{:else}
	<form method="POST" action="?/zuordnen" class="felder">
		<label class="breit">
			Einheit
			<Suchauswahl
				name="unitId"
				beschriftung="Einheit"
				leerText="— wählen —"
				pflicht
				eintraege={data.auswahl.flatMap((g) =>
					g.einheiten.map((e) => ({
						wert: e.id,
						text: `${e.label} · ${e.eigentuemer ? `zugeordnet an ${e.eigentuemer}` : 'noch ohne Eigentümer'}`,
						gruppe: g.gemeinschaft
					}))
				)}
			/>
			<span class="hilfe">
				Der angezeigte Eigentümer gilt am {datumLang(data.belegungsstichtag)}. Gehört die Einheit
				einer Gemeinschaft, in der dieser Eigentümer noch nicht geführt ist, entsteht die Zeile
				dort erst beim bestätigten Zuordnen.
			</span>
		</label>
		<label>
			Gültig ab
			<input type="date" name="ab" required {...anfangswert(data.heute)} />
		</label>
		<label class="breit">
			Bemerkung
			<input name="notiz" placeholder="Kaufvertrag vom 3. Mai" />
		</label>
		<button type="submit">Zuordnen</button>
	</form>
	<p class="klein lesebreite">
		Besteht bereits eine Zuordnung dieser Einheit, wird sie auf dieses Datum beendet statt
		überschrieben — der frühere Eigentümer bleibt für vergangene Versammlungen sichtbar. Das ist ein
		<strong>Wechsel</strong>, kein Hinzufügen: Sollen zwei Leute eine Einheit zusammen halten, gehört
		das in eine einzige Eigentümerzeile mit dem Haken «Gemeinschaftliches Eigentum».
	</p>
{/if}

<!-- ── Archiv ─────────────────────────────────────────────────────────────── -->
<!--
	**Für die Person, die nirgends mehr Eigentümerin ist.** Der Eigentumswechsel
	ist zeitlich abgebildet — verkauft heisst, die Zuordnung endet. Die Person
	selbst blieb trotzdem für immer in der Eigentümerliste stehen.
-->
<section class="archiv">
	<h2>Archiv</h2>
	{#if data.person.archiviertAm}
		<p class="klein">
			<strong>Im Archiv seit {datumLang(tagVon(data.person.archiviertAm))}.</strong>
			{#if data.person.archivnotiz}{' '}{data.person.archivnotiz}{/if}
			Sie erscheint nicht in der Eigentümerliste. Bestehende Zuordnungen, Protokolle und der
			Verlauf bleiben unverändert.
		</p>
		<form method="POST" action="?/hervorholen">
			<button type="submit">Aus dem Archiv holen</button>
		</form>
	{:else}
		<p class="klein">
			Archivieren nimmt nichts weg: Die Person bleibt mit allem, was an ihr hängt. Sie
			erscheint nur nicht mehr in der Eigentümerliste und in Auswahlfeldern.
		</p>
		<form method="POST" action="?/archivieren" class="archivform">
			<input
				name="notiz"
				maxlength="200"
				placeholder="Warum (freiwillig)"
				aria-label="Warum archiviert wird"
				{...anfangswert(form?.quelle === 'archiv' ? form.notiz : '')}
			/>
			<button type="submit" class="leise">Person archivieren</button>
		</form>
	{/if}
</section>

<!-- ── Löschen ────────────────────────────────────────────────────────────── -->
<!--
	**Ganz unten und optisch zurückgenommen**, wie bei der Gemeinschaft: Es ist
	die eine Handlung dieser Seite, die sich nicht zurücknehmen lässt. Über ihr
	steht das Archiv — der mildere Weg, der immer geht.

	Die Rückfrage nennt den Namen **und** die Eigentümerzeilen, die mitgehen:
	`party.person_id` steht auf RESTRICT, ohne sie liesse sich die Person gar
	nicht löschen. Wer das nicht liest, löscht mehr, als er dachte.
-->
<section class="entfernen">
	<h2>Person löschen</h2>
	{#if form?.quelle === 'entfernen' && form?.fehler}
		<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
	{/if}
	<p class="klein">
		Löschen geht nur, solange nichts daran hängt: keine Einheit — auch keine früher
		gehaltene —, keine Teilnahme an einer Versammlung, keine Weisung, kein Traktandum. Wer
		einmal mitgezählt hat, bleibt erfasst; für sie ist das Archiv der Weg.
	</p>
	<form method="POST" action="?/entfernen">
		<Rueckfrage
			beschriftung="«{p.name}» löschen"
			zeichen="kreuz"
			ton="fehler"
			gewicht="leise"
			frage="«{p.name}» endgültig löschen?"
			folge="Die Person wird mit ihren leeren Eigentümerzeilen entfernt. Das lässt sich nicht rückgängig machen — im Verlauf bleibt festgehalten, dass es geschah."
			bestaetigen="Löschen"
		/>
	</form>
</section>

<style>
	/*
	 * Wie auf der Angabenseite der Gemeinschaft: abgesetzt und leise. Eine
	 * Klasse ohne Stil wäre eine Rückmeldung, die niemand sieht — der Abschnitt
	 * klebte sonst in voller Überschriftgrösse am Archivblock darüber.
	 */
	.entfernen {
		margin-top: 2.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--linie);
	}

	.entfernen h2 {
		font-size: 1rem;
		color: var(--text-leise);
	}

	.entfernen .klein {
		color: var(--text-leise);
		max-width: 62ch;
	}

	.pfad {
		color: var(--text-leise);
		font-size: 0.9rem;
		margin-bottom: 0.25rem;
	}

	h1 {
		margin-bottom: 0.15rem;
	}

	.liste {
		width: 100%;
		border-collapse: collapse;
		margin: 0.5rem 0 1.5rem;
		max-width: 52rem;
	}

	.liste th {
		text-align: left;
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		color: var(--text-leise);
		padding: 0.35rem 0.5rem;
		border-bottom: 1px solid var(--linie);
	}

	/* `:where(.liste)`, damit unter 46rem `table.karten td` aus app.css gewinnt
	   (Auftrag V2, 06.10.2026): Vorher trug in der Karte jede Angabe eine Linie
	   und seitliches Polster, gemessen 3 von 3 Zellen. */
	:where(.liste) td {
		padding: 0.45rem 0.5rem;
		border-bottom: 1px solid var(--linie);
	}

	/*
	 * Ungebrochen nur, solange die Tabelle Spalten hat (UI-Durchgang 06.10.2026):
	 * In der Karte steht der Zeitraum hinter seiner Beschriftung, und «1. Januar
	 * 2020 bis 31. Dezember 2024» passt dort nicht auf eine Zeile.
	 */
	.zeitraum {
		font-variant-numeric: tabular-nums;
	}

	@media not all and (max-width: 46rem) {
		.zeitraum {
			white-space: nowrap;
		}
	}

	.frueher {
		margin: 1.5rem 0;
	}

	.klein,
	.leer,
	.hilfe {
		color: var(--text-leise);
		font-size: 0.875rem;
		font-weight: 400;
	}

	.hilfe {
		display: block;
	}

	.meldung {
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		max-width: var(--lesebreite);
	}

	.meldung.gut {
		background: color-mix(in srgb, var(--akzent) 15%, transparent);
	}

	.meldung.fehler {
		background: color-mix(in srgb, var(--fehler) 12%, transparent);
		color: var(--fehler);
	}
	.berichtigen {
		margin: 1.25rem 0;
	}

	/* Kein `display: flex` am summary — das nähme ihm sein Dreieck
	   (docs/gestaltung.md, bewacht von der Stylelint-Regel `versammlung/dreieck-am-summary`). */
	.berichtigen summary {
		cursor: pointer;
		min-height: var(--ziel-min);
		padding: 0.7rem 0;
	}
</style>
