<script lang="ts">
	import { datumLang, tagVon } from '$lib/domain/datum';
	import { anfangswert } from '$lib/felder';
	import {
		VERKNUEPFUNGSFENSTER_TAGE,
		verknuepfungsstand,
		type Verknuepfungsstand
	} from '$lib/domain/kontoverknuepfung';
	import Meldung from '$lib/components/Meldung.svelte';
	import Suchauswahl from '$lib/components/Suchauswahl.svelte';

	let { data, form } = $props();

	/**
	 * Der Stand der Authentik-Verknüpfung eines Kontos.
	 *
	 * **Die Uhrzeit wird bei jedem Aufruf frisch genommen und nicht einmal
	 * gemerkt.** Ein Fenster kann während der geöffneten Seite ablaufen, und
	 * eine Liste, die dann weiter «offen bis» behauptet, schickt die Verwaltung
	 * mit einer falschen Auskunft ans Telefon.
	 */
	function standVon(k: {
		ueberAuthentik: boolean;
		email: string | null;
		verknuepfungOffenBis: string | null;
	}): Verknuepfungsstand {
		return verknuepfungsstand(
			{
				hatKennung: k.ueberAuthentik,
				email: k.email,
				offenBis: k.verknuepfungOffenBis ? new Date(k.verknuepfungOffenBis) : null
			},
			new Date()
		);
	}

	const fehler = $derived(form && 'fehler' in form ? form.fehler : null);
	const hinweis = $derived(form && 'hinweis' in form ? form.hinweis : null);

	/** Welches Konto gerade bearbeitet wird — höchstens eines. */
	let offen = $state<string | null>(null);

	const inDienst = $derived(data.konten.filter((k) => !k.ausserDienstSeit));
	const ausserDienst = $derived(data.konten.filter((k) => k.ausserDienstSeit));
</script>

<svelte:head><title>Konten</title></svelte:head>

	<h1>Konten</h1>

	{#if hinweis}
		<Meldung ton="gut" marke={form}>{hinweis}</Meldung>
	{:else if fehler}
		<Meldung ton="fehler" marke={form}>{fehler.nachricht}</Meldung>
	{/if}

	<!-- `einleitung` statt `hilfe` (UI-Durchgang 06.10.2026): `.hilfe` nimmt hier
	     jede Marge weg, und «In Dienst» stand 0 px unter dem Absatz, «Ausser
	     Dienst» dagegen 24 px unter der Liste. -->
	<p class="einleitung">
		Wer sich anmelden darf, entscheidet die Bewirtschaftung — es gibt keine Selbstregistrierung.
		Konten werden <strong>nicht gelöscht</strong>, sondern ausser Dienst gestellt: Der Name steht
		in Verläufen, Protokollen und Siegeln, und ein gelöschtes Konto machte aus «freigegeben durch
		Anna Meier» eine Zeile ohne Person.
	</p>

	<!-- ── Bestand ─────────────────────────────────────────────────────────── -->
	<section>
		<h2>In Dienst</h2>
		<ul class="konten">
			{#each inDienst as k (k.id)}
				<li>
					<!--
						**Drei Gruppen statt einer Reihe** (Auftraggeber, 16.09.2026: «So sieht es
						unruhig aus»). Vorher standen Name, Rolle, Gerätezahl und bis zu drei
						Marken als gleichrangige Geschwister nebeneinander; mit dem
						Authentik-Stand kamen zwei dazu, und die Zeile kippte.

						Wer die Zeile liest, sucht dreierlei, und das steht jetzt an drei
						Orten: **wer** das ist (links, mit Benutzername und Rolle, denn beides
						gehört zur Identität und nicht zum Zustand), **wie es um das Konto
						steht** (mittig, als eine Gruppe, die zusammen umbricht) und **was man
						tun kann** (rechts).
					-->
					<div class="zeile">
						<span class="wer">
							<strong>{k.displayName}</strong>
							<span class="klein">
								{k.username} · {k.role === 'admin' ? 'Verwaltung' : 'Sitzungsleitung'}
								{#if k.id === data.eigenesKonto}· Ihr Konto{/if}
							</span>
						</span>

						<span class="stand">
							{#if data.authentikEingerichtet}
								{@const zustand = standVon(k)}
								{#if zustand === 'verknuepft'}
									<span class="marke leise">mit Authentik verknüpft</span>
								{:else if zustand === 'offen'}
									<span class="marke">
										erste Anmeldung offen bis {datumLang(tagVon(k.verknuepfungOffenBis!))}
									</span>
								{:else if zustand === 'abgelaufen'}
									<span class="marke warnung">Anmeldefenster abgelaufen</span>
								{:else if zustand === 'ohne_adresse'}
									<span class="marke leise">ohne Adresse</span>
								{/if}
							{/if}
							{#if !k.hatKennwort}
								<span class="marke warnung">nur zentrale Anmeldung</span>
							{/if}
							{#if k.sitzungen > 0}
								<span class="klein">
									{k.sitzungen} angemeldet{k.sitzungen === 1 ? 'es Gerät' : 'e Geräte'}
								</span>
							{/if}
						</span>

						<button
							type="button"
							class="leise"
							aria-expanded={offen === k.id}
							onclick={() => (offen = offen === k.id ? null : k.id)}
						>
							{offen === k.id ? 'Schliessen' : 'Ändern'}
						</button>
					</div>

					{#if offen === k.id}
						<!--
							**Ein Kasten je Handlung** (Auftraggeber, 16.09.2026: «So sieht es unruhig
							aus»). Hier standen fünf Formulare als gleichrangige Geschwister in
							einem umbrechenden Flexbereich: verschieden hoch, ohne Trennung, mit
							Knöpfen auf fünf verschiedenen Linien. `docs/gestaltung.md` nennt
							beides beim Namen — «Karten in einer Reihe sind gleich hoch» und
							«Zwei Handlungen, zwei Rahmen».

							Jeder Kasten füllt jetzt seine Rasterzelle und schiebt seinen Knopf
							nach unten, damit alle auf einer Linie liegen. Die langen
							Begründungen sind hinter «Was heisst das?» gewandert (Regel 4): Sie
							waren der Grund für die ungleichen Höhen, und wer ein Kennwort setzt,
							braucht sie nicht.
						-->
						<div class="feld">
							<section class="teil">
								<h4>Angaben</h4>
								<form method="POST" action="?/angaben" class="formular">
									<input type="hidden" name="konto" value={k.id} />
									<label>
										Name im Protokoll
										<input name="displayName" required minlength="2" {...anfangswert(k.displayName)} />
									</label>
									<label>
										E-Mail-Adresse
										<input type="email" name="email" {...anfangswert(k.email)} />
									</label>
									<details class="erklaerung">
										<summary>Was heisst das?</summary>
										<p>
											Bereits geschriebene Protokolle und Verläufe behalten den Namen, der zur
											Zeit der Handlung galt. Wer im März gehandelt hat, heisst dort weiterhin
											so, wie er damals hiess.
										</p>
										{#if data.authentikEingerichtet}
											<p>
												Über die Adresse findet die <strong>erste</strong> Anmeldung mit Authentik
												dieses Konto. Danach zählt allein die Kennung, die Authentik dabei
												hinterlegt. Eine geänderte Adresse schliesst ein offenes Anmeldefenster.
											</p>
										{/if}
									</details>
									<button type="submit" class="leise">Angaben speichern</button>
								</form>
							</section>

							{#if data.authentikEingerichtet}
								{@const zustand = standVon(k)}
								<section class="teil">
									<h4>Anmeldung über Authentik</h4>
									<p class="antwort">
										{#if zustand === 'verknuepft'}
											Verknüpft. Die Anmeldung läuft über die hinterlegte Kennung.
										{:else if zustand === 'offen'}
											Offen bis {datumLang(tagVon(k.verknuepfungOffenBis!))}.
										{:else if zustand === 'abgelaufen'}
											Das Fenster ist abgelaufen, niemand ist hereingekommen.
										{:else if zustand === 'ohne_adresse'}
											Keine Adresse hinterlegt.
										{:else}
											Noch nicht geöffnet.
										{/if}
									</p>
									{#if zustand === 'verknuepft'}
										<form method="POST" action="?/loesen" class="formular">
											<input type="hidden" name="konto" value={k.id} />
											<p class="hilfe">
												Nach dem Lösen kommt dieses Konto nur noch über Benutzername und
												Kennwort herein.
											</p>
											<details class="erklaerung">
												<summary>Was heisst das?</summary>
												<p>
													Alle angemeldeten Geräte dieses Kontos werden dabei beendet — auch
													Ihres, wenn es Ihr eigenes ist. Wer die Verknüpfung danach neu
													herstellen will, öffnet die erste Anmeldung eigens; sie geht beim
													Lösen <strong>nicht</strong> von selbst wieder auf.
												</p>
												{#if !k.hatKennwort}
													<p>
														Für dieses Konto ist <strong>kein Kennwort</strong> hinterlegt. Ohne
														die Verknüpfung käme niemand mehr hinein; setzen Sie zuerst eines,
														oder stellen Sie das Konto ausser Dienst.
													</p>
												{/if}
											</details>
											<button type="submit" class="leise" disabled={!k.hatKennwort}>
												Verknüpfung lösen
											</button>
										</form>
									{:else}
										<form method="POST" action="?/verknuepfung" class="formular">
											<input type="hidden" name="konto" value={k.id} />
											<input
												type="hidden"
												name="offen"
												value={zustand === 'offen' ? 'nein' : 'ja'}
											/>
											<p class="hilfe">
												{#if zustand === 'offen'}
													Dieses Konto bekommt, wer sich mit <strong>{k.email}</strong> bei
													Authentik anmeldet.
												{:else if zustand === 'ohne_adresse'}
													Dafür braucht es zuerst eine E-Mail-Adresse.
												{:else}
													Öffnet für {VERKNUEPFUNGSFENSTER_TAGE} Tage.
												{/if}
											</p>
											<details class="erklaerung">
												<summary>Was heisst das?</summary>
												<p>
													In dieser Zeit verbindet sich das Konto mit dem Authentik-Zugang, der
													dieselbe Adresse führt. Danach ist der Weg wieder zu, und es zählt
													allein die Kennung.
												</p>
												<p>
													Vergebliche Versuche stehen im <a href="/verlauf">Verlauf</a>. Ohne
													Frist stünde der Weg dauerhaft offen — und eine Adresse kann sich in
													Authentik jeder selbst setzen.
												</p>
											</details>
											<button type="submit" class="leise">
												{zustand === 'offen'
													? 'Erste Anmeldung schliessen'
													: 'Erste Anmeldung öffnen'}
											</button>
										</form>
									{/if}
								</section>
							{/if}

							<section class="teil">
								<h4>Kennwort</h4>
								<form method="POST" action="?/kennwort" class="formular">
									<input type="hidden" name="konto" value={k.id} />
									<label>
										Neues Kennwort
										<input
											type="password"
											name="kennwort"
											required
											minlength={data.mindestlaenge}
											autocomplete="new-password"
										/>
									</label>
									<label>
										Wiederholen
										<input
											type="password"
											name="wiederholung"
											required
											minlength={data.mindestlaenge}
											autocomplete="new-password"
										/>
									</label>
									<p class="hilfe">Alle Geräte dieses Kontos werden dabei abgemeldet.</p>
									<button type="submit" class="leise">Kennwort setzen</button>
								</form>
							</section>

							<section class="teil">
								<h4>Rolle</h4>
								<form method="POST" action="?/rolle" class="formular">
									<input type="hidden" name="konto" value={k.id} />
									<!--
										**Kein sichtbares `<label>` daneben**: Der Kastentitel sagt bereits
										«Rolle», und zweimal dasselbe Wort untereinander liest sich wie ein
										Fehler. Für Vorlesehilfen bleibt es benannt — `Suchauswahl` setzt
										`aria-label` aus `beschriftung` an beide Felder selbst.
									-->
									<Suchauswahl
										name="rolle"
										beschriftung="Rolle"
										wert={k.role}
										eintraege={data.rollen.map((r) => ({ wert: r.wert, text: r.name }))}
									/>
									<button type="submit" class="leise">Rolle ändern</button>
								</form>
							</section>

							{#if k.id !== data.eigenesKonto}
								<section class="teil">
									<h4>Dienst</h4>
									<form method="POST" action="?/dienst" class="formular">
										<input type="hidden" name="konto" value={k.id} />
										<input type="hidden" name="ausserDienst" value="ja" />
										<p class="hilfe">
											Das Konto bleibt in Verläufen und Protokollen stehen, kommt aber nicht
											mehr herein. Alle angemeldeten Geräte werden beendet.
										</p>
										<button type="submit" class="leise">Ausser Dienst stellen</button>
									</form>
								</section>
							{/if}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	{#if ausserDienst.length > 0}
		<section>
			<h2>Ausser Dienst</h2>
			<ul class="konten">
				{#each ausserDienst as k (k.id)}
					<li>
						<!--
							**Auch hier muss sich die Verknüpfung lösen lassen** (Code-Review
							16.09.2026). Ohne diesen Knopf blieb die Kennung für immer an einer
							stillgelegten Zeile hängen — und weil sie über alle Betreiber
							eindeutig ist, bekäme dieser Mensch nie wieder ein verknüpftes Konto.
						-->
						<div class="zeile">
							<span class="wer">
								<strong>{k.displayName}</strong>
								<span class="klein">
									{k.username} · ausser Dienst seit {datumLang(k.ausserDienstSeit!.slice(0, 10))}
								</span>
							</span>
							<span class="stand">
								{#if data.authentikEingerichtet && k.ueberAuthentik}
									<span class="marke leise">mit Authentik verknüpft</span>
									<form method="POST" action="?/loesen">
										<input type="hidden" name="konto" value={k.id} />
										<button type="submit" class="leise">Verknüpfung lösen</button>
									</form>
								{/if}
							</span>
							<form method="POST" action="?/dienst">
								<input type="hidden" name="konto" value={k.id} />
								<input type="hidden" name="ausserDienst" value="nein" />
								<button type="submit" class="leise">Wieder in Dienst</button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- ── Anlegen ─────────────────────────────────────────────────────────── -->
	<section>
		<h2>Konto anlegen</h2>
		<form method="POST" action="?/anlegen" class="formular anlegen">
			<label>
				Name, wie er im Protokoll erscheint
				<input name="displayName" required minlength="2" />
			</label>
			<label>
				Benutzername
				<input name="username" required minlength="3" pattern="[a-z0-9._\-]+" />
				<span class="hilfe">
					Kleinbuchstaben, Ziffern, Punkt, Bindestrich, Unterstrich. Er wird getippt, oft am
					Telefon.
				</span>
			</label>
			<label>
				E-Mail-Adresse
				<input type="email" name="email" />
				<span class="hilfe">
					{#if data.authentikEingerichtet}
						Dieselbe, die Authentik für diese Person führt. Das Konto steht damit
						{VERKNUEPFUNGSFENSTER_TAGE} Tage lang für die erste Anmeldung offen; danach zählt die
						Kennung, die Authentik dabei hinterlegt. <strong>Ohne Adresse</strong> entsteht das
						Konto trotzdem, es kommt dann aber nur über Benutzername und Kennwort herein.
					{:else}
						Zurzeit ohne Wirkung, weil keine zentrale Anmeldung eingerichtet ist.
					{/if}
				</span>
			</label>
			<label>
				Rolle
				<Suchauswahl
					name="rolle"
					beschriftung="Rolle"
					eintraege={data.rollen.map((r) => ({ wert: r.wert, text: r.name }))}
				/>
				<span class="hilfe">
					Die <strong>Verwaltung</strong> führt die Stammdaten — Einheiten, Wertquoten,
					Eigentümer. Die <strong>Sitzungsleitung</strong> führt Versammlungen und liest die
					Stammdaten, ohne sie zu ändern.
				</span>
			</label>
			<label>
				Kennwort
				<input type="password" name="kennwort" required minlength={data.mindestlaenge} autocomplete="new-password" />
				<span class="hilfe">
					Mindestens {data.mindestlaenge} Zeichen. Geben Sie es der Person auf einem anderen Weg
					als per Mail weiter; sie kann es unter «Mein Konto» selbst ändern.
				</span>
			</label>
			<label>
				Kennwort wiederholen
				<input type="password" name="wiederholung" required minlength={data.mindestlaenge} autocomplete="new-password" />
			</label>
			<button type="submit" class="haupt">Konto anlegen</button>
		</form>
	</section>


<style>
	.konten {
		list-style: none;
		margin: 0.5rem 0 1.5rem;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.konten li {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.5rem 0.7rem;
		background: var(--flaeche);
	}

	.zeile {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.8rem;
	}

	/*
	 * `margin-right: auto` schiebt alles Folgende nach rechts. Es stand hier schon
	 * und ging beim Umbau vom 16.09.2026 verloren — in der Liste «Ausser Dienst»,
	 * die kein `.stand` mit eigener Schubkraft hat, rückten Datum und Knopf damit
	 * an den Namen heran (Code-Review).
	 */
	.wer {
		display: flex;
		flex-direction: column;
		margin-right: auto;
	}

	/*
	 * Die Statusangaben als eine Gruppe, die zusammen umbricht statt Marke für
	 * Marke. `margin-left: auto` schiebt sie samt Knopf nach rechts; bricht die
	 * Zeile auf schmaler Bahn, wandert die ganze Gruppe nach unten und nicht die
	 * Hälfte davon.
	 */
	.stand {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 0.6rem;
		margin-left: auto;
	}

	.klein {
		color: var(--text-leise);
		font-size: 0.85rem;
	}

	/*
	 * **Ein Raster, keine umbrechende Reihe** (16.09.2026).
	 *
	 * `flex-wrap` legte die fünf Formulare in eine Zeile, die je nach Inhalt
	 * anders brach; jedes war so hoch, wie sein längster Hilfetext es machte, und
	 * die Knöpfe lagen auf fünf Linien. `auto-fit` mit einer Mindestbreite rechnet
	 * die Spaltenzahl selbst aus, und `stretch` (die Vorgabe, hier nur nicht
	 * überschrieben) macht alle Kästen einer Reihe gleich hoch — die Regel «Karten
	 * in einer Reihe sind gleich hoch» aus `docs/gestaltung.md`.
	 *
	 * Dieselbe Bauart wie `.dienste` auf der Schwesterseite und `.arbeitsflaeche`
	 * in app.css; `min(…, 100%)` verhindert, dass eine Spur auf dem Telefon breiter
	 * wird als die Bahn.
	 */
	.feld {
		margin-top: 0.6rem;
		padding-top: 0.6rem;
		border-top: 1px solid var(--linie);
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(19rem, 100%), 1fr));
		gap: 0.8rem;
	}

	/*
	 * **Der Kasten je Handlung.** Er füllt seine Rasterzelle, und sein Formular
	 * schiebt den Knopf nach unten — so liegen die Knöpfe aller Kästen einer Reihe
	 * auf einer Linie, auch wenn der eine zwei Felder trägt und der andere keines.
	 */
	.teil {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.6rem 0.7rem;
		background: var(--flaeche-2);
	}

	/*
	 * **`.erklaerung` ist keine Hausklasse** (Code-Review 16.09.2026). Sie steht in
	 * `GemeinschaftFormular.svelte` und `VersammlungFormular.svelte`, aber Svelte
	 * kapselt Stile je Datei — hierher kopiert kam nur das Markup, nicht das
	 * Aussehen. Die drei Ausklapper standen unformatiert.
	 */
	.erklaerung {
		font-weight: 400;
		font-size: 0.875rem;
		color: var(--text-leise);
	}

	.erklaerung summary {
		cursor: pointer;
		color: var(--akzent);
		/* Fingerbreit, aber ohne `display: flex` — das nähme dem `summary` den Marker. */
		padding: 0.35rem 0;
	}

	.erklaerung p {
		margin: 0.5rem 0 0;
	}

	.teil h4 {
		margin: 0 0 0.5rem;
		font-size: 0.9rem;
	}

	.teil .antwort {
		margin: 0 0 0.5rem;
		font-size: 0.95rem;
	}

	.teil .formular {
		flex: 1;
	}

	.teil button {
		margin-top: auto;
	}

	.formular {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.formular.anlegen {
		min-width: 16rem;
		max-width: 32rem;
	}

	.formular label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.92rem;
	}

	/* `font-weight: 400`, weil die Hilfe unter einem Feld sonst das Gewicht der
	   Beschriftung erbt (550, aus `.formular > label` in app.css); gemessen beim
	   UI-Durchgang 06.10.2026 an allen vier Hilfen von «Konto anlegen». */
	.hilfe {
		color: var(--text-leise);
		font-size: 0.85rem;
		font-weight: 400;
		margin: 0;
	}
</style>
