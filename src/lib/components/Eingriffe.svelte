<script lang="ts">
	/**
	 * «Was jetzt geht» — die Eingriffe am aufgerufenen Traktandum, an einem Ort.
	 *
	 * **Der Anlass** (13.08.2026): «Immer den Fokus des Nutzers ohne
	 * Programmkenntnisse und Stress durch die Sitzungsleitung im Hinterkopf
	 * behalten. Einfach verständlich, intuitiv und sichtbar (nicht dominant).»
	 * Vorher standen sie an vier Stellen, alle zugeklappt, alle mit einem
	 * Fachwort beschriftet.
	 *
	 * Welche möglich sind, rechnet der Kern (`domain/eingriffe.ts`) — dieselbe
	 * Frage, die der Server beim Abschicken stellt. Nichts steht ausgegraut da:
	 * Ein Eintrag, den man nicht drücken kann, ist eine Frage ohne Antwort.
	 *
	 * **Als Komponente seit dem 24.08.2026** (Auftraggeber: «Von der Funktionalität her
	 * muss es gleich sein wie bei der Einzelversammlung»). Am gemeinsamen Abend
	 * ist ein Schritt genau ein Traktandum in genau einem Haus — dieselbe Lage,
	 * dieselben Eingriffe.
	 */
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import TraktandumAufnehmen from '$lib/components/TraktandumAufnehmen.svelte';
	import Wahlliste from '$lib/components/Wahlliste.svelte';
	import { eingriffssatz, moeglicheEingriffe, type Traktandumslage, type Eingriffsart } from '$lib/domain/eingriffe';
	import { rueckkommensvorbehalt } from '$lib/domain/rueckkommen';
	import { ausstandMitAngehoerigenergebnis, ausstandUndBetroffenHinweis } from '$lib/domain/auszaehlung';
	import type { Ergebnistyp } from '$lib/domain/regelwerk';

	interface Eigenschaften {
		traktandumId: string;
		/** Woraus der Kern rechnet, welche Eingriffe möglich sind. */
		lage: Traktandumslage;
		parteien: { id: string; name: string }[];
		/**
		 * Vertreter, die nicht Eigentümer sind, zur Wahl beim Ausstand (Ä-26,
		 * Migration 167). Nur dort: Als Antragsteller kommen sie nicht in Frage.
		 */
		vertreterOhnePartei?: { id: string; name: string; zusatz?: string }[];
		ausstand: { parteiId: string }[];
		/** Der Titel des geltenden Mehrheitserfordernisses. */
		erfordernisTitel: string;
		/** Wohin der Verweis «Nötige Mehrheit ändern» führt. */
		erfordernisPfad: string;
		grundantraege: {
			id: string;
			nummer: string;
			titel: string;
			erfordernisTyp: Ergebnistyp | null;
			/** Das Mehr der Einladung in Worten, `null` ohne Untergrenze. */
			einladungsmehr: { worte: string; zuMild: string[]; geerbtZuMild: boolean } | null;
			/** Wer beim Grundantrag als betroffen eingetragen ist (Block A3b). */
			betroffene: string[];
		}[];
		erfordernisse: { knotenId: string; astTitel: string; titel: string; typ: Ergebnistyp }[];
		/** Ob der gefasste Beschluss angenommen wurde — für den Rückkommensvorbehalt. */
		angenommen: boolean;
		/** Am Abend: das Haus, in dem der Eingriff wirkt. Null in der Leitung eines Hauses. */
		mitVersammlungId?: string | null;
		/**
		 * Ob die Versammlung an einem gemeinsamen Abend tagt, auch in der Leitung
		 * des Hauses. Fehlt die Angabe, gilt die Abendseite (`mitVersammlungId`).
		 * Für den Satz zur Rückweisung im Aufnahmeformular (Laienprüfung R3,
		 * 06.10.2026): Am Abend stimmt nur die Gemeinschaft ab, deren Traktandum
		 * es ist.
		 */
		amAbend?: boolean;
		/**
		 * Warum sich der Antrag gerade nicht zurückziehen lässt, oder `null`.
		 *
		 * Der Satz kommt aus `hindernisFuerRueckzug`; die Zusicherung selbst
		 * prüft der Kern (`verlangeZurueckziehbar`) unabhängig von dieser Seite.
		 */
		rueckzugHindernis?: string | null;
		/**
		 * Wer bei diesem Traktandum als unmittelbar betroffen eingetragen ist,
		 * samt Vorab-Vermerk (`holeBetroffene`, Block A2).
		 */
		betroffene?: {
			parteiId: string;
			name: string;
			vorab: { vermerk: string } | null;
			/** Ob die Wohnung mehreren gehört. */
			gemeinsam?: boolean;
			/** Ausschlussklage: alle Eigentümer der Wohnung beklagt (Migration 132). */
			alleEigentuemerBeklagt?: boolean;
		}[];
		/**
		 * Ob bei einer gemeinsamen Wohnung festzuhalten ist, ob nur eine Person
		 * oder alle Eigentümer beklagt sind (`beklagtenwohnungZaehltMit`,
		 * Produktentscheid 30.09.2026). Der Server prüft dasselbe.
		 */
		beklagtenumfangWirkt?: boolean;
		/**
		 * Wie die Zustimmung erteilt wird. Nur bei `im_saal_oder_vorab` lässt
		 * sich eine Vorab-Zustimmung vermerken; der Server prüft dasselbe.
		 */
		betroffenenform?: 'im_saal_oder_vorab' | 'nachher' | null;
		/**
		 * Ob das Erfordernis Betroffene überhaupt kennt: Zustimmung nötig oder
		 * ihre Stimmen zählen nicht mit (`betroffenenlage.kennt`).
		 *
		 * Beim von Hand gesetzten Mehr ist es falsch (Auftrag 03.10.2026):
		 * Dann trägt eine Eintragung keine Wirkung, und das Feld zeigt statt
		 * der Eingabe den Weg über «Nötige Mehrheit ändern». Ohne Angabe gilt
		 * das alte Verhalten (Eintrag möglich).
		 */
		kenntBetroffene?: boolean;
		/**
		 * Der Hinweis, wenn dieser Folgeantrag andere Eigentümer trifft als sein
		 * Grundantrag (`betroffenenabweichung`, Block A3b), oder `null`.
		 */
		betroffenenabweichung?: string | null;
		/**
		 * Wer bei der Ausschlussklage ausser dem Beklagten nicht mitstimmt
		 * (`angehoerigenhinweis`, 27.09.2026), oder `null`.
		 */
		angehoerigenhinweis?: string | null;
		/**
		 * Der Satz zu L10 vor der Abstimmung (`angehoerigenlesartHinweis`,
		 * E1 Block D), oder `null`. Er erscheint nur, wenn an diesem Traktandum
		 * eine nicht betroffene Partei im Ausstand ist (`ausstandMitZweitemErgebnis`):
		 * Sonst nennt die Auszählung kein zweites Ergebnis, und der Satz
		 * verspräche eines.
		 */
		angehoerigenlesartHinweis?: string | null;
		/**
		 * Die stehende Warnung, wenn das Mehr dieses Traktandums nach der Freigabe
		 * milder gestellt wurde (`saalhinweisNachMilderung`, Produktentscheid
		 * 07.10.2026), oder `null`.
		 */
		milderungshinweis?: string | null;
		/**
		 * Beim Grundantrag: Folgeanträge mit eigenem Beschluss, die mit dem neuen
		 * Beschluss zum Grundantrag nicht wegfallen (`folgeantragBleibtHinweis`, Fachprüfung
		 * 08.10.2026, Frage 2), oder `null`.
		 */
		folgeantragHinweis?: string | null;
		/**
		 * Wer beim Grundantrag im Ausstand ist (Befund C-02, 22.08.2026). Für die
		 * Erinnerung beim Folgeantrag; leer, wo es keinen Grundantrag gibt.
		 */
		ausstandAmGrundantrag?: { id: string; name: string }[];
		/**
		 * Der Veto-Stand der Betroffenen im Ausstand während des offenen
		 * Durchgangs (Auftrag «Veto im Ausstand», 26.09.2026). Leer heisst:
		 * kein offener Durchgang, keine Betroffenen im Ausstand oder die Form
		 * kennt kein Veto.
		 */
		vetoStand?: {
			parteiId: string;
			name: string;
			entscheid: 'ja' | 'nein' | null;
			weg: 'telefon' | 'leitung' | null;
			/** Wahr, wenn die Vertretung am eigenen Gerät entschieden hat. */
			durchVertretung?: boolean;
			/** Die Angabe der vorab schriftlichen Zustimmung, oder null. */
			vorab?: string | null;
		}[];
	}

	let {
		traktandumId,
		lage,
		parteien,
		vertreterOhnePartei = [],
		ausstand,
		erfordernisTitel,
		erfordernisPfad,
		grundantraege,
		erfordernisse,
		angenommen,
		mitVersammlungId = null,
		amAbend = undefined,
		rueckzugHindernis = null,
		betroffene = [],
		beklagtenumfangWirkt = false,
		betroffenenform = null,
		kenntBetroffene = true,
		betroffenenabweichung = null,
		angehoerigenhinweis = null,
		angehoerigenlesartHinweis = null,
		milderungshinweis = null,
		folgeantragHinweis = null,
		ausstandAmGrundantrag = [],
		vetoStand = []
	}: Eigenschaften = $props();

	/** Wer noch als betroffen eingetragen werden kann. */
	const nichtBetroffen = $derived(
		parteien.filter((p) => !betroffene.some((b) => b.parteiId === p.id))
	);

	/**
	 * Die Auswahl im Formular «Eintragen», aus demselben Grund wie
	 * `ausstandswahl` (siehe dort): Ohne diesen Griff bliebe eine eben
	 * eingetragene Partei angekreuzt, und der nächste Eintrag scheiterte am
	 * Server mit «bereits eingetragen».
	 */
	let betroffenenwahl = $state<string[]>([]);
	function raeumeBetroffenenwahl(): void {
		betroffenenwahl = betroffenenwahl.filter((id) => nichtBetroffen.some((p) => p.id === id));
	}

	/**
	 * Welche Parteien im Ausstandsformular angekreuzt sind.
	 *
	 * **Warum das hier stehen muss.** `Wahlliste` führt die Auswahl in eigenem
	 * `$state`, und `form.reset()` räumt nur das DOM. Ohne diesen Griff bliebe
	 * die eben in den Ausstand gesetzte Partei angekreuzt: Sie fällt danach aus
	 * der Auswahlliste heraus, `Wahlliste` schreibt sie als verborgenes Feld
	 * weiter mit, und die **nächste** Ausstandserklärung am selben Traktandum
	 * scheiterte am Server mit «bereits ein Ausstand erklärt» — dauerhaft, denn
	 * bei einer Absage läuft `reset` gar nicht erst (28.08.2026 im Review
	 * gefunden, im Drehbuch nachgestellt).
	 */
	let ausstandswahl = $state<string[]>([]);

	/** Wer noch in den Ausstand treten kann — wer schon drin ist, nicht mehr. */
	const waehlbar = $derived(
		[...parteien, ...vertreterOhnePartei].filter((p) => !ausstand.some((a) => a.parteiId === p.id))
	);

	/**
	 * Die Auswahl auf das zusammenstreichen, was noch wählbar ist.
	 *
	 * **Nach jeder Antwort, nicht nur nach einer erfolgreichen.** Der Server
	 * erklärt den Ausstand Partei für Partei; scheitert die dritte von fünf,
	 * sind die ersten zwei erfasst und die Antwort ist trotzdem eine Absage.
	 * Ein Griff, der nur bei Erfolg räumt, liesse die beiden angekreuzt — und
	 * jeder weitere Versuch scheiterte an ihnen statt an der eigentlichen
	 * Ursache.
	 */
	function raeumeAuswahl(): void {
		ausstandswahl = ausstandswahl.filter((id) => waehlbar.some((p) => p.id === id));
	}

	/**
	 * Wer betroffen und zugleich im Ausstand ist, für den Hinweis vor der
	 * Abstimmung (seit 26.09.2026). Der Hinweis der Auszählung kommt erst unter
	 * dem Ergebnis, zu spät, um den Ausstand zu klären.
	 */
	const betroffenImAusstand = $derived(
		betroffene.filter((b) => ausstand.some((a) => a.parteiId === b.parteiId))
	);
	/**
	 * Die Parteien im Ausstand, ohne betroffen zu sein: Nur für sie nennt die
	 * Zählung ein Ergebnis nach der anderen Wahl zu L10 (`ausstandInDerZahlBei`
	 * ohne die Betroffenen; Codeprüfung E1 Block D, N1). Steht nur der Beklagte im
	 * Ausstand, verspräche W11 sonst ein Ergebnis, das nicht kommt; ebenso nur
	 * ein Vertreter ohne Partei (Review DeepSeek zu E1, Befund 1). Dieselbe
	 * Menge wie die Zählung, aus `ausstandMitAngehoerigenergebnis`; der Wächter
	 * `tests/waechter/angehoerigenhinweis.test.ts` hält das fest.
	 */
	const ausstandMitZweitemErgebnis = $derived(
		ausstandMitAngehoerigenergebnis(
			ausstand.map((a) => a.parteiId),
			betroffene.map((b) => b.parteiId)
		)
	);

	const eingriffe = $derived(moeglicheEingriffe(lage));
	let offenerEingriff = $state<Eingriffsart | null>(null);
</script>

{#snippet mitVersammlung()}
	{#if mitVersammlungId}
		<input type="hidden" name="versammlung" value={mitVersammlungId} />
	{/if}
{/snippet}

<div class="eingriffe">
	<p class="einleitung">{eingriffssatz(lage, eingriffe.length)}</p>
	<!--
		**Das Mehr wurde nach der Freigabe milder gestellt** (Produktentscheid
		07.10.2026, «Nur noch aufmerksam machen», Punkt 4a). Die Anwendung nimmt
		das mildere Mehr und macht hier nur aufmerksam, in Haus und Abend. Stehend
		bis zum Abschluss des Traktandums, nicht während eines offenen Durchgangs:
		Dann lässt sich das Mehr nicht mehr ändern, und der letzte Satz der Warnung
		stimmte nicht.
	-->
	{#if milderungshinweis && !lage.durchgangOffen && !lage.abgestimmt && !lage.zurueckgezogen}
		<p class="meldung warnung">{milderungshinweis}</p>
	{/if}
	<!--
		**Vor dem Eröffnen, in Haus und Abend** (Block A3b). Eine Rüge gehört vor
		die Abstimmung; danach wäre der Hinweis nur noch eine Feststellung. Hier
		und nicht auf der Seite, weil beide Leitungsseiten diesen Baustein nehmen.
	-->
	{#if betroffenenabweichung && !lage.durchgangOffen && !lage.abgestimmt && !lage.zurueckgezogen}
		<p class="meldung warnung">{betroffenenabweichung}</p>
	{/if}
	<!--
		**Ehegatte und Verwandte des Beklagten** (27.09.2026), vor der Abstimmung
		und in Haus und Abend, aus demselben Grund wie die Hinweise daneben: Nach
		dem Eröffnen lässt sich kein Ausstand mehr erklären.
	-->
	{#if angehoerigenhinweis && !lage.durchgangOffen && !lage.abgestimmt && !lage.zurueckgezogen}
		<p class="meldung warnung">{angehoerigenhinweis}</p>
	{/if}
	<!--
		**Die Zahl der Angehörigen im Ausstand** (E1, Block D; L10). Nur wo die
		Zählung ein zweites Ergebnis nennt (`ausstandMitZweitemErgebnis`): Ohne
		Ausstand einer nicht betroffenen Partei gibt es keines, und der Satz
		verspräche eines. Dieselbe Stelle wie der Hinweis darüber, aus demselben
		Grund: Nach dem Eröffnen lässt sich kein Ausstand mehr erklären.
	-->
	{#if angehoerigenlesartHinweis && ausstandMitZweitemErgebnis.length > 0 && !lage.durchgangOffen && !lage.abgestimmt && !lage.zurueckgezogen}
		<p class="meldung warnung">{angehoerigenlesartHinweis}</p>
	{/if}
	<!--
		**Betroffen und im Ausstand**, vor der Abstimmung. Nur, wo die Lage
		eintritt (Code-Review 26.09.2026, M1 und N2): bei Zustimmung im Saal oder
		vorab, nicht bei den Wertquoten und nicht bei der Ausschlussklage. Bis zum
		26.09.2026 stand der Hinweis auf der Leitungsseite des Hauses und fehlte
		deshalb am Abend.
	-->
	{#if betroffenImAusstand.length > 0 && betroffenenform === 'im_saal_oder_vorab' && !lage.durchgangOffen && !lage.abgestimmt}
		<p class="meldung warnung">
			{ausstandUndBetroffenHinweis(betroffenImAusstand.map((b) => b.name))}
		</p>
	{/if}
	<!--
		**Der Ausstand am Grundantrag gilt hier nicht von selbst** (22.08.2026,
		Befund C-02). Im Prüflauf trat eine Partei bei Traktandum 7 in den
		Ausstand; beim Folgeantrag 7.1 zur selben Fassadensanierung stand sie
		wieder mit voller Stimmkraft da. Ein Ausstand wird Fall für Fall erklärt,
		aber wer bei der Sache befangen ist, ist es beim Folgeantrag dazu genauso.
		**Erinnern statt entscheiden:** Über Befangenheit entscheidet die
		Versammlung. Seit dem 26.09.2026 hier statt auf der Seite des Hauses,
		damit der Abend ihn auch zeigt.
	-->
	{#if ausstandAmGrundantrag.length > 0 && ausstand.length === 0}
		<p class="meldung warnung erinnerung">
			Beim Grundantrag ist
			{#each ausstandAmGrundantrag as a, i (a.id)}{i > 0 ? ', ' : ''}<strong>{a.name}</strong
				>{/each}
			in den Ausstand getreten. Für diesen Folgeantrag gilt das
			<strong>nicht von selbst</strong> — erklären Sie ihn hier erneut, wenn er
			auch hier gilt.
		</p>
	{/if}
	{#if eingriffe.length > 0}
		<ul class="woerter">
			{#each eingriffe as e (e.art)}
				<li>
					<button
						type="button"
						class="wort"
						class:offen={offenerEingriff === e.art}
						aria-expanded={offenerEingriff === e.art}
						onclick={() =>
							(offenerEingriff = offenerEingriff === e.art ? null : e.art)}
					>
						{e.wort}
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#each eingriffe.filter((e) => e.art === offenerEingriff) as e (e.art)}
		<div class="feld">
			<h4>
				{e.titel}
				{#if e.fachwort}<span class="fachwort">({e.fachwort})</span>{/if}
			</h4>
			{#if e.art === 'betroffene' && !kenntBetroffene}
				<!--
					**Der Weg statt der Eingabe** (Auftrag 03.10.2026): Beim von Hand
					gesetzten Mehr kennt das Erfordernis keine Betroffenen. Eine
					Eintragung hätte keine Wirkung und der Server lehnt sie ab; hier
					steht deshalb, wie der Fall zu setzen ist, wonach die Eingabe
					erscheint. Der Satz aus dem Katalog («Tragen Sie sie hier ein»)
					bleibt weg, weil er hier nicht stimmt.
				-->
				<p class="hilfe">
					Dieses Erfordernis kennt keine Betroffenen. Es verlangt keine Zustimmung, und
					es zählt niemanden wegen Befangenheit aus.
				</p>
				<p class="hilfe">
					Stellt sich in der Diskussion heraus, dass jemand unmittelbar betroffen ist, setzen
					Sie zuerst die nötige Mehrheit auf den passenden Fall. Etwa die Zuteilung eines
					Nutzungsrechts; danach lässt sich die Person hier eintragen, und ihre Zustimmung
					zählt.
				</p>
				<a class="knopfartig" href={erfordernisPfad}>Nötige Mehrheit ändern</a>
			{:else}
				<p class="hilfe">{e.satz}</p>
			{/if}

			{#if e.art === 'ausstand'}
				<form
					method="POST"
					action="?/ausstand"
					class="ausstandsform"
					use:enhance={absenden({ danach: raeumeAuswahl })}
				>
					<input type="hidden" name="traktandum" value={traktandumId} />
					{@render mitVersammlung()}
					<!--
						**Suchen statt scrollen, und mehrere auf einmal**
						(21.08.2026). Ein Auswahlfeld mit achtzig Namen findet
						im Saal niemand — und wenn eine Firma drei Eigentümern
						gehört, treten sie gemeinsam in den Ausstand. Ein Grund
						gilt dann für alle: Er ist derselbe, und ihn dreimal zu
						tippen wäre keine bessere Auskunft.
					-->
					<Wahlliste
						bind:gewaehlt={ausstandswahl}
						name="partei"
						eintraege={waehlbar}
						suchbeschriftung="Partei suchen"
						leerhinweis="Mehrere möglich — der Grund gilt für alle."
					/>
					<label>
						Warum
						<input
							name="grund"
							required
							minlength="3"
							placeholder="Der Auftrag geht an seine eigene Firma"
						/>
						<span class="hilfe">
							Pflicht. Der Grund verändert die Zahl, gegen die gemessen wird — ohne
							ihn liesse sich später nicht sagen, ob das gewollt war.
						</span>
					</label>
					<button type="submit" class="leise" data-fokus="eingriff:{traktandumId}">
						Ausstand erklären
					</button>
				</form>
			{:else if e.art === 'betroffene'}
				<!--
					**Stand und Eingriff in einem Feld** (Block A2, 25.09.2026). Anders als
					beim Ausstand ist die Liste hier nicht nur Anzeige: Jede Zeile trägt
					ihre eigenen Handlungen, und das Eintragen steht darunter.

					**Die Liste bleibt immer, die Eingabe folgt dem Erfordernis**
					(Auftrag 03.10.2026; Codeprüfung 04.10.2026, M2): Kennt das
					Erfordernis keine Betroffenen, tritt an die Stelle der Eingabe der
					Weg über die nötige Mehrheit. Die eingetragenen Zeilen samt
					«Austragen» bleiben aber stehen, auch wenn das Erfordernis
					gewechselt hat; sonst läge eine Angabe unsichtbar in der Tabelle und
					wirkte wieder, sobald das Erfordernis zurückkehrt (Codeprüfung
					30.09.2026, N-d).
				-->
				{#if betroffene.length > 0}
					<ul class="betroffenenliste">
						{#each betroffene as b (b.parteiId)}
							<li>
								<span><strong>{b.name}</strong>{#if b.vorab}, vorab zugestimmt: {b.vorab.vermerk}{/if}{#if (beklagtenumfangWirkt && b.gemeinsam) || b.alleEigentuemerBeklagt}, {b.alleEigentuemerBeklagt ? 'alle Eigentümer der Wohnung beklagt' : 'nur eine Person beklagt'}{/if}</span>
								<!--
									Der Rückweg auch dort, wo die Angabe nicht mehr wirkt, etwa nach einem
									geänderten Erfordernis (Codeprüfung 30.09.2026, N-d); sonst läge sie
									unsichtbar in der Tabelle und wirkte wieder, sobald das Erfordernis
									zurückkehrt.
								-->
								{#if (beklagtenumfangWirkt && b.gemeinsam) || b.alleEigentuemerBeklagt}
									<!--
										**Nur eine Person oder alle Eigentümer beklagt** (Produktentscheid
										30.09.2026, Fachprüfung F3-1). Vorgabe «nur eine Person»: Die Wohnung
										zählt mit und stimmt nicht ab. Sind alle beklagt, etwa eine
										Erbengemeinschaft, fällt sie aus der Zahl (Rz. 216 ad Art. 712a).
									-->
									<form method="POST" action="?/beklagtenumfang" use:enhance={absenden()}>
										<input type="hidden" name="traktandum" value={traktandumId} />
										<input type="hidden" name="partei" value={b.parteiId} />
										<input type="hidden" name="alle" value={b.alleEigentuemerBeklagt ? 'nein' : 'ja'} />
										{@render mitVersammlung()}
										<button type="submit" class="leise" data-fokus="eingriff:{traktandumId}">
											{b.alleEigentuemerBeklagt
												? 'Ändern in: nur eine Person beklagt'
												: 'Ändern in: alle Eigentümer der Wohnung beklagt'}
										</button>
									</form>
									{#if beklagtenumfangWirkt}
										<p class="hilfe">
											Massgebend ist, gegen wen sich der Antrag richtet, wie ihn die Einladung angekündigt
											hat: nur gegen den Beklagten oder gegen alle Eigentümer der Wohnung. Beschränkt die
											Versammlung ihn auf den Beklagten, halten Sie das fest, bevor Sie die Abstimmung
											eröffnen. Gegen wen sich die Klage richten muss, hängt von der Eigentumsform ab und
											ist bei einer Familienwohnung umstritten (SVIT-Kommentar Rz. 216 ad Art. 712a); das
											gehört vor der Einladung geklärt.
										</p>
									{/if}
								{/if}
								{#if b.vorab}
									<form method="POST" action="?/vorabZurueck" use:enhance={absenden()}>
										<input type="hidden" name="traktandum" value={traktandumId} />
										<input type="hidden" name="partei" value={b.parteiId} />
										{@render mitVersammlung()}
										<button type="submit" class="leise" data-fokus="eingriff:{traktandumId}">
											Vermerk zurücknehmen
										</button>
									</form>
								{:else if betroffenenform === 'im_saal_oder_vorab'}
									<form
										method="POST"
										action="?/vorabVermerken"
										class="ausstandsform vorab"
										use:enhance={absenden()}
									>
										<input type="hidden" name="traktandum" value={traktandumId} />
										<input type="hidden" name="partei" value={b.parteiId} />
										{@render mitVersammlung()}
										<label>
											Vorab schriftlich zugestimmt
											<input
												name="vermerk"
												required
												minlength="3"
												autocomplete="off"
												placeholder="Schreiben vom 12.09.2026"
											/>
										</label>
										<button type="submit" class="leise" data-fokus="eingriff:{traktandumId}">
											Vorab-Zustimmung vermerken
										</button>
									</form>
								{/if}
								<form method="POST" action="?/betroffeneAus" use:enhance={absenden()}>
									<input type="hidden" name="traktandum" value={traktandumId} />
									<input type="hidden" name="partei" value={b.parteiId} />
									{@render mitVersammlung()}
									<button type="submit" class="leise" data-fokus="eingriff:{traktandumId}">
										Austragen
									</button>
								</form>
							</li>
						{/each}
					</ul>
				{:else if kenntBetroffene}
					<p class="hilfe">Eingetragen ist niemand.</p>
				{/if}
				{#if kenntBetroffene}
				<form
					method="POST"
					action="?/betroffeneEin"
					class="ausstandsform"
					use:enhance={absenden({ danach: raeumeBetroffenenwahl })}
				>
					<input type="hidden" name="traktandum" value={traktandumId} />
					{@render mitVersammlung()}
					<Wahlliste
						bind:gewaehlt={betroffenenwahl}
						name="partei"
						eintraege={nichtBetroffen}
						suchbeschriftung="Partei suchen"
						leerhinweis="Mehrere möglich."
					/>
					<button type="submit" class="leise" data-fokus="eingriff:{traktandumId}">
						Als betroffen eintragen
					</button>
				</form>
				{/if}
			{:else if e.art === 'veto'}
				<!--
					**Der mündliche Veto-Entscheid** (Auftrag «Veto im Ausstand»,
					26.09.2026). Den Entscheid am Telefon trifft die Betroffene
					selbst; hier steht er für die, die ihn der Sitzungsleitung sagt.
					Der Weg wird als «mündlich, von der Sitzungsleitung erfasst» genannt.
				-->
				<ul class="betroffenenliste">
					{#each vetoStand as v (v.parteiId)}
						<li>
							<span>
								<strong>{v.name}</strong>
								{#if v.entscheid}
									— {v.entscheid === 'ja' ? 'Zustimmung' : 'keine Zustimmung'}
									({v.weg === 'leitung'
										? 'mündlich, von der Sitzungsleitung erfasst'
										: v.durchVertretung
											? 'durch ihre Vertretung'
											: 'am eigenen Gerät'})
								{:else}
									— noch kein Entscheid in der Abstimmung
								{/if}
								{#if v.vorab}
									· vorab schriftlich zugestimmt: {v.vorab}
								{/if}
							</span>
							<form method="POST" action="?/veto" use:enhance={absenden()}>
								<input type="hidden" name="traktandum" value={traktandumId} />
								<input type="hidden" name="partei" value={v.parteiId} />
								{@render mitVersammlung()}
								<button type="submit" name="entscheid" value="ja" class="leise" data-vorgabe="Zustimmen" data-fokus="eingriff:{traktandumId}">
									Zustimmen
								</button>
								<button type="submit" name="entscheid" value="nein" class="leise" data-fokus="eingriff:{traktandumId}">
									Nicht zustimmen
								</button>
							</form>
						</li>
					{/each}
				</ul>
			{:else if e.art === 'gegenantrag'}
				<!--
					Dasselbe Formular wie unter der Liste, nur mit festem
					Grundantrag: Hier steht er fest — es ist das aufgerufene
					Traktandum.
				-->
				<TraktandumAufnehmen
					grundantraege={grundantraege.map((t) => ({
						id: t.id,
						nummer: t.nummer,
						titel: t.titel,
						erfordernisTyp: t.erfordernisTyp,
						einladungsmehr: t.einladungsmehr,
						betroffene: t.betroffene
					}))}
					erfordernisse={erfordernisse}
					parteien={parteien}
					festerGrundantrag={traktandumId}
						versammlungId={mitVersammlungId}
					amAbend={amAbend ?? Boolean(mitVersammlungId)}
				/>
			{:else if e.art === 'zurueckziehen' && rueckzugHindernis}
				<!--
					**Der Grund statt des Formulars** (Code-Review 08.09.2026). Dies ist
					der HÄUFIGERE der beiden Rückzugswege: Der Gegenantrag im Saal hängt
					den Folgeantrag immer an das aufgerufene Traktandum, und genau dann
					steht der Rückzug hier. Ohne diesen Zweig liesse sich das Formular
					ausfüllen und der Server sagte danach ab.
				-->
				<p class="hilfe">{rueckzugHindernis}</p>
			{:else if e.art === 'zurueckziehen'}
				<form method="POST" action="?/zurueckziehen" class="ausstandsform" use:enhance={absenden()}>
					<input type="hidden" name="traktandum" value={traktandumId} />
					{@render mitVersammlung()}
					<label>
						Grund
						<input
							name="grund"
							required
							minlength="3"
							placeholder="z. B. Offerte liegt noch nicht vor"
						/>
					</label>
					<button type="submit" class="leise" data-fokus="eingriff:{traktandumId}">
						Zurückziehen
					</button>
				</form>
			{:else if e.art === 'mehrheit'}
				<p class="hilfe">
					Zurzeit gilt: <strong>{erfordernisTitel}</strong>
				</p>
				<a
					class="knopfartig"
					href={erfordernisPfad}
				>
					Nötige Mehrheit ändern
				</a>
			{:else if e.art === 'rueckkommen'}
				<p class="hilfe vorbehalt">
					{rueckkommensvorbehalt(angenommen)}
				</p>
				{#if folgeantragHinweis}
					<p class="hilfe vorbehalt">{folgeantragHinweis}</p>
				{/if}
				<form method="POST" action="?/rueckkommen" use:enhance={absenden()}>
					<input type="hidden" name="traktandum" value={traktandumId} />
					{@render mitVersammlung()}
					<button type="submit" class="leise" data-fokus="eingriff:{traktandumId}">
						Rückkommensantrag stellen
					</button>
				</form>
			{/if}
		</div>
	{/each}
</div>

<style>
	/*
	 * **Hinweise vor dem Eröffnen** (26.09.2026). Derselbe Kasten wie auf der
	 * Leitungsseite des Hauses, von dort übernommen: Dort ist `.meldung.warnung`
	 * gestaltet, im Baustein und am Abend nicht, und die Hinweise standen am
	 * Abend als Fliesstext da. So sehen sie in Haus und Abend gleich aus.
	 */
	.meldung.warnung {
		padding: 0.7rem 0.95rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		margin: 0.75rem 0;
		max-width: 62ch;
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
	}

	/*
	 * **Ein Satz, keine Knopfleiste.** «Jetzt möglich:» und die Wörter stehen in
	 * derselben Zeile und fliessen wie Fliesstext um; getrennt sind sie durch
	 * einen Mittelpunkt, nicht durch vier Kästen. Das aufgeklappte Feld nimmt
	 * dann die ganze Breite — es ist die Arbeitsfläche, nicht mehr das Angebot.
	 */
	.eingriffe {
		margin-top: 0.6rem;
		font-size: 0.9rem;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.1rem 0.5rem;
	}

	/*
		Nur der Abstand — die Farbe kommt seit dem 02.09.2026 aus `app.css`. Hier
		stand sie zeichengleich noch einmal: ein zweiter Schreiber, der beim
		nächsten Wechsel der Hausfarbe zurückbliebe.
	*/
	.eingriffe .einleitung {
		margin: 0;
	}

	.eingriffe .woerter {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.1rem 0.55rem;
		margin: 0;
		padding: 0;
	}

	/* Der Mittelpunkt gehört zur Trennung, nicht zum Wort: Er bleibt leise und
	   ist für den Bildschirmleser unsichtbar. */
	.eingriffe .woerter li + li::before {
		content: '·';
		margin-right: 0.55rem;
		color: var(--text-leise);
	}

	/*
	 * **Das Polster ist die Trefferfläche.** Ein `min-height` würde die Zeile
	 * sprengen, weil es die Grundlinie verschiebt; senkrechtes Polster hebt die
	 * Fläche auf Fingergrösse und lässt die Wörter trotzdem auf einer Linie
	 * stehen. Im Saal wird auf einem Telefon gedrückt, und daneben zu treffen
	 * kostet dort mehr als am Schreibtisch.
	 */
	.eingriffe .wort {
		background: none;
		border: 0;
		padding: 0.65rem 0;
		color: var(--akzent);
		font: inherit;
		text-decoration: underline;
		text-underline-offset: 3px;
		text-decoration-thickness: 1px;
		cursor: pointer;
	}

	/*
	 * Das offene Wort ist die Überschrift des Feldes darunter — es trägt deshalb
	 * dessen Gewicht und keinen Strich mehr.
	 */
	.eingriffe .wort.offen {
		font-weight: 650;
		text-decoration: none;
	}

	/*
	 * **Das Feld steht unter der ganzen Zeile — und bleibt in der Spalte.**
	 *
	 * `flex-basis: 100%` allein genügt nicht: Ein Flex-Kind schrumpft von sich
	 * aus nicht unter die Breite seines Inhalts (`min-width: auto`). Das Feld
	 * trägt ein Formular mit Auswahl- und Textfeldern und war damit 800 px
	 * breit, während die Ablaufspalte 480 misst — es ragte 339 px darüber
	 * hinaus und verschwand unter der rechten Spalte. Gemeldet am 21.08.2026
	 * («Gegenantrag sieht man nicht vollständig»), verursacht einen Tag zuvor
	 * beim Umbau dieser Zeile auf Flex. Mit `display: block` gemessen: 417 px,
	 * kein Überstand.
	 */
	.eingriffe > * {
		min-width: 0;
	}

	.eingriffe .feld {
		flex-basis: 100%;
	}

	/* Und die Felder darin füllen die Breite, statt ihre eigene zu fordern. */
	.eingriffe .feld :global(input) {
		max-width: 100%;
		box-sizing: border-box;
	}

	.eingriffe .feld h4 {
		margin: 0 0 0.2rem;
		font-size: 0.95rem;
	}

	.eingriffe .feld .fachwort {
		color: var(--text-leise);
		font-weight: 400;
	}

	.vorbehalt {
		border-left: 2px solid var(--warnung);
		padding-left: 0.6rem;
	}

	.betroffenenliste {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
	}

	/*
	 * **Name links, die Handlungen rechts** (Praxisfund 03.10.2026): Bis dahin
	 * stand alles untereinander, und die Autovervollständigung des Browsers
	 * deckte die Knöpfe zu. Die Zeile ist jetzt eine Reihe mit Umbruch; auf
	 * schmalen Geräten fällt sie von selbst wieder untereinander.
	 */
	.betroffenenliste li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.35rem 0.75rem;
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--linie);
	}

	.betroffenenliste li > span {
		flex: 1 1 20ch;
	}

	/*
	 * **Name, Feld und Knöpfe fluchten in einer Zeile** (Rückfrage 03.10.2026):
	 * Die Formulare treten mit `display: contents` aus dem Layout, ihre Felder
	 * und Knöpfe werden direkt zu Elementen der Zeile. So stehen Beschriftung,
	 * Feld und beide Knöpfe nebeneinander und brechen gemeinsam um, statt
	 * dreifach übereinander. Die Formulare bleiben im Dokument und schicken
	 * weiter ab.
	 */
	.betroffenenliste li > form {
		display: contents;
	}

	/*
	 * **Das Vorab-Feld steht auf einer Linie** (Rückfrage 03.10.2026): Die
	 * Beschriftung steht neben dem Feld, nicht darüber. Der Selektor geht
	 * durch das Formular, weil `display: contents` nur die Box entfernt und
	 * die Baumstruktur bleibt.
	 */
	.betroffenenliste li form.vorab > label {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.45rem;
		font-weight: 550;
		white-space: nowrap;
	}

	.betroffenenliste li form.vorab > label input {
		font-weight: 400;
		width: 14rem;
	}

	/*
	 * **Die leisen Knöpfe des Bausteins.** Svelte kapselt Stile je Datei: Die
	 * Regel `button.leise` der Leitungsseiten erreicht diese Komponente nicht,
	 * und «Austragen» und «Vermerk zurücknehmen» standen im Saal als
	 * Browserknöpfe (Praxisfund 03.10.2026).
	 */
	button.leise {
		background: transparent;
		font-size: 0.85rem;
		min-height: 2rem;
		padding: 0 0.6rem;
		color: var(--text-leise);
	}

	.ausstandsform {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	/*
	 * **Nur die eigenen Beschriftungen, nicht die der Liste darin** — dieselbe
	 * Falle wie bei `.dreischritt li`: Ohne das `>` bekamen auch die Zeilen der
	 * Wahlliste `flex-direction: column`, und das Häkchen stand über dem Namen
	 * statt daneben.
	 */
	.ausstandsform > label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-weight: 550;
	}

	.eingriffe .wort:hover,
	.eingriffe .wort:focus-visible {
		text-decoration-thickness: 2px;
	}
</style>
