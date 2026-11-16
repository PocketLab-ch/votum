<script lang="ts">
	import { untrack } from 'svelte';
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import Anhaenge from '$lib/components/Anhaenge.svelte';
	import TraktandumFormular from '$lib/components/TraktandumFormular.svelte';
	import Modellantwort from '$lib/components/Modellantwort.svelte';
	import { anfangswert } from '$lib/felder';
	import { erfordernisInWorten } from '$lib/domain/auszaehlung';
	import Meldung from '$lib/components/Meldung.svelte';
	import Wahlliste from '$lib/components/Wahlliste.svelte';

	let { data, form } = $props();

	let offen = $state<string | null>(null);
	/**
	 * Abstimmungstraktanden ohne Mehrheitserfordernis.
	 *
	 * Trägt das Band oben. Kenntnisnahmen zählen nicht mit: Über sie wird nicht
	 * beschlossen, ein Erfordernis wäre dort eine Erfindung.
	 */
	const ohneErfordernis = $derived(
		data.traktanden.filter((t) => t.knoten.art === 'abstimmung' && !t.knoten.erfordernis)
	);

	/**
	 * Das Prüfergebnis zu einem Traktandum — aus der Einzelprüfung ODER aus dem
	 * Sammellauf.
	 *
	 * **Zwei Quellen, eine Anzeige** (01.09.2026): Der Kasten am Traktandum las
	 * nur `form.pruefung`, also das Ergebnis der Einzelprüfung. Nach «Alle
	 * Traktanden prüfen» wären die Befunde da gewesen und hätten nirgends
	 * gestanden — eine Prüfung, deren Ergebnis niemand sieht, ist keine.
	 */
	/**
	 * Die Ergebnisse des letzten Sammellaufs — gehalten, nicht nur durchgereicht.
	 *
	 * **Warum sie nicht direkt aus `form` kommen** (Code-Review 01.09.2026,
	 * zweite Runde): Jede weitere Handlung auf der Seite ersetzt `form`. Ein
	 * Klick auf «Übernommen» an EINEM Traktandum hätte damit alle elf
	 * Ergebniskästen auf einmal gelöscht — zehn bereits bezahlte Modellantworten,
	 * die niemand mehr gelesen hat und die nur ein zweiter Sammellauf
	 * zurückholt.
	 */
	let gehalten = $state<NonNullable<typeof form>['pruefungen']>(undefined);

	/*
	 * **Was gehalten wird, muss auch nachgeführt und weggeräumt werden**
	 * (Code-Review 02.09.2026). Die erste Fassung schrieb nur hinein und nie
	 * heraus. Folge: Wer nach dem Sammellauf ein Traktandum einzeln prüfte und
	 * dann «Übernommen» drückte, sah wieder den ALTEN Befund samt alter
	 * `nutzungId` — und der nächste Klick schrieb den Entscheid auf diese alte
	 * Zeile. Dieselbe Falle nach dem Speichern: Der Befund galt dem Wortlaut von
	 * vorher und las sich als aktuell.
	 *
	 * Drei Fälle, drei Behandlungen:
	 */
	$effect(() => {
		// 1. Ein Sammellauf ersetzt alles.
		if (form?.pruefungen) {
			gehalten = form.pruefungen;
			return;
		}
		// 2. Eine Einzelprüfung ersetzt ihren Punkt — sie ist die neuere Antwort.
		if (form?.pruefung) {
			const neu = form.pruefung;
			untrack(() => {
				gehalten = [
					...(gehalten ?? []).filter((p) => p.traktandumId !== neu.traktandumId),
					neu
				];
			});
			return;
		}
		// 3. Ein geänderter Punkt verliert seinen Befund: Er galt dem alten Wortlaut.
		if (form?.geaendert) {
			const weg = form.geaendert;
			untrack(() => {
				gehalten = (gehalten ?? []).filter((p) => p.traktandumId !== weg);
			});
		}
	});

	/*
	 * **`untrack` in den Fällen 2 und 3**, weil dort der eigene Zustand gelesen
	 * UND geschrieben wird (Code-Review 02.09.2026). Ohne ihn hängt der Effekt
	 * von einem Wert ab, den er selbst setzt: Svelte fährt ihn erneut, und der
	 * Lauf endet in `effect_update_depth_exceeded` — ausgerechnet auf den beiden
	 * Wegen, die er reparieren soll. Fall 1 braucht ihn nicht, er liest nichts.
	 */

	const sammelergebnisse = $derived(form?.pruefungen ?? gehalten);

	const pruefungFuer = (id: string) =>
		form?.pruefung?.traktandumId === id
			? form.pruefung
			: (sammelergebnisse?.find((p) => p.traktandumId === id) ?? null);

	/** Ob der Sammellauf gerade unterwegs ist — der Knopf sperrt sich solange. */
	let laeuft = $state(false);

	/** Mehr Punkte, als ein Sammellauf auf einmal an das Modell schickt. */
	const zuViele = $derived(data.traktanden.length > data.hoechstensAufEinmal);

	let neuOffen = $state(false);

	/**
	 * Ob die **Liste** hier geführt wird — oder am Abend.
	 *
	 * Gehört die Versammlung zu einer gemeinsamen, ist sie hier ein Abbild: Was
	 * darauf steht, in welcher Reihenfolge und unter welcher Nummer, entscheidet
	 * der Abend. Das Anpassen des eigenen Wortlauts bleibt — genau dafür gibt es
	 * die Ziffern 3.1 und 3.2 (Auftraggeber, 11.08.2026).
	 */
	const listeAenderbar = $derived(data.aenderbar && !data.gemeinsam);

	/**
	 * Was gerade gezogen wird.
	 *
	 * Bewusst kein HTML5-Drag-and-Drop: Auf Android und iOS löst es entweder gar
	 * nicht aus oder scrollt die Seite mit. Zeigerereignisse (`pointerdown`)
	 * fassen Maus, Stift und Finger gleich an — dasselbe Verhalten überall, ohne
	 * zwei Wege, die auseinanderlaufen.
	 */
	let zieht = $state<string | null>(null);
	let ueber = $state<{ id: string; als: 'davor' | 'darunter' } | null>(null);

	let formular: HTMLFormElement;
	let feldId: HTMLInputElement;
	let feldElternteil: HTMLInputElement;
	let feldStelle: HTMLInputElement;

	/**
	 * Ob das Aufklappen dieser Zeile überhaupt etwas zeigt.
	 *
	 * **Sonst verspricht der Winkel Inhalt und liefert eine Linie**
	 * (Code-Review 06.09.2026): In der gesperrten Sicht hat ein
	 * Pflichttraktandum weder Antragswortlaut noch Inhalt noch Unterlagen, und
	 * der Ausklapp blieb leer. Änderbar ist die Zeile immer aufklappbar, denn
	 * dann steht dort das Formular.
	 */
	/**
	 * Wie viele Untertraktanden ein Traktandum hat.
	 *
	 * **Für die Frage, ob das Entfernen überhaupt durchgeht** (Code-Review
	 * 06.09.2026): `entferneTraktandum` weist ab, solange Kinder da sind. Die
	 * Zahl steht in derselben Liste, aus der die Seite ohnehin rendert.
	 */
	function kinderVon(id: string): number {
		return data.traktanden.filter((x) => x.knoten.parentId === id).length;
	}

	function zeigtEtwas(t: (typeof data.traktanden)[number]): boolean {
		return (
			data.aenderbar ||
			// Vor Beginn braucht der Verweis «Erfordernis ändern» eine offene Zeile.
			(data.erfordernisVorBeginn && t.knoten.art === 'abstimmung' && Boolean(t.knoten.erfordernis)) ||
			t.anhaenge.length > 0 ||
			Boolean(t.knoten.antragswortlaut) ||
			Boolean(t.knoten.inhalt)
		);
	}

	function beginne(e: PointerEvent, id: string) {
		if (!listeAenderbar) return;
		zieht = id;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function bewege(e: PointerEvent) {
		if (!zieht) return;
		const unten = document
			.elementsFromPoint(e.clientX, e.clientY)
			.find((el) => el instanceof HTMLElement && el.dataset.traktandum) as HTMLElement | undefined;
		if (!unten || unten.dataset.traktandum === zieht) {
			ueber = null;
			return;
		}
		const kasten = unten.getBoundingClientRect();
		// Rechts der Mitte einrücken, links davon davor einordnen. Ein Zielbereich
		// von einem Drittel reicht auf dem Telefon aus und trifft mit der Maus
		// noch zuverlässig.
		const eingerueckt = e.clientX - kasten.left > kasten.width / 3;
		ueber = { id: unten.dataset.traktandum as string, als: eingerueckt ? 'darunter' : 'davor' };
	}

	function lasse() {
		if (!zieht || !ueber) {
			zieht = null;
			ueber = null;
			return;
		}
		const ziel = data.traktanden.find((t) => t.knoten.id === ueber!.id);
		if (ziel) {
			feldId.value = zieht;
			if (ueber.als === 'darunter') {
				feldElternteil.value = ziel.knoten.id;
				feldStelle.value = '0';
			} else {
				feldElternteil.value = ziel.knoten.parentId ?? '';
				feldStelle.value = String(Math.max(0, ziel.knoten.position - 1));
			}
			formular.requestSubmit();
		}
		zieht = null;
		ueber = null;
	}

	/*
	 * **Die Auswahl beim Ausstand vorab** (Ä-26; Codeprüfung 17.10.2026, M4):
	 * gebunden und nach dem Absenden auf das zurückgeschnitten, was noch zur
	 * Wahl steht, wie in `Eingriffe.svelte`. Sonst schickte die Wahlliste den
	 * eben Erklärten als verdecktes Feld beim nächsten Mal mit, und die
	 * Erklärung scheiterte an «bereits ein Ausstand erklärt».
	 */
	let ausstandswahl = $state<string[]>([]);
	// Beim Wechsel des Traktandums leer (zweiter Durchgang, Befund 4): sonst ging
	// eine Wahl aus dem vorigen als verdecktes Feld mit.
	$effect(() => {
		void offen;
		ausstandswahl = [];
	});
	function raeumeAusstandswahl(): void {
		const traktandum = data.traktanden.find((x) => x.knoten.id === offen);
		ausstandswahl = ausstandswahl.filter(
			(id) =>
				data.ausstandswahl.some((w) => w.id === id) &&
				!(traktandum?.ausstand ?? []).some((a) => a.kennung === id)
		);
	}
</script>


<h1>Traktanden</h1>

<!--
	**Das Prüfergebnis als Baustein** (01.09.2026). Es entsteht auf zwei Wegen —
	die Einzelprüfung am aufgeklappten Traktandum und der Sammellauf über die
	ganze Liste — und gehört beide Male an dieselbe Stelle: unter das Traktandum,
	um das es geht.

	**Und ausserhalb des Bearbeitungsformulars.** Zuerst stand es darin; nach dem
	Sammellauf ist nichts aufgeklappt, und dann wären die Befunde da gewesen und
	hätten nirgends gestanden. Ein Befund, den niemand sieht, ist keine Prüfung.
	Er wird auch gezeigt, wenn die Liste nicht mehr änderbar ist: Lesen darf man
	ihn immer, nur ändern nicht.
-->
{#snippet pruefergebnis(p: NonNullable<ReturnType<typeof pruefungFuer>>)}
					{#if p.stufe === null}
						<p class="fehlschlag">
							Die Prüfung war nicht möglich: {p.fehlschlaege.join(' · ')}. Am Traktandum
							ändert das nichts.
						</p>
					{:else if p.unlesbar}
						<!--
							**Nicht als Entwarnung anzeigen.** «Nichts zu beanstanden»
							und «die Antwort war unbrauchbar» sahen gleich aus — wer das
							Erste liest, hält sein Traktandum für geprüft.
						-->
						<p class="fehlschlag">
							{p.stufe} hat geantwortet, aber nicht in verwertbarer Form. Bitte
							noch einmal prüfen lassen. Am Traktandum ändert das nichts.
						</p>
					{:else}
						<p class="ergebnis">
							{p.befunde.length === 0
								? 'Nichts zu beanstanden.'
								: p.befunde.length === 1
									? '1 Befund.'
									: p.befunde.length + ' Befunde.'}
							<span class="herkunft">
								{p.stufe}, {(p.dauerMs / 1000).toFixed(1)} s,
								{p.namenGeschuetzt === 0
									? 'keine Namen im Text'
									: p.namenGeschuetzt === 1
										? '1 Name ersetzt'
										: p.namenGeschuetzt + ' Namen ersetzt'}
							</span>
						</p>

						{#if p.befunde.length > 0}
							<!--
								**Die Befunde tragen eine Umrandung** (Audit B-09). Ein
								Befund im Ton der Anwendung liest sich wie eine Auskunft
								des Werkzeugs — er stammt aber aus dem geprüften Text, und
								der darf von einem Eigentümer sein.
							-->
							<Modellantwort stufe={p.stufe}>
								{#each p.befunde as b, i (i)}
									<div class="befund {b.schwere}">
										<p class="was"><span class="grad">{b.schwere}</span> {b.was}</p>
										<p class="vorschlag">{b.vorschlag}</p>
									</div>
								{/each}
							</Modellantwort>
						{/if}

						<!--
							**Was hinausging, wörtlich.** Eine Zusage über Datensparsamkeit,
							die man nicht nachsehen kann, ist eine Behauptung. Wer hier einen
							Namen stehen sieht, den die Maskierung nicht kannte, ändert ihn
							im Traktandum.
						-->
						<details class="hinausgegangen">
							<summary>Was übermittelt wurde</summary>
							<pre>{p.hinausgegangen}</pre>
						</details>

						{#if p.nutzungId}
							<form method="POST" action="?/kientscheid" class="entscheid" use:enhance={absenden()}>
								<input type="hidden" name="nutzungId" value={p.nutzungId} />
								<span>Was haben Sie damit gemacht?</span>
								<button type="submit" name="entscheid" value="angenommen" class="leise" data-vorgabe="angenommen">
									Übernommen
								</button>
								<button type="submit" name="entscheid" value="veraendert" class="leise">
									Verändert übernommen
								</button>
								<button type="submit" name="entscheid" value="abgelehnt" class="leise">
									Nicht übernommen
								</button>
							</form>
						{/if}
					{/if}
{/snippet}


{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.hinweis}
	<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
{:else if form?.angelegt || form?.gespeichert || form?.verschoben || form?.entfernt}
	<Meldung ton="gut" marke={form}>Gespeichert.</Meldung>
{/if}

<!--
	**Was «Mehrheitserfordernisse» in der Leiste meint.**

	Der Schritt führt auf dieselbe Seite wie «Traktandenliste» — das Erfordernis
	wird ja am Traktandum gesetzt. Wer darauf klickte, landete in der Liste und
	fand nichts, was mit Erfordernissen zu tun hatte: Es wirkte wie eine
	Fehlverknüpfung. Dieses Band ist die Antwort auf den Klick.

	Es erscheint nur, wenn wirklich etwas fehlt. Ein Band, das immer dasteht,
	wird nicht mehr gelesen.
-->
<!--
	**Die KI-Prüfung gehört an die Liste, nicht nur ins Bearbeitungsformular**
	(Auftraggeber, 01.09.2026: «KI-Knopf fehlt bei Traktanden. Eigentlich müssten alle
	Traktanden eine Überprüfung möglich sein»).

	Bis dahin stand der Knopf ausschliesslich im aufgeklappten Formular EINES
	Traktandums. Wer die Liste bloss ansah, fand ihn nie und konnte auch nicht
	sehen, dass es die Prüfung überhaupt gibt. Und wer sie nutzen wollte, musste
	zwölf Punkte einzeln aufklappen.

	**Auch die Absage steht jetzt hier oben.** Vorher stand «Für diese
	Gemeinschaft ist die KI-Unterstützung nicht zugelassen» nur im aufgeklappten
	Formular — an einer Stelle, an der sie niemand sucht, wenn er sich fragt, wo
	die Prüfung geblieben ist.
-->
<!--
	**Nur solange die Liste änderbar ist** (Code-Review 01.09.2026). Nach der
	Freigabe ist der Anzeigeweg zu, und ein kostenpflichtiger Lauf über eine
	Liste, an der sich nichts mehr ändern lässt, führt zu Befunden, die niemand
	umsetzen kann. Die Befunde eines früheren Laufs bleiben am Traktandum stehen.
-->
{#if data.ki.anzeigen && data.aenderbar && data.ki.verfuegbar}
	<section class="kiband">
			<h2>Traktanden prüfen lassen</h2>
			<p class="lesebreite">
				Ein Sprachmodell liest die Traktanden und meldet, was auffällt: fehlender
				Antragswortlaut, Widersprüche zu anderen Punkten, ein Antrag, über den sich so nicht
				abstimmen lässt. <strong>Nichts wird verändert</strong> — Sie bekommen Befunde und
				entscheiden. Einzeln geht es beim jeweiligen Traktandum.
			</p>
			<!--
				**Der Knopf sagt, dass er läuft** (Code-Review 01.09.2026). Ein
				Sammellauf fragt je Traktandum ein Modell und dauert Sekunden; ohne
				Rückmeldung drückt man ein zweites Mal, und dann geht alles zweimal
				hinaus. Dieselbe Bauart wie auf der Diensteseite, dort schon für
				einen einzigen Aufruf.
			-->
			<form
				method="POST"
				action="?/kipruefenAlle"
				use:enhance={absenden({ laufend: (marke) => (laeuft = marke !== null) })}
			>
				<button
					type="submit"
					data-fokus="kipruefen:alle"
					disabled={data.traktanden.length === 0 || zuViele || laeuft}
				>
					{#if laeuft}
						Prüfung läuft …
					{:else if data.traktanden.length === 1}
						Das Traktandum prüfen
					{:else}
						Alle {data.traktanden.length} Traktanden prüfen
					{/if}
				</button>
			</form>
			<!--
				**Der Knopf führt nicht in die Absage** (Code-Review 01.09.2026).
				Der Server nimmt höchstens `HOECHSTENS_AUF_EINMAL` Punkte auf einmal;
				stand die Schranke nur dort, bot die Seite bei 25 Traktanden einen
				Knopf an, der zwingend abgewiesen wurde.
			-->
			{#if zuViele}
				<p class="hilfe">
					Auf einmal prüfen lassen sich höchstens {data.hoechstensAufEinmal} Traktanden — jeder
					Punkt geht einzeln an das Modell und kostet. Prüfen Sie beim jeweiligen Traktandum.
				</p>
			{/if}
	</section>
{:else if data.ki.anzeigen && data.aenderbar}
	<!--
		**Kein Kasten für etwas, das es hier nicht gibt** (Prüflauf I, B-28, und
		zwölf Zeilen weiter unten in dieser Datei schon einmal behoben). Eine
		Überschrift, unter der nur steht, dass es das nicht gibt, ist eine
		Ankündigung ohne Inhalt. Der Grund verschwindet nicht, er wird leise.
	-->
	<p class="hilfe ki-aus">{data.ki.grund}</p>
{/if}

{#if ohneErfordernis.length > 0}
	<section class="fehlende-erfordernisse">
		<h2>
			{ohneErfordernis.length === 1
				? 'Ein Antrag hat noch kein Mehrheitserfordernis'
				: `${ohneErfordernis.length} Anträge haben noch kein Mehrheitserfordernis`}
		</h2>
		<p class="lesebreite">
			Welche Mehrheit ein Antrag braucht, wird über den Entscheidbaum aus dem Vorhaben
			hergeleitet. Ohne Erfordernis lässt sich am Abend nicht auszählen — nachholen lässt
			es sich bis zur Abstimmung, auch im Saal.
		</p>
		<ul>
			{#each ohneErfordernis as t (t.knoten.id)}
				<li>
					<a href="/versammlungen/{data.versammlung.id}/traktanden/{t.knoten.id}/erfordernis">
						{t.nummer}
						{t.knoten.titel}
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if !data.aenderbar}
	<p class="meldung">
		Die Versammlung ist freigegeben — die Traktanden sind gesperrt.
		{#if data.freigabeZuruecknehmbar}
			Nehmen Sie die Freigabe zurück, um sie noch zu ändern.
		{:else if data.vollmachtenHaengen}
			<!--
				**Kein Weg mehr über die Rücknahme** (Nachzug Block 3, Entscheid E
				vom 03.10.2026): Mit der ersten Vollmacht ist die Freigabe
				endgültig. Der Satz nennt den Ausfall denn auch nicht als Weg —
				die Traktanden lassen sich damit nicht mehr ändern, und das steht
				so da.
			-->
			Die Freigabe lässt sich nicht mehr zurücknehmen: Es hängen bereits Vollmachten daran. Die
			Traktanden bleiben damit, wie sie sind.
		{/if}
	</p>
{/if}

<!--
	**Ein Abbild, keine zweite Liste** (Auftraggeber, 11.08.2026). Ohne dieses Band stand
	hier eine eigene Zählung 1–8, und daneben trug das gemeinsame Traktandum die
	Nummer «1.1» — zwei Ordnungen auf einer Seite.
-->
{#if data.gemeinsam}
	<p class="meldung gemeinsam">
		Diese Versammlung gehört zu <strong>{data.gemeinsam.bezeichnung}</strong>. Die Traktandenliste
		wird dort geführt, für alle Gemeinschaften zusammen — deshalb steht hier dieselbe Nummer wie
		im Saal und im Protokoll. Aufnehmen, umordnen und entfernen geschieht
		<a href="/tage/{data.gemeinsam.id}/geschaefte">in der gemeinsamen Versammlung</a>. Den
		Wortlaut für diese Gemeinschaft können Sie hier anpassen; sie bekommt dann eine eigene
		Ziffer.
	</p>
{/if}

<!-- Das Ziel des Ziehens. Ein gewöhnliches Formular: Ohne JavaScript bleibt die
     Liste lesbar, und die Reihenfolge lässt sich über die Pfeilknöpfe ändern. -->
<form
	method="POST"
	action="?/verschieben"
	bind:this={formular}
	class="versteckt"
	use:enhance={absenden({ reset: false })}
>
	<input type="hidden" name="id" bind:this={feldId} />
	<input type="hidden" name="neuerElternteil" bind:this={feldElternteil} />
	<input type="hidden" name="stelle" bind:this={feldStelle} />
</form>

{#if data.traktanden.length === 0}
	<p class="leer">Noch kein Traktandum erfasst.</p>
{:else}
	<ol class="baum">
		{#each data.traktanden as t (t.knoten.id)}
			<li
				data-traktandum={t.knoten.id}
				style="--tiefe: {t.tiefe}"
				class:zieht={zieht === t.knoten.id}
				class:davor={ueber?.id === t.knoten.id && ueber.als === 'davor'}
				class:darunter={ueber?.id === t.knoten.id && ueber.als === 'darunter'}
			>
				<div class="zeile">
					<!-- Kein Griff, wo die Reihenfolge nicht hier entschieden wird: Ein
					     Griff, der nichts bewegt, ist ein Versprechen ohne Deckung. -->
					{#if listeAenderbar}
						<button
							type="button"
							class="griff"
							aria-label="{t.nummer} {t.knoten.titel} verschieben"
							onpointerdown={(e) => beginne(e, t.knoten.id)}
							onpointermove={bewege}
							onpointerup={lasse}
							onpointercancel={lasse}
						>
							⠿
						</button>
					{/if}

					<span class="nummer" class:manuell={t.manuell}>{t.nummer}</span>

					<!--
						**Der Titel muss als Knopf erkennbar sein** (Bedienbarkeitsprüfung
						05.09.2026, Befund 11 der Bewirtschaftersicht): «Der
						Traktandentitel ist ein Knopf, sieht aber aus wie fetter Text.
						Ohne Klick gibt es keinen Weg zum Ändern.» Verraten hat ihn nur
						`cursor: pointer` — und einen Mauszeiger gibt es auf dem Tablet
						der Sitzungsleitung nicht.

						Der Winkel zeigt zugleich, ob die Zeile offen ist; `aria-expanded`
						sagt dasselbe für Bildschirmleser.
					-->
					<button
						type="button"
						class="titel"
						class:stumm={!zeigtEtwas(t)}
						aria-expanded={zeigtEtwas(t) ? offen === t.knoten.id : undefined}
						onclick={() => (offen = offen === t.knoten.id ? null : t.knoten.id)}
					>
						{t.knoten.titel}
						<!--
							**Zurückgezogen steht auch hier** (Bedienbarkeitsprüfung
							05.09.2026, Befund 33 der Bewirtschaftersicht). Die
							Sitzungsleitungssicht führte die Zeile mit der Marke, diese
							Seite dieselbe Zeile ohne — zwei Aussagen über denselben Antrag,
							je nachdem, von welcher Seite man kommt. Der Rückzug stand längst
							im Knoten, er wurde hier nur nicht gezeigt.

							Zuerst und nicht als Spielart von «Kenntnisnahme»: Zurückgezogen
							ist etwas anderes als abgelehnt, und es gilt unabhängig von der
							Art des Traktandums.
						-->
						{#if t.knoten.rueckzug}
							<span class="marke leise" title={t.knoten.rueckzug.grund}>zurückgezogen</span>
						{:else if t.knoten.art === 'kenntnisnahme'}
							<span class="marke">Kenntnisnahme</span>
						{/if}
						{#if t.knoten.uebernommenAus}
							<span class="marke leise">
								übernommen aus der Versammlung vom {t.knoten.uebernommenAus.datum}
							</span>
						{/if}
						<!-- G7 (06.11.2026): das Häkchen am Traktandum als Merkmal wie die
						     übrigen, damit die Leitung beim Durchgehen sieht, wo die
						     Vollmachten der Verwaltung ruhen. -->
						{#if t.knoten.verwaltungsGeschaeft}
							<span class="marke leise">Geschäft der Verwaltung</span>
						{/if}
						{#if t.knoten.erfordernis}
							<span class="marke leise">{t.knoten.erfordernis.titel}</span>
						{/if}
					</button>
				</div>

				{#if t.knoten.kurzfassung}
					<p class="kurzfassung">{t.knoten.kurzfassung}</p>
				{/if}

				{#each t.hinweise as h (h.feld)}
					<p class="hinweis">
						{h.text}
						<!-- Ein Mangel, der nur benannt wird, verlangt vom Leser, den Weg
						     selbst zu suchen. Beim Erfordernis führt er hier hin. -->
						{#if h.feld === 'erfordernis' && data.aenderbar}
							<a href="/versammlungen/{data.versammlung.id}/traktanden/{t.knoten.id}/erfordernis">
								Jetzt bestimmen
							</a>
						{/if}
					</p>
				{/each}

				{#if pruefungFuer(t.knoten.id)}
					<section class="kipruefung">
						{@render pruefergebnis(pruefungFuer(t.knoten.id)!)}
					</section>
				{/if}

				{#if offen === t.knoten.id}
					<div class="ausklapp">
						{#if data.aenderbar}
							<TraktandumFormular
								traktandum={t.knoten}
								eigentuemer={data.eigentuemer}
								historischerEinzelantragsteller={t.historischerEinzelantragsteller}
								historischeGemeinsameAntragsteller={t.historischeGemeinsameAntragsteller}
								historischeBetroffene={t.historischeBetroffene}
								untergemeinschaften={data.untergemeinschaften}
								antragstellerarten={data.antragstellerarten}
								schwelleKurzfassung={data.schwelleKurzfassung}
								erfordernisse={data.erfordernisse}
								aktion="?/speichern"
								beschriftungKnopf="Speichern"
							/>

							{#if listeAenderbar}
								<div class="nebenformulare">
									<form
										method="POST"
										action="?/nummer"
										class="klein-formular"
										use:enhance={absenden({ reset: false })}
									>
										<input type="hidden" name="id" value={t.knoten.id} />
										<label>
											Nummer von Hand
											<input
												name="nummer"
												{...anfangswert(t.knoten.nummerManuell ?? '')}
												placeholder="leer = gerechnet"
												maxlength="20"
											/>
										</label>
										<button type="submit" class="leise" data-fokus="nummer:{t.knoten.id}">
											Nummer setzen
										</button>
									</form>

									<form
										method="POST"
										action="?/entfernen"
										use:enhance={absenden({
											beiErfolg: () => {
												offen = null;
											}
										})}
									>
										<input type="hidden" name="id" value={t.knoten.id} />
										<!--
											**Mit Rückfrage** (Bedienbarkeitsprüfung 05.09.2026, Befund
											12): «Ein Traktandum wird ohne Rückfrage gelöscht, während
											das Tilgen einer Zuordnung nachfragt.» Zwei Handlungen mit
											derselben Wirkung — etwas verschwindet — und nur eine
											fragte.

											Was verloren geht, ist mehr als eine Zeile: Wortlaut,
											Kurzfassung, Mehrheitserfordernis und angehängte Unterlagen
											hängen daran. Die Frage nennt deshalb den Titel, nicht bloss
											«dieses Traktandum».

											**Und keine Rückfrage vor einer sicheren Absage**
											(Code-Review 06.09.2026): `entferneTraktandum` weist ein
											Traktandum mit Untertraktanden ab. Eine Bestätigungsstufe
											davorzuschalten hiesse, jemanden zustimmen zu lassen und
											ihm danach abzusagen — genau das Muster, das derselbe Block
											auf der Vollmachtenseite abgestellt hat.
										-->
										{#if kinderVon(t.knoten.id) === 0}
											<Rueckfrage
												beschriftung="Traktandum entfernen"
												zeichen="kreuz"
												ton="warnung"
												frage="«{t.knoten.titel}» entfernen?"
												folge="Wortlaut, Kurzfassung, Mehrheitserfordernis und angehängte Unterlagen gehen mit. Die Nummern der folgenden Traktanden rücken nach."
												bestaetigen="Entfernen"
											/>
										{:else}
											<p class="klein">
												Zum Entfernen: Dieses Traktandum hat
												{kinderVon(t.knoten.id)}
												{kinderVon(t.knoten.id) === 1 ? 'Untertraktandum' : 'Untertraktanden'}.
												Entfernen Sie diese zuerst, sonst verschwänden Geschäfte, an die
												niemand gedacht hat.
											</p>
										{/if}
									</form>
								</div>
							{:else if data.gemeinsam}
								<p class="hilfe">
									Nummer und Reihenfolge kommen von
									<a href="/tage/{data.gemeinsam.id}/geschaefte">{data.gemeinsam.bezeichnung}</a>.
									Dort wird das Traktandum auch entfernt — in allen Gemeinschaften zugleich.
								</p>
							{/if}

							<!--
								**Vor den Unterlagen, nicht dahinter.**
								Der Weg zum Mehrheitserfordernis stand als blosser Verweis ganz
								unten, hinter den Anhängen — gefunden wurde er zufällig. Er ist
								aber der zweitwichtigste Schritt an einem Abstimmungstraktandum:
								Ohne Erfordernis lässt sich nicht auszählen. Deshalb steht er
								jetzt gleich unter dem Formular, mit Gewicht und mit dem Satz,
								der sagt, wozu er führt.
							-->
							<!--
								**Die Prüfung steht beim Text, nicht auf einer eigenen Seite.**
								Geprüft wird, was gerade getippt wurde; ein Befund, für den man
								die Seite wechseln muss, wird gelesen, wenn der Text schon
								abgeschickt ist.
							-->
							<!--
								**Kein Kasten für etwas, das es hier nicht gibt** (23.08.2026,
								Prüflauf I, B-28). Bei ausgeschalteter KI blieb die Überschrift
								«Prüfen lassen» stehen, darunter der Absatz «Für diese Gemeinschaft
								ist die KI-Unterstützung nicht zugelassen …» — an jedem Traktandum,
								und dasselbe noch einmal auf jeder Erfordernisseite. Eine
								Überschrift, unter der nur steht, dass es das nicht gibt, ist eine
								Ankündigung ohne Inhalt.

								Der Grund verschwindet nicht, er wird leise: eine Zeile statt eines
								Kastens, dort, wo der Knopf gewesen wäre.
							-->
							{#if data.ki.anzeigen && !data.ki.verfuegbar}
								<p class="hilfe ki-aus">{data.ki.grund}</p>
							{:else if data.ki.anzeigen}
						<section class="kipruefung">
								<h4>Prüfen lassen</h4>
								{#if data.ki.verfuegbar}
									<p class="hilfe">
										Geprüft wird auf: {t.pruefpunkte.join(' · ')}.
										<strong>Nichts wird verändert</strong> — Sie bekommen Befunde und entscheiden.
									</p>
									<form method="POST" action="?/kipruefen" use:enhance={absenden()}>
										<input type="hidden" name="traktandumId" value={t.knoten.id} />
										<button type="submit" class="leise" data-fokus="kipruefen:{t.knoten.id}">
											Dieses Traktandum prüfen
										</button>
									</form>
								{/if}

							</section>
							{/if}

							{#if t.knoten.art === 'abstimmung'}
								<!--
									**Der Kasten nennt jetzt die Mehrheit, nicht nur den Fall**
									(Bedienbarkeitsprüfung 05.09.2026, Befund 9): «Der Erfordernis-Kasten
									nennt Fall und Fundstelle, aber nicht die geltende Mehrheit. Die Zahl
									steht nur im Einladungs-PDF und hinter dem Knopf ‹Erfordernis ändern›
									— der klingt, als würde er etwas kaputtmachen.»

									`erfordernisInWorten` ist **dieselbe** Funktion, die den
									Abstimmungsschirm und die gedruckte Auszählmappe speist. Ein Nachbau
									hier wäre die zweite Rechnung für dieselbe Zahl gewesen, und die
									laufen auseinander, sobald eine von beiden eine Regel lernt.

									Sie hängt allein am eingefrorenen Erfordernis des Traktandums (AD-4),
									braucht also weder Momentaufnahme noch Anwesenheitsstand — das ist der
									Grund, warum sie auf einer Planungsseite überhaupt stehen kann. Eine
									konkrete Zahl («4 von 5») steht hier bewusst **nicht**: Wo die
									Bezugsgrösse an der Anwesenheit hängt, gibt es sie vor dem Abend
									nicht, und «zwei Drittel der Wertquoten» gilt in jedem Fall.

									**Und die Anleitung steht nur noch da, wo sie hilft** (Befund 30): Sie
									stand bei jedem Traktandum, auch wo das Erfordernis längst gesetzt war
									— «genau dort, wo die fehlende Zahl aus Befund 9 stehen müsste».
								-->
								<section class="erfordernisweg" class:offen-noch={!t.knoten.erfordernis}>
									<h4>Mehrheitserfordernis</h4>
									<!-- Ä-17 B: neu an einer zweiten Versammlung, auch ohne Erfordernis. -->
									{#if t.neuAnZweiter}
										<p class="meldung warnung">{t.neuAnZweiter}</p>
									{/if}
									{#if t.knoten.erfordernis}
										<p class="stand">
											<strong>{t.knoten.erfordernis.titel}</strong>
											<span class="mehrheit"
												>Nötig: {erfordernisInWorten(t.knoten.erfordernis)}</span
											>
											<span class="grundlage">{t.knoten.erfordernis.rechtsgrundlage}</span>
										</p>
										{#if t.umstritten}
											<p class="umstritten">{t.umstritten}</p>
										{/if}
										<!-- Warnungen am Erfordernis (Block 3, `domain/mehrhinweise.ts`). -->
										{#each t.mehrhinweise as h (h)}
											<p class="meldung warnung">{h}</p>
										{/each}
									{:else}
										<p class="stand">Steht noch nicht fest.</p>
										<p class="hilfe">
											Zwei Wege dorthin: Kennen Sie den Fall, wählen Sie ihn oben im Formular
											unmittelbar aus. Kennen Sie ihn nicht, führt Sie der Entscheidbaum mit
											ein paar Fragen hin — das Werkzeug schlägt vor, Sie entscheiden, und der
											Weg steht später im Verlauf. Ohne Erfordernis lässt sich am Abend nicht
											auszählen.
										</p>
									{/if}
									<a
										class="knopf"
										href="/versammlungen/{data.versammlung.id}/traktanden/{t.knoten.id}/erfordernis"
									>
										{t.knoten.erfordernis ? 'Erfordernis ändern' : 'Erfordernis bestimmen'}
									</a>
								</section>
							{/if}

							<Anhaenge
								anhaenge={t.anhaenge}
								aenderbar={data.aenderbar}
								gegenstandId={t.knoten.id}
								titel="Offerten, Anträge, Pläne"
								hinweis="Die Grundlagen zum Geschäft liegen beim Geschäft."
							/>
						{:else}
							<!--
								**Auch nach der Freigabe steht die Mehrheit da** (Code-Review
								06.09.2026). Der Kasten oben hängt an `data.aenderbar` und
								verschwindet mit der Freigabe — also genau in dem Zustand, in dem
								diese Liste vor und an der Versammlung gelesen wird. Ohne diese
								Zeile hätte Befund 9 dort unverändert weitergegolten, und die
								Änderung darüber wäre eine für den Entwurf gewesen.
							-->
							{#if t.neuAnZweiter}
								<p class="meldung warnung">{t.neuAnZweiter}</p>
							{/if}
							{#if t.knoten.erfordernis && t.knoten.art === 'abstimmung'}
								<p class="erfordernis-fest">
									<strong>Mehrheitserfordernis:</strong>
									{t.knoten.erfordernis.titel}
									<span class="mehrheit">Nötig: {erfordernisInWorten(t.knoten.erfordernis)}</span>
									<span class="grundlage">{t.knoten.erfordernis.rechtsgrundlage}</span>
								</p>
								{#if t.umstritten}
									<p class="umstritten">{t.umstritten}</p>
								{/if}
								{#each t.mehrhinweise as h (h)}
									<p class="meldung warnung">{h}</p>
								{/each}
								<!--
									**Vor Beginn mit dem Weg dorthin** (Produktentscheid 06.10.2026,
									«Verweis einbauen»). Auf der Erfordernisseite lässt sich das Mehr
									mildern, mit berichtigter Einladung, oder auf das der Einladung
									zurückstellen; Mail und Hinweis nennen diesen Verweis. Ab der
									Eröffnung führt die Leitungsseite hin.
								-->
								{#if data.erfordernisVorBeginn}
									<!-- `knopfartig` aus app.css: `.knopf` ist hier nur im Kasten des
									     Entwurfs gestaltet (Codeprüfung N6). -->
									<a
										class="knopfartig"
										href="/versammlungen/{data.versammlung.id}/traktanden/{t.knoten.id}/erfordernis"
									>
										Erfordernis ändern
									</a>
								{/if}
							{/if}
							{#if t.anhaenge.length > 0}
								<Anhaenge anhaenge={t.anhaenge} aenderbar={false} titel="Unterlagen" />
							{/if}
							{#if t.knoten.antragswortlaut}
								<p class="wortlaut"><strong>Antrag:</strong> {t.knoten.antragswortlaut}</p>
							{/if}
							{#if t.knoten.inhalt}
								<p class="inhalt">{t.knoten.inhalt}</p>
							{/if}
						{/if}
						<!--
							**Ausstand vorab** (Ä-26, Produktentscheid 17.10.2026): Solange die
							Versammlung bevorsteht, wird er hier erklärt, und die Seite nennt,
							wessen Vollmachten dadurch ruhen werden. Am Abend steht er auf der
							Leitungsseite, und dort wird er weitergeführt. Dieselbe Wahlliste wie
							dort, dazu die Vertreter, die nicht Eigentümer sind.
						-->
						{#if t.knoten.art === 'abstimmung' && data.ausstandswahl.length > 0}
							<section class="erfordernisweg">
								<h4>Ausstand</h4>
								{#each t.ausstand as a (a.id)}
									<p class="stand">
										<!-- G7 (06.11.2026): Der Ausstand aus L8 trägt keine Begründung; der
										     Zusatz hinter dem Namen sagt, woher er kommt. -->
										<strong>{a.name}</strong>{#if a.grund}: {a.grund}{/if}
									</p>
									{#if a.warnung}
										<p class="meldung warnung">{a.warnung}</p>
									{/if}
									{#if !a.ausEinstellung}
										<form method="POST" action="?/ausstandZurueck" use:enhance={absenden()}>
											<input type="hidden" name="ausstand" value={a.id} />
											<button type="submit" class="leise" data-fokus="ausstand:{a.id}">Zurücknehmen</button>
										</form>
									{/if}
								{/each}
								<form
									method="POST"
									action="?/ausstand"
									use:enhance={absenden({ danach: raeumeAusstandswahl })}
								>
									<input type="hidden" name="traktandum" value={t.knoten.id} />
									<Wahlliste
										bind:gewaehlt={ausstandswahl}
										name="partei"
										eintraege={data.ausstandswahl.filter(
											(w) => !t.ausstand.some((a) => a.kennung === w.id)
										)}
										suchbeschriftung="Partei oder Vertreter suchen"
										leerhinweis="Wer bei diesem Traktandum nicht mitentscheiden darf. Mehrere möglich, der Grund gilt für alle."
									/>
									<label>
										Warum
										<input name="grund" required minlength="3" placeholder="Es geht um ihre eigene Entschädigung" />
									</label>
									<button type="submit" class="leise" data-fokus="ausstand:neu:{t.knoten.id}">
										Ausstand erklären
									</button>
								</form>
							</section>
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ol>
{/if}

{#if data.gemeinsam}
	<p class="uebernehmen">
		<a href="/tage/{data.gemeinsam.id}/geschaefte">
			Traktandum aufnehmen — in der gemeinsamen Versammlung
		</a>
	</p>
{:else if data.aenderbar}
	<p class="uebernehmen">
		<a href="/versammlungen/{data.versammlung.id}/uebernehmen">
			Traktanden aus einer früheren Versammlung übernehmen
		</a>
	</p>

	<div class="neu">
		<!--
			`data-fokus`: Nach dem Hinzufügen klappt der Kasten zu, und mit ihm
			verschwindet der Knopf, der den Fokus trug. Ohne eine Marke hier
			bliebe er auf `<body>` — genau das, was `absenden()` abschaffen soll.
		-->
		<button
			type="button"
			class="haupt"
			data-fokus="traktandum:neu"
			onclick={() => (neuOffen = !neuOffen)}
		>
			{neuOffen ? 'Abbrechen' : 'Traktandum hinzufügen'}
		</button>

		{#if neuOffen}
			<!--
				`fehler`: nur die eigene Absage. Die übrigen Aktionen der Seite melden
				sich oben in der Meldung; hier stünde ihre rote Zeile an einem Kasten,
				in den niemand etwas eingegeben hat — seit die Seite nicht mehr neu
				lädt, bleibt er dabei ja offen stehen.
			-->
			<TraktandumFormular
				eigentuemer={data.eigentuemer}
				untergemeinschaften={data.untergemeinschaften}
				antragstellerarten={data.antragstellerarten}
				schwelleKurzfassung={data.schwelleKurzfassung}
				erfordernisse={data.erfordernisse}
				moeglicheEltern={data.traktanden
					.filter((t) => t.tiefe < data.groessteTiefe)
					.map((t) => ({ id: t.knoten.id, bezeichnung: `${t.nummer} ${t.knoten.titel}` }))}
				fehler={form?.fehler && 'aktion' in form.fehler && form.fehler.aktion === 'anlegen'
					? form.fehler
					: null}
				aktion="?/anlegen"
				beschriftungKnopf="Hinzufügen"
				beiErfolg={() => {
					neuOffen = false;
				}}
			/>
		{/if}
	</div>
{/if}


<!-- ── Die Vorankündigung (Praxisdurchlauf 28.08.2026) ──────────────────────── -->
<!--
	Vor der Bestätigungskachel, weil sie denselben Gegenstand hat: Wer die
	Liste durchgeht, um sie zu bestätigen, will die Vorankündigung vielleicht
	gleich mitnehmen. Die Liste ist dann noch nicht freigegeben — der Vermerk
	steht im Dokument, nicht nur hier.
-->
{#if data.aenderbar}
	<section class="vorankuendigung">
		<h2>Provisorische Traktandenliste</h2>
		<p class="lesebreite">
			Für die Einladung, bevor die Liste freigegeben ist. Das Dokument trägt den
			Vermerk «nicht freigegeben» und den Stand von heute — die Liste kann sich
			bis zur Freigabe noch ändern.
		</p>
		<a
			class="knopf"
			href="/versammlungen/{data.versammlung.id}/einladung.pdf?art=provisorisch"
			target="_blank"
			rel="noopener"
		>Provisorische Traktandenliste</a>
	</section>
{/if}

<!-- ── Die Liste bestätigen (Migration 033) ───────────────────────────────── -->
<!--
	Der Kasten steht am **Ende** der Liste, nicht oben: Bestätigt wird, was man
	gelesen hat, und gelesen wird von oben nach unten. Oben stünde er als Angebot,
	bevor es etwas zu bestätigen gibt.
-->
{#if data.aenderbar}
	<section class="bestaetigung" class:fertig={data.bestaetigt !== null}>
		{#if data.bestaetigt}
			<p class="stand">✓ Die Traktandenliste ist als vollständig bestätigt.</p>
			<form method="POST" action="?/wiedereroeffnen" use:enhance={absenden()}>
				<button type="submit" class="leise" data-fokus="liste:bestaetigung">
					Doch noch etwas ändern
				</button>
			</form>
		{:else}
			<h2>Ist die Liste vollständig?</h2>
			<p class="lesebreite">
				Die Punkte oben stammen zum Teil aus der Vorlage. Sie kennt die
				Jahresgeschäfte, aber nicht das, was diese Gemeinschaft dieses Jahr
				beschäftigt. Gehen Sie die Liste durch, ergänzen Sie, was fehlt, und
				bestätigen Sie sie erst dann.
			</p>
			<form method="POST" action="?/bestaetigen" use:enhance={absenden()}>
				<button type="submit" class="haupt" data-fokus="liste:bestaetigung">
					Liste ist vollständig
				</button>
			</form>
			<p class="klein lesebreite">
				Ändern lässt sie sich danach weiter — die Bestätigung ist ein Vermerk, keine
				Sperre. Gesperrt wird die Liste erst mit der Freigabe.
			</p>
		{/if}
	</section>
{/if}

<style>
	/*
	 * Das Band steht oben und tritt zurück, solange nichts zu melden ist: Es ist
	 * ein Angebot, keine Aufgabe. Ist die KI nicht zugelassen, bleibt nur der
	 * Satz mit dem Grund — dieselbe Bauart wie bei den anderen KI-Abschnitten.
	 */
	.kiband {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.85rem 1rem;
		margin: 1rem 0;
	}

	.kiband h2 {
		margin: 0 0 0.35rem;
		font-size: 1.05rem;
	}

	.kiband p {
		margin: 0 0 0.6rem;
	}

	.kiband.aus p {
		margin: 0;
	}

	.kiband button {
		min-height: var(--ziel-min);
	}

	/* Der Grund für eine fehlende Funktion steht leise, nicht als Kasten. */
	.ki-aus {
		margin: 0.4rem 0 0;
		font-style: italic;
	}



	.versteckt {
		display: none;
	}

	.leer {
		color: var(--text-leise);
	}

	.baum {
		list-style: none;
		padding: 0;
		margin: 1.5rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		/* Breite des Aufklappwinkels vor dem Titel; Kurzfassung und Hinweis
		   rücken um denselben Betrag ein. */
		--winkel: 1.4rem;
	}

	.baum li {
		margin-left: calc((var(--tiefe) - 1) * 1.5rem);
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 0.6rem 0.75rem;
		/* Sonst scrollt der Finger die Seite statt das Traktandum zu ziehen. */
		touch-action: pan-y;
	}

	.baum li.zieht {
		opacity: 0.5;
	}

	.baum li.davor {
		border-top: 3px solid var(--akzent);
	}

	.baum li.darunter {
		border-left: 3px solid var(--akzent);
		background: color-mix(in srgb, var(--akzent) 8%, var(--flaeche));
	}

	.zeile {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}

	.griff {
		min-height: var(--ziel-min);
		min-width: var(--ziel-min);
		border: none;
		background: transparent;
		color: var(--text-leise);
		font-size: 1.2rem;
		cursor: grab;
		touch-action: none;
		flex: none;
	}

	.nummer {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		flex: none;
		min-width: 2.5rem;
	}

	.nummer.manuell {
		text-decoration: underline dotted;
	}

	.titel {
		flex: 1;
		text-align: left;
		border: none;
		background: transparent;
		color: inherit;
		font: inherit;
		font-weight: 550;
		cursor: pointer;
		padding: 0.2rem 0 0.2rem var(--winkel);
		min-height: var(--ziel-min);
	}

	/*
	 * **Der Winkel gehört in die Darstellung, nicht in den Text** (06.09.2026).
	 * Als `<span>` im Knopf stand er in dessen `textContent` — und damit in
	 * allem, was den Titel ausliest oder kopiert. Zwei bestehende
	 * Drehbuchschritte fielen sofort darüber («Die Begrüssung trägt nicht die
	 * 1.n»), und dieselbe Falle träfe jeden, der den Titel weiterverwendet.
	 *
	 * Ein Pseudoelement erscheint im Bild, nicht im Text. Den Zustand sagt
	 * `aria-expanded`, das der Knopf ohnehin trägt.
	 */
	/*
	 * **Dieselbe Geste wie in der Versammlungsliste** (Code-Review 06.09.2026):
	 * dort ein `▾`, das sich im geschlossenen Zustand um 90 Grad dreht
	 * (`versammlungen/+page.svelte`, `.pfeil.zu`). Zwei verschiedene Zeichen
	 * zu tauschen sähe an zwei Orten derselben Anwendung verschieden aus.
	 *
	 * Der Unterschied bleibt das Pseudoelement statt eines `<span>`: Im Knopf
	 * stünde das Zeichen sonst im `textContent` und damit in allem, was den
	 * Titel ausliest.
	 */
	/*
	 * **Hängender Einzug** (UI-Durchgang 06.10.2026). Der Winkel stand im Fluss
	 * der ersten Zeile; umbrochene Zeilen begannen 17 px weiter links als die
	 * erste, eine umbrochene Marke dazwischen, also drei linke Kanten in einem
	 * Eintrag (am Telefon 96, 79 und 87 px). Und «Verschiedenes», das keinen
	 * Winkel hat, stand 17 px links von allen anderen Titeln. Jetzt hält der
	 * Knopf links den Platz frei, und der Winkel hängt mit negativem Rand
	 * hinein: Alle Zeilen eines Titels und alle Titel beginnen an derselben
	 * Kante, mit oder ohne Winkel.
	 *
	 * `text-align: center`, weil das Zeichen gedreht wird: Links ausgerichtet
	 * lag seine Mitte neben der Mitte des Kastens, und die Drehung machte aus
	 * diesem seitlichen Versatz einen nach unten. Der Winkel hing unter der
	 * Grundlinie und klebte 3 bis 4 px am Titel.
	 */
	.titel::before {
		content: '▾';
		display: inline-block;
		width: var(--winkel);
		margin-left: calc(-1 * var(--winkel));
		text-align: center;
		color: var(--text-leise);
		transform: rotate(-90deg);
		transition: transform 0.12s ease;
	}

	.titel[aria-expanded='true']::before {
		transform: rotate(0deg);
	}

	/*
	 * **Kein Winkel, wo nichts aufklappt** (Code-Review 06.09.2026). In der
	 * gesperrten Sicht hat ein Pflichttraktandum weder Antragswortlaut noch
	 * Inhalt noch Unterlagen; der Ausklapp zeigte dann nur seine Trennlinie.
	 * Ein Zeichen, das Inhalt verspricht und eine leere Linie liefert, ist
	 * schlechter als gar keins.
	 */
	.titel.stumm::before {
		content: none;
	}

	.marke {
		display: inline-block;
		margin-left: 0.5rem;
		font-size: 0.75rem;
		font-weight: 400;
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		background: var(--flaeche-2);
		color: var(--text-leise);
	}

	.kurzfassung {
		margin: 0.2rem 0 0 calc(3.1rem + var(--winkel));
		font-size: 0.9rem;
		color: var(--text-leise);
	}

	.hinweis {
		margin: 0.35rem 0 0 calc(3.1rem + var(--winkel));
		font-size: 0.85rem;
		padding: 0.4rem 0.6rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--fehler) 8%, transparent);
	}

	.ausklapp {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--linie);
	}

	.nebenformulare {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
		align-items: flex-end;
		margin-top: 1rem;
	}

	.klein-formular {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
	}

	.klein-formular label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
		font-weight: 550;
	}

	.klein-formular input {
		min-height: var(--ziel-min);
		width: 9rem;
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--grund);
		color: var(--text);
		font: inherit;
		font-weight: 400;
	}

	.wortlaut,
	.inhalt {
		white-space: pre-wrap;
	}

	.erfordernisweg {
		margin-top: 1.25rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--linie);
		border-left: 4px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		max-width: 46rem;
	}

	/* Fehlt es, ist es kein Nebenschauplatz mehr. */
	.erfordernisweg.offen-noch {
		border-left-color: var(--warnung);
	}

	.erfordernisweg h4 {
		margin: 0 0 0.35rem;
		font-size: 0.95rem;
	}

	.erfordernisweg .stand {
		margin: 0 0 0.4rem;
	}

	/*
	 * Die Mehrheit trägt die Textfarbe, die Fundstelle die leise: Wer den Kasten
	 * überfliegt, sucht die Bedingung, nicht den Artikel. Sie steht bewusst
	 * zwischen beiden — der Fallname sagt, worum es geht, die Zahl, was gilt,
	 * und der Artikel, woher es kommt.
	 */
	.erfordernisweg .mehrheit,
	.erfordernis-fest .mehrheit {
		display: block;
		margin-top: 0.15rem;
	}

	/* Nach der Freigabe: kein Kasten, die Auskunft und vor Beginn der Verweis darunter. */
	.erfordernis-fest {
		margin: 0 0 0.75rem;
		max-width: 46rem;
	}

	.erfordernis-fest .grundlage {
		display: block;
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	.erfordernisweg .grundlage {
		display: block;
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	.erfordernisweg .hilfe {
		margin: 0 0 0.75rem;
	}

	/* Ä-01: ein Satz unter der Fundstelle, so leise wie sie; kein Warnkasten. */
	.umstritten {
		margin: 0 0 0.75rem;
		max-width: 46rem;
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	.erfordernisweg .knopf {
		display: inline-flex;
		align-items: center;
		min-height: var(--ziel-min);
		padding: 0 1rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche-2);
		color: inherit;
		text-decoration: none;
		font-weight: 550;
	}

	.uebernehmen {
		margin-top: 2rem;
		font-size: 0.9rem;
	}

	.neu {
		margin-top: 1rem;
	}

	button.leise {
		min-height: var(--ziel-min);
		padding: 0 0.9rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: transparent;
		color: var(--text-leise);
		font: inherit;
		cursor: pointer;
	}

	.meldung {
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		max-width: 46rem;
		margin-top: 1rem;
	}

	.meldung.gut {
		background: color-mix(in srgb, var(--akzent) 15%, transparent);
	}

	.meldung.fehler {
		background: color-mix(in srgb, var(--fehler) 12%, transparent);
		color: var(--fehler);
	}

	/* Kein Fehler, keine Warnung: eine Herkunftsangabe. Sie steht ruhig da. */
	.meldung.gemeinsam {
		background: var(--flaeche-2);
	}

	.bestaetigung {
		margin-top: 2rem;
		padding: 1rem 1.15rem;
		border: 1px solid var(--linie);
		border-top: 3px solid var(--warnung);
		border-radius: var(--radius);
		background: var(--flaeche);
		max-width: 46rem;
	}

	/* Erledigt tritt zurück: Der Kasten hat seine Arbeit getan. */
	.bestaetigung.fertig {
		border-top-color: var(--akzent);
	}

	.bestaetigung h2 {
		margin-top: 0;
	}

	/* Die Vorankündigung folgt auf die Erfassen-Zeile; der Abstand hält sie
	   von deren Knopf getrennt, statt wie ein Anhängsel zu kleben. */
	.vorankuendigung {
		margin-top: 2.5rem;
	}

	.vorankuendigung h2 {
		margin-top: 0;
	}

	.bestaetigung .stand {
		margin: 0 0 0.6rem;
		font-weight: 600;
	}

	.bestaetigung form {
		margin: 0.75rem 0 0.5rem;
	}

	.fehlende-erfordernisse {
		margin: 0.75rem 0 1.25rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--linie);
		border-left: 4px solid var(--warnung);
		border-radius: var(--radius);
		background: var(--flaeche);
		max-width: 46rem;
	}

	.fehlende-erfordernisse h2 {
		margin: 0 0 0.4rem;
		font-size: 1rem;
	}

	.fehlende-erfordernisse ul {
		margin: 0.6rem 0 0;
		padding-left: 1.1rem;
	}

	.fehlende-erfordernisse li {
		margin: 0.25rem 0;
	}
	/* ── Die Prüfung (FR-58) ──────────────────────────────────────────────── */
	.kipruefung {
		margin-top: 1rem;
		padding: 0.75rem 1rem;
		border: 1px solid var(--linie);
		border-radius: 6px;
		background: var(--flaeche-2);
	}
	.kipruefung h4 {
		margin: 0 0 0.35rem;
		font-size: 0.95rem;
	}
	.kipruefung.aus {
		opacity: 0.7;
	}
	.kipruefung .ergebnis {
		margin: 0.75rem 0 0.5rem;
		font-weight: 600;
	}
	.kipruefung .herkunft {
		display: block;
		font-weight: 400;
		font-size: 0.8rem;
		color: var(--text-leise);
	}
	.befund {
		margin: 0.5rem 0;
		padding: 0.5rem 0.75rem;
		border-left: 3px solid var(--linie);
		background: var(--flaeche);
	}
	/* Der Schweregrad traegt Farbe, nicht der Rahmen: Wer im Saal drei Zeilen
	   liest, soll die richtigen zuerst sehen. */
	.befund.hoch {
		border-left-color: var(--fehler);
	}
	.befund.mittel {
		border-left-color: var(--hinweis);
	}
	.befund.tief {
		border-left-color: var(--neutral);
	}
	.befund .grad {
		display: inline-block;
		margin-right: 0.4rem;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-leise);
	}
	.befund .was {
		margin: 0;
	}
	.befund .vorschlag {
		margin: 0.25rem 0 0;
		color: var(--text-leise);
	}
	.hinausgegangen {
		margin-top: 0.5rem;
		font-size: 0.85rem;
	}
	.hinausgegangen pre {
		margin: 0.4rem 0 0;
		padding: 0.5rem;
		overflow-x: auto;
		white-space: pre-wrap;
		background: var(--flaeche);
		border: 1px dashed var(--linie);
	}
	.entscheid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
		margin-top: 0.75rem;
		font-size: 0.85rem;
	}
	.fehlschlag {
		margin: 0.75rem 0 0;
		color: var(--warnung);
	}
</style>
