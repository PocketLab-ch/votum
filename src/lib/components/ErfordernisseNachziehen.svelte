<script lang="ts">
	/**
	 * Der Kasten der Traktanden mit älterem Erfordernis (23.08.2026, Prüflauf II,
	 * B-01), mit dem Weg zum Nachziehen.
	 *
	 * **Eine Komponente für zwei Seiten** (Codeprüfung Lesarten, Teil 2): die
	 * Reglementsseite und die Seite der Lesarten. Stellt die Sitzungsleitung dort
	 * eine Lesart um, macht sie schon hergeleitete Traktanden veraltet und muss sie
	 * nachziehen können, ohne die Reglementsseite, die der Verwaltung vorbehalten
	 * ist. Jede Seite hat ihre eigene Aktion `nachziehen`; beide rufen
	 * `erfordernisseNachziehen`.
	 */
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';
	// Die Felder von `VeraltetesErfordernis` (server/reglement.ts); hier
	// ausgeschrieben, weil Komponenten nichts aus `$lib/server` einbinden.
	let {
		veraltet
	}: {
		veraltet: { traktandumId: string; versammlungId: string; ziffer: string; titel: string; bisher: string; neu: string }[];
	} = $props();
</script>

{#if veraltet.length > 0}
	<section class="nachziehen">
		<h2>
			{veraltet.length === 1
				? 'Ein Traktandum trägt noch ein älteres Erfordernis'
				: `${veraltet.length} Traktanden tragen noch ein älteres Erfordernis`}
		</h2>
		<p class="lesebreite">
			Diese Traktanden wurden hergeleitet, bevor die hinterlegten Regeln ihre heutige Fassung hatten.
			Dasselbe gilt nach einer Änderung der Einstellung zu den Enthaltungen in den Angaben der
			Gemeinschaft und nach einer Umstellung der Lesarten.
			Sie stehen in Versammlungen, die noch nicht eröffnet sind — und die Traktandenliste
			einer Versammlung ist zugleich ihre Einladung: Was dort steht, ist das angekündigte
			Mehr.
		</p>
		<div class="tabellenrahmen">
			<table>
				<thead>
					<tr>
						<th>Ziffer</th>
						<th>Traktandum</th>
						<th>bisher</th>
						<th>neu</th>
					</tr>
				</thead>
				<tbody>
					{#each veraltet as v (v.traktandumId)}
						<tr>
							<td>{v.ziffer}</td>
							<td><a href="/versammlungen/{v.versammlungId}/traktanden">{v.titel}</a></td>
							<td>{v.bisher}</td>
							<td><strong>{v.neu}</strong></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<form method="POST" action="?/nachziehen">
			<Rueckfrage
				beschriftung={veraltet.length === 1
					? 'Erfordernis neu herleiten'
					: `Alle ${veraltet.length} neu herleiten`}
				zeichen="zuordnen"
				ton="warnung"
				frage="Erfordernisse nach der heutigen Regellage neu herleiten?"
				folge="Die Traktanden oben bekommen das Mehr aus der rechten Spalte. Nur diese; was schon stimmt, bleibt unberührt, ebenso alles in eröffneten Versammlungen. Wurde eine Traktandenliste bereits versandt, kündigen Sie das geänderte Mehr nach."
				bestaetigen="Neu herleiten"
			/>
		</form>
		<p class="hilfe lesebreite">
			Von Hand gesetzte Erfordernisse mit eigener Begründung bleiben stehen — dort hat jemand
			bewusst vom Vorschlag abweichen wollen.
		</p>
	</section>
{/if}

<style>
	/*
	 * Mit dem Kasten aus der Reglementsseite übernommen: Deren Stile sind dort
	 * gescoped und wirken nicht in diese Komponente (zweite Codeprüfung Teil 2).
	 */
	h2 {
		font-size: 1.15rem;
	}

	.tabellenrahmen {
		overflow-x: auto;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		margin: 0;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	th,
	td {
		text-align: left;
		padding: 0.5rem 0.75rem;
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

	.hilfe {
		font-size: 0.875rem;
		color: var(--text-leise);
	}

	.nachziehen {
		margin: 0;
		padding: 1rem 1.1rem;
		border: 1px solid var(--warnung);
		border-radius: var(--radius);
	}

	.nachziehen h2 {
		margin-top: 0;
	}

	.nachziehen form {
		margin-top: 0.8rem;
	}
</style>
