<script lang="ts">
	/**
	 * Eine Versammlung an das Gerät im Saal abgeben.
	 *
	 * **Hier steht kein Schlüssel, und das ist der Punkt.** Ein früherer Entwurf
	 * zeigte nach der Abgabe einen Schlüssel zum Abtippen; entschieden wurde am
	 * 18.09.2026 anders. Das Gerät wird einmal eingetragen, und ab dann
	 * verschlüsselt jede Abgabe für genau dieses Gerät. Zu sehen ist deshalb nur
	 * das Paket und der Name, für den es gilt.
	 */
	import { zeitpunktKurz } from '$lib/domain/datum';
	import Meldung from '$lib/components/Meldung.svelte';
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';
	import Suchauswahl from '$lib/components/Suchauswahl.svelte';
	import { abgabehinweis } from '$lib/domain/abgabe';

	let { data, form } = $props();

	let laeuft = $state(false);

	const v = $derived(data.versammlung);
	const offen = $derived(data.lage.offen);

	function groesse(bytes: number): string {
		return bytes < 1024 * 1024
			? `${(bytes / 1024).toFixed(1)} kB`
			: `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}
</script>

<h1>An ein anderes Gerät abgeben</h1>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler}</Meldung>
{:else if form?.zurueckgenommen}
	<Meldung ton="gut" marke={form}>
		Die Abgabe ist zurückgenommen. Diese Versammlung wird wieder hier geführt.
	</Meldung>
{/if}

{#if form?.abgegeben}
	<Meldung ton="gut" marke={form}>
		Abgegeben an «{form.geraet}». Laden Sie das Paket herunter und bringen Sie es auf das Gerät.
	</Meldung>
{/if}

{#if offen}
	<p class="einleitung">{abgabehinweis(offen, zeitpunktKurz)}</p>

	<dl class="angaben">
		<div>
			<dt>Abgegeben</dt>
			<dd>
				{zeitpunktKurz(offen.abgegebenAm)}{#if offen.abgegebenDurch} durch {offen.abgegebenDurch}{/if}
			</dd>
		</div>
		<div>
			<dt>Paket</dt>
			<dd>{groesse(offen.paketGroesse)} · <code>{offen.paketPruefsumme}</code></dd>
		</div>
	</dl>

	<p class="tun">
		<a class="knopf" href="/versammlungen/{v.id}/abgeben/paket.votum" download>
			Paket noch einmal herunterladen
		</a>
	</p>

	<section class="karte warnung">
		<h2>Abgabe zurücknehmen</h2>
		<p>
			Nur, wenn kein Paket mehr zurückkommt, etwa weil das Gerät ausgefallen ist. Danach gilt hier
			wieder der Stand von vor der Abgabe, und was auf dem anderen Gerät geschah, ist für diese
			Anwendung verloren.
		</p>
		<form method="POST" action="?/zuruecknehmen">
			<label>
				Warum?
				<input
					type="text"
					name="grund"
					required
					minlength="5"
					placeholder="Notebook defekt, Versammlung wird hier geführt"
				/>
			</label>
			<Rueckfrage
				beschriftung="Abgabe zurücknehmen"
				gewicht="leise"
				frage="Abgabe wirklich zurücknehmen?"
				folge="Danach gilt hier wieder der Stand von vor der Abgabe. Kommt das Paket vom anderen Gerät später doch, lässt es sich dieser Versammlung nicht mehr zuordnen."
				bestaetigen="Zurücknehmen"
			/>
		</form>
	</section>
{:else if data.lage.moeglich}
	<p class="einleitung">
		Die Versammlung wird auf einem anderen Gerät geführt, etwa auf dem Notebook im Saal ohne Netz.
		Sie erhalten ein Paket mit allem, was der Abend braucht, verschlüsselt für genau dieses Gerät.
		Hier ist die Versammlung danach gesperrt, bis sie mit ihrem Abschlusspaket zurückkommt.
	</p>

	<ul class="hinweise">
		<li>Mit im Paket sind die Stimmberechtigten, die Traktanden, die Unterlagen und die bereits ausgegebenen Zugänge. Die verschickten QR-Blätter gelten also im Saal.</li>
		<li>Nicht im Paket sind Briefkopf und Betreiberangaben. Was im Saal gedruckt wird, trägt keinen Kopf.</li>
		<li>Beide Geräte brauchen denselben Stand der Anwendung. Das Paket sagt es beim Einspielen.</li>
		{#if !data.herkunft}
			<li class="warnung">
				Diese Anwendung kennt keine feste Adresse. Das Paket nennt deshalb keine Rückgabeadresse,
				und die Rückgabe läuft über die Datei.
			</li>
		{/if}
	</ul>

	{#if data.geraete.length === 0}
		<p class="hinweis">
			Es ist noch kein Saalgerät eingetragen. Das Paket wird für genau ein Gerät verschlüsselt,
			deshalb muss es vorher bekannt sein.
			<a href="/betreiber/saalgeraete">Gerät eintragen</a>
		</p>
	{:else}
		<form method="POST" action="?/abgeben" onsubmit={() => (laeuft = true)}>
			<Suchauswahl
				name="geraet"
				beschriftung="An welches Gerät?"
				pflicht
				eintraege={data.geraete.map((g) => ({
					wert: g.id,
					text: g.name,
					/*
					 * Der Fingerabdruck ist mitdurchsuchbar, steht aber nicht in der
					 * Zeile: Wer zwei gleich benannte Notebooks hat, findet das richtige
					 * über die Zeichen, die auf seinem Bildschirm stehen.
					 */
					auchSuchen: g.fingerabdruck
				}))}
			/>
			<p class="klein">
				Das Paket wird für dieses Gerät verschlüsselt und lässt sich auf keinem anderen öffnen.
			</p>
			<button type="submit" class="knopf haupt" disabled={laeuft}>
				{laeuft ? 'Paket entsteht…' : 'Abgeben und Paket erzeugen'}
			</button>
		</form>
	{/if}
{:else}
	<p class="hinweis">{data.lage.hindernisse.join(' ')}</p>
{/if}

{#if data.verlauf.length > 0}
	<h2>Frühere Abgaben</h2>
	<ul class="liste">
		{#each data.verlauf as a (a.id)}
			<li>
				<strong>{zeitpunktKurz(a.abgegebenAm)}</strong>
				{#if a.geraet}an {a.geraet}{/if}
				{#if a.zurueckAm}
					· zurück am {zeitpunktKurz(a.zurueckAm)}
				{:else if a.zurueckgenommenAm}
					· zurückgenommen am {zeitpunktKurz(a.zurueckgenommenAm)}: {a.zurueckgenommenGrund}
				{:else}
					· unterwegs
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.hinweise {
		margin: 0 0 1.5rem;
		padding-left: 1.2rem;
	}

	.hinweise li {
		margin-bottom: 0.4rem;
	}

	.hinweise li.warnung {
		color: var(--warnung);
	}

	.angaben code {
		word-break: break-all;
	}
</style>
