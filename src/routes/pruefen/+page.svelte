<script lang="ts">
	import Meldung from '$lib/components/Meldung.svelte';
	/**
	 * Ein Abschlusspaket prüfen.
	 *
	 * **Vier getrennte Aussagen, nicht ein Ampelbild.** Wer hier steht, hat einen
	 * Streit am Hals; ihm ist mit «alles gut» nicht geholfen. Er will wissen,
	 * welcher Bestandteil abweicht, ob das Manifest selbst getauscht wurde und
	 * worauf der Zeitstempel lautet.
	 */
	let { data, form } = $props();

	const b = $derived(form?.befund ?? null);

	function groesse(bytes: number): string {
		return bytes < 1024
			? `${bytes} B`
			: bytes < 1024 * 1024
				? `${(bytes / 1024).toFixed(1)} kB`
				: `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}
</script>

<svelte:head><title>Abschlusspaket prüfen</title></svelte:head>

<h1>Abschlusspaket prüfen</h1>

<p class="einleitung">
	Legen Sie ein Abschlusspaket vor. Diese Seite rechnet nach, ob es unverändert ist — und was
	der Zeitstempel bezeugt. Das Paket wird dabei <strong>nicht gespeichert</strong>.
</p>
<p class="einleitung">
	Ebenso prüft sie eine Protokollfassung mit Nachtragssiegel, wie die Protokollseite sie unter
	«Fassung mit Siegel herunterladen» ausgibt. Geprüft wird, ob der Wortlaut unverändert ist und
	ob die Fassung in der Kette der Siegel an ihrem Platz steht.
</p>

<form method="POST" enctype="multipart/form-data" class="formular">
	<label>
		<span>Abschlusspaket (ZIP)</span>
		<input type="file" name="paket" accept=".zip,application/zip" required />
	</label>

	<label>
		<span>Zeitstempel (TSR) — nur nötig, wenn er nicht im Paket liegt</span>
		<input type="file" name="zeitstempel" accept=".tsr" />
	</label>

	<label>
		<span>Siegel zum Vergleich (64 Zeichen) — nur nötig, wenn die Versammlung hier nicht mehr steht</span>
		<input type="text" name="siegel" autocomplete="off" spellcheck="false" />
	</label>

	<p class="hilfe">
		Das Siegel steht <strong>nicht</strong> im Paket — sonst wäre es keines. Kennt diese Anwendung
		die Versammlung noch, wird ihr eigener Wert genommen; das ist der stärkere Vergleich, weil er
		nicht mit dem Paket zusammen gefälscht werden kann.
	</p>

	<p><button type="submit" class="haupt">Prüfen</button></p>
</form>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{/if}

{#if b}
	<h2>Befund zu {form?.dateiname}</h2>
	<p
		class="befundsatz"
		class:haelt={b.inhalt?.bestandteileStimmen &&
			b.inhalt?.manifestStimmt &&
			b.herkunft.stimmtUeberein !== false &&
			b.kette?.haelt !== false}
	>
		{b.satz}
	</p>

	<dl class="aussagen">
		<div>
			<dt>Bestandteile</dt>
			<dd>
				{#if b.inhalt?.bestandteileStimmen}
					Alle {(b.manifest ?? b.nachtragsmanifest)?.eintraege.length} Bestandteile stimmen mit dem Inhaltsverzeichnis überein.
				{:else if b.inhalt}
					{#if b.inhalt.abweichungen.length > 0}
						<p>Abweichend:</p>
						<ul>
							{#each b.inhalt.abweichungen as a (a.pfad)}
								<li>
									<code>{a.pfad}</code><br />
									erwartet <code>{a.erwartet}</code><br />
									gefunden <code>{a.gefunden}</code>
								</li>
							{/each}
						</ul>
					{/if}
					{#if b.inhalt.fehlend.length > 0}
						<p>Fehlt im Paket: {b.inhalt.fehlend.join(', ')}</p>
					{/if}
				{:else}
					Nicht feststellbar.
				{/if}
				{#if b.inhalt && b.inhalt.zusaetzlich.length > 0}
					<p class="hinweis">
						Zusätzlich im Paket, aber nicht im Inhaltsverzeichnis: {b.inhalt.zusaetzlich.join(', ')}
					</p>
				{/if}
			</dd>
		</div>

		<div>
			<dt>Inhaltsverzeichnis</dt>
			<dd>
				{#if b.gerechnetesSiegel}
					Gerechnet: <code>{b.gerechnetesSiegel}</code><br />
					{#if b.fassungFehlt}
						<span class="hinweis hinweis-ernst">
							Zu dieser Fassung ist hier kein Nachtragssiegel festgehalten; verglichen wurde
							gegen nichts.
						</span>
					{:else if b.siegelquelle === 'datenbank'}
						Verglichen mit dem hier festgehaltenen Siegel —
						{b.inhalt?.manifestStimmt ? 'übereinstimmend.' : 'abweichend.'}
					{:else if b.siegelquelle === 'eingegeben'}
						Verglichen mit dem eingegebenen Siegel —
						{b.inhalt?.manifestStimmt ? 'übereinstimmend.' : 'abweichend.'}
					{:else}
						<span class="hinweis">
							Kein Vergleichswert vorhanden. Die Prüfsumme ist gerechnet, aber gegen nichts
							gehalten.
						</span>
					{/if}
				{:else}
					Kein Inhaltsverzeichnis im Paket.
				{/if}
			</dd>
		</div>

		{#if b.kette}
			<div>
				<dt>Siegelkette</dt>
				<dd>
					<span class:hinweis={b.kette.haelt !== true} class:hinweis-ernst={b.kette.haelt === false}
						>{b.kette.satz}</span
					>
				</dd>
			</div>
		{/if}

		<div>
			<dt>Zeitstempel</dt>
			<dd>
				{#if b.stempelquelle === 'ersetzt'}
					<!--
						**Die hochgeladene Datei wurde nicht beurteilt, und das gehört
						gesagt.** Das Paket führt einen eigenen Stempel; er ist Teil des
						Versiegelten und damit das stärkere Beweisstück. Ihn stumm durch
						einen mitgebrachten zu ersetzen hiesse, einen untauglichen
						Stempel im Paket verdecken zu lassen (Sicherheitsprüfung,
						22.09.2026).
					-->
					<span class="hinweis hinweis-ernst">
						Sie haben eine Zeitstempeldatei mitgeschickt, das Paket führt aber
						einen eigenen. Beurteilt wurde der aus dem Paket: Er gehört zum
						Versiegelten und ist damit das stärkere Beweisstück.
						<!--
							**Kein Vorwurf im Wortlaut** (Code-Review 22.09.2026). Der
							Regelfall dahinter ist ernst, aber es gibt einen redlichen:
							Die Datei im Archiv ist beschädigt, und jemand bringt die gute
							Kopie mit. Die Entscheidung bleibt dieselbe, der Ton nicht.
						-->
						Nachgeholt werden muss ein Stempel nur, wenn im Paket keiner liegt.
						Passt beides nicht zusammen, klären Sie, woher die mitgeschickte
						Datei stammt.
					</span>
				{/if}
				{#if b.zeitstempel}
					{b.zeitstempel.satz}
					{#if b.zeitstempel.fingerabdruck}
						<br />Aussteller: <code>{b.zeitstempel.fingerabdruck}</code>
						{#if b.manifesterwartung === 'verletzt'}
							<!--
								**Der Widerspruch im Paket selbst.** Es nennt eine
								Zeitstempelstelle, signiert hat eine andere. Das ist keine
								Alterserscheinung, und der Text daneben darf ihn nicht so
								nennen (Code-Review und Sicherheitsprüfung, 22.09.2026).

								**Aber er hat zwei Lesarten, und nur eine ist ernst.** Ein
								nachgeholter Stempel wird getrennt eingereicht, weil das
								Paket beim Nachholen längst geschlossen ist. Hat der
								Betreiber dazwischen den Dienst gewechselt, nennt das
								Inhaltsverzeichnis zwangsläufig die alte Stelle — ein
								gewöhnlicher Vorgang, kein Angriff. Beides gleich scharf zu
								melden hätte die Warnung abgenutzt, die im ernsten Fall
								trägt.
							-->
							{#if b.stempelquelle === 'daneben'}
								<!--
									**Die Entlastung nennt ihren Grund.** Sonst ist sie eine
									Behauptung, die niemand nachprüfen kann — und wer sie
									prüfen will, müsste erst den Code lesen
									(Sicherheitsprüfung, 22.09.2026).
								-->
								<span class="hinweis">
									Der Stempel stammt von einer anderen Stelle als der, die das
									Paket nennt. Dem Paket liegt kein eigener Stempel bei, und
									der hier eingereichte wurde also nachgeholt: Dazwischen kann
									der Dienst gewechselt haben. Er bezeugt dann den Zeitpunkt
									des Nachholens, nicht den des Versiegelns.
									<!--
										**Der Vorbehalt gehört hierher, nicht nur in die Doku**
										(Code-Review 22.09.2026). Bisher trug die scharfe
										Formulierung die Vorsicht. Dieser Zweig erzählt
										stattdessen eine entlastende Geschichte, und wer sie
										liest, nimmt sie als Feststellung.
									-->
									Welche Stelle das Paket nennt, hat hineingeschrieben, wer es
									versiegelt hat: Die Angabe reist mit, sie sichert nichts.
								</span>
							{:else}
								<span class="hinweis hinweis-ernst">
									Das Paket nennt eine andere Zeitstempelstelle, als den Stempel
									ausgestellt hat. Der Stempel liegt im Paket, ist also mit ihm
									entstanden: Dafür gibt es keine harmlose Erklärung. Wer sich
									darauf stützen will, klärt das ab.
								</span>
							{/if}
						{/if}
						{#if b.zeitstempel.angeheftet === false}
							<span class="hinweis">
								Dieser Aussteller ist hier nicht hinterlegt. Das ist bei einem alten Paket
								normal, es sagt nur, dass heute ein anderer Dienst eingestellt ist.
								<!-- Seit dem Ersatzdienst (13.11.2026) auch, wenn nur der Ersatz angeheftet ist. -->
								Ebenso, wenn für den Hauptdienst kein Zertifikat angeheftet ist und nur für den
								Ersatzdienst eines.
							</span>
						{/if}
					{/if}
				{:else}
					Dem Paket liegt kein Zeitstempel bei. Das Siegel gilt auch ohne; es fehlt ihm der
					unabhängige Beleg, wann es entstand.
				{/if}
			</dd>
		</div>

		<div>
			<dt>Herkunft</dt>
			<dd>{b.herkunft.satz}</dd>
		</div>
	</dl>

	{#if b.manifest || b.nachtragsmanifest}
		<h3>Was im Paket steht</h3>
		<table>
			<thead>
				<tr><th>Datei</th><th class="zahl">Grösse</th><th>Prüfsumme</th></tr>
			</thead>
			<tbody>
				{#each b.dateien as d (d.pfad)}
					<tr>
						<td><code>{d.pfad}</code></td>
						<td class="zahl">{groesse(d.groesse)}</td>
						<td><code class="klein">{d.pruefsumme}</code></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
{:else}
	<p class="hilfe">
		Prüfen lässt sich auch ohne diese Anwendung: <code>manifest.json</code> nennt zu jeder Datei
		ihre Prüfsumme, <code>MANIFEST.txt</code> erklärt in Worten, wie man sie nachrechnet.
		{#if data.angehefteteStelle}
			Zeitstempel holt diese Anlage bei <strong>{data.angehefteteStelle}</strong>{#if data.angehefteteErsatzstelle}.
				Liefert er keinen geprüften Stempel, weil er nicht antwortet, die Anfrage abweist oder
				sein Zertifikat nicht angeheftet ist, springt der Ersatzdienst
				<strong>{data.angehefteteErsatzstelle}</strong> ein; nach einer endgültigen Absage
				schon nach einem Anlauf{/if}.
		{/if}
	</p>
{/if}

<style>
	.hinweis-ernst {
		font-weight: 600;
	}
	.hilfe {
		max-width: 62ch;
	}

	.hilfe,
	.hinweis {
		color: var(--text-leise);
		font-size: 0.9rem;
	}

	.hinweis {
		display: block;
	}

	.formular {
		display: grid;
		gap: 0.85rem;
		max-width: 46rem;
	}

	.formular label {
		display: grid;
		gap: 0.25rem;
	}

	.formular label span {
		font-size: 0.9rem;
	}

	.befundsatz {
		border-left: 3px solid var(--warnung);
		font-size: 1.05rem;
		max-width: 62ch;
		padding-left: 0.75rem;
	}

	.befundsatz.haelt {
		border-left-color: var(--akzent);
	}

	.aussagen {
		display: grid;
		gap: 0.9rem;
		margin: 1.25rem 0;
		max-width: 62rem;
	}

	.aussagen dt {
		color: var(--text-leise);
		font-size: 0.85rem;
	}

	.aussagen dd {
		margin: 0.15rem 0 0;
		overflow-wrap: anywhere;
	}

	code {
		font-size: 0.85rem;
	}

	code.klein {
		font-size: 0.75rem;
	}

	table {
		border-collapse: collapse;
		max-width: 62rem;
		width: 100%;
	}

	th,
	td {
		border-bottom: 1px solid var(--linie);
		padding: 0.35rem 0.5rem;
		text-align: left;
	}

	.zahl {
		text-align: right;
		white-space: nowrap;
	}
</style>
