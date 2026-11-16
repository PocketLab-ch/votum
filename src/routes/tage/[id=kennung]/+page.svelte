<script lang="ts">
	/**
	 * Angaben der gemeinsamen Versammlung — ein Formular, ein Speicherknopf.
	 *
	 * Nach `docs/gestaltung.md`: Die Seite beantwortet **eine** Frage («wann und
	 * wo?»), der Knopf steht zuunterst, und wer die Seite mit offenen Änderungen
	 * verlässt, wird gefragt.
	 *
	 * **Dieselben Felder wie beim Anlegen**, in denselben Spuren: Bis zum
	 * 11.08.2026 lagen Tag, Beginn und Ort in einer eigenen `.zeile`, und weil
	 * das eine Zwischenebene im Baum ist, griff `.felder > label` nicht mehr —
	 * die Beschriftungen standen inline neben ihren Feldern, während Bezeichnung
	 * und Bemerkung daneben gestapelt waren.
	 */
	import { untrack } from 'svelte';
	import Ungespeichert from '$lib/components/Ungespeichert.svelte';
	import { anfangswert, angekreuzt } from '$lib/felder';
	import Meldung from '$lib/components/Meldung.svelte';
	import { abstimmungsweise, beschriftung } from '$lib/domain/klartext';

	let { data, form } = $props();

	const w = $derived(
		form && 'werte' in form && form.werte
			? form.werte
			: {
					bezeichnung: data.tag.bezeichnung,
					datum: data.tag.datum,
					uhrzeit: data.tag.uhrzeit,
					ort: data.tag.ort,
					bemerkung: data.tag.bemerkung ?? '',
					art: data.tag.art,
					anlass: data.tag.anlass ?? '',
					betriebsart: data.tag.betriebsart
				}
	);

	const abstimmText = {
		einfach: abstimmungsweise('einfach'),
		gefuehrt: abstimmungsweise('gefuehrt')
	};

	/**
	 * Die Art lebt im Browser, weil sie das Anlassfeld ein- und ausblendet.
	 *
	 * Der Startwert kommt aus `untrack`, damit Svelte ihn nicht für eine
	 * Abhängigkeit hält — und nach einem abgewiesenen Formular aus `form`: Der
	 * Server hat die Seite dann neu gezeichnet, und ohne das stünde die Wahl
	 * wieder auf «ordentlich», während der eingetippte Anlass unsichtbar wäre.
	 */
	let art = $state<'ordentlich' | 'ausserordentlich'>(
		untrack(() =>
			form && 'werte' in form && form.werte?.art ? form.werte.art : data.tag.art
		)
	);

	const anzahl = $derived(data.mittagende);
	const abweichend = $derived(data.abweichend);
</script>

<h1>Wann und wo?</h1>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.hinweis}
	<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
{/if}

<form id="angaben" method="POST" action="?/speichern" class="felder">
	<label class="voll">
		Bezeichnung
		<input name="bezeichnung" required minlength="2" maxlength="200" {...anfangswert(w.bezeichnung)} />
		<span class="hilfe">So steht sie in der Liste und auf der Tafel im Saal.</span>
	</label>
	<label>
		Tag
		<input type="date" name="datum" required {...anfangswert(w.datum)} />
	</label>
	<label>
		Beginn
		<input type="time" name="uhrzeit" required {...anfangswert(w.uhrzeit)} />
	</label>
	<label class="breit">
		Ort
		<input name="ort" required minlength="2" {...anfangswert(w.ort)} />
	</label>
	<label class="voll">
		Bemerkung
		<input name="bemerkung" {...anfangswert(w.bemerkung)} />
	</label>
</form>

<!--
	Die Art gehört zum Anlass, nicht zum einzelnen Haus: Sechs Gemeinschaften,
	die zusammen tagen, tun das aus demselben Grund. Sie steht deshalb hier —
	und wird mit dem Häkchen unten auf alle umgelegt.
-->
<h2>Was für eine Versammlung?</h2>
<div class="wahlen">
	<label class="wahl">
		<input type="radio" name="art" value="ordentlich" form="angaben" bind:group={art} />
		<span>
			<strong>Die jährliche Versammlung (ordentlich)</strong>
			<span class="hilfe">Die immer gleichen Geschäfte entstehen von selbst.</span>
		</span>
	</label>
	<label class="wahl">
		<input type="radio" name="art" value="ausserordentlich" form="angaben" bind:group={art} />
		<span>
			<strong>Aus einem besonderen Anlass (ausserordentlich)</strong>
			<span class="hilfe">Der Anlass gehört in die Einladung.</span>
		</span>
	</label>
	{#if art === 'ausserordentlich'}
		<label class="eingerueckt">
			Anlass
			<input name="anlass" form="angaben" required maxlength="200" {...anfangswert(w.anlass)} />
			<span class="hilfe">Er gehört in die Einladung und ins Protokoll jeder Gemeinschaft.</span>
		</label>
	{/if}
</div>

<!--
	**Wie wird abgestimmt — für den ganzen Saal** (Auftraggeber, 25.08.2026: «Kann ich in
	der Gruppen-Veranstaltung sagen, ob von Hand gezählt wird oder über die App?
	[…] ‹Wie wird abgestimmt?› fehlt bei Gruppenveranstaltung»).

	**Hart**, und zwar nicht aus Ordnungsliebe: Einlass, Wand und Stimmerfassung
	folgen ihr. Halb Handzeichen, halb Telefon hiesse, im selben Raum zwei
	Verfahren zugleich zu führen — und die Sitzungsleitung müsste bei jedem Punkt
	wissen, welches gerade gilt. Die ganze Matrix steht in
	`docs/vererbung-abend.md`.

	Dieselben Sätze wie am einzelnen Haus, aus `domain/klartext.ts`: Wer zwischen
	Gruppe und Haus wechselt, soll dieselbe Frage und dieselbe Antwort lesen.
-->
<h2>{abstimmText.einfach.frage}</h2>
<div class="wahlen">
	<label class="wahl">
		<input
			type="radio"
			name="betriebsart"
			value="einfach"
			form="angaben"
			{...angekreuzt(w.betriebsart === 'einfach')}
		/>
		<span>
			<strong>{beschriftung(abstimmText.einfach)}</strong>
			<span class="hilfe">{abstimmText.einfach.zusatz}</span>
		</span>
	</label>
	<label class="wahl">
		<input
			type="radio"
			name="betriebsart"
			value="gefuehrt"
			form="angaben"
			{...angekreuzt(w.betriebsart !== 'einfach')}
		/>
		<span>
			<strong>{beschriftung(abstimmText.gefuehrt)}</strong>
			<span class="hilfe">{abstimmText.gefuehrt.zusatz}</span>
		</span>
	</label>
</div>

<!--
	**Einmal ändern statt sechsmal.** Gemeldet am 11.08.2026: «Auch sollte man
	dies global ändern können, damit ich nicht X mal Angaben korrigieren muss,
	wenn der Ort oder Zeit und Datum änderten.» Vorangekreuzt, weil das der
	Normalfall ist — die gemeinsame Versammlung *ist* der Termin. Wer eine
	einzelne bewusst abweichen lässt, nimmt das Häkchen weg.
-->
{#if anzahl > 0}
	<div class="umlegen">
		<label class="kasten">
			<input type="checkbox" name="umlegen" value="ja" form="angaben" checked />
			<span>
				<strong>
					Auf {anzahl}
					{anzahl === 1 ? 'mittagende Versammlung' : 'mittagende Versammlungen'} übernehmen
				</strong>
				<!--
					Der Satz muss die **Gesperrten** mitrechnen. «Zurzeit stimmen alle
					überein» stand einmal direkt über «Nicht mitziehen können: A, B» —
					ein Widerspruch im selben Kasten, weil `abweichend` nur die
					änderbaren zählt.
				-->
				<span class="hilfe">
					{#if abweichend === 0 && data.gesperrt.length === 0}
						Zurzeit stimmen alle überein — dann ändert sich nichts.
					{:else if abweichend === 0}
						Zurzeit kann keine nachgezogen werden — die Gründe stehen unten.
					{:else}
						{abweichend}
						{abweichend === 1 ? 'weicht' : 'weichen'} zurzeit ab und {abweichend === 1
							? 'wird'
							: 'werden'} nachgezogen.
					{/if}
				</span>
			</span>
		</label>

		{#if data.gesperrt.length > 0}
			<p class="klein">
				Nicht mitziehen können: {data.gesperrt
					.map((g) => `${g.gemeinschaft} (${g.grund})`)
					.join(', ')}.
			</p>
		{/if}
	</div>
{/if}

<details class="erklaerung">
	<summary>Was heisst das?</summary>
	<p>
		Tag, Beginn, Ort, Art und Abstimmungsweise gehören zum gemeinsamen Anlass. Mit dem Häkchen
		gelten sie für jede Versammlung, die hier mittagt — solange sie im Entwurf ist.
	</p>
	<p>
		Bei der Abstimmungsweise ist das keine Bequemlichkeit, sondern nötig: Einlass, Tafel und
		Stimmerfassung folgen ihr. Wären zwei Häuser im selben Saal verschieden eingestellt, müsste
		die Sitzungsleitung zwei Verfahren gleichzeitig führen.
	</p>
	<p>
		Ab der Freigabe bleibt eine Versammlung stehen, auch mit dem Häkchen. Ihr Tag und ihr Ort
		stehen in versandten Einladungen — wer sie stillschweigend überschreibt, ändert etwas, das
		jemand schon gelesen hat. Welche Versammlungen das sind, sagt die Meldung nach dem
		Speichern — und die Seite der Versammlung selbst.
	</p>
</details>

<div class="abschluss">
	<button type="submit" form="angaben" class="haupt">Speichern</button>
	<a href="/versammlungen">Abbrechen</a>
	<Ungespeichert formular="angaben" />
</div>

<style>
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

	h2 {
		margin-top: 1.75rem;
	}

	/* Abgesetzt, weil es nicht das Formular ist, sondern seine Reichweite. */
	.umlegen {
		background: var(--flaeche-2);
		border-radius: var(--radius);
		margin-top: 1.5rem;
		max-width: var(--lesebreite);
		padding: 0.9rem 1rem;
	}

	.umlegen .kasten {
		align-items: start;
		display: flex;
		flex-direction: row;
		gap: 0.6rem;
		font-weight: 400;
	}

	.umlegen .kasten > span {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.umlegen input[type='checkbox'] {
		margin-top: 0.25rem;
		width: 1.1rem;
		height: 1.1rem;
		min-height: 0;
		flex: none;
	}

	.klein {
		color: var(--text-leise);
		font-size: 0.9rem;
		margin: 0.6rem 0 0;
	}

	.erklaerung {
		margin-top: 0.75rem;
		max-width: var(--lesebreite);
	}

	.erklaerung summary {
		cursor: pointer;
		color: var(--text-leise);
		font-size: 0.9rem;
	}

	.erklaerung p {
		color: var(--text-leise);
		font-size: 0.9rem;
		margin: 0.4rem 0 0;
	}

	.abschluss {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-top: 1.25rem;
	}
</style>
