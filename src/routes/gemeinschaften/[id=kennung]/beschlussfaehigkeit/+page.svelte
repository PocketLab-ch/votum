<script lang="ts">
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import { anfangswert, gefuehrteWahl } from '$lib/felder';
	import Meldung from '$lib/components/Meldung.svelte';
	let { data, form } = $props();

	/*
	 * **Die Anteilsbedingung folgt der gewählten Stufe** (Code-Review 06.09.2026).
	 *
	 * Bis dahin stand das Kästchen leer und die Auswahl auf «Erstversammlung» —
	 * also im einzigen Zustand, den `pruefeErschwerung` zwingend abweist: Bei der
	 * ersten Versammlung kennt das Gesetz die Anteilsbedingung, und sie
	 * wegzulassen ist eine Erleichterung. Der Vorgabeweg des Formulars endete
	 * damit immer in einer Absage.
	 *
	 * Bei «erste» geht sie deshalb als verstecktes Feld mit, statt als Kästchen
	 * zum Abwählen dazustehen: Ein abgeschaltetes Kästchen schickt nichts, und
	 * ein anklickbares böte eine Wahl an, die es nicht gibt.
	 */
	let stufe = $state<'erste' | 'zweite'>('erste');
	let quotenGewaehlt = $state(false);
	const mitQuoten = $derived(stufe === 'erste' || quotenGewaehlt);

	const andereArt = $derived(data.art === 'erste' ? 'zweite' : 'erste');
</script>

<h1>Beschlussfähigkeit nach ZGB Art. 712p</h1>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.gespeichert}
	<Meldung ton="gut" marke={form}>Regel hinterlegt.</Meldung>
{:else if form?.aufgehoben}
	<Meldung ton="gut" marke={form}>Regel aufgehoben.</Meldung>
{/if}

<nav class="reiter">
	<a href="?art=erste&kopf={data.anwesendKopf}&quoten={data.anwesendQuoten}" class:aktiv={data.art === 'erste'}>
		Erstversammlung
	</a>
	<a href="?art=zweite&kopf={data.anwesendKopf}&quoten={data.anwesendQuoten}" class:aktiv={data.art === 'zweite'}>
		Zweitversammlung
	</a>
</nav>

<!--
	**Ein Rechenschieber, keine Feststellung** (23.08.2026, Prüflauf I, A-21). Die
	Felder sind vorbelegt, das Ergebnis steht in einer grünen Zeile «✓
	Beschlussfähig» — und der Prüfer wusste nicht, ob das eine Aussage über eine
	konkrete Versammlung ist. Sie ist es nicht: Hier probiert man Zahlen durch,
	bevor der Abend kommt. Die Feststellung für einen konkreten Abend steht auf
	der Anwesenheitsseite und rechnet mit den Leuten, die wirklich da sind.
-->
<p class="hilfe lesebreite">
	<strong>Zum Durchrechnen.</strong> Tragen Sie ein, wie viele Stockwerkeigentümer und Wertquoten
	anwesend wären, und sehen Sie, ob es reichte. Für die <em>wirkliche</em> Feststellung an
	einem Abend zählt die
	<a href="/gemeinschaften/{data.gemeinschaft.id}">Anwesenheit der Versammlung</a>, nicht
	diese Seite.
</p>

<form method="GET" class="felder">
	<input type="hidden" name="art" value={data.art} />
	<label class="schmal">
		Stockwerkeigentümer anwesend oder vertreten
		<input
			type="number"
			name="kopf"
			min="0"
			max={data.eigentuemerGesamt}
			{...anfangswert(data.anwesendKopf)}
		/>
		<span class="hilfe">
			von {data.eigentuemerGesamt} — <strong>Personen</strong>, nicht Stimmen. Art. 712p zählt
			Köpfe; wem drei Wohnungen gehören, der ist trotzdem einer.
		</span>
	</label>
	<label class="schmal">
		Wertquoten anwesend oder vertreten
		<input type="number" name="quoten" min="0" max={data.gesamtquote} {...anfangswert(data.anwesendQuoten)} />
		<span class="hilfe">von {data.gesamtquote}</span>
	</label>
	<button type="submit">Feststellen</button>
</form>

<article class="feststellung" class:ja={data.feststellung.beschlussfaehig}>
	<p class="marke">
		{data.feststellung.beschlussfaehig ? 'Beschlussfähig' : 'Nicht beschlussfähig'}
	</p>

	<ul class="bedingungen">
		{#each data.feststellung.bedingungen as b (b.bezeichnung)}
			<li class:erfuellt={b.erfuellt}>
				<span aria-hidden="true">{b.erfuellt ? '✓' : '✗'}</span>
				{b.bezeichnung}: <strong>{b.vorhanden}</strong>, mindestens {b.noetig} nötig
			</li>
		{/each}
	</ul>

	{#if !data.feststellung.beschlussfaehig}
		<p class="fehlt">Es fehlt: {data.feststellung.fehlt}</p>
		{#if data.art === 'erste'}
			<p class="klein">{data.fristhinweis}</p>
		{/if}
	{/if}

	<p class="grundlage">
		{#if data.feststellung.grundlage === 'reglement'}
			Angewandt wird die hinterlegte Regel dieser Gemeinschaft ({data.feststellung.fundstelle}).
		{:else if data.art === 'erste'}
			Gesetzliche Regel: die Hälfte aller Stockwerkeigentümer, die zugleich zur Hälfte
			anteilsberechtigt sind, mindestens aber zwei (ZGB Art. 712p Abs. 1).
		{:else}
			Gesetzliche Regel: ein Drittel aller Stockwerkeigentümer, mindestens aber zwei — ohne
			Anteilsbedingung (ZGB Art. 712p Abs. 3).
		{/if}
	</p>

	<div class="hinweis">
		<h2>Bei Einstimmigkeitstraktanden</h2>
		<p>{data.einstimmigkeitshinweis}</p>
	</div>
</article>

<h2>Abweichende Regel im Reglement</h2>

<p class="einleitung">
	Das Reglement darf die Beschlussfähigkeit <strong>erschweren</strong>, nicht erleichtern. Ein
	tieferes Anwesenheitsquorum liesse eine kleine Gruppe für alle entscheiden; eine erleichternde
	Regel wird deshalb abgewiesen und nicht mit einem Hinweis übernommen.
</p>

{#each ['erste', 'zweite'] as art (art)}
	{@const regel = data.regeln[art as 'erste' | 'zweite']}
	<section class="kasten">
		<h3>{art === 'erste' ? 'Erstversammlung' : 'Zweitversammlung'}</h3>
		{#if regel}
			<p>
				Mindestens {regel.kopf.zaehler}/{regel.kopf.nenner} der Stockwerkeigentümer{#if regel.quoten}
					und {regel.quoten.zaehler}/{regel.quoten.nenner} der Wertquoten{/if}, mindestens aber
				{regel.mindestens}. Fundstelle: {regel.fundstelle}
			</p>
			<form method="POST" action="?/aufheben">
				<input type="hidden" name="art" value={art} />
				<button type="submit" class="leise">Aufheben</button>
			</form>
		{:else}
			<p class="klein">Keine Abweichung hinterlegt — es gilt das Gesetz.</p>
		{/if}
	</section>
{/each}

<form method="POST" action="?/hinterlegen" class="formular" use:enhance={absenden()}>
	<label class="schmal">
		Für welche Versammlung
		<!--
			`use:gefuehrteWahl` und `selected` statt `bind:value`: Letzteres
			überschreibt beim Aufbau, was vor der Hydration gewählt wurde — im Saal
			auf einem fremden Telefon der Normalfall. Die Begründung steht bei
			`gefuehrteWahl` in `$lib/felder`, der Wächter dazu in `check:code`. Er
			hat diese Zeile im ersten Anlauf gefangen.
		-->
		<select name="art" required use:gefuehrteWahl={(w) => (stufe = w as 'erste' | 'zweite')}>
			<option value="erste" selected={stufe === 'erste'}>Erstversammlung</option>
			<option value="zweite" selected={stufe === 'zweite'}>Zweitversammlung</option>
		</select>
	</label>

	<!--
		**Die Bruchfelder stehen leer** (Bedienbarkeitsprüfung 05.09.2026,
		Befund 17): «Das Formular ‹Abweichende Regel› ist mit 2/3 vorbelegt —
		weder Gesetz noch Reglement.»

		Eine Vorbelegung ist ein Vorschlag, und hier gibt es nichts vorzuschlagen:
		Was gilt, steht im Reglement dieser Gemeinschaft, und nur wer es vor sich
		hat, kennt die Zahl. «2/3» sah aus wie die Antwort der Anwendung und war
		bloss ein häufiger Wert — wer ihn stehen liess, hinterlegte ein
		Anwesenheitsquorum, das niemand beschlossen hat.

		**Die Mindestzahl bleibt vorbelegt**, weil sie etwas anderes ist: Zwei
		steht im Gesetz (ZGB Art. 712p Abs. 1) und ist die Untergrenze, die eine
		Reglementsregel nicht unterschreiten darf. Das ist kein geratener Wert,
		sondern der einzige zulässige Startpunkt.

		Beim Leeren fiel auf, dass ein leeres Feld die Fachprüfung passierte: `NaN`
		bestand jede Erschwerungsprüfung, weil `NaN < 0.5` falsch ist. Gespeichert
		wurde es deswegen nicht — die Spalten sind `integer NOT NULL`, und
		Postgres wies «NaN» mit 22P02 ab. Angekommen ist es als **Fehlerseite**
		statt als Feldmeldung, weil die Aktion nur `FachlicherFehler` fängt.
		Dieselbe Lücke hatte der Bruch 5/3: fachlich keine Erleichterung, aber ein
		Verstoss gegen `bylaw_attendance_kopf_bruch`. `pruefeErschwerung` bildet
		den CHECK jetzt vollständig nach.
	-->
	<fieldset>
		<legend>Stockwerkeigentümer — mindestens</legend>
		<div class="reihe">
			<label class="eng">
				Zähler
				<input type="number" name="kopfZaehler" min="1" max="100" required />
			</label>
			<label class="eng">
				Nenner
				<input type="number" name="kopfNenner" min="2" max="100" required />
			</label>
			<!--
				**«Untergrenze» wovon?** (23.08.2026, Prüflauf I, A-20). Das Feld stand
				neben «Zähler» und «Nenner», und der Prüfer musste raten, ob es ein
				dritter Bruchteil ist oder eine Personenzahl — geraten hat er aus dem
				Titel des Feldsets, bestätigt erst durch Ausprobieren.
			-->
			<label class="mindestzahl">
				Mindestzahl Köpfe
				<input type="number" name="mindestens" min="2" max="99" value="2" required />
				<span class="hilfe">
					Keine Quote, sondern eine Zahl von Personen: Auch wenn der Bruch weniger ergäbe,
					müssen so viele da sein. Das Gesetz nennt zwei (ZGB Art. 712p Abs. 1).
				</span>
			</label>
		</div>
	</fieldset>

	{#if stufe === 'erste'}
		<input type="hidden" name="mitQuoten" value="true" />
		<p class="hilfe">
			<strong>Die Anteilsbedingung gehört dazu.</strong> Bei der Erstversammlung verlangt das Gesetz
			sie. Sie wegzulassen wäre eine Erleichterung. Und eine, die man leicht übersieht: Sie steht
			nicht in einer Zahl, sondern in deren Fehlen.
		</p>
	{:else}
		<label class="kasten-label">
			<input type="checkbox" name="mitQuoten" value="true" bind:checked={quotenGewaehlt} />
			Zusätzlich eine Anteilsbedingung
			<span class="hilfe">
				Bei der Zweitversammlung verlangt das Gesetz keine. Das Reglement darf eine verlangen.
			</span>
		</label>
	{/if}

	{#if mitQuoten}
		<fieldset>
			<legend>Wertquoten — mindestens</legend>
			<div class="reihe">
				<label class="eng">
					Zähler
					<input type="number" name="quotenZaehler" min="1" max="100" required />
				</label>
				<label class="eng">
					Nenner
					<input type="number" name="quotenNenner" min="2" max="100" required />
				</label>
			</div>
		</fieldset>
	{/if}

	<label class="breit">
		Fundstelle im Reglement
		<input name="fundstelle" required minlength="3" placeholder="Reglement Ziff. 8.1" />
	</label>

	<button type="submit">Hinterlegen</button>
</form>

<style>

	h2 {
		margin-top: 2rem;
		font-size: 1.15rem;
	}

	.reiter {
		display: flex;
		gap: 0.5rem;
		margin: 1.25rem 0 0.75rem;
	}

	.reiter a {
		min-height: var(--ziel-min);
		display: inline-flex;
		align-items: center;
		padding: 0 1rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: inherit;
		text-decoration: none;
		font-size: 0.9rem;
	}

	.reiter a.aktiv {
		border-color: var(--akzent);
		background: color-mix(in srgb, var(--akzent) 15%, transparent);
		font-weight: 550;
	}

	.feststellung {
		border: 1px solid var(--fehler);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 1.15rem;
		max-width: 46rem;
		margin: 1.25rem 0;
	}

	.feststellung.ja {
		border-color: var(--akzent);
	}

	.marke {
		display: inline-block;
		padding: 0.15rem 0.7rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--fehler) 18%, transparent);
		font-weight: 550;
		margin: 0 0 0.75rem;
	}

	.feststellung.ja .marke {
		background: color-mix(in srgb, var(--akzent) 25%, transparent);
	}

	.bedingungen {
		list-style: none;
		padding: 0;
		margin: 0 0 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.bedingungen li {
		font-variant-numeric: tabular-nums;
	}

	.fehlt {
		font-weight: 550;
	}

	.grundlage,
	.klein,
	.hilfe {
		font-size: 0.875rem;
		color: var(--text-leise);
		font-weight: 400;
	}

	.hinweis {
		border-top: 1px solid var(--linie);
		padding-top: 0.9rem;
		margin-top: 0.9rem;
	}

	.hinweis h2 {
		margin: 0 0 0.35rem;
		font-size: 0.95rem;
	}

	.kasten {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 0.85rem 1rem;
		margin: 0.75rem 0;
		max-width: 46rem;
	}

	.kasten h3 {
		margin: 0 0 0.35rem;
		font-size: 0.95rem;
	}

	.kasten p {
		margin: 0 0 0.5rem;
	}




	.formular {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		align-items: flex-start;
		max-width: 46rem;
		margin-top: 1rem;
	}

	fieldset {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.75rem 1rem 1rem;
		width: 100%;
	}

	legend {
		font-size: 0.85rem;
		font-weight: 550;
		padding: 0 0.35rem;
	}

	.reihe {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.9rem;
		font-weight: 550;
	}

	.schmal {
		max-width: 15rem;
	}

	.eng {
		flex: 0 0 7rem;
	}

	/*
	 * **Das Feld bleibt schmal, die Erklärung darunter nicht** (UI-Durchgang
	 * 06.10.2026). Als `.eng` stand die Hilfe in derselben 7rem-Spalte wie das
	 * Zahlenfeld: 14 Zeilen zu ein bis zwei Wörtern, 291 px hoch, bei 1440 wie
	 * bei 390 px. Die Beschriftung nimmt jetzt den Rest der Reihe, das Feld
	 * behält die Breite seiner Nachbarn.
	 */
	.mindestzahl {
		flex: 1 1 16rem;
		min-width: 0;
	}

	.mindestzahl input {
		width: 7rem;
		max-width: 100%;
	}

	.breit {
		width: 100%;
	}

	.kasten-label {
		flex-direction: row;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
		font-weight: 400;
		min-height: var(--ziel-min);
	}

	.kasten-label .hilfe {
		flex-basis: 100%;
	}

	input,
	select {
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

	button.leise {
		background: transparent;
		border: 1px solid var(--linie);
		color: var(--text-leise);
		padding: 0 0.9rem;
	}
</style>
