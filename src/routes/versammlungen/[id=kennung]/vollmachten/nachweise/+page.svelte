<script lang="ts">
	/**
	 * Nachweise fotografieren — die schmale Seite fürs Telefon.
	 *
	 * **Der Anlass** (Auftraggeber, 24.08.2026): «Kann man, wenn man Dokumente hochladen
	 * möchte, einen QR-Code bereitstellen, auf dem der Leiter dann — natürlich
	 * angemeldet — das Dokument fotografieren und zur Person, die sich vertreten
	 * lässt, hochladen kann?»
	 *
	 * Genau eine Handlung je Zeile: Kamera auf, Blatt fotografieren, hinterlegt.
	 * Was auf der breiten Seite dazugehört — prüfen, bestätigen, zurückweisen,
	 * widerrufen — steht hier nicht: Auf dem Telefon wäre es ein halber Meter
	 * Scrollen, bevor das Kamerafeld kommt.
	 */
	import Meldung from '$lib/components/Meldung.svelte';
	import { GRENZHINWEIS, nachweisgrenze } from '$lib/nachweisgrenze';
	import { datumLang } from '$lib/domain/datum';
	import { page } from '$app/state';

	let { data, form } = $props();

	/**
	 * Wie viele Seiten je Vollmacht gewählt sind.
	 *
	 * Ohne diese Zahl sieht man nach dem Fotografieren nicht, ob eine oder drei
	 * Seiten im Feld liegen — und drückt «Hinterlegen» im Vertrauen darauf, dass
	 * alle drin sind. Ein Nachweis ist Teil des Siegels; was fehlt, fehlt später.
	 */
	let gewaehlt = $state<Record<string, number>>({});
</script>

<svelte:head>
	<title>Nachweise fotografieren</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<h1>Nachweise</h1>
<p class="wo">Versammlung vom {datumLang(data.versammlung.datum)}</p>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.hinweis}
	<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
{/if}

{#if data.vollmachten.length === 0}
	<p class="leer">
		Keine Vollmacht, an die ein Nachweis gehört. Erfasst wird sie auf der
		<a href="/versammlungen/{page.params.id}/vollmachten">Vollmachtsseite</a>.
	</p>
{:else}
	<ul class="liste">
		{#each data.vollmachten as v (v.id)}
			<li>
				<p class="wer">
					<strong>{v.bevollmaechtigt}</strong>
					<span class="fuer">vertritt</span>
					{v.vertreteneName}
				</p>
				<p class="stand">
					{v.zustandName}{#if v.nachweisVorgelegt}{v.mitberechtigung === 'nicht_eingetragen'
						? ' · Nachweis der Mitberechtigung hat vorgelegen'
						: ' · Original hat vorgelegen'}{/if}{#if v.dateien.length > 0}{` · ${v.dateien.length} hinterlegt`}{/if}
				</p>

				<!--
					**`capture="environment"` öffnet die Rückkamera**, ohne den Weg über
					die Galerie zu versperren: Wer das Blatt schon fotografiert hat,
					wählt es aus. Ein Attribut, das den anderen Weg zumauert, wäre am
					Eingang genau der Griff, der fehlt.
				-->
				<form method="POST" enctype="multipart/form-data">
					<input type="hidden" name="id" value={v.id} />
					<label class="knopfartig">
						Blätter fotografieren oder wählen
						<!--
							**`multiple`, weil eine Vollmacht mehrere Seiten hat** (Auftraggeber,
							24.08.2026). Vollmacht und Weisung, Vorder- und Rückseite: Je
							Seite ein Gang durch das Formular hiesse dreimal die Kamera
							öffnen und dreimal warten.
						-->
						<input
							type="file"
							name="datei"
							accept="image/*,application/pdf"
							capture="environment"
							multiple
							required
							oninput={(e) => (gewaehlt[v.id] = e.currentTarget.files?.length ?? 0)}
							{@attach nachweisgrenze}
							aria-describedby="grenze-{v.id}"
						/>
					</label>
					<small id="grenze-{v.id}">{GRENZHINWEIS}</small>
					{#if gewaehlt[v.id] > 0}
						<span class="gewaehlt">
							{gewaehlt[v.id]}
							{gewaehlt[v.id] === 1 ? 'Seite' : 'Seiten'} gewählt
						</span>
					{/if}
					<!--
						**Zwei Schritte, absichtlich.** Ein Selbstabschicken beim `change`
						wäre ein Tipp weniger — und ein Weg, versehentlich ein falsches
						Bild zu hinterlegen, das sich nicht mehr entfernen lässt (der
						Nachweis ist Teil des Siegels). Wer fotografiert hat, sieht den
						Dateinamen und drückt dann.
					-->
					<button type="submit">Hinterlegen</button>
				</form>

				{#if v.dateien.length > 0}
					<p class="dateien">{v.dateien.join(' · ')}</p>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<p class="zurueck">
	<a href="/versammlungen/{page.params.id}/vollmachten">Zur vollen Vollmachtsseite</a>
</p>

<style>
	/*
	 * **Eine Spalte, fingergrosse Ziele.** Diese Seite wird im Stehen bedient,
	 * mit dem Telefon in einer Hand und einem Blatt Papier in der anderen.
	 */
	h1 {
		margin: 0.5rem 0 0.1rem;
		font-size: 1.5rem;
	}

	.wo {
		margin: 0 0 1rem;
		color: var(--text-leise);
		font-size: 0.9rem;
	}

	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.liste li {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 0.75rem 1rem;
	}

	.wer {
		margin: 0;
	}

	.fuer {
		color: var(--text-leise);
	}

	.gewaehlt {
		font-weight: 550;
	}

	.stand,
	.dateien {
		margin: 0.15rem 0 0;
		color: var(--text-leise);
		font-size: 0.85rem;
	}

	form {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.6rem;
	}

	/*
	 * Das Dateifeld steckt in der Beschriftung: Ein `<input type="file">` sieht
	 * je nach Browser anders aus und ist auf dem Telefon oft winzig. So ist die
	 * ganze Fläche das Ziel.
	 */
	.knopfartig {
		display: inline-flex;
		align-items: center;
		min-height: var(--ziel-min);
		padding: 0.5rem 1rem;
		border: 1px solid var(--akzent);
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font-weight: 550;
		cursor: pointer;
	}

	.knopfartig input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}

	button {
		min-height: var(--ziel-min);
		padding: 0 1rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		cursor: pointer;
	}

	.leer,
	.zurueck {
		color: var(--text-leise);
	}

	.zurueck {
		margin-top: 1.25rem;
	}
</style>
