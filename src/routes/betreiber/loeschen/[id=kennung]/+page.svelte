<script lang="ts">
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import { anfangswert, angekreuzt } from '$lib/felder';
	import Meldung from '$lib/components/Meldung.svelte';
	import Rueckfragefenster from '$lib/components/Rueckfragefenster.svelte';
	import { datumLang, istKalendertag } from '$lib/domain/datum';
	import { anfechtungsfristEnde, loeschbarAb, RESERVE_TAGE } from '$lib/domain/loeschfrist';

	/**
	 * Eine Versammlung nach Ablauf der Anfechtungsfrist löschen (17.09.2026).
	 *
	 * **Die Rechnung steht im Kern** (`$lib/domain/loeschfrist`) und läuft hier
	 * mit, während man das Datum eintippt: Wer den Tag der Zustellung ändert,
	 * sieht sofort, ab wann gelöscht werden darf. Entschieden wird trotzdem auf
	 * dem Server und in der Datenbank.
	 */
	let { data, form } = $props();
	const lage = $derived(data.lage);
	const werte = $derived(form && 'werte' in form ? form.werte : null);
	const rueckfrage = $derived(form && 'rueckfrage' in form ? form.rueckfrage : null);

	// `bind:value` mit `$state`: der Wert muss die Hydration überleben.
	let zugestelltAm = $state(vorschlag());
	/** Der Versandtag als Vorbelegung, einmal beim Aufbau gelesen. */
	function vorschlag(): string {
		return data.lage.versandtAm ?? '';
	}

	const erste = $derived(lage.versammlungen[0]);
	const titel = $derived(
		lage.abend
			? `Den Abend «${lage.abend}» löschen`
			: `${erste.gemeinschaft}, Versammlung vom ${datumLang(erste.datum)} löschen`
	);

	/** Was einem Löschen vorher schon entgegensteht, unabhängig vom Datum. */
	const nichtGeschlossen = $derived(
		lage.versammlungen.some((v) => v.zustand !== 'geschlossen' && v.zustand !== 'versiegelt')
	);
	const unversiegelt = $derived(lage.versammlungen.filter((v) => !v.versiegelt));
	const ungenehmigt = $derived(lage.versammlungen.filter((v) => v.genehmigung !== 'genehmigt'));
	const gesperrt = $derived(
		nichtGeschlossen || unversiegelt.length > 0 || lage.offenePendenzen > 0 || ungenehmigt.length > 0
	);

	const rechnung = $derived(
		istKalendertag(zugestelltAm)
			? { ende: anfechtungsfristEnde(zugestelltAm), ab: loeschbarAb(zugestelltAm) }
			: null
	);
</script>

<h1>{titel}</h1>
<p class="einleitung">
	Endgültig, ohne Rückweg. Vorher gehören Abschlusspaket und unterzeichnetes Protokoll ins Archiv:
	bei der Verwaltung, sonst beim Stockwerkeigentümer, der den Vorsitz geführt hat.
</p>

{#if form && 'fehler' in form && form.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{/if}

<div class="seitenstapel">
	<section class="abschnitt">
		<section class="kasten">
			<h2>Was verschwindet?</h2>
			<ul class="versammlungen">
				{#each lage.versammlungen as v (v.id)}
					<li>
						<strong>{v.gemeinschaft}</strong>, {datumLang(v.datum)}, {v.ort}
						{#if !v.versiegelt}<span class="hilfe">(nicht versiegelt)</span>{/if}
						{#if v.siegel}
							<span class="hilfe siegelwert">Siegel: {v.siegel}</span>
						{/if}
						<span class="wege">
							{#if v.versiegelt}
								<a href="/versammlungen/{v.id}/abschlusspaket.zip">Abschlusspaket herunterladen</a>
								·
							{/if}
							<a href="/versammlungen/{v.id}/protokoll">Protokoll</a>
						</span>
					</li>
				{/each}
			</ul>
			<p class="hilfe">
				Mit {lage.versammlungen.length === 1 ? 'ihr' : 'ihnen'} gehen {lage.zahlen.traktanden} Traktanden,
				{lage.zahlen.stimmen} Stimmen, {lage.zahlen.vollmachten} Vollmachten und
				{lage.zahlen.dateien} Dateien, dazu ihre Einträge im Verlauf. An der Gemeinschaft bleibt ein
				Vermerk, dass und wann gelöscht wurde.
			</p>
			{#if lage.abend}
				<p class="hilfe">
					Diese Versammlung gehört zu einem gemeinsamen Abend. Gelöscht wird er nur als Ganzes, weil
					Weisungen und das gemeinsame Protokoll seine Versammlungen verbinden.
				</p>
			{/if}
		</section>

		{#if nichtGeschlossen}
			<p class="meldung warnung" role="status">
				Gelöscht wird nur eine geschlossene Versammlung. Schliessen Sie sie zuerst.
			</p>
		{:else if unversiegelt.length > 0}
			<p class="meldung warnung" role="status">
				Gelöscht wird nur eine versiegelte Versammlung: Erst mit dem Siegel gibt es ein Abschlusspaket
				mit Prüfsumme, das ins Archiv gehört.
				{#each unversiegelt as v, i (v.id)}{i > 0 ? ' · ' : ''}<a href="/versammlungen/{v.id}/siegel"
						>{v.gemeinschaft} versiegeln</a
					>{/each}
			</p>
		{:else if ungenehmigt.length > 0}
			<p class="meldung warnung" role="status">
				Gelöscht wird erst, wenn die nächste Versammlung das Protokoll genehmigt hat. Bis dahin lässt
				es sich berichtigen, und die Stimmen in Votum sind der Beleg dafür. Halten Sie danach auf der
				Protokollseite die Fassung «von der Versammlung genehmigt» fest.
				{#each ungenehmigt as v, i (v.id)}{i > 0 ? ' · ' : ''}<a href="/versammlungen/{v.id}/protokoll"
						>Protokoll {v.gemeinschaft}</a
					>{v.genehmigung === 'ohne_folgeversammlung'
						? ' (als genehmigt festgehalten, aber vor der nächsten Versammlung)'
						: ''}{/each}
			</p>
		{/if}

		{#if lage.offenePendenzen > 0}
			<p class="meldung warnung" role="status">
				{lage.offenePendenzen === 1
					? 'Eine Pendenz dieser Versammlung ist noch offen.'
					: `${lage.offenePendenzen} Pendenzen dieser Versammlung sind noch offen.`}
				Sie gehören der Gemeinschaft und verschwinden nicht mit der Versammlung. Schliessen Sie sie ab
				oder setzen Sie sie auf «hinfällig»:
				<a href="/versammlungen/{erste.id}/leitung">zur Versammlungsleitung</a>.
			</p>
		{/if}
	</section>

	{#if !gesperrt}
		<section class="abschnitt">
			<section class="kasten">
				<h2>Ist die Anfechtungsfrist abgelaufen?</h2>
				<form
					method="POST"
					action="?/loeschen"
					class="formular"
					use:enhance={absenden()}
				>
					<label>
						Tag der letzten Zustellung des Protokolls
						<input type="date" name="zugestelltAm" bind:value={zugestelltAm} max={lage.heute} required />
						<span class="hilfe">
							{#if lage.versandtAm}
								Vorbelegt mit dem {datumLang(lage.versandtAm)}, an dem das Protokoll als versandt
								festgehalten wurde. Kam es bei jemandem später an, tragen Sie diesen Tag ein.
							{:else}
								Das Protokoll wurde in Votum nie als versandt festgehalten. Tragen Sie den Tag ein, an
								dem es zuletzt jemandem zugestellt wurde.
							{/if}
						</span>
					</label>

					{#if rechnung}
						<p class="rechnung" class:laeuft={rechnung.ab > lage.heute}>
							Die Anfechtungsfrist endet am {datumLang(rechnung.ende)}, danach laufen {RESERVE_TAGE} Tage
							Reserve.
							{#if rechnung.ab > lage.heute}
								Löschen lässt sich die Versammlung ab dem <strong>{datumLang(rechnung.ab)}</strong>.
							{:else}
								Löschbar seit dem {datumLang(rechnung.ab)}.
							{/if}
						</p>
					{/if}

					<fieldset class="bestaetigungen">
						<legend>Liegt alles im Archiv?</legend>
						<label class="ankreuz">
							<input
								type="checkbox"
								name="paketArchiviert"
								{...angekreuzt(werte?.paketArchiviert ?? false)}
							/>
							<span>
								Das Abschlusspaket ist heruntergeladen und liegt im Archiv.
								<span class="hilfe">Nach dem Löschen lässt es sich aus Votum nicht mehr holen.</span>
							</span>
						</label>
						<label class="ankreuz">
							<input
								type="checkbox"
								name="protokollArchiviert"
								{...angekreuzt(werte?.protokollArchiviert ?? false)}
							/>
							<span>
								Das unterzeichnete Protokoll liegt im Archiv.
								<span class="hilfe">Es ist aufzubewahren, solange das Stockwerkeigentum besteht.</span>
							</span>
						</label>
						<label class="ankreuz">
							<input
								type="checkbox"
								name="keineAnfechtung"
								{...angekreuzt(werte?.keineAnfechtung ?? false)}
							/>
							<span>
								Weder eine Anfechtungsklage noch ein Schlichtungsgesuch ist eingegangen.
								<span class="hilfe">Ist eines hängig, bleibt die Versammlung stehen, bis es erledigt ist.</span>
							</span>
						</label>
					</fieldset>

					<p><button type="submit" class="gefahr">Versammlung löschen</button></p>
				</form>
			</section>
		</section>
	{/if}

	<section class="abschnitt">
		<details>
			<summary>Was heisst das?</summary>
			<p>
				Anfechten lässt sich ein Beschluss innert eines Monats seit Kenntnisnahme (ZGB Art. 75
				i.V.m. Art. 712m Abs. 2). Wer nicht an der Versammlung war und nicht vertreten wurde, erfährt
				davon mit dem Protokoll; für ihn beginnt die Frist erst mit dessen Zustellung (Wermelinger,
				Rz. 230 ad Art. 712m). Deshalb zählt die letzte Zustellung. Die Frist endet am Tag des
				Folgemonats mit derselben Zahl (OR Art. 77 Abs. 1 Ziff. 3).
			</p>
			<p>
				Endgültig ist das Protokoll aber erst, wenn die nächste Versammlung es genehmigt hat. Bis
				dahin lässt sich seine Berichtigung verlangen, unabhängig von der Anfechtungsfrist
				(Wermelinger, Rz. 136, 138 ad Art. 712n). Deshalb wartet das Löschen auf die Genehmigung.
			</p>
			<p>
				Die {RESERVE_TAGE} Tage Reserve sind Vorsicht, kein Recht: Eine Klage wird innert Frist
				eingereicht, das Schlichtungsgesuch erreicht die Gemeinschaft aber oft erst Wochen später.
			</p>
			<p>
				Ein <strong>nichtiger</strong> Beschluss kennt keine Frist (Wermelinger, Rz. 214 ad
				Art. 712m). Dafür ist die Aufbewahrung da: Das Protokoll bewahrt die Verwaltung auf, sonst
				der Stockwerkeigentümer, der den Vorsitz geführt hat (ZGB Art. 712n Abs. 2). Nach
				herrschender Lehre gilt das, solange das Stockwerkeigentum besteht (Wermelinger, Rz. 144 f.
				ad Art. 712n). Das Abschlusspaket gehört als Nachweis der Beschlüsse dazu und liegt am
				selben Ort.
			</p>
		</details>
	</section>
</div>

{#if rueckfrage}
	<Rueckfragefenster
		frage={lage.versammlungen.length === 1
			? `${erste.gemeinschaft}, Versammlung vom ${datumLang(erste.datum)} endgültig löschen?`
			: `Den Abend «${lage.abend ?? ''}» mit ${lage.versammlungen.length} Versammlungen endgültig löschen?`}
		zurueck="/betreiber/loeschen/{erste.id}"
		marke={form}
	>
		{#snippet inhalt()}
			<p>
				Mit {lage.versammlungen.length === 1 ? 'ihr' : 'ihnen'} gehen {rueckfrage.zahlen.traktanden}
				Traktanden, {rueckfrage.zahlen.stimmen} Stimmen, {rueckfrage.zahlen.vollmachten} Vollmachten und
				{rueckfrage.zahlen.dateien} Dateien. Das lässt sich nicht rückgängig machen.
			</p>
		{/snippet}
		{#snippet handlung()}
			<form method="POST" action="?/loeschen" use:enhance={absenden()}>
				<input type="hidden" name="zugestelltAm" {...anfangswert(werte?.zugestelltAm)} />
				{#if werte?.paketArchiviert}<input type="hidden" name="paketArchiviert" value="true" />{/if}
				{#if werte?.protokollArchiviert}<input type="hidden" name="protokollArchiviert" value="true" />{/if}
				{#if werte?.keineAnfechtung}<input type="hidden" name="keineAnfechtung" value="true" />{/if}
				<input type="hidden" name="bestaetigt" value="true" />
				<button type="submit" class="ja" data-ton="warnung">Endgültig löschen</button>
			</form>
		{/snippet}
	</Rueckfragefenster>
{/if}

<style>
	/*
	 * Die festen Hinweise sehen aus wie `Meldung` im Ton «warnung», nur ohne
	 * Schliessknopf: Wegdrücken nähme die Anzeige, die Sperre bliebe. Eine
	 * globale Gestaltung von `.meldung.warnung` gibt es nicht; ohne diese Regeln
	 * stand die Sperre als gewöhnlicher Absatz da (17.09.2026, im Browser gesehen).
	 */
	.meldung {
		padding: 0.7rem 0.95rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		margin: 0.75rem 0;
		max-width: var(--lesebreite);
	}

	.meldung.warnung {
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
	}

	.versammlungen {
		margin: 0 0 0.6rem;
		padding-left: 1.1rem;
	}

	.versammlungen li {
		margin-bottom: 0.3rem;
	}

	.wege {
		display: block;
		font-size: 0.9rem;
	}

	/*
	 * Der Siegelwert zum Abschreiben: 64 Zeichen, die im Streitfall ein Paket
	 * belegen, wenn die Siegelzeile längst gelöscht ist. Umbruch überall, sonst
	 * schiebt er auf dem Telefon die Seite auseinander.
	 */
	.siegelwert {
		display: block;
		font-family: monospace;
		word-break: break-all;
	}

	.rechnung {
		margin: 0.4rem 0 0.8rem;
	}

	.rechnung.laeuft {
		color: var(--warnung);
	}

	.bestaetigungen {
		min-width: 0;
		border: 0;
		padding: 0;
		margin: 0 0 0.8rem;
	}

	.bestaetigungen legend {
		font-weight: 600;
		margin-bottom: 0.4rem;
	}

	.formular label .hilfe {
		font-weight: 400;
	}

	.formular label.ankreuz {
		display: flex;
		flex-direction: row;
		align-items: flex-start;
		gap: 0.5rem;
		min-height: var(--ziel-min);
	}

	.ankreuz > span {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
</style>
