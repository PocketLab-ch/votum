<script lang="ts">
	/**
	 * Die Ergebniskarte des Entscheidbaums.
	 *
	 * Als Komponente und nicht zweimal abgeschrieben: Sie ist die rechtlich
	 * massgebliche Erklärung, die im Protokoll landet. Zwei Fassungen davon
	 * liefen auseinander — und dann stünde auf dem Rechner etwas anderes als am
	 * Traktandum, ohne dass jemand sagen könnte, welche gilt.
	 */
	import type { Ergebniskarte } from '$lib/domain/entscheidbaum';

	let {
		karte,
		urheberschaft = ''
	}: { karte: Ergebniskarte; urheberschaft?: string } = $props();
</script>

<article class="karte" class:grenzfall={karte.typ === 'grenzfall'}>
	<p class="marke">{karte.bezeichnung}</p>
	<h2>{karte.titel}</h2>
	<p class="grundlage">{karte.rechtsgrundlage}</p>

	<p class="formel">{karte.formel}</p>
	<p class="begruendung">{karte.begruendung}</p>

	{#if karte.zahlenbeispiel}
		<p class="beispiel"><strong>Für diese Gemeinschaft:</strong> {karte.zahlenbeispiel}</p>
	{/if}

	{#if karte.empfehlung}
		<div class="block hervor">
			<h3>Was jetzt zu tun ist</h3>
			<p>{karte.empfehlung}</p>
			<p class="klein">
				Ein Erfordernis ist nicht gesetzt. Die Sitzungsleitung entscheidet ausdrücklich selbst.
			</p>
		</div>
	{/if}

	{#if karte.bezugsgroesse}
		<div class="block hervor">
			<h3>Achtung bei der Bezugsgrösse</h3>
			<p>{karte.bezugsgroesse}</p>
		</div>
	{/if}

	{#if karte.betroffeneErlaeuterung}
		<div class="block hervor">
			<h3>Zusätzliche Zustimmung nötig</h3>
			<p>{karte.betroffeneErlaeuterung}</p>
			<!--
				**Je Form ein eigener Schluss** (25.09.2026, Laien- und Fachprüfung,
				`quellen/pruefung/berichte/2026-09-25-betroffene-ergebnis.md`). Bei den
				Wertquoten genehmigt die Versammlung mit der Mehrheit; wer hier «ohne Ja
				kein Beschluss» läse, hielte einen genehmigten Beschluss für gescheitert.
				Im Markup und nicht im Skript, damit `check:texte` die Sätze misst.
			-->
			{#if karte.betroffenenzustimmung === 'nachher'}
				<p class="klein">
					Die Versammlung genehmigt die Änderung mit der Mehrheit. Die Wertquoten ändern sich aber
					erst, wenn alle betroffenen Personen die Abänderung vor einem Notar unterzeichnet haben
					und sie im Grundbuch eingetragen ist. Ein Ja im Saal ersetzt diese Unterschrift nicht.
				</p>
			{:else}
				<p class="klein">
					Der Beschluss gilt erst als angenommen, wenn beides vorliegt: die Mehrheit und die
					Zustimmung jeder betroffenen Person. Ohne schriftliche Zustimmung vorab ist eine
					Enthaltung oder Nichtabgabe einer betroffenen Person keine Zustimmung.
				</p>
			{/if}
		</div>
	{/if}

	<div class="block">
		<h3>Enthaltung, Nichtabgabe, Fernbleiben</h3>
		<!--
			Ein Absatz je Teil (Befund 31). Zwölf Zeilen am Stück überspringt man,
			und darin stand der Satz, auf den es ankommt — beim Reglementsvorbehalt
			sogar als letzter.
		-->
		<!--
			**Ohne Schlüssel.** Der Absatztext als Schlüssel liesse Svelte werfen
			(`each_key_duplicate`), sobald zwei Teile wörtlich gleich sind — und dann
			fiele die ganze Ergebniskarte aus, also gerade die rechtlich massgebliche
			Erklärung. Die Reihenfolge steht fest und kein Eintrag trägt eigenen
			Zustand; ein Schlüssel bringt hier nichts (Code-Review 06.09.2026).
		-->
		<!--
			Reihenfolge: erst die Bezugsgrösse, dann die Wirkung darin, dann der
			Reglementsvorbehalt dazu, zuletzt die Wertquoten. Beide Bezugsgrössen
			sind eigene Felder, weil eine Reglementsregel sie wechselt und ein
			Ersetzen über die Position im Feld beim nächsten Zusatzabsatz still
			das Falsche träfe.
		-->
		{#if karte.bezugsgroessensatz}<p>{karte.bezugsgroessensatz}</p>{/if}
		{#each karte.stimmwirkung as teil}<p>{teil}</p>{/each}
		{#if karte.einstimmigkeitsweg}<p>{karte.einstimmigkeitsweg}</p>{/if}
		{#if karte.quotenwirkungssatz}<p>{karte.quotenwirkungssatz}</p>{/if}
	</div>

	{#if karte.hinweise.length > 0}
		<div class="block">
			<h3>Zu beachten</h3>
			<ul>
				{#each karte.hinweise as hinweis (hinweis)}<li>{hinweis}</li>{/each}
			</ul>
		</div>
	{/if}

	{#if karte.beispiele.length > 0}
		<div class="block">
			<h3>Beispiele</h3>
			<ul>
				{#each karte.beispiele as beispiel (beispiel)}<li>{beispiel}</li>{/each}
			</ul>
		</div>
	{/if}

	{#if karte.wortlautHinweis}
		<div class="block">
			<h3>Wortlaut und Rechtsprechung</h3>
			<p>{karte.wortlautHinweis}</p>
		</div>
	{/if}

	<div class="block">
		<h3>Reglementsvorbehalt</h3>
		<p>{karte.reglementsvorbehalt}</p>
	</div>

	<!--
		Ab Fassung 2026-11-11 (Auftrag E2): ein eigener Abschnitt, gleich unter dem
		Vorbehalt. Im Kasten ging der Satz für den Saal hinter dem unter, was vor
		der Einladung zu tun ist (Laienprüfung E2, L-1).
	-->
	{#if karte.einwandImSaal}
		<div class="block">
			<h3>Wird im Saal eine Bestimmung eingewendet</h3>
			<p>{karte.einwandImSaal}</p>
		</div>
	{/if}

	<!--
		Nur unter einer angewandten Regel (Produktentscheid 29.09.2026). Direkt
		unter dem Reglementsvorbehalt, weil der das gesetzliche Erfordernis nennt
		und dieser Abschnitt es erklärt.
	-->
	{#if karte.zumGesetz}
		<div class="block">
			<h3>Zum gesetzlichen Erfordernis</h3>
			<p class="klein">{karte.zumGesetz.einleitung}</p>
			<p>{karte.zumGesetz.begruendung}</p>
			{#if karte.zumGesetz.hinweise.length > 0}
				<ul>
					{#each karte.zumGesetz.hinweise as hinweis (hinweis)}<li>{hinweis}</li>{/each}
				</ul>
			{/if}
		</div>
	{/if}

	{#if karte.gemischteGeschaefte}
		<div class="block">
			<h3>Mehrere Zwecke im selben Geschäft</h3>
			<p>{karte.gemischteGeschaefte}</p>
		</div>
	{/if}

	{#if urheberschaft}
		<p class="urheber">{urheberschaft}</p>
	{/if}
</article>

<style>
	.karte {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 1.25rem;
		max-width: 46rem;
		margin: 1rem 0;
	}

	.karte.grenzfall {
		border-color: var(--warnung);
	}

	.marke {
		display: inline-block;
		padding: 0.15rem 0.6rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--akzent) 20%, transparent);
		font-size: 0.85rem;
		font-weight: 550;
		margin: 0 0 0.5rem;
	}

	h2 {
		margin: 0 0 0.2rem;
	}

	.grundlage {
		font-family: ui-monospace, monospace;
		font-size: 0.9rem;
		color: var(--text-leise);
		margin: 0 0 1rem;
	}

	.formel {
		font-weight: 550;
	}

	.beispiel {
		padding: 0.7rem 0.9rem;
		border-radius: var(--radius);
		background: var(--flaeche-2);
	}

	.klein {
		font-size: 0.875rem;
		color: var(--text-leise);
		font-weight: 400;
	}

	.block {
		border-top: 1px solid var(--linie);
		padding-top: 0.9rem;
		margin-top: 0.9rem;
	}

	.block.hervor {
		border: 1px solid var(--warnung);
		border-radius: var(--radius);
		padding: 0.75rem 0.9rem;
		background: color-mix(in srgb, var(--warnung) 10%, transparent);
	}

	.block h3 {
		font-size: 0.95rem;
		margin: 0 0 0.35rem;
	}

	.block p,
	.block ul {
		margin: 0 0 0.4rem;
	}

	.block ul {
		padding-left: 1.2rem;
	}

	.urheber {
		border-top: 1px solid var(--linie);
		padding-top: 0.75rem;
		margin-top: 0.9rem;
		margin-bottom: 0;
		font-size: 0.875rem;
		color: var(--text-leise);
	}
</style>
