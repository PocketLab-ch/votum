<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import Fallauswahl from './Erfordernisauswahl.svelte';
	import {
		antragstellerbedarf,
		type Antragstellerart,
		type Traktandum,
		type Traktandumart
	} from '$lib/domain/traktanden';
	import {
		AUSSCHLUSSKLAGE_KNOTEN,
		EINSPRACHE_KNOTEN,
		betroffenenzustimmungVon,
		type Erfordernisauswahl
	} from '$lib/domain/entscheidbaum';
	import Antragsvorschlag from './Antragsvorschlag.svelte';
	import { anfangswert, angekreuzt } from '$lib/felder';
	import { zeichenzahl } from '$lib/domain/zeichenzahl';
	import Suchauswahl from './Suchauswahl.svelte';

	interface Wahl {
		id: string;
		name: string;
	}
	interface EigentuemerWahl extends Wahl {
		einheiten: string[];
	}

	let {
		traktandum = null as Traktandum | null,
		eigentuemer = [] as EigentuemerWahl[],
		historischerEinzelantragsteller = [] as EigentuemerWahl[],
		historischeGemeinsameAntragsteller = [] as EigentuemerWahl[],
		historischeBetroffene = [] as EigentuemerWahl[],
		untergemeinschaften = [] as Wahl[],
		antragstellerarten = [] as { art: Antragstellerart; bezeichnung: string }[],
		schwelleKurzfassung = 400,
		moeglicheEltern = [] as { id: string; bezeichnung: string }[],
		erfordernisse = [] as Erfordernisauswahl[],
		fehler = null as { nachricht: string; feld?: string } | null,
		aktion = '',
		beschriftungKnopf = 'Speichern',
		/**
		 * Was nach einem erfolgreichen Absenden geschehen soll.
		 *
		 * **Warum das der Aufrufer entscheidet.** Seit dem 28.08.2026 lädt das
		 * Formular die Seite nicht mehr neu (Auftraggeber: «Jedes Mal beim Speichern
		 * springt die Seite Top»), und damit bleibt jeder Zustand stehen, den
		 * vorher das Neuladen zurücksetzte. Was danach richtig ist, hängt an der
		 * Stelle:
		 *
		 *   * Beim **Anlegen** gehört der Kasten zugeklappt. Er trägt seine
		 *     Felder als `$state`, und `reset()` erreicht die nicht — nur das
		 *     Zuklappen zerstört die Komponente und gibt ihr beim nächsten
		 *     Öffnen frische Werte.
		 *   * Beim **Ändern** bleibt er offen. Zuklappen liesse die Seite unter
		 *     dem Finger zusammenfallen, und das ist wieder ein Sprung. Die
		 *     Quittung erscheint stattdessen unten rechts, wo sie auch sieht,
		 *     wer weit unten in der Liste steht.
		 */
		beiErfolg = undefined as (() => void) | undefined
	} = $props();

	let art = $state<Traktandumart>(untrack(() => traktandum?.art ?? 'abstimmung'));
	let antragsteller = $state<Antragstellerart>(
		untrack(() => traktandum?.antragstellerart ?? 'bewirtschaftung')
	);

	// Was die gewählte Art noch verlangt — die Regel steht im Kern, nicht hier.
	const bedarf = $derived(antragstellerbedarf(antragsteller));
	let inhalt = $state(untrack(() => traktandum?.inhalt ?? ''));
	let kurzfassung = $state(untrack(() => traktandum?.kurzfassung ?? ''));

	// `zeichenzahl` und nicht `.length`: Der Hinweis darunter nennt die Zahl als
	// «Zeichen», und die Serverseite (`traktanden.ts`) zählt seit dem 26.08.2026
	// ebenso. Der Wächter sieht `.svelte` nicht — hier hilft nur Mitdenken.
	const kurzfassungFehlt = $derived(
		zeichenzahl(inhalt) > schwelleKurzfassung && !kurzfassung.trim()
	);

	const verlangtZustimmung = $derived(traktandum?.erfordernis?.zustimmungBetroffenerNoetig ?? false);
	// Bei der Ausschlussklage steht hier die beklagte Partei, kein Vetorecht
	// (Produktentscheid 29.09.2026; ohne Eintrag sperrt die Freigabe).
	const istAusschlussklage = $derived(traktandum?.erfordernis?.knotenId === AUSSCHLUSSKLAGE_KNOTEN);
	// Bei der Einsprache (ab Fassung 2026-10-20) die Partei, die verkauft,
	// vermietet oder belastet; auch sie hat kein Vetorecht und stimmt nicht mit.
	const istEinsprache = $derived(traktandum?.erfordernis?.knotenId === EINSPRACHE_KNOTEN);
	// Die Form kommt aus derselben Zuordnung wie die Rechnung, nicht aus einer
	// eigenen am Formular.
	const zustimmungsform = $derived(
		traktandum?.erfordernis ? betroffenenzustimmungVon(traktandum.erfordernis) : null
	);
	const einzelantragsteller = $derived([...eigentuemer, ...historischerEinzelantragsteller]);
	const gemeinsameAntragsteller = $derived([
		...eigentuemer,
		...historischeGemeinsameAntragsteller
	]);
	const betroffene = $derived([...eigentuemer, ...historischeBetroffene]);

	function eigentuemerBeschriftung(e: EigentuemerWahl): string {
		return e.einheiten.length > 0
			? `${e.name} · ${e.einheiten.join(', ')}`
			: `${e.name} · am Versammlungstag keine Einheit`;
	}

	/*
	 * **Der Musterwortlaut** (Prüflauf I, B-18: «Für elf Traktanden habe ich elf
	 * Anträge frei formuliert. Die Anwendung kennt die Geschäftsart, den Titel
	 * und den Betrag»).
	 *
	 * Gesteuerte Felder, weil das Programm sie füllt — genau der Fall, für den
	 * `bind:value` + `$state` richtig ist (Doktrin vom 11.08.2026); `anfangswert`
	 * wäre hier falsch, es schriebe den Vorschlag nie hinein.
	 *
	 * Der Knopf verschwindet, sobald etwas im Feld steht: Ein Vorschlag, der
	 * einen ausformulierten Antrag überschreiben kann, ist eine Falle. Wer den
	 * eigenen Text loswerden will, löscht ihn — dann ist der Knopf wieder da.
	 */
	let titel = $state(untrack(() => traktandum?.titel ?? ''));
	let wortlaut = $state(untrack(() => traktandum?.antragswortlaut ?? ''));
	let gewaehlterFall = $state('');
	const fallart = $derived(
		erfordernisse.find((e: Erfordernisauswahl) => e.knotenId === gewaehlterFall)?.geschaeftsart ??
			null
	);
</script>

<!--
	`reset: false`: Die Felder zeigen beim Ändern den Bestand, nicht eine leere
	Eingabe. Ein Leeren fiele auf die Werte zurück, die beim letzten
	Seitenaufbau darin standen. Das Anlegen braucht es nicht — dort klappt der
	Aufrufer zu, und das ist gründlicher als jedes `reset()`.
-->
<form
	method="POST"
	action={aktion}
	class="formular"
	use:enhance={absenden({ reset: false, beiErfolg })}
>
	{#if fehler}
		<p class="fehler" role="alert">{fehler.nachricht}</p>
	{/if}

	{#if traktandum}
		<input type="hidden" name="id" value={traktandum.id} />
		<input type="hidden" name="parentId" value={traktandum.parentId ?? ''} />
	{/if}

	<label>
		Titel
		<!-- Gesteuert, weil der Titel in den Musterwortlaut einfliesst. -->
		<input name="titel" bind:value={titel} required maxlength="300" autocomplete="off" />
	</label>

	<fieldset class="eng">
		<legend>Art</legend>
		<label class="wahl">
			<input type="radio" name="art" value="abstimmung" bind:group={art} />
			<span>
				<strong>Abstimmung</strong>
				<span class="hilfe">Es wird beschlossen. Der Antragswortlaut ist Pflicht.</span>
			</span>
		</label>
		<label class="wahl">
			<input type="radio" name="art" value="kenntnisnahme" bind:group={art} />
			<span>
				<strong>Kenntnisnahme</strong>
				<span class="hilfe">
					Es wird nur berichtet. Kein Antragswortlaut, kein Mehrheitserfordernis — über eine
					Kenntnisnahme wird nicht beschlossen.
				</span>
			</span>
		</label>
	</fieldset>

	{#if art === 'abstimmung'}
		<label>
			Antragswortlaut
			<textarea name="antragswortlaut" rows="3" bind:value={wortlaut} required></textarea>
			<span class="hilfe">
				Genau dieser Satz kommt zur Abstimmung und steht so im Protokoll.
			</span>
			<Antragsvorschlag
				art={fallart}
				{titel}
				vorhanden={wortlaut}
				uebernehmen={(satz) => (wortlaut = satz)}
			/>
		</label>

		<!--
			**Das Erfordernis gleich hier, wenn man den Fall kennt.**

			Gewünscht am 02.08.2026: «Beim Zuweisen des Traktandums soll die
			Möglichkeit bestehen, das Quorum selbst zu bestimmen, ggf. als Dropdown
			mit allen Variationen.»

			Die Liste führt die Fälle des Regelwerks, nicht bloss die vier
			Mehrheitshöhen: «Wertquoten ändern» sagt mitsamt seiner Rechtsgrundlage,
			warum zwei Drittel gelten — «Qualifiziertes Mehr» sagt es nicht. Wer den
			Fall nicht kennt, lässt das Feld stehen und geht den Entscheidbaum; der
			bleibt der Weg für den Zweifel und schreibt jede Antwort in den Verlauf.

			Bleibt die Auswahl unverändert, wird **nichts** geschrieben. Sonst
			verlöre ein hergeleitetes Erfordernis beim nächsten Speichern des Titels
			seinen Pfad, ein übersteuertes seine Begründung und ein aus dem Reglement
			stammendes seine Fundstelle.
		-->
		{#if erfordernisse.length > 0}
			<Fallauswahl
					{erfordernisse}
					bind:wert={gewaehlterFall}
					leerText={traktandum?.erfordernis
						? '— unverändert lassen —'
						: '— offen, über den Entscheidbaum bestimmen —'}
					hilfe={traktandum?.erfordernis
						? `Steht auf «${traktandum.erfordernis.titel}» (${traktandum.erfordernis.quelle === 'hergeleitet' ? 'hergeleitet' : traktandum.erfordernis.quelle === 'reglement' ? 'aus dem Reglement' : 'gesetzt'}). Bleibt die Auswahl leer, ändert sich nichts.`
					: 'Kennen Sie den Fall, wählen Sie ihn hier. Sonst führt der Entscheidbaum am Traktandum hin.'}
			/>
		{/if}

		<!--
			**Das Häkchen zum Geschäft der Verwaltung** (L8, Migration 184). Es
			gehört zur Abstimmung, nicht zur Kenntnisnahme, und wirkt zusammen
			mit dem Häkchen an der Vollmacht: Ruhen die Vollmachten der
			Verwaltung nach der Einstellung der Gemeinschaft, geschieht das nur
			an Traktanden mit diesem Häkchen. An Wahl und Abberufung der
			Verwaltung weist der Server es ab; der Satz dazu steht in der
			Absage, nicht hier. `kaestchen-eintrag` wie die Antragssteller
			darunter: ein Häkchen mit Text daneben.
		-->
		<label class="kaestchen-eintrag">
			<input
				type="checkbox"
				name="verwaltungsGeschaeft"
				value="ja"
				{...angekreuzt(traktandum?.verwaltungsGeschaeft === true)}
			/>
			<span>Es geht um die Entschädigung der Verwaltung, einen Vertrag mit ihr oder ihre Entlastung</span>
		</label>
	{/if}

	<label>
		Kurzfassung
		<!-- Ungesteuert mit Mitschrift, siehe GemeinschaftFormular: `bind:value`
		     schreibt den Wert zurück und kann Getipptes hinter den alten Inhalt
		     setzen, statt an seine Stelle. -->
		<textarea
			name="kurzfassung"
			rows="2"
			{...anfangswert(kurzfassung)}
			oninput={(e) => (kurzfassung = e.currentTarget.value)}
			maxlength="600"
		></textarea>
		<span class="hilfe" class:mahnung={kurzfassungFehlt}>
			Ein bis zwei Sätze in einfacher Sprache. Erscheint auf der Traktandenliste, auf dem Beamer und
			auf dem Telefon über der Abstimmungsfrage.
			{#if kurzfassungFehlt}
				<strong>
					Der Inhalt ist länger als {schwelleKurzfassung} Zeichen — dort wird die Kurzfassung gelesen,
					der lange Text nicht.
				</strong>
			{/if}
		</span>
	</label>

	<label>
		Inhalt
		<textarea
			name="inhalt"
			rows="5"
			{...anfangswert(inhalt)}
			oninput={(e) => (inhalt = e.currentTarget.value)}
		></textarea>
		<span class="hilfe">
			Die ausführliche Darstellung. Sie steht auf der Traktandenliste (Einladung) und hier
			unter dem Titel; auf dem Beamer erscheint nur die Kurzfassung.
		</span>
	</label>

	<label>
		Antragsteller
		<Suchauswahl
			name="antragstellerart"
			beschriftung="Antragsteller"
			pflicht
			bind:wert={antragsteller}
			eintraege={antragstellerarten.map((a) => ({ wert: a.art, text: a.bezeichnung }))}
		/>
	</label>

	{#if antragsteller === 'eigentuemer'}
		<label class="eingerueckt">
			Welcher Eigentümer
			<Suchauswahl
				name="antragstellerPartei"
				beschriftung="Welcher Eigentümer"
				leerText="— wählen —"
				pflicht
				wert={traktandum?.antragstellerId ?? ''}
				eintraege={einzelantragsteller.map((e) => ({
					wert: e.id,
					text: eigentuemerBeschriftung(e)
				}))}
			/>
			<span class="hilfe">
				Ohne diese Angabe liesse sich später nicht prüfen, ob er antragsberechtigt war.
			</span>
		</label>
	{:else if antragsteller === 'untergemeinschaft'}
		<label class="eingerueckt">
			Welche Untergemeinschaft
			<Suchauswahl
				name="antragstellerGemeinschaft"
				beschriftung="Welche Untergemeinschaft"
				leerText="— wählen —"
				pflicht
				wert={traktandum?.antragstellerId ?? ''}
				eintraege={untergemeinschaften.map((g) => ({ wert: g.id, text: g.name }))}
			/>
		</label>
	{:else if bedarf === 'mehrere'}
		<!--
			Kästchen statt Mehrfachauswahl: Eine `select multiple` verlangt auf dem
			Telefon eine Geste, die niemand kennt, und zeigt nie alle Gewählten auf
			einmal. Hier steht jeder Name für sich.
		-->
		<fieldset class="eingerueckt">
			<legend>Welche Eigentümer gemeinsam</legend>
			<p class="hilfe">
				Mindestens zwei. Bei einem einzelnen wählen Sie oben «Ein einzelner Eigentümer» —
				sonst stünde im Protokoll «mehrere» über einem Antrag, den einer gestellt hat.
			</p>
			<div class="kaestchen">
				{#each gemeinsameAntragsteller as e (e.id)}
					<label class="kaestchen-eintrag">
						<input
							type="checkbox"
							name="antragstellerParteien"
							value={e.id}
							{...angekreuzt(traktandum?.antragstellerIds?.includes(e.id) ?? false)}
						/>
						<span>{eigentuemerBeschriftung(e)}</span>
					</label>
				{/each}
			</div>
		</fieldset>
	{:else if bedarf === 'name' || bedarf === 'nameFrei'}
		<label class="eingerueckt">
			{bedarf === 'name' ? 'Wer genau' : 'Bezeichnung (freiwillig)'}
			<input
				name="antragstellerName"
				{...anfangswert(traktandum?.antragstellerName ?? '')}
				maxlength="120"
				required={bedarf === 'name'}
				placeholder={antragsteller === 'ausschuss'
					? 'z. B. Bauausschuss'
					: antragsteller === 'revision'
						? 'z. B. Revisionsstelle Meier AG'
						: 'z. B. Arbeitsgruppe Umgebung'}
			/>
			<span class="hilfe">
				{#if bedarf === 'name'}
					Ohne Bezeichnung benennt «Andere» niemanden.
				{:else}
					Hat die Gemeinschaft mehrere, gehört der Name dazu.
				{/if}
			</span>
		</label>
	{/if}

	{#if traktandum && betroffene.length > 0}
		<fieldset class:hervorgehoben={verlangtZustimmung || istAusschlussklage || istEinsprache}>
			<legend>
				{istAusschlussklage
					? 'Beklagte Partei, sie stimmt nicht mit'
					: istEinsprache
						? 'Betroffene Partei, sie stimmt nicht mit'
						: 'Unmittelbar Betroffene — ihre Zustimmung ist ein Vetorecht'}
			</legend>
			<!--
				Ausgeschrieben, weil «unmittelbar Betroffene» nicht sagt, was daran
				hängt. Gefragt am 01.08.2026: «Ist das das Veto für direkt betroffene
				Eigentümer?» — Ja, und genau so wirkt es in der Auszählung:
				`angenommen = Köpfe && Quoten && Betroffene`. Wer die Wirkung nicht
				kennt, kreuzt hier zu viele an und wundert sich später über einen
				gescheiterten Beschluss, oder zu wenige und fasst einen anfechtbaren.
			-->
			<p class="hilfe">
				{#if istAusschlussklage}
					<strong>
						Kreuzen Sie an, gegen wen geklagt werden soll. Diese Partei stimmt bei der Ermächtigung
						nicht mit, auch nicht als Vertretung anderer (ZGB Art. 649b Abs. 2; BGE 134 III 481
						E. 3.8). Ohne Eintrag lässt
						sich die Einladung nicht freigeben. Nennen Sie die Person auch im Antrag, damit die
						Einladung sagt, gegen wen geklagt wird. Ist es eine Familienwohnung oder gehört die
						Wohnung mehreren, klären Sie vor der Einladung, gegen wen sich der Antrag richtet. Fragen
						Sie dazu die Anwältin oder den Anwalt, die für die Klage vorgesehen sind. Nach dem
						SVIT-Kommentar richtet sich der Antrag bei Miteigentum an der Wohnung nur gegen die beklagte
						Person. Bei Gesamteigentum, etwa einer Erbengemeinschaft oder Gütergemeinschaft, richtet
						er sich gegen alle. Bei einer Familienwohnung ist umstritten, ob auch der Ehegatte oder die
						eingetragene Partnerin einzubeziehen ist (Rz. 216 ad Art. 712a). Nennen Sie im Antrag
						alle, gegen die geklagt werden soll. Richtet er sich gegen alle Eigentümer der Wohnung,
						tragen Sie das nach der Freigabe unter «Jetzt möglich», «Betroffene» ein; vorher lässt es
						sich dort nicht erfassen.
					</strong>
				{:else if istEinsprache}
					<strong>
						Kreuzen Sie an, wer verkauft, vermietet oder belastet. Diese Partei stimmt über die
						Einsprache nicht mit; Votum zählt auch ihre Vollmachten hier nicht. Ohne Eintrag lässt
						sich die Einladung nicht freigeben.
					</strong>
				{:else if verlangtZustimmung}
					<strong>
						{#if zustimmungsform === 'nachher'}
							Durch Beschluss lassen sich die Wertquoten nur ändern, wenn jede Person, die hier
							steht, zustimmt (ZGB Art. 712e Abs. 2), in der Regel mit ihrer Unterschrift auf der
							Abänderungsurkunde, die ein Notar öffentlich beurkundet; erst dann kann die Änderung
							im Grundbuch eingetragen werden. Betroffen ist auch, wessen Quote steigt. Welche Form
							das Grundbuch für die Genehmigung verlangt, klärt die Verwaltung am besten vor der
							Versammlung mit dem Notar. Die Versammlung genehmigt die Änderung mit der Mehrheit,
							auch wenn eine betroffene Person im Saal Nein sagt.
						{:else}
							Votum zählt die Zustimmung, wenn eine Person, die hier steht, im Saal ausdrücklich Ja
							sagt, selbst oder durch ihre Vertretung. Ebenso zählt eine Zustimmung zu diesem Antrag,
							die sie vorher schriftlich erteilt hat und die die Sitzungsleitung in Votum vermerkt.
							Sagt die Person oder ihre Vertretung danach im Saal Nein, zählt Votum die schriftliche
							Zustimmung nicht mehr; eine Enthaltung oder keine Stimme ändert an ihr nichts. Ohne
							Zustimmung meldet Votum den Beschluss als abgelehnt, gleich wie gross die Mehrheit
							ist. Ohne schriftliche Zustimmung zählt Votum Enthaltung, Nichtabgabe und Abwesenheit
							nicht als Zustimmung. Kann eine Person, die hier steht, nicht teilnehmen, lässt sie
							sich am besten vertreten oder stimmt vorher schriftlich zu. Am besten unterschreibt
							sie dafür ein eigenes Schreiben, getrennt von einer allfälligen Vollmacht, das den
							Antrag wörtlich wiedergibt und zum Protokoll kommt. Ändert sich der Wortlaut des
							Antrags danach, löscht Votum den Vermerk; für den geänderten Antrag braucht es eine
							neue Zustimmung. Ist die Person im Ausstand, stimmt sie bei der Mehrheit nicht mit;
							Votum zählt nur, ob sie zustimmt. Dafür hat sie drei Wege. Sie stimmt vor der
							Versammlung schriftlich zu, und die Sitzungsleitung vermerkt es. Sie unterschreibt
							in der Versammlung, und die Sitzungsleitung vermerkt es vor der Abstimmung. Oder
							sie entscheidet während der Abstimmung, am eigenen Gerät oder mündlich, auch
							telefonisch. Äussert sie sich auf keinem Weg, ist der Antrag abgelehnt. Zieht sie
							eine schriftliche Zustimmung zurück, nimmt die Sitzungsleitung den Vermerk zurück.
							Ein Entscheid während der Abstimmung geht einer früheren schriftlichen Zustimmung
							vor. Die Zustimmung verlangt ZGB Art. 712g Abs. 4.
						{/if}
					</strong>
				{:else}
					Wer hier steht, muss dem Antrag ausdrücklich zustimmen, sonst kommt er nicht
					zustande — ein Vetorecht neben der Mehrheit. Nur zu füllen, wo das
					Mehrheitserfordernis diese Zustimmung verlangt.
				{/if}
			</p>
			{#if istAusschlussklage}
				<!-- Eigener Absatz, nicht im fetten Block: Dort wurde der Satz überlesen (Laienprüfung F1, A5). -->
				<p class="hilfe">
					Nennen Sie im Antrag auch mit Namen, wer klagen soll: betroffene Eigentümerinnen oder
					Eigentümer, nicht die Gemeinschaft und nicht die Bewirtschaftung.
				</p>
			{/if}
			<div class="kaestchen">
				{#each betroffene as e (e.id)}
					<label class="kaestchen-eintrag">
						<input
							type="checkbox"
							name="betroffene"
							value={e.id}
							{...angekreuzt(traktandum.betroffeneParteiIds.includes(e.id))}
						/>
						{eigentuemerBeschriftung(e)}
					</label>
				{/each}
			</div>
		</fieldset>
	{/if}

	{#if !traktandum && moeglicheEltern.length > 0}
		<label>
			Als Untertraktandum von
			<Suchauswahl
				name="parentId"
				beschriftung="Als Untertraktandum von"
				leerText="— eigenständiges Traktandum —"
				eintraege={moeglicheEltern.map((m) => ({ wert: m.id, text: m.bezeichnung }))}
			/>
		</label>
	{/if}

	<button type="submit" data-fokus="traktandum:{traktandum?.id ?? 'neu'}">
		{beschriftungKnopf}
	</button>
</form>

<style>
	.formular {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 42rem;
		margin-top: 1rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-weight: 550;
	}

	/*
	 * **`:global(…)`, weil das Auswahlfeld jetzt in `Suchauswahl.svelte` steht.**
	 * Svelte gestaltet nur Elemente, die in dieser Datei stehen; ohne `:global`
	 * fiele die Regel lautlos aus, und das Feld sähe anders aus als seine
	 * Nachbarn. Die Verankerung an der Klasse hält sie trotzdem auf dieser Seite.
	 */
	input:not([type='radio']):not([type='checkbox']),
	.formular :global(select),
	.formular :global(.auswahlsuche),
	textarea {
		min-height: var(--ziel-min);
		padding: 0.5rem 0.65rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		font-weight: 400;
	}

	textarea {
		resize: vertical;
	}

	.hilfe {
		font-weight: 400;
		font-size: 0.875rem;
		color: var(--text-leise);
	}

	.hilfe.mahnung strong {
		color: var(--fehler);
	}

	fieldset {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.85rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	fieldset.hervorgehoben {
		border-color: var(--akzent);
		background: color-mix(in srgb, var(--akzent) 8%, transparent);
	}

	legend {
		font-weight: 550;
		padding: 0 0.35rem;
	}

	.wahl {
		flex-direction: row;
		align-items: flex-start;
		gap: 0.6rem;
		font-weight: 400;
		min-height: var(--ziel-min);
	}

	.wahl > span {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.eingerueckt {
		margin-left: 1.2rem;
	}

	.kaestchen {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 1rem;
	}

	.kaestchen-eintrag {
		flex-direction: row;
		align-items: center;
		gap: 0.45rem;
		font-weight: 400;
		min-height: var(--ziel-min);
	}

	input[type='radio'],
	input[type='checkbox'] {
		margin-top: 0.2rem;
		width: 1.1rem;
		height: 1.1rem;
		min-height: 0;
		flex: none;
	}

	.kaestchen-eintrag input {
		margin-top: 0;
	}

	button {
		align-self: flex-start;
		min-height: var(--ziel-min);
		padding: 0 1.25rem;
		border: none;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font: inherit;
		font-weight: 550;
		cursor: pointer;
	}

	.fehler {
		margin: 0;
		padding: 0.75rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--fehler) 12%, transparent);
		color: var(--fehler);
	}
</style>
