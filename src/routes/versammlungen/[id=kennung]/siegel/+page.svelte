<script lang="ts">
	import { zeitpunktKurz } from '$lib/domain/datum';
	/**
	 * Das Abschlusspaket und sein Siegel.
	 *
	 * **Vorher steht, was geschieht; nachher, was entstanden ist.** Das
	 * Versiegeln ist die einzige unumkehrbare Handlung des ganzen Ablaufs —
	 * danach lassen sich Stimmen, Anwesenheit und Vollmachten nicht mehr ändern.
	 * Eine Seite, die das erst hinterher erklärt, wäre zu spät.
	 */
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';
	import Meldung from '$lib/components/Meldung.svelte';

	let { data, form } = $props();

	/** Läuft das Versiegeln gerade? Nur für die Rückmeldung während der Wartezeit (C-04). */
	let laeuft = $state(false);

	const v = $derived(data.versammlung);
	const s = $derived(data.lage.siegel);

	/*
	 * **Über die Hausfunktion, sonst wechselt der Siegelzeitpunkt die Uhrzeit**
	 * (04.09.2026). Ohne `timeZone` nimmt `Intl` die Zone des Geräts: Der Server
	 * lieferte «06:43», der Browser rechnete auf «08:43» um, und im Protokoll-PDF
	 * stand «08:43». Zwei Uhrzeiten für denselben Vorgang, und der Siegelzeitpunkt
	 * ist ein Nachweiselement.
	 */
	const zeitpunkt = zeitpunktKurz;

	function groesse(bytes: number): string {
		return bytes < 1024 * 1024
			? `${(bytes / 1024).toFixed(1)} kB`
			: `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}
</script>

<h1>Abschlusspaket und Siegel</h1>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.hinweis}
	<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
{/if}

{#if s}
	<p class="einleitung">
		Diese Versammlung ist <strong>versiegelt</strong>. Abstimmungen, Anwesenheit, Vollmachten und
		Entscheidbaumpfade stehen fest; das Protokoll bleibt bearbeitbar.
	</p>

	<dl class="siegel">
		<div>
			<dt>Versiegelt</dt>
			<dd>{zeitpunkt(s.versiegeltAm)}{#if s.versiegeltDurch} durch {s.versiegeltDurch}{/if}</dd>
		</div>
		<div>
			<dt>Siegel (Prüfsumme des Inhaltsverzeichnisses)</dt>
			<dd><code>{s.siegel}</code></dd>
		</div>
		<div>
			<dt>Paket</dt>
			<dd>
				{groesse(s.paketGroesse)} · <code>{s.paketPruefsumme}</code>
			</dd>
		</div>
		<div>
			<dt>Zeitstempel</dt>
			<dd class:offen={s.zeitstempel !== 'vorhanden'}>
				{data.zeitstempelsatz}
				<!--
					**Der Grund steht auch bei vorhandenem Stempel da**, wenn der
					Ersatz bezeugt hat (13.11.2026). Sonst läse sich das Siegel
					wie ein planmässiger Stempel des Hauptdienstes, und niemand
					erführe, dass dessen Abdruck wahrscheinlich gewechselt hat.
				-->
				{#if s.zeitstempelBemerkung && (s.zeitstempel !== 'vorhanden' || s.zeitstempelVomErsatz)}
					<span class="grund" class:ersatz={s.zeitstempelVomErsatz}>
						{s.zeitstempelBemerkung}
					</span>
				{/if}
			</dd>
		</div>
	</dl>

	<p class="knopfreihe">
		<!--
			`knopfartig haupt` statt `knopf haupt` (Auftrag V2, 06.10.2026): `knopf`
			hat auf dieser Seite keine Regel, und der Hauptweg stand als
			unterstrichener Textlink da.
		-->
		<a class="knopfartig haupt" href="/versammlungen/{v.id}/abschlusspaket.zip" data-sveltekit-reload>
			Abschlusspaket herunterladen
		</a>
		{#if data.verlaufspdf}
			<!--
				Der Verlauf liegt auch als Daten im Paket; diese Fassung ist die
				lesbare für ein Gericht. Sie kommt unverändert aus dem Paket, und
				ihre Prüfsumme steht im Manifest.
			-->
			<a class="knopf" href="/versammlungen/{v.id}/verlauf.pdf" data-sveltekit-reload>
				Verlauf (PDF)
			</a>
		{/if}
		{#if s.zeitstempel === 'vorhanden'}
			<a class="knopf" href="/versammlungen/{v.id}/zeitstempel.tsr" data-sveltekit-reload>
				Zeitstempel herunterladen
			</a>
		{/if}
		<a class="knopf" href="/pruefen">Paket prüfen</a>
	</p>

	{#if s.zeitstempel !== 'vorhanden'}
		<div class="kasten">
			<h2>Zeitstempel nachholen</h2>
			<p class="hilfe">
				Der Zeitstempel bezeugt, dass die Prüfsumme des Pakets zu einem bestimmten Zeitpunkt
				bereits vorlag — eine Aussage von aussen, die nicht von dieser Anwendung stammt. Das
				Siegel gilt auch ohne ihn; er macht es gegenüber Dritten stärker.
				{#if data.zeitstempeldienst}
					Hinterlegt ist <strong>{data.zeitstempeldienst.name}</strong>.
					{#if data.zeitstempeldienst.angeheftet === 0}
						Es ist kein Zertifikat angeheftet — geprüft wird die Signatur, aber nicht, wer sie
						geleistet hat.
					{/if}
				{:else}
					Es ist kein Dienst hinterlegt (<code>VERSAMMLUNG_ZEITSTEMPEL_URL</code>).
				{/if}
			</p>
			<form method="POST" action="?/zeitstempelNachholen">
				<button type="submit" disabled={!data.zeitstempeldienst}>Jetzt nachholen</button>
			</form>
		</div>
	{/if}

	{#if data.stimmnachweise.length > 0}
		<!--
			**Einzeln herausgeben, statt das ganze Paket zu schicken** (S-4,
			Produktentscheid 22.09.2026). Fragt jemand nach einem Traktandum, geht
			ein Blatt heraus und nicht der ganze Abend. Jede Herausgabe steht im
			Verlauf; das Blatt trägt alle Namen dieses Traktandums, nicht nur den
			der fragenden Person.
		-->
		<h2>Ein einzelnes Blatt herausgeben</h2>
		<p class="einleitung">
			Fragt eine Eigentümerin oder ein Eigentümer nach einem Traktandum, geben Sie
			das Blatt dazu heraus statt des ganzen Pakets. Jede Herausgabe wird im Verlauf
			festgehalten.
		</p>
		<ul class="blattliste">
			{#each data.stimmnachweise as blatt (blatt.datei)}
				<li>
					<a href="/versammlungen/{data.versammlung.id}/stimmnachweis/{encodeURIComponent(blatt.datei)}"
						data-sveltekit-reload>Traktandum {blatt.traktandum}</a
					>
				</li>
			{/each}
		</ul>
	{/if}

	<h2>Das Inhaltsverzeichnis</h2>
	<p class="hilfe">
		Es liegt zweimal im Paket: als <code>manifest.json</code> für die Maschine und als
		<code>MANIFEST.txt</code> in Worten — mit einer Anleitung, wie sich jeder Bestandteil prüfen
		lässt. Die Prüfsumme über <code>manifest.json</code> ist das Siegel.
	</p>
	<details>
		<summary>Inhaltsverzeichnis im Wortlaut</summary>
		<pre>{s.manifest}</pre>
	</details>
{:else}
	<p class="einleitung">
		Das Abschlusspaket enthält alles, was die Beschlüsse dieser Versammlung trägt:
	</p>
	<ul>
		<li>wer stimmberechtigt war</li>
		<li>die Anwesenheit, mit Zeitpunkten</li>
		<li>die Vollmachten, mit ihren Nachweisen</li>
		<li>jede Abstimmung, mit Zahlen und dem nötigen Mehr</li>
		<li>die Unterlagen im Original</li>
		<li>den lückenlosen Verlauf, als Daten und als lesbares PDF</li>
		<li>je Traktandum ein Blatt mit den Namen zu jeder Stimme</li>
	</ul>
	<p>
		Die Blätter unter <code>stimmnachweis/</code> weisen das Stimmverhalten namentlich
		aus. Sie sind für eine Nachfrage und für den Streitfall gedacht und nicht zur
		Verteilung an die Gemeinschaft bestimmt. Wer das Paket weitergibt, gibt sie mit.
	</p>

	<p>
		Jeder Bestandteil bekommt eine <strong>Prüfsumme</strong> — eine Zeichenfolge aus 64
		Zeichen, die sich ändert, sobald sich am Inhalt auch nur ein Zeichen ändert. Alle
		Prüfsummen stehen zusammen im Inhaltsverzeichnis des Pakets
		(<code>manifest.json</code>), und die Prüfsumme darüber ist das
		<strong>Siegel</strong>.
	</p>

	<p class="hilfe">
		Der Nachweiswert entsteht nicht dadurch, dass sich nichts mehr bearbeiten lässt, sondern
		dadurch, dass <strong>jede Bearbeitung auffällt</strong>. Wer einen Bestandteil austauscht,
		ändert seine Prüfsumme; wer die nachzieht, ändert die des Inhaltsverzeichnisses — und die steht
		ausserhalb.
	</p>

	{#if data.lage.hindernisse.length > 0}
		<div class="meldung warnung">
			<strong>Noch nicht möglich:</strong>
			<ul>
				{#each data.lage.hindernisse as h (h)}<li>{h}</li>{/each}
			</ul>
		</div>
	{:else}
		<div class="kasten">
			<h2>Was das Versiegeln bewirkt</h2>
			<ul>
				<li>
					Das Paket entsteht und wird unter seiner Prüfsumme abgelegt. Es ist ohne diese
					Anwendung lesbar — die Daten in offenem Format, die Unterlagen im Original.
				</li>
				<li>
					<strong>Abstimmungen, Anwesenheit, Vollmachten und Entscheidbaumpfade lassen sich
					danach nicht mehr ändern</strong>, und zwar in der Datenbank selbst, nicht bloss in
					der Oberfläche.
				</li>
				<li>
					Das <strong>Protokoll bleibt bearbeitbar</strong>: Es entsteht nach der Sitzung und
					wird von der nächsten Versammlung genehmigt.
				</li>
				<li>
					Der unabhängige Zeitstempel wird eingeholt. Geht das gerade nicht — im
					Versammlungsraum ohne Netz der Regelfall —, gilt das Siegel trotzdem, und der
					Zeitstempel wird nachgeholt.
				</li>
			</ul>
			<!--
				**Fünfzehn Sekunden ohne ein Wort** (23.08.2026, Prüflauf II, C-04). Das
				Versiegeln fragt den Zeitstempeldienst; ist er nicht erreichbar,
				laufen drei Versuche mit Frist — gemessen 15 s. In dieser Zeit stand
				nichts auf dem Bildschirm. Im Saal, mit dreissig wartenden Leuten, ist
				das lang genug, um ein zweites Mal zu klicken.

				Zwei Sätze statt eines Ladebalkens: Die Dauer steht in der Rückfrage,
				bevor man bestätigt, und danach steht da, dass es läuft. Ohne
				JavaScript bleibt es beim ersten — der Vorgang läuft trotzdem.
			-->
			<!--
				**Vor dem Knopf, nicht in der Rückfrage** (Block 7c). Der Hinweis
				verlangt einen Gang auf die Protokollseite; in der Rückfrage stünde
				er, wenn die Hand schon auf «Versiegeln» liegt. Er hält nichts auf.
			-->
			{#if data.hakenhinweis}
				<p class="meldung" data-hakenhinweis>
					{data.hakenhinweis}
					<a href="/versammlungen/{v.id}/protokoll">Zum Protokoll</a>
				</p>
			{/if}
			<form method="POST" action="?/versiegeln" onsubmit={() => (laeuft = true)}>
				<Rueckfrage
					beschriftung="Jetzt versiegeln"
					zeichen="haken"
					gewicht="haupt"
					gesperrt={laeuft}
					frage="Jetzt versiegeln?"
					folge="Danach lassen sich Abstimmungen, Anwesenheit, Vollmachten und Entscheidbaumpfade dieser Versammlung nicht mehr ändern. Das Protokoll bleibt bearbeitbar. Versiegeln ist unumkehrbar. Es dauert einen Augenblick: Das Paket entsteht, und der Zeitstempel wird geholt — ohne Netz bis zu fünfzehn Sekunden, bis die Versuche aufgeben."
					bestaetigen="Versiegeln"
				/>
				{#if laeuft}
					<p class="hilfe laeuft" role="status">
						Das Paket entsteht und der Zeitstempel wird geholt. Ohne Netz dauert es bis zu
						fünfzehn Sekunden — bitte nicht noch einmal klicken.
					</p>
				{/if}

			</form>
		</div>
	{/if}
{/if}

<style>
	.blattliste a {
		font-weight: 600;
	}
	.laeuft {
		margin-top: 0.5rem;
		color: var(--akzent);
	}

	.hilfe {
		max-width: 62ch;
	}

	.hilfe {
		color: var(--text-leise);
		font-size: 0.9rem;
	}

	.kasten {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		max-width: 46rem;
		padding: 1rem 1.15rem;
	}

	.kasten h2 {
		margin-top: 0;
	}

	.siegel {
		display: grid;
		gap: 0.6rem;
		margin: 1rem 0;
		max-width: 62rem;
	}

	.siegel dt {
		color: var(--text-leise);
		font-size: 0.85rem;
	}

	.siegel dd {
		margin: 0.1rem 0 0;
		overflow-wrap: anywhere;
	}

	.siegel dd.offen {
		color: var(--warnung);
	}

	/* Ein vorhandener Ersatzstempel ist kein offener Zustand, aber ein
	   Hinweis: Die Kante macht ihn sichtbar, ohne ihn wie einen Fehler
	   aussehen zu lassen (13.11.2026). */
	.siegel .grund.ersatz {
		border-left: 3px solid var(--warnung);
		display: block;
		margin-top: 0.35rem;
		padding-left: 0.5rem;
	}

	code {
		font-size: 0.85rem;
	}

	pre {
		background: var(--flaeche-2);
		border-radius: 0.4rem;
		font-size: 0.8rem;
		max-height: 28rem;
		overflow: auto;
		padding: 0.75rem;
		white-space: pre-wrap;
	}

	/* Umbrechen und mittig ausrichten (Auftrag V2, 06.10.2026): Ohne Umbruch
	   schrumpften die vier Verweise, und der Hauptknopf stand zweizeilig da,
	   gemessen 56 px hoch bei 1440 px Fensterbreite. */
	.knopfreihe {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
	}
</style>
