<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import { uhrzeit } from '$lib/domain/datum';
	import { zustandsname } from '$lib/domain/versammlung';
	import { ohneKontrollkarte } from '$lib/domain/anwesenheit';
	import Einlass from '$lib/components/Einlass.svelte';
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';
	import Kartenscanner from '$lib/components/Kartenscanner.svelte';
	import Meldung from '$lib/components/Meldung.svelte';
	import Papierentscheid from '$lib/components/Papierentscheid.svelte';

	/**
	 * Die Einlass-Seite fürs Telefon: scannen, sehen, entscheiden.
	 *
	 * **Was hier bewusst fehlt** (Auftraggeber, 20.08.2026: «Das muss ja nicht in die
	 * Ansicht gepresst werden, wenn das Handy für das Checkin gebraucht wird.
	 * Der Laptop liegt ja nebenan»): Beamer, Wandbild, Beschlussfähigkeit, die
	 * Liste aller Parteien, Vollmachten, Codeausgabe. Alles davon steht eine
	 * Verknüpfung entfernt in der Anwesenheitssicht — auf dem Notebook, das
	 * daneben liegt.
	 *
	 * Was bleibt, sind die drei Dinge, die am Eingang zwischen zwei Menschen
	 * passieren: die Karte lesen, prüfen wer davorsteht, einlassen oder nicht.
	 */
	let { data, form } = $props();

	const v = $derived(data.versammlung);
	const laufend = $derived(v.zustand === 'laufend');

	let scanfeld = $state<HTMLInputElement | null>(null);
	let scanformular = $state<HTMLFormElement | null>(null);
	let weggelegt = $state(false);

	const rohkontrolle = $derived(
		(form && 'geprueft' in form ? form.geprueft : null) ?? data.gescannt ?? null
	);
	const kontrolle = $derived(weggelegt ? null : rohkontrolle);

	function scanne(inhalt: string) {
		if (!scanfeld || !scanformular) return;
		scanfeld.value = inhalt;
		scanformular.requestSubmit();
	}

	/*
	 * Wortgleich mit der Anwesenheitssicht (`versammlungen/[id]/anwesenheit`) —
	 * dort steht, warum die Karte ins Blickfeld gerollt wird und warum das an
	 * `danach` hängt und nicht an `beiErfolg`.
	 */
	const nachPruefung = absenden({
		reset: false,
		danach: async () => {
			weggelegt = false;
			// **Erst zeichnen lassen, dann suchen.** Die Karte hängt an `weggelegt`;
			// wer sie im selben Zug sucht, findet nichts (28.08.2026 gefunden).
			await tick();
			document.getElementById('gescannt')?.scrollIntoView({ block: 'center' });
		}
	});

	const nachEinlass = absenden({
		danach: () => {
			weggelegt = false;
		}
	});

</script>

<div class="kopf">
	<h1>Einlass</h1>
	<span class="zustand" data-zustand={v.zustand}>{zustandsname(v.zustand)}</span>
</div>
<p class="unterzeile">
	{data.gemeinschaftName} · <strong>{data.anwesend}</strong> von {data.gesamt} anwesend
</p>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.bestaetigt}
	<Meldung ton="gut" marke={form}>{form.bestaetigt}</Meldung>
{:else if form?.hinweis}
	<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
{/if}

<Papierentscheid papier={form && 'papier' in form ? form.papier : null} />

{#if !laufend}
	<p class="meldung warnung">
		{v.zustand === 'freigegeben'
			? 'Die Versammlung ist noch nicht eröffnet — die Anwesenheit zählt erst ab der Eröffnung.'
			: 'Die Versammlung läuft nicht mehr. Die Anwesenheit steht fest.'}
	</p>
{/if}

<!-- ── Was gescannt wurde ──────────────────────────────────────────────── -->
{#if kontrolle}
	<section class="gescannt" id="gescannt">
		<p class="woher">Karte gescannt · zur Kontrolle</p>
		<h2>{kontrolle.name}</h2>
		<p class="einheiten">{kontrolle.einheiten.join(' · ')}</p>
		<p class="stimmkraft">
			{kontrolle.kopfstimmen}
			{kontrolle.kopfstimmen === 1 ? 'Kopfstimme' : 'Kopfstimmen'} ·
			{kontrolle.wertquote} von {kontrolle.gesamtquote} Wertquoten
		</p>
		{#if kontrolle.schonAnwesend}
			<p class="schonda">
				Bereits als anwesend erfasst{#if kontrolle.seit}, seit {uhrzeit(kontrolle.seit)}{/if}. Ein
				zweiter Eintrag entsteht nicht.
			</p>
		{/if}
		{#if kontrolle.wartetSchon}
			<!--
				**Sonst stünde dieselbe Person zweimal da** (11.09.2026, vom Auftraggeber im
				Eingangstest gefunden): einmal hier als gescannte Karte, einmal unten im
				Kasten «Am Eingang», je mit eigenem Knopfpaar. Auf diesem schmalen
				Bildschirm rollt der Daumen an beiden vorbei. Der wartende Eintrag
				entfällt darum, solange diese Karte oben steht — in der Laptopsicht
				bleibt er stehen, dort ist der Kasten die Liste, die man abarbeitet
				(Vorgabe des Auftraggebers).
			-->
			<p class="schonda">
				Hat sich schon selbst angemeldet und wartet auf die Freigabe. Was Sie hier drücken, gibt
				genau diese Anmeldung frei.
			</p>
			<!--
				**Und das Ablehnen muss mit** (11.09.2026, im Code-Review gefunden).
				Den Weg trug bisher nur der Wartendenkasten. Wer den Eintrag dort
				ausblendet, ohne ihn hier anzubieten, hat die Anmeldung unabweisbar
				gemacht — «Verwerfen» daneben legt bloss die Karte weg und lässt die
				Anmeldung stehen.
			-->
			<form method="POST" action="?/ablehnen" class="ablehnen" use:enhance={absenden()}>
				<input type="hidden" name="partei" value={kontrolle.parteiId} />
				<Rueckfrage
					beschriftung="Anmeldung ablehnen"
					zeichen="kreuz"
					ton="fehler"
					gesperrt={!laufend}
					marke="ablehnen:{kontrolle.parteiId}"
					frage="Anmeldung von {kontrolle.name} ablehnen?"
					folge="Die Person bleibt abwesend und zählt nicht mit. Sie kann sich erneut anmelden."
					bestaetigen="Ablehnen"
				/>
			</form>
		{/if}
		{#if kontrolle.aufPapier}
			<p class="aufpapier">
				<strong>Stimmt an dieser Versammlung von Hand ab.</strong> Die Sitzungsleitung überträgt
				die Stimmen, das Telefon dieser Partei stimmt nicht mit.
			</p>
			<form method="POST" action="?/papierZuruecknehmen" class="zuruecknehmen">
				<input type="hidden" name="partei" value={kontrolle.parteiId} />
				<button type="submit" class="handlung">Vermerk zurücknehmen</button>
			</form>
		{/if}
		<form method="POST" action="?/einlassen" enctype="multipart/form-data" use:enhance={nachEinlass}>
			<input type="hidden" name="partei" value={kontrolle.parteiId} />
			<input type="hidden" name="weg" value="gescannt" />
			<span class="entscheid">
				{#if data.papierfrage}
					<!--
						**Enter darf hier nichts erraten.** Die beiden Knöpfe sind die Frage;
						ein Vorgabeknopf machte aus einem Tastendruck die Antwort «digital»,
						und genau die soll niemand ungefragt geben. Der Platzhalter steht
						INNERHALB des Zweiges: Ist die Frage aus, bleibt es beim einen Knopf
						und bei dem Verhalten, das er bisher hatte.
					-->
					<button type="submit" disabled hidden data-vorgabe="keiner">Kein Vorgabeknopf</button>
					<!--
						**Die Frage steht am Knopf, nicht daneben.** Sie ist am Eingang
						nicht mehr Arbeit als vorher: Es war ein Knopf, jetzt sind es
						zwei, und beide erfassen die Anwesenheit.

						Keiner ist vorbelegt. Wer nicht gefragt wird, gilt als digital,
						und das ist genau der Fall, den diese Frage abfangen soll.
					-->
					<button type="submit" name="papier" value="nein" class="haupt" disabled={!laufend}>
						Erfassen, stimmt digital
					</button>
					<button
						type="submit"
						name="papier"
						value="ja"
						class="haupt vonhand"
						disabled={!laufend}
					>
						Erfassen, stimmt von Hand
					</button>
				{:else}
					<button type="submit" class="haupt" disabled={!laufend}>Als anwesend erfassen</button>
				{/if}
				<button
					type="button"
					class="handlung"
					data-ton="fehler"
					onclick={() => (weggelegt = true)}
				>
					Verwerfen
				</button>
			</span>
		</form>
	</section>
{/if}

<!-- ── Scannen ─────────────────────────────────────────────────────────── -->
<section class="scannen">
	<form
		method="POST"
		action="?/pruefen"
		bind:this={scanformular}
		use:enhance={nachPruefung}
		hidden
	>
		<input type="hidden" name="code" bind:this={scanfeld} />
	</form>
	<Kartenscanner beiFund={scanne} angehalten={kontrolle !== null} />

	<form method="POST" action="?/pruefen" class="zeile">
		<label>
			<span class="nurLeser">Zugangscode</span>
			<input
				name="code"
				placeholder="ABCD-EFGH-JKMN-PQRS-TWXY"
				autocomplete="off"
				autocapitalize="characters"
				spellcheck="false"
			/>
		</label>
		<button type="submit">Nachschlagen</button>
	</form>
	<p class="klein">
		<strong>Nachschlagen erfasst noch nichts</strong> — es zeigt Ihnen, wer dahintersteckt, und Sie
		entscheiden. Die Kamera-App Ihres Telefons führt auf dieselbe Karte: Sie öffnet den Link
		der gescannten Zugangskarte.
	</p>
</section>

<!-- ── Wer wartet ──────────────────────────────────────────────────────── -->
<!--
	**Nur filtern, wenn die Karte den Wartezustand auch kennt** (zweiter
	Reviewdurchgang, 11.09.2026). `kontrolle` kommt aus `?/pruefen` und ist damit
	eine Momentaufnahme. Meldet sich die Person zwischen dem Nachschlagen und dem
	nächsten Laden selbst an, trüge die Karte `wartetSchon: false` — und ohne
	diese Bedingung verschwände der wartende Eintrag ersatzlos, samt seinem Weg
	zum Ablehnen.
-->
<Einlass
	wartende={ohneKontrollkarte(data.wartende, kontrolle?.wartetSchon ? kontrolle : null)}
	saalmeldungen={data.saalmeldungen}
	parteien={data.parteien}
	{laufend}
/>

<p class="weiter">
	<a href="/versammlungen/{v.id}/anwesenheit">Ganze Anwesenheitssicht</a> — Liste, Vollmachten,
	Codes, Beamer. Auf dem Notebook.
</p>

<style>
	.kopf {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.unterzeile {
		margin-top: -0.5rem;
		color: var(--text-leise);
	}

	/* Die Karte ist der Grund, warum es diese Seite gibt: gross, ruhig, mit
	   einer Entscheidung darunter. */
	.gescannt {
		border: 2px solid var(--akzent);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--akzent) 8%, var(--flaeche));
		padding: 1rem 1.15rem;
		margin: 1.25rem 0;
	}

	.woher {
		margin: 0;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-leise);
	}

	.gescannt h2 {
		margin: 0.1rem 0 0.2rem;
		font-size: 1.6rem;
	}

	.einheiten {
		margin: 0 0 0.3rem;
		color: var(--text-leise);
	}

	.stimmkraft {
		margin: 0 0 0.9rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.schonda {
		margin: 0 0 0.75rem;
		padding: 0.5rem 0.7rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
	}

	.entscheid {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.gescannt button.haupt {
		font-size: 1.05rem;
		padding: 0.7rem 1.4rem;
		border: none;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font-weight: 550;
		cursor: pointer;
	}

	.gescannt button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.scannen {
		margin: 1.5rem 0;
		max-width: 46rem;
	}

	.zeile {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.zeile label {
		flex: 1 1 14rem;
	}

	.zeile input {
		width: 100%;
		min-height: var(--ziel-min);
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		font-family: ui-monospace, monospace;
		letter-spacing: 0.06em;
	}

	.zeile button {
		min-height: var(--ziel-min);
		padding: 0 1.15rem;
		border: none;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font: inherit;
		font-weight: 550;
		cursor: pointer;
	}

	.klein {
		font-size: 0.85rem;
		color: var(--text-leise);
		max-width: 52ch;
	}

	.nurLeser {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}

	.meldung {
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		max-width: 46rem;
		margin-top: 1rem;
	}


	.meldung.warnung {
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
	}


	/* Zwei gleichwertige Knöpfe: gleiche Grösse, gleiches Gewicht. Der eine
	   trägt den Akzent, der andere die Linie — verschieden genug, um sie unter
	   Zeitdruck auseinanderzuhalten, ohne einen davon zur Vorgabe zu machen. */
	.gescannt button.haupt.vonhand {
		background: var(--flaeche);
		color: var(--text);
		border: 2px solid var(--akzent);
	}

	.aufpapier {
		margin: 0 0 0.5rem;
		padding: 0.5rem 0.7rem;
		border-radius: var(--radius);
		background: var(--flaeche-2);
	}

	.zuruecknehmen {
		margin: 0 0 0.9rem;
	}


	.weiter {
		margin-top: 2rem;
		font-size: 0.9rem;
		color: var(--text-leise);
		max-width: 52ch;
	}
</style>
