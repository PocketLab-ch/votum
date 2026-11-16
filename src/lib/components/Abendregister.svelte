<script lang="ts">
	/**
	 * Dasselbe Thema bei allen Häusern eines Abends — die Reiterleiste.
	 *
	 * **Was sie ersetzt.** Wer einen Abend mit sechs Häusern vorbereitet, brauchte
	 * für die vier Themen der Gemeinschaft vierundzwanzig Seitenaufrufe, und
	 * dreiundzwanzig davon begannen mit Suchen: zurück zur Übersicht, Haus
	 * anklicken, Thema anklicken. Die Leiste macht daraus einen Klick.
	 *
	 * **Was sie nicht ist: eine dritte Navigation.** Die Seitenleiste führt den
	 * Ablauf (was als Nächstes zu tun ist), der Weiterweg am Fuss führt weiter.
	 * Diese Leiste führt quer: dasselbe, aber nebenan. Deshalb steht sie über dem
	 * Inhalt, den sie betrifft, und nicht in der Leiste — und deshalb ist ihre
	 * Beschriftung eine Frage nach dem Haus, nicht nach der Aufgabe.
	 *
	 * Der Haken ist keine Zierde: Er ist der Grund, hier zu stehen. Ohne ihn
	 * müsste man jedes Haus öffnen, um zu sehen, ob man dort schon war.
	 */
	import type { Registerleiste } from '$lib/domain/register';

	let {
		leiste,
		frage = 'Für welches Haus?'
	}: { leiste: Registerleiste; frage?: string } = $props();

	/*
	 * Die Frage nennt das Thema **nicht**: Es steht als Überschrift unmittelbar
	 * darunter. «Einheiten und Wertquoten — für welches Haus?» über einer
	 * Überschrift «Einheiten» wäre genau die Doppelung, die diese Seiten
	 * unruhig gemacht hat. Für die Sprachausgabe, die keine Überschrift
	 * danebenhält, trägt die Leiste das Thema in ihrer Beschriftung.
	 */
	const beschriftung = $derived(
		leiste.titel ? `${leiste.titel} — Gemeinschaften dieser Versammlung` : 'Gemeinschaften dieser Versammlung'
	);

	/*
	 * Am Telefon stehen die Reiter in **einer** Reihe und rollen seitwärts —
	 * gemessen: sechs Häuser untereinander sind 397 px hoch und damit fast der
	 * halbe Bildschirm, bevor der Inhalt anfängt. Eine Reihe misst 90 px.
	 *
	 * Der Preis ist, dass das eigene Haus dann rechts ausserhalb liegen kann.
	 * Diese eine Zeile holt es herein. Ohne JavaScript bleibt die Leiste am
	 * Anfang stehen — sichtbar, nur nicht mitgeführt.
	 */
	let leisteEl: HTMLElement | null = $state(null);
	$effect(() => {
		leisteEl
			?.querySelector('[aria-current="page"]')
			?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	});
</script>

<nav class="register" aria-label={beschriftung} bind:this={leisteEl}>
	<p class="frage">
		<span>{frage}</span>
		{#if leiste.erledigt !== null}
			<!--
				Die Zahl steht bewusst neben der Frage und nicht unter den Reitern:
				Sie beantwortet «bin ich durch?», und das fragt man, bevor man klickt.
				Mit «Häusern» im Text, weil daneben in der Leiste ein zweiter Zähler
				steht — der Fortschritt der Versammlung. Zwei nackte Brüche
				nebeneinander liest niemand auseinander.
			-->
			<span class="zaehler">Bei {leiste.erledigt} von {leiste.haeuser} Häusern erledigt</span>
		{/if}
	</p>
	<ul>
		{#each leiste.reiter as r (r.pfad)}
			<li>
				<a href={r.pfad} class:hier={r.hier} aria-current={r.hier ? 'page' : undefined}>
					{#if r.erledigt === true}
						<!--
							Das Häkchen trägt seine Bedeutung im Text daneben, nicht in der
							Farbe: Wer Grün nicht von Grau unterscheidet, liest «erledigt».
						-->
						<span class="haken" aria-hidden="true">✓</span>
						<span class="sr">Erledigt: </span>
					{:else if r.erledigt === false}
						<!--
							**Auch das Offene bekommt ein Zeichen.** Bis zum 12.08.2026 trug nur
							das Erledigte eines; wer die offenen suchte, suchte nach einer
							Abwesenheit — und die sieht man schlechter als ein Zeichen. Gemeldet
							als «Fehlende Einträge können da leicht übersehen werden».
						-->
						<span class="mangel" aria-hidden="true">!</span>
						<span class="sr">Noch offen: </span>
					{/if}
					<span class="name">{r.name}</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>

<style>
	.register {
		background: var(--flaeche-2);
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		margin: 0 0 1rem;
		padding: 0.6rem 0.75rem;
	}

	.frage {
		align-items: baseline;
		color: var(--text-leise);
		display: flex;
		flex-wrap: wrap;
		font-size: 0.9rem;
		gap: 0.5rem 1rem;
		justify-content: space-between;
		margin: 0 0 0.5rem;
	}

	.zaehler {
		white-space: nowrap;
	}

	ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	a {
		align-items: center;
		background: var(--flaeche);
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		color: var(--text);
		display: flex;
		font-size: 0.95rem;
		gap: 0.35rem;
		/* Mindestens fingerbreit: Die Leiste wird am Abend auch am Gerät bedient. */
		min-height: var(--ziel-min);
		min-width: 0;
		padding: 0.35rem 0.7rem;
		/*
		 * Wegen `.sr` weiter unten: Ein `position: absolute` ohne positionierten
		 * Vorfahren bezieht sich auf das ganze Dokument. Im seitwärts rollenden
		 * Band am Telefon stand das versteckte «Erledigt: » dadurch bei x ≈ 900
		 * — und zog die ganze Seite auf 960 px Breite. Sichtbar war nichts, nur
		 * die Seite liess sich plötzlich quer schieben.
		 */
		position: relative;
		text-decoration: none;
	}

	a:hover {
		border-color: var(--akzent);
	}

	.hier {
		background: var(--akzent);
		border-color: var(--akzent);
		color: var(--akzent-text);
		font-weight: 600;
	}

	.haken {
		color: var(--akzent);
	}

	.mangel {
		color: var(--warnung);
		font-weight: 700;
	}

	/*
	 * Auf dem eigenen Reiter liegt die Akzentfläche — dort trüge die Warnfarbe zu
	 * wenig Kontrast. Beide Zeichen nehmen deshalb die Textfarbe des Akzents; wo
	 * man steht, sagt ohnehin schon die Fläche.
	 */
	.hier .haken,
	.hier .mangel {
		color: var(--akzent-text);
	}

	.sr {
		clip-path: inset(50%);
		height: 1px;
		overflow: hidden;
		position: absolute;
		white-space: nowrap;
		width: 1px;
	}

	/*
	 * Am Telefon eine Reihe, die seitwärts rollt — gemessen am 11.08.2026:
	 * sechs Häuser untereinander 397 px, in einer Reihe 90 px. Der Inhalt der
	 * Seite fängt sonst erst nach der halben Bildschirmhöhe an.
	 */
	@media (max-width: 40rem) {
		ul {
			flex-wrap: nowrap;
			overflow-x: auto;
			/* Damit der Rand des ersten Reiters beim Rollen nicht abgeschnitten wirkt. */
			padding-bottom: 0.15rem;
		}

		/*
		 * Angeschnitten statt ausgeschrieben: Nimmt der eigene Reiter die ganze
		 * Breite ein, sieht die Leiste aus wie ein einzelner Knopf und niemand
		 * kommt auf die Idee, sie zu schieben. Mit der Deckelung ragt immer ein
		 * Stück des nächsten Hauses herein — der einzige Hinweis, den es dafür
		 * braucht. Der volle Name steht eine Zeile höher im Pfad.
		 *
		 * Die Deckelung gehört auf das **Listenglied**, nicht auf den Verweis:
		 * Ein Flex-Element ohne Umbruch bekommt die Breite seines längsten
		 * Inhalts, und ein `max-width` auf dem Kind schmälert nur das Kind. Der
		 * Verweis wurde schmal, das Glied blieb breit — und zwischen den Reitern
		 * klaffte eine Lücke von 136 px.
		 */
		li {
			/*
			 * Nicht schrumpfen: Ohne diese Zeile pressen sich alle sechs Reiter in
			 * die sichtbare Breite und heissen dann «Schmi…», «Schmi…», «Schmi…».
			 * Das Band soll überstehen — dafür rollt es.
			 */
			flex: 0 0 auto;
			max-width: 65%;
			min-width: 0;
		}

		.name {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}
</style>
