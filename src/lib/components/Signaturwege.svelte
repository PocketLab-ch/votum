<script lang="ts">
	import { aufgeklappt } from '$lib/felder';

	/**
	 * Was über das Unterschreiben eines Protokolls gilt — an **einer** Stelle.
	 *
	 * **Warum eine Komponente und nicht zwei Absätze.** Dieselbe Aussage stand auf
	 * der Versammlungs- und auf der Verbundseite, jede für sich formuliert. Am
	 * 22.08.2026 fiel auf, dass sie auseinandergelaufen waren: Hier hiess es
	 * pauschal «FES prüft der Bund nicht», daneben stand im Code-Kommentar das
	 * Richtige. Wer zwei Fassungen pflegt, pflegt irgendwann nur noch eine.
	 *
	 * **Die Grenzen des Validators verlaufen nicht dort, wo man sie vermutet.**
	 * Laut BIT (bit.admin.ch/de/der-validator) prüft validator.admin.ch Schweizer
	 * qualifizierte Signaturen, geregelte Siegel und fortgeschrittene der Swiss
	 * Government PKI. Nicht geprüft werden einfache Signaturen, fortgeschrittene
	 * anderer Anbieter und **Signaturen ausländischer Anbieter, auch deren
	 * qualifizierte**.
	 *
	 * **Deshalb steht die Rechtsordnung als eigener Absatz da.** Skribble signiert
	 * über Swisscom wahlweise nach ZertES oder nach eIDAS — das ist ein Klick, und
	 * wer ihn falsch setzt, hält eine tadellose QES in der Hand, die diese Stelle
	 * abweist. Das ist der wahrscheinlichste Weg, hier etwas falsch zu machen, und
	 * er kostet nichts ausser Wissen.
	 *
	 * Bewusst ohne «gerichtsfest» oder «rechtssicher»: Für dieses Protokoll
	 * verlangt das Gesetz keine Form (ZGB Art. 712n Abs. 2), und es gibt keine
	 * Beweisregel, nur freie Würdigung (ZPO Art. 157).
	 */
	let { offen = false }: { offen?: boolean } = $props();
</script>

<details class="signaturwege" {...aufgeklappt(offen)}>
	<summary>Das Protokoll unterschreiben lassen</summary>
	<p>
		Das Gesetz verlangt für dieses Protokoll keine Form. Eine Unterschrift ist trotzdem
		üblich und wird vom Standardkommentar empfohlen — meist durch die Sitzungsleitung und
		die Protokollführung. Verlangt es Ihr Reglement, sollte dort auch stehen, wie
		unterschrieben wird.
	</p>
	<p>
		<strong>Elektronisch:</strong> Der Bund prüft kostenlos —
		<a href="https://www.validator.admin.ch" target="_blank" rel="noopener noreferrer"
			>validator.admin.ch</a
		>. Er nimmt qualifizierte Signaturen (QES) Schweizer Anbieter, geregelte Siegel und
		fortgeschrittene (FES) der Swiss Government PKI. Nicht geprüft werden die FES
		gewöhnlicher Anbieter und Signaturen ausländischer Anbieter — auch deren qualifizierte
		nicht. Dort bleibt der Bericht des Anbieters.
	</p>
	<p>
		<strong>Achten Sie auf die Rechtsordnung.</strong> Dienste wie Skribble signieren wahlweise
		nach Schweizer Recht (ZertES) oder nach EU-Recht (eIDAS). Beide sind gültig — aber der
		Bund prüft nur die Schweizer Fassung. Wählen Sie im Signaturdienst also ZertES, sonst
		haben Sie eine einwandfreie Signatur, die diese Stelle abweist.
	</p>
	<p>
		<strong>Auf Papier:</strong> ausdrucken, unterschreiben, ablegen. Aufzubewahren, solange
		das Stockwerkeigentum besteht — nicht zehn Jahre. Ein Ausdruck ist auch neben der
		elektronischen Fassung sinnvoll: Er bleibt lesbar, wenn Zertifikate längst abgelaufen
		sind.
	</p>
</details>

<style>
	.signaturwege {
		margin-top: 0.75rem;
	}

	/*
	 * **Kein `display: flex` auf dem `summary`** — das nähme ihm sein Dreieck, und
	 * der Satz sähe aus wie ein Satz (docs/gestaltung.md, «Die Anleitung steht
	 * dort, wo die Frage entsteht»). Die Fingergrösse kommt über `padding`.
	 */
	.signaturwege summary {
		cursor: pointer;
		font-size: 0.9rem;
		min-height: var(--ziel-min);
		padding: 0.7rem 0;
	}

	.signaturwege p {
		color: var(--text-leise);
		font-size: 0.9rem;
		max-width: 62ch;
	}
</style>
