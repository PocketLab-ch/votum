<script lang="ts">
	/**
	 * Freigeben — eine Karte je Gemeinschaft, ein Knopf für alle.
	 *
	 * Dieselbe Bauart wie «Wer tagt mit»: Karte mit Frage, Antwort und Handlung
	 * im Fuss. Was der Freigabe entgegensteht, steht in der Karte selbst und
	 * nicht in einer Fussnote — es ist der Grund, warum der Knopf fehlt.
	 */
	import Karte from '$lib/components/Karte.svelte';
	import { datumLang } from '$lib/domain/datum';
	import { zustandsname } from '$lib/domain/versammlung';
	import { EINBERUFUNGSZUSTAENDIGKEIT } from '$lib/domain/freigabe';
	import Meldung from '$lib/components/Meldung.svelte';

	let { data, form } = $props();

	const offen = $derived(data.zeilen.filter((z) => !z.schonFrei));
	const bereit = $derived(offen.filter((z) => z.bereit).length);
</script>

<h1>Freigeben</h1>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.hinweis}
	<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
{/if}

{#if data.zeilen.length === 0}
	<p class="leer">
		Noch tagt keine Gemeinschaft mit. Nehmen Sie unter
		<a href="/tage/{data.rahmenTag.id}/haeuser">Wer tagt mit</a> eine Versammlung auf.
	</p>
{:else}
	<p class="lesebreite">
		Freigegeben wird je Gemeinschaft. Jede hält für sich fest, wer stimmberechtigt ist, und
		jede hat ihre eigenen Mehrheiten — auch dort, wo das Traktandum auf der gemeinsamen Liste
		steht. Hier stehen sie nebeneinander.
	</p>

	{#if offen.length > 0}
		<!--
			Vor dem Sammelknopf: «Alle freigeben» lädt dazu ein, nicht je Gemeinschaft
			hinzusehen, und gerade die Zuständigkeit kann je Gemeinschaft verschieden
			sein (Laienprüfung 24.09.2026). Wortlaut bei `EINBERUFUNGSZUSTAENDIGKEIT`.
			Nur solange noch etwas freizugeben ist, wie auf der Seite einer
			Versammlung nur im Entwurf: Danach ist die Einberufung geschehen.
		-->
		<p class="lesebreite">
			Die Zuständigkeit kann je Gemeinschaft verschieden sein. {EINBERUFUNGSZUSTAENDIGKEIT}
		</p>

		<form method="POST" action="?/alle" class="sammel">
			<button type="submit" class="haupt" disabled={bereit === 0}>
				{bereit === offen.length
					? `Alle ${offen.length} freigeben`
					: `${bereit} von ${offen.length} freigeben`}
			</button>
			<span class="klein">
				{#if bereit === 0}
					Zurzeit kann keine freigegeben werden — die Gründe stehen bei den Karten.
				{:else if bereit < offen.length}
					Die übrigen bleiben stehen; ihre Gründe stehen bei den Karten.
				{:else}
					Jede einzeln, nacheinander, mit derselben Prüfung wie auf ihrer eigenen Seite.
				{/if}
			</span>
		</form>
	{/if}

	<div class="kacheln">
		{#each data.zeilen as z (z.id)}
			<Karte
				titel={z.gemeinschaft}
				antwort={z.schonFrei ? zustandsname(z.zustand) : z.bereit ? 'Bereit.' : 'Noch nicht.'}
				zusatz="{datumLang(z.datum)} · {z.uhrzeit} Uhr · {z.ort}"
				warnung={!z.schonFrei && !z.bereit ? z.huerden.join(' · ') : undefined}
			>
				{#snippet erklaerung()}
					<p>
						Mit der Freigabe wird der Stand der Stimmberechtigten festgeschrieben
						und die Einladung kann hinaus. Ab dann ändern sich Tag, Ort und
						Traktanden nicht mehr von selbst — auch nicht über die gemeinsame Versammlung.
					</p>
				{/snippet}
				{#snippet fuss()}
					<div class="handlungen">
						<a href="/versammlungen/{z.id}/freigabe">Ansehen</a>
						{#if !z.schonFrei && z.bereit}
							<form method="POST" action="?/eine">
								<input type="hidden" name="versammlung" value={z.id} />
								<button type="submit" class="leise">Freigeben</button>
							</form>
						{/if}
					</div>
				{/snippet}
			</Karte>
		{/each}
	</div>
{/if}

<style>

	.sammel {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin: 1.25rem 0;
	}

	.sammel button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.handlungen {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.klein,
	.leer {
		color: var(--text-leise);
		font-size: 0.9rem;
	}
</style>
