<script lang="ts">
	import { UNIVERSALVARIANTE_TEXT } from '$lib/domain/ausnahmen';
	import Lesartenwahl from '$lib/components/Lesartenwahl.svelte';
	import Meldung from '$lib/components/Meldung.svelte';
	import ErfordernisseNachziehen from '$lib/components/ErfordernisseNachziehen.svelte';
	let { data, form } = $props();
</script>

<h1>Lesarten der Gemeinschaft</h1>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.lesartenGespeichert}
	<Meldung ton="gut" marke={form}>Lesarten gespeichert.</Meldung>
{:else if form?.nachgezogen !== undefined}
	<Meldung ton="gut" marke={form}>
		{form.nachgezogen === 1 ? 'Ein Erfordernis' : `${form.nachgezogen} Erfordernisse`} neu hergeleitet.
	</Meldung>
{/if}

<!--
	Die Seite gehört zur Gemeinschaft, nicht zu einer Versammlung: Eine Wahl gilt
	für jede Versammlung, deren Einladung danach freigegeben wird (Migration 169).
	Die Sitzungsleitung kommt hierher, wenn die Gemeinschaft es ihr erlaubt;
	sonst sieht sie nach und liest, wer umstellt.
-->
<div class="seitenstapel">
	<section class="abschnitt">
		<!-- Laienprüfung 20.10.2026, M8, H3, M9: «umstritten» statt «lässt zu»,
		     «eingestellt» statt «legt die Gemeinschaft fest». -->
		<p>
			An einigen Stellen ist umstritten, wie das Gesetz zu lesen ist, und das Ergebnis einer
			Abstimmung kann davon abhängen. Hier wird für die Gemeinschaft eingestellt, nach welcher
			Lesart Votum rechnet. Votum rechnet zusätzlich nach der anderen und nennt das Ergebnis, wo
			die andere etwas ändern kann. Legt Ihr Reglement das Mehr eines Traktandums fest, rechnet
			Votum nach ihm; die Karte des Traktandums nennt dann, was das Gesetz verlangen würde.
		</p>
		<!-- Lesarten Block 2 (Codeprüfung Teil 1, M1): Nachziehen gibt es nur, wo
		     die Lesart das Mehr ändert; L1, L3, L5, L7 und L8 übernimmt die Freigabe von
		     selbst (Featureprüfung Lesarten, 22.10.2026; L7 Codeprüfung Block 4, N6;
		     L8 Featureprüfung 2 F4c, G2). L10 ebenso, ausser an einem Traktandum vor
		     der Fassung 2026-11-10 (`angehoerigeNachzuziehen`; Codeprüfung E1 Block D,
		     M3). -->
		<p class="hilfe">
			Die Einstellung gilt für Versammlungen, deren Einladung danach freigegeben wird. Ändert sie
			das Mehr eines Traktandums, das schon eines hat, erscheint es unten, und Sie ziehen es dort
			nach. Bei der Wertquote im Ausstand, der Zählung an der Einsprache, neuen Geschäften
			an der zweiten Versammlung und dem Ausstand bei der Beschlussfähigkeit müssen Sie nichts
			nachziehen. Dasselbe gilt für die Vollmachten der Verwaltung bei ihren eigenen Geschäften.
			Auch die Stimmführung von Mitberechtigten in der Höchstzahl und das Vertagen nach
			erreichter Beschlussfähigkeit brauchen kein Nachziehen.
			Bei den Angehörigen des Beklagten im Ausstand erscheint unten nur ein Traktandum aus einer
			früheren Fassung.
			Für eine schon freigegebene Einladung gilt die bisherige Einstellung.
		</p>
		<p>
			Wer umstellen darf: <strong>{data.recht}</strong>.
			{#if !data.darfUmstellen}
				Ihr Konto kann die Lesarten hier nur ansehen.
			{/if}
		</p>
	</section>

	<section class="abschnitt">
		<h2>Lesarten, die das Gesetz offenlässt</h2>
		<Lesartenwahl
			lesarten={data.lesarten}
			wahl={data.einstellung.wahl}
			geaendert={data.einstellung.geaendert}
			darfUmstellen={data.darfUmstellen}
		/>
	</section>

	{#if data.veraltet.length > 0}
		<section class="abschnitt">
			<ErfordernisseNachziehen veraltet={data.veraltet} />
		</section>
	{/if}

	<section class="abschnitt">
		<h2>Universalversammlung</h2>
		<p>
			Auch die Universalversammlung hängt an einer Einstellung. An ihr beschliesst die Versammlung
			ohne ordentliche Einladung, weil alle Eigentümer da sind und niemand widerspricht; nicht
			geklärt ist, ob dafür eine Vollmacht genügt. Eingestellt ist:
			<strong>{UNIVERSALVARIANTE_TEXT[data.universalvariante]}</strong>.
		</p>
		<p class="hilfe">
			Diese Angabe stellt nur die Verwaltung um, auf der Seite
			<a href="/gemeinschaften/{data.gemeinschaft.id}/reglement#universalversammlung"
				>Reglement und Quoren</a
			>.
		</p>
	</section>
</div>

<style>
	/* Ausserhalb von `.felder` setzt `app.css` die Hilfe nicht klein. */
	.hilfe {
		font-size: 0.875rem;
		color: var(--text-leise);
	}
</style>
