<script lang="ts">
	/**
	 * Saalgeräte.
	 *
	 * **Der Fingerabdruck steht auf beiden Seiten.** Wer ein Gerät einträgt,
	 * vergleicht ihn mit dem auf dem Notebook. Das ist der einzige Schritt, der
	 * wirklich von Hand geschieht, und er ist der Grund, warum ein vertauschter
	 * oder untergeschobener Code auffällt, bevor die erste Versammlung darauf
	 * geht.
	 */
	import { zeitpunktKurz } from '$lib/domain/datum';
	import Meldung from '$lib/components/Meldung.svelte';
	import { fingerabdruckInGruppen } from '$lib/domain/abgabe';
	import { begrenzt, brauchtSuchfeld, filtereNach } from '$lib/domain/listensuche';
	import { anfangswert } from '$lib/felder';

	let { data, form } = $props();

	/*
	 * **Die Liste wird gekürzt, nach dem Filtern** (UI-Durchgang 06.10.2026).
	 * Auf Dev standen 144 Geräte aus Prüfläufen untereinander, die Seite war bei
	 * 1440 px 28 791 px hoch und «Gerät eintragen» lag ganz unten. Dieselbe
	 * Regel wie auf der Personen- und der Gemeinschaftsliste
	 * (`docs/gestaltung.md`, «Ein Archiv, das mitwächst, gehört gekürzt»):
	 * `begrenzt()` über die schon gefilterte Liste, 25 Zeilen, solange niemand
	 * sucht. Ein eben eingetragenes Gerät steht oben (der Server sortiert die
	 * gültigen zuerst, darin die neuesten), `e2e/durchspielen.mjs` findet seinen
	 * Fingerabdruck also weiterhin ohne Suche.
	 */
	let suche = $state('');
	let alleZeigen = $state(false);

	type Geraet = (typeof data.geraete)[number];
	const suchtext = (g: Geraet) =>
		[
			g.name,
			fingerabdruckInGruppen(g.fingerabdruck),
			g.registriertDurch ?? '',
			g.widerrufenAm ? `widerrufen ${g.widerrufenGrund ?? ''}` : ''
		].join(' ');

	const treffer = $derived(filtereNach(data.geraete, suche, suchtext));
	const sichtbar = $derived(begrenzt(treffer, suche, alleZeigen));
</script>

<h1>Saalgeräte</h1>

<p class="einleitung">
	Eine Versammlung lässt sich an ein anderes Gerät abgeben, etwa an das Notebook im Saal ohne Netz.
	Damit das Paket unterwegs geschützt ist, wird es für genau dieses Gerät verschlüsselt. Dafür muss
	das Gerät einmal eingetragen sein.
</p>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler}</Meldung>
{:else if form?.hinweis}
	<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
{/if}

<!--
	Die Bausteine des Hauses statt eigener Klassen (UI-Durchgang 06.10.2026):
	`karte`, `klein` und `knopf haupt` trugen hier keinen Stil. Die Abschnitte
	standen ohne Rahmen, der Hauptknopf war nicht grün, die Liste trug
	Aufzählungspunkte, «Gerät eintragen» stand mit den Beschriftungen in einer
	Zeile, und die Überschrift des zweiten Abschnitts klebte am Formular
	darüber (0 px). Jetzt `.kachel` je Abschnitt und `.felder` je Formular.
-->
<section class="kachel">
	<h2>Dieses Gerät</h2>

	{#if data.eigenes}
		<p>
			Diese Anwendung ist als <strong>{data.eigenes.name}</strong> eingerichtet, seit
			{zeitpunktKurz(data.eigenes.eingerichtetAm)}.
		</p>
		<p class="klein">
			Das gilt für die ganze Installation, nicht je Bewirtschaftung. Steht hier ein Name, den
			Sie nicht kennen, hat ihn eine andere Bewirtschaftung vergeben.
		</p>
		<p class="klein">
			Übertragen Sie den Code auf die Stelle, die abgibt. Er ist öffentlich: Wer ihn kennt, kann
			Pakete <em>für</em> dieses Gerät verschlüsseln, aber keines öffnen.
		</p>
		<p class="wert"><code>{data.eigenes.code}</code></p>
		<dl class="angaben">
			<div>
				<dt>Fingerabdruck</dt>
				<dd><code>{fingerabdruckInGruppen(data.eigenes.fingerabdruck)}</code></dd>
			</div>
		</dl>
		<p class="klein">
			Dieselben Zeichen müssen nach dem Eintragen auf der anderen Seite stehen. Weichen sie ab, ist
			der Code unterwegs vertauscht worden.
		</p>
	{:else}
		<p>
			Diese Anwendung ist noch kein Saalgerät. Richten Sie sie ein, wenn <em>hier</em> die
			Versammlung geführt werden soll, während sie anderswo vorbereitet wurde.
		</p>
		<!--
			**Der Satz gehört auf die Seite, nicht nur in die Migration**
			(18.09.2026, aus dem Code-Review). Die Identität hängt an der
			Installation und nicht an der Bewirtschaftung: Es gibt genau eine, und
			jede Bewirtschaftung auf dieser Installation sieht sie. Wer das nicht
			liest, richtet auf einer geteilten Installation etwas ein, das den
			anderen im Weg steht — und wundert sich später über einen fremden
			Gerätenamen an dieser Stelle.
		-->
		<p class="klein">
			Das gilt für <strong>die ganze Installation</strong> und nicht für diese Bewirtschaftung:
			Es gibt genau ein solches Gerät, und wer hier eingerichtet ist, steht für alle
			Bewirtschaftungen dieser Installation da. Auf dem gemeinsamen Betrieb im Netz gehört das
			nicht eingerichtet, sondern nur auf dem Notebook, das im Saal steht.
		</p>

		{#if !data.tresor.bereit}
			<p class="hinweis">
				Dafür fehlt <code>{data.tresor.variable}</code> in der Umgebung. Der geheime Teil des
				Schlüssels wird damit verschlüsselt abgelegt. Erzeugen mit
				<code>{data.tresor.erzeugen}</code>.
			</p>
		{:else}
			<form method="POST" action="?/einrichten" class="felder">
				<label>
					Wie heisst dieses Gerät?
					<input type="text" name="name" required minlength="2" maxlength="80" placeholder="Notebook Saal" />
				</label>
				<button type="submit" class="haupt">Als Saalgerät einrichten</button>
			</form>
		{/if}
	{/if}
</section>

<section class="kachel">
	<h2>Geräte, an die abgegeben werden kann</h2>

	{#if brauchtSuchfeld({ durchsuchbar: data.geraete.length, archiviert: 0 })}
		<div class="suchleiste">
			<label class="suchfeld">
				<span class="nurLeser">Gerät suchen</span>
				<input
					type="search"
					placeholder="Name, Fingerabdruck oder Person"
					{...anfangswert(suche)}
					oninput={(e) => (suche = e.currentTarget.value)}
					autocomplete="off"
				/>
			</label>
			<!-- Die Zahl der gezeigten Zeilen, nicht der gefundenen (`gestaltung.md`). -->
			<p class="zaehler">
				{sichtbar.zeigen.length} von {data.geraete.length}
				{data.geraete.length === 1 ? 'Gerät' : 'Geräten'}
			</p>
		</div>
	{/if}

	{#if data.geraete.length === 0}
		<p class="leer">Noch kein Gerät eingetragen.</p>
	{:else if treffer.length === 0}
		<p class="leer">Kein Gerät passt zu «{suche}».</p>
	{:else}
		<ul class="liste">
			{#each sichtbar.zeigen as g (g.id)}
				<li class:widerrufen={g.widerrufenAm}>
					<p class="name">
						<strong>{g.name}</strong>
						{#if g.widerrufenAm}
							<span class="marke">widerrufen</span>
						{/if}
					</p>
					<p class="klein">
						Fingerabdruck <code>{fingerabdruckInGruppen(g.fingerabdruck)}</code>
					</p>
					<p class="klein">
						Eingetragen {zeitpunktKurz(g.registriertAm)}{#if g.registriertDurch}{' '}durch {g.registriertDurch}{/if} ·
						{#if g.zuletztBenutzt}
							zuletzt benutzt {zeitpunktKurz(g.zuletztBenutzt)}
						{:else}
							noch nie benutzt
						{/if}
					</p>
					{#if g.widerrufenAm}
						<p class="klein">
							Widerrufen {zeitpunktKurz(g.widerrufenAm)}: {g.widerrufenGrund}
						</p>
					{:else}
						<form method="POST" action="?/widerrufen" class="felder">
							<input type="hidden" name="id" value={g.id} />
							<label>
								Widerrufen, weil
								<input type="text" name="grund" required minlength="5" placeholder="verloren gegangen" />
							</label>
							<button type="submit">Widerrufen</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
		{#if sichtbar.verborgen > 0}
			<p class="mehr">
				<strong>{sichtbar.verborgen} weitere</strong> — suchen Sie oben, oder
				<button type="button" class="flach" onclick={() => (alleZeigen = true)}>
					alle {treffer.length} anzeigen
				</button>.
			</p>
		{/if}
	{/if}

	<h3>Gerät eintragen</h3>
	<form method="POST" action="?/eintragen" class="felder">
		<label>
			Name
			<input type="text" name="name" required minlength="2" maxlength="80" placeholder="Notebook Saal" />
		</label>
		<label class="voll">
			Gerätecode
			<textarea name="code" required rows="3" placeholder="Der Code von der anderen Anwendung, unter «Dieses Gerät»"></textarea>
		</label>
		<button type="submit" class="haupt">Eintragen</button>
	</form>
</section>

<style>
	.wert {
		word-break: break-all;
		background: var(--flaeche-hinweis);
		padding: 0.6rem 0.8rem;
		border-radius: 0.3rem;
		font-size: 0.95rem;
	}

	/* Die beiden Abschnitte untereinander, mit derselben Luft wie im Stapel. */
	.kachel + .kachel {
		margin-top: 1.5rem;
	}

	/* Je Gerät ein umrandeter Eintrag statt eines Aufzählungspunkts, wie die
	   Konten und die Stufen auf den Schwesterseiten. */
	.liste {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.liste li {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.6rem 0.8rem;
		background: var(--flaeche-2);
	}

	.liste p {
		margin: 0 0 0.35rem;
	}

	/*
	 * Leise wie die Leermeldungen der Personenliste (Code-Review 06.10.2026:
	 * `.leer` ist nicht global, beide Meldungen hier standen ungestaltet).
	 */
	.leer {
		color: var(--text-leise);
		font-size: 0.875rem;
	}

	/* Wie auf der Personenliste: unter der Liste, wo das Blättern endet. */
	.mehr {
		margin: 0.6rem 0 0;
		color: var(--text-leise);
	}

	.liste .felder {
		margin-top: 0.5rem;
	}

	.klein {
		font-size: 0.875rem;
		color: var(--text-leise);
	}

	/* Das Eintragen ist ein eigener Block unter der Liste, nicht ihr Anhang. */
	.kachel > h3 {
		margin: 1.5rem 0 0.5rem;
		font-size: 0.95rem;
	}

	.liste li.widerrufen {
		color: var(--text-leise);
	}

	.name .marke {
		font-size: 0.8rem;
		color: var(--warnung);
		margin-left: 0.4rem;
	}

	code {
		word-break: break-all;
	}
</style>
