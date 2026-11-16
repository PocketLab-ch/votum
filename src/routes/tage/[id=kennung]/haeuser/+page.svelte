<script lang="ts">
	/**
	 * Wer mittagt — Karten statt Tabellenzeilen, ein Knopf je Handlung.
	 *
	 * Vorher stand das in einer Tabelle mit sieben Spalten, in der «Herausnehmen»
	 * sechsmal untereinander erschien, ohne zu sagen, was es tut. Jetzt trägt
	 * jede Gemeinschaft eine Karte mit ihrem Stand, und die Handlung sitzt in
	 * deren Fuss — mit der Erklärung eine Zeile darunter.
	 */
	import Karte from '$lib/components/Karte.svelte';
	import { datumLang } from '$lib/domain/datum';
	import { versammlungsstufe, beschriftung } from '$lib/domain/klartext';
	import { zustandsname } from '$lib/domain/versammlung';
	import { anfangswert } from '$lib/felder';
	import Meldung from '$lib/components/Meldung.svelte';
	import Suchauswahl from '$lib/components/Suchauswahl.svelte';

	let { data, form } = $props();

	const rueckfrage = $derived(form && 'rueckfrage' in form ? form.rueckfrage : null);
	const rueckgaengig = $derived(form && 'rueckgaengig' in form ? form.rueckgaengig : null);

	/** Wie eine Versammlung in der Auswahlliste heisst — genug, um sie zu erkennen. */
	function zeile(v: {
		gemeinschaft: string;
		datum: string;
		ort: string;
		stufe: 'erste' | 'zweite';
		schonWo: string | null;
	}): string {
		// Klartext **und** Fachbegriff, wie überall: «Das erste Treffen
		// (Erstversammlung)». Wer die Liste liest, muss die Stufe erkennen — an
		// ihr hängt, ob die Aufnahme abgewiesen wird oder nur nachfragt.
		const teile = [
			v.gemeinschaft,
			datumLang(v.datum),
			v.ort,
			beschriftung(versammlungsstufe(v.stufe))
		];
		if (v.schonWo) teile.push('— tagt schon woanders mit');
		return teile.join(' · ');
	}
</script>

<h1>Wer tagt mit?</h1>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.hinweis}
	<div class="meldung gut" role="status">
		<span>{form.hinweis}</span>
		<!--
			Der Weg zurück steht bei der Meldung, nicht in einer Liste weiter unten:
			Wer sich vertippt hat, sucht ihn genau hier — und die alte Stelle im
			Ablauf ist nur jetzt noch bekannt.
		-->
		{#if rueckgaengig}
			<form method="POST" action="?/aufnehmen">
				<input type="hidden" name="versammlung" value={rueckgaengig.versammlung} />
				<input type="hidden" name="stelle" value={String(rueckgaengig.stelle)} />
				<input type="hidden" name="bestaetigt" value="ja" />
				<button type="submit" class="leise">Rückgängig</button>
			</form>
		{/if}
	</div>
{/if}

<!--
	Die Rückfrage ist keine Fehlermeldung: Sie sagt, was geschehen wird, und
	schickt dasselbe Formular noch einmal ab — diesmal bestätigt.
-->
{#if rueckfrage}
	<div class="meldung frage" role="alert">
		<p>{rueckfrage.text}</p>
		<form method="POST" action="?/aufnehmen" class="knoepfe">
			<input type="hidden" name="versammlung" value={rueckfrage.versammlung} />
			<input type="hidden" name="stelle" value={String(rueckfrage.stelle)} />
			<input type="hidden" name="bestaetigt" value="ja" />
			<button type="submit" class="haupt">Trotzdem aufnehmen</button>
			<a href="/tage/{data.rahmenTag.id}/haeuser">Lassen</a>
		</form>
	</div>
{/if}

{#if data.dabei.length === 0}
	<p class="leer">Noch tagt keine Gemeinschaft mit. Nehmen Sie unten eine Versammlung auf.</p>
{:else}
	<div class="kacheln">
		{#each data.dabei as v (v.id)}
			<Karte
				titel={v.gemeinschaft}
				antwort={beschriftung(versammlungsstufe(v.stufe))}
				zusatz="{datumLang(v.datum)} · {v.ort} · {zustandsname(v.zustand)}{v.archiviertAm
					? ' · im Archiv'
					: ''}"
			>
				{#snippet erklaerung()}
					<p>
						«Aus der Versammlung lösen» hebt nur die Zuordnung auf: Die Versammlung bleibt
						bestehen, mit ihren Traktanden, Zugängen und ihrem Verlauf. Sie steht danach wieder
						für sich und lässt sich hier jederzeit wieder aufnehmen. Gelöscht wird sie nie —
						eine Versammlung ist ein Nachweis.
					</p>
				{/snippet}
				{#snippet fuss()}
					<div class="handlungen">
						<a href="/versammlungen/{v.id}">Vorbereiten</a>
						<form method="POST" action="?/loesen">
							<input type="hidden" name="versammlung" value={v.id} />
							<button type="submit" class="leise">Aus der Versammlung lösen</button>
						</form>
					</div>
				{/snippet}
			</Karte>
		{/each}
	</div>
{/if}

<h2>Eine weitere Versammlung aufnehmen</h2>
{#if data.waehlbar.length === 0}
	<p class="leer">
		Es gibt keine Versammlung, die noch nicht eröffnet ist und hier fehlt. Eine neue legen Sie
		unter <a href="/versammlungen/neu">Neue Versammlung</a> an.
	</p>
{:else}
	<form method="POST" action="?/aufnehmen" class="felder">
		<label class="breit">
			Versammlung
			<Suchauswahl
				name="versammlung"
				beschriftung="Versammlung"
				leerText="— wählen —"
				pflicht
				eintraege={data.waehlbar.map((v) => ({ wert: v.id, text: zeile(v) }))}
			/>
			<span class="hilfe">
				Tag und Ort der Versammlung bleiben, wie sie in der Einladung stehen — das Aufnehmen
				ändert sie nicht.
			</span>
		</label>
		<label>
			Stelle im Ablauf
			<input type="number" name="stelle" min="0" {...anfangswert(String(data.dabei.length))} />
		</label>
		<button type="submit">Aufnehmen</button>
	</form>
{/if}

<style>
	.meldung {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		margin: 0 0 1rem;
		max-width: var(--lesebreite);
		padding: 0.75rem 1rem;
	}

	.meldung.gut {
		align-items: center;
		background: color-mix(in srgb, var(--akzent) 15%, transparent);
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.meldung.fehler {
		background: color-mix(in srgb, var(--fehler) 12%, transparent);
		color: var(--fehler);
	}

	.meldung.frage {
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
	}

	.meldung.frage p {
		margin: 0 0 0.75rem;
	}


	.knoepfe {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.handlungen {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	h2 {
		margin-top: 2rem;
	}

	.leer,
	.hilfe {
		color: var(--text-leise);
		display: block;
		font-size: 0.9rem;
	}
</style>
