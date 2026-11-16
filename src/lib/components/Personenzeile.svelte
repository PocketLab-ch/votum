<script lang="ts">
	/**
	 * Eine Person in der Liste der Mitberechtigten.
	 *
	 * **Sie steht an zwei Stellen**: in der Erfassungsmaske («Wer ist
	 * beteiligt?») und im Ausklapper «Miteigentum eintragen» an einer
	 * bestehenden Zeile. Ausgerechnet die Wahl «neu oder bestehend» ist die
	 * Stelle, an der sich ein Doppelgänger entscheidet.
	 *
	 * **Bis zum 04.09.2026 war sie zweimal geschrieben** (Task 8 des
	 * Hüllen-Plans). Gemessen an jenem Tag waren beide Fassungen im Markup noch
	 * wortgleich; auseinandergelaufen waren nur die **Begründungen**, die allein
	 * in der Erfassungsmaske standen. Das ist die stillere Hälfte der Doppelung:
	 * Wer die Kopie ändert, hat die Gründe nicht vor sich, mit denen die Zeile so
	 * geworden ist.
	 *
	 * **Sieben Felder je Zeile, immer alle sieben.** Der Server verbindet Name,
	 * E-Mail, Telefon, Anschrift, Wahl, Person und Vertretung über die
	 * **Stellung** in der Reihe. Was die Zeile gerade nicht zeigt, schickt sie
	 * deshalb als leeres verborgenes Feld: Sonst verschöbe sich alles um eins,
	 * sobald eine Zeile den Zweig wechselt.
	 */
	import Suchauswahl from '$lib/components/Suchauswahl.svelte';
	import Wenfrage from '$lib/components/Wenfrage.svelte';
	import { anfangswert, angekreuzt } from '$lib/felder';
	import type { Beteiligter } from '$lib/domain/personenangaben';

	interface Eigenschaften {
		/**
		 * Die Zeile, solange sie sich bearbeiten lässt.
		 *
		 * Fehlt sie, steht hier eine Person, die es schon gibt: auf
		 * `eigentuemer/[partei]` ist das die bestehende Eigentümerzeile, die
		 * mitberechtigt wird. Sie trägt keine Felder, nur ihren Namen, denn ihre
		 * Angaben stehen schon in der Datenbank und werden anderswo berichtigt.
		 */
		zeile?: Beteiligter;
		/** Der Name der festen Person. Nur ohne `zeile` von Bedeutung. */
		festerName?: string;
		/**
		 * Was der Auswahlknopf «Übt die Stimme aus» schickt.
		 *
		 * Für eine Zeile ist das ihre Kennung, für die feste Person das Wort
		 * «bestehend»: Der Server unterscheidet daran, ob die Stimme bei der
		 * bestehenden Zeile bleibt oder auf eine der neuen Personen geht.
		 */
		vertreterWert: string;
		/** Die Nummer in der Aufzählung, ab 1. */
		nummer: number;
		entfernbar?: boolean;
		weg?: (kennung: string) => void;
		wahlSetzen?: (kennung: string, wahl: string) => void;
		vertritt: boolean;
		/** Wer zur Wahl steht, wenn die Zeile auf «bestehend» steht. */
		waehlbare?: { id: string; name: string; gemeinschaften: string[] }[];
	}

	let {
		zeile,
		festerName,
		vertreterWert,
		nummer,
		entfernbar = false,
		weg,
		wahlSetzen,
		vertritt,
		waehlbare = []
	}: Eigenschaften = $props();
</script>

<div class="felder person" class:erste={nummer === 1}>
	{#if zeile}
		<!--
			Die Kennung reist mit, damit der Server Namen, Anschrift und den gewählten
			Vertreter derselben Zeile zuordnen kann. Über die **Stellung** ginge das
			nicht: Wer die erste Person wegnimmt, verschöbe alles um eins.
		-->
		<input type="hidden" name="mitberechtigterKennung" value={zeile.kennung} />
	{/if}
	<p class="nummer voll">
		<span>{nummer}. Person</span>
		{#if entfernbar && zeile && weg}
			<button type="button" class="leise" onclick={() => weg(zeile.kennung)}>Wegnehmen</button>
		{/if}
	</p>
	{#if !zeile}
		<!-- Die bestehende Zeile bleibt, wie sie ist; berichtigt wird sie oben unter «Angaben berichtigen». -->
		<p class="voll wer">{festerName}</p>
	{:else}
		<!--
			**«Wen tragen Sie ein?» auch hier** (Auftraggeber, 27.08.2026). Der Zweig für eine
			einzelne Person hat die Wahl seit dem 11.08.2026; die Personenliste der
			gemeinschaftlichen Zeile hatte sie nicht und legte deshalb immer neue
			Menschen an.
		-->
		<Wenfrage
			feldname="mitberechtigterWahl"
			kennung="wenfrage-{zeile.kennung}"
			wahl={zeile.wahl}
			hatWaehlbare={waehlbare.length > 0}
			melden={(w) => wahlSetzen?.(zeile.kennung, w)}
		/>
		{#if zeile.wahl === 'bestehend'}
			<label class="breit voll">
				Welche Person
				<Suchauswahl
					name="mitberechtigterPersonId"
					beschriftung="Welche Person"
					leerText="— wählen —"
					pflicht
					wert={zeile.personId}
					eintraege={waehlbare.map((pe) => ({
						wert: pe.id,
						text: pe.name + (pe.gemeinschaften.length > 0 ? ` (${pe.gemeinschaften.join(', ')})` : '')
					}))}
				/>
				<span class="hilfe">
					Name und Anschrift kommen von dort. Steht die Person in dieser Gemeinschaft schon, wird
					ihre Zeile mitberechtigt statt einer zweiten.
				</span>
			</label>
			<!-- Fülllöcher: Die Reihen bleiben gleich lang, siehe Kommentar oben. -->
			<input type="hidden" name="mitberechtigterName" value="" />
			<input type="hidden" name="mitberechtigterEmail" value="" />
			<input type="hidden" name="mitberechtigterTelefon" value="" />
			<input type="hidden" name="mitberechtigterAdresse" value="" />
		{:else}
			<input type="hidden" name="mitberechtigterPersonId" value="" />
			<label class="breit">
				Name
				<input
					name="mitberechtigterName"
					required
					maxlength="200"
					placeholder="Anna Muster"
					{...anfangswert(zeile.name)}
				/>
			</label>
			<!-- Je eine Spur: E-Mail und Telefon nebeneinander sparen eine Zeile. -->
			<label>
				E-Mail
				<input
					name="mitberechtigterEmail"
					type="email"
					maxlength="200"
					{...anfangswert(zeile.email)}
				/>
			</label>
			<!--
				**Telefon gehört hierher** (27.08.2026). `party` trägt es, der Zweig für
				eine einzelne Person erfasst es, und der Berichtigungsweg je
				Mitberechtigtem führt es ebenfalls: Es fehlte allein beim Erfassen.
				Dieselbe Person bekam je nach Eigentumsform verschieden viel erfasst.
			-->
			<label>
				Telefon
				<input name="mitberechtigterTelefon" maxlength="60" {...anfangswert(zeile.telefon)} />
			</label>
			<label class="voll">
				Adresse
				<input name="mitberechtigterAdresse" maxlength="300" {...anfangswert(zeile.adresse)} />
			</label>
		{/if}
	{/if}
	<!--
		**Keine Pflichtwahl** (Produktentscheid 27.08.2026). Ist nur einer der
		Mitberechtigten anwesend, darf die Sitzungsleitung annehmen, dass er die
		Gemeinschaft gültig vertritt, ohne Vollmacht (Wermelinger, Rz. 19 ad
		Art. 712o). Am Einlass entscheidet ohnehin der Zugangscode und nicht der
		gedruckte Name. Wer es nicht weiss, lässt es offen; die Wahl «Niemand
		bezeichnet» steht unter der Liste.
	-->
	<label class="kasten voll">
		<input type="radio" name="vertreter" value={vertreterWert} {...angekreuzt(vertritt)} />
		Übt die Stimme aus
	</label>
</div>

<style>
	/*
		**Jede Person ein eigener Kasten, jeder Kasten dasselbe Raster.** Damit
		sieht die Maske bei zwei Beteiligten aus wie bei fünf, dieselbe Lehre wie
		bei den Wertquoten der Einheitenkachel: Läge alles in einem Raster, hinge
		die Anordnung an der Zahl der Beteiligten.

		**Die Regeln stehen hier und nicht in `app.css`** (04.09.2026, aus dem
		Code-Review). Der erste Anlauf schob `.person` und `.nummer` als
		Hausklassen hinaus, weil die bestehende Person auf `eigentuemer/[partei]`
		sie ebenfalls braucht. `.nummer` gibt es aber an sieben weiteren Stellen
		mit eigener Bedeutung, und ein globales `display: flex` hätte in
		`Traktandenwand.svelte` und im Protokoll Nummer und Titel auseinander-
		gerissen. Die bestehende Person geht deshalb durch diesen Baustein.
	*/
	.person {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.85rem 1rem 1rem;
	}

	/*
		**Der Abstand hängt an der Nummer, nicht am Geschwisterselektor.** Zwei
		Kästen sind zwei Instanzen dieses Bausteins, also je eine eigene Wurzel;
		`.person + .person` löst Svelte gar nicht erst auf und meldet die Regel als
		ungenutzt.
	*/
	.person {
		margin-top: 0.75rem;
	}

	.person.erste {
		margin-top: 0;
	}

	/* Nummer links, «Wegnehmen» rechts: eine Zeile, kein eigener Block. */
	.nummer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin: 0;
		font-size: 0.85rem;
		font-weight: 550;
		color: var(--text-leise);
	}

	/* Der Name der bestehenden Zeile steht wie ein Feldwert, nur ohne Feld. */
	.wer {
		margin: 0;
		font-weight: 550;
	}

	/*
		**`.leise` und das Feldmass reisen mit** (04.09.2026, aus dem Code-Review).
		Svelte kapselt Stile je Datei: Markup, das in einen Baustein wandert,
		verliert jede Regel, die in der Seite stand. `.leise` gibt es nur
		seitengebunden, und ohne diese Zeilen wäre «Wegnehmen» ein gefüllter
		Standardknopf neben lauter leisen.
	*/
	.leise {
		background: none;
		border: 1px solid var(--linie);
		color: var(--text-leise);
		font: inherit;
		font-size: 0.85rem;
		padding: 0.25rem 0.6rem;
		border-radius: var(--radius);
		cursor: pointer;
	}

	.leise:hover {
		border-color: var(--text-leise);
		color: var(--text);
	}

	/*
		Dasselbe Feldmass wie in den Formularen der beiden Seiten. Ohne diese
		Zeilen fielen die Felder auf das Hausmass zurück und stünden neben ihren
		Nachbarn im selben Formular sichtbar anders da.
	*/
	input:not([type='checkbox']),
	.felder :global(select),
	.felder :global(.auswahlsuche) {
		min-height: var(--ziel-min);
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--grund);
		color: var(--text);
		font: inherit;
		font-weight: 400;
	}

	input[type='checkbox'],
	input[type='radio'] {
		min-height: 0;
		padding: 0;
		border: revert;
		background: revert;
	}
</style>
