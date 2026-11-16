import { describe, expect, it } from 'vitest';
import { falteLaeufe } from '../../scripts/kollisionshinweis.mjs';

/**
 * **Warum es diese Probe gibt.** Am 23.09.2026 hat website-78 den Hinweis
 * während eines laufenden Prüflaufs von Hand gefahren. Er meldete
 * «4 Prozess(e)», obwohl genau ein Lauf unterwegs war: Bash-Hülle,
 * `docker compose exec`, das Compose-Plugin und ein weiteres Glied derselben
 * Kette. Bei zwei echten Läufen stünde dort «8», und die Zahl wäre wertlos.
 *
 * **Und warum sie eine Probe ist und kein Kommentar.** Eine Messung im
 * Kommentar überlebt die Sitzung, aber keinen Umbau: Wer das Skript später
 * ändert, liest «4 Prozesse, gemessen am 23.09.2026» und weiss nicht, ob das
 * noch gilt. Die Probe weiss es.
 *
 * Sie misst die Faltung an erfundenen Listen. Was sie nicht misst, ist, ob
 * das Skript auf einem laufenden Host die richtigen Prozesse überhaupt
 * findet; das kann keine Fixture, und es ist am lebenden System gegengeprüft
 * worden.
 */
describe('kollisionshinweis: falteLaeufe', () => {
	/**
	 * Die Wirtseite der Kette, die den Befund ausgelöst hat.
	 *
	 * **Nur die Wirtseite**, und das ist wichtig: Die ursprüngliche Messung
	 * nannte vier Prozesse, und ein erster Entwurf dieser Probe hat sie als
	 * eine lineare Kette modelliert. Damit fehlte genau die Grenze, an der der
	 * Umbau zuerst scheiterte. Die vollständige Lage steht weiter unten unter
	 * `WIRT` und `CONTAINER`.
	 */
	const EINE_KETTE = [
		{ pid: 100, ppid: 1, zeile: '/usr/bin/bash -c source /root/.claude/shell-snapshots/x && npm run pruefen' },
		{ pid: 101, ppid: 100, zeile: 'docker compose exec -T app npm run pruefen' },
		{ pid: 102, ppid: 101, zeile: '/usr/libexec/docker/cli-plugins/docker-compose compose exec -T app npm run pruefen' },
		{ pid: 103, ppid: 102, zeile: 'docker compose exec -T app npm run pruefen --' }
	];

	it('zählt eine Prozesskette als einen Lauf, nicht als vier', () => {
		expect(falteLaeufe(EINE_KETTE)).toHaveLength(1);
	});

	it('zählt zwei getrennte Ketten als zwei Läufe, nicht als acht', () => {
		const zweite = EINE_KETTE.map((p) => ({ ...p, pid: p.pid + 100, ppid: p.ppid === 1 ? 1 : p.ppid + 100 }));
		expect(falteLaeufe([...EINE_KETTE, ...zweite])).toHaveLength(2);
	});

	it('behält je Kette den untersten Treffer, nicht die Bash-Hülle', () => {
		const [zeile] = falteLaeufe(EINE_KETTE);
		expect(zeile, 'der Schnappschusspfad sagt dem Leser nichts').not.toMatch(/shell-snapshots/);
		expect(zeile).toMatch(/npm run pruefen/);
	});

	it('zählt einen Lauf ohne Elternkette weiterhin als einen', () => {
		expect(falteLaeufe([{ pid: 7, ppid: 1, zeile: 'vitest run' }])).toEqual(['vitest run']);
	});

	it('meldet nichts, wenn nichts Langes läuft', () => {
		expect(falteLaeufe([{ pid: 7, ppid: 1, zeile: 'sshd: root@pts/0' }])).toEqual([]);
	});

	it('lässt die eigene Kette aussen vor', () => {
		expect(falteLaeufe(EINE_KETTE, new Set([100, 101, 102, 103]))).toEqual([]);
	});

	/**
	 * **Die Selbstausblendung darf den fremden Lauf nicht mitnehmen.** Sie
	 * arbeitet über Prozesskennungen, und die sind je Kette verschieden; eine
	 * Fassung, die stattdessen über den Wortlaut ausblendete, hätte hier den
	 * fremden Lauf verschluckt, weil beide Ketten denselben Befehl fahren.
	 */
	it('blendet die eigene Kette aus und sieht den fremden Lauf trotzdem', () => {
		const fremd = EINE_KETTE.map((p) => ({ ...p, pid: p.pid + 100, ppid: p.ppid === 1 ? 1 : p.ppid + 100 }));
		expect(falteLaeufe([...EINE_KETTE, ...fremd], new Set([100, 101, 102, 103]))).toHaveLength(1);
	});

	/**
	 * **Kürzen an der Wortgrenze.** Die erste Fassung schnitt hart auf 78
	 * Zeichen und endete mitten im Wort («npm run pruef»), was wie ein anderer
	 * Befehl aussieht.
	 */
	it('kürzt lange Zeilen an einer Wortgrenze', () => {
		const lang = 'docker compose exec -T app npm run pruefen ' + 'abcdefgh '.repeat(9) + 'ende';
		const [zeile] = falteLaeufe([{ pid: 9, ppid: 1, zeile: lang }]);
		expect(zeile.length).toBeLessThanOrEqual(82);
		expect(zeile).toMatch(/…$/);

		/*
		 * **Die Zusicherung misst die Wortgrenze, nicht die Optik.** Ein erster
		 * Entwurf verlangte, die gekürzte Zeile dürfe nicht auf einem
		 * Buchstaben enden; das ist für jedes vollständige Wort falsch, und die
		 * Probe war rot, ohne dass am Code etwas fehlte. Richtig gemessen ist
		 * es so: Der Rumpf muss ein Präfix des Originals sein, und an der
		 * Schnittstelle muss im Original ein Leerzeichen stehen.
		 */
		const rumpf = zeile.slice(0, -2);
		expect(lang.startsWith(rumpf)).toBe(true);
		expect(lang[rumpf.length], 'mitten im Wort geschnitten').toBe(' ');
	});

	/**
	 * **Eine widersprüchliche Momentaufnahme von /proc darf nicht hängen.**
	 *
	 * Der erste Entwurf dieser Probe hatte genau **einen** Treffer. Damit lief
	 * `some` über ein einziges Element, `q.pid !== p.pid` war falsch, und
	 * `istVorfahrVon` wurde nie aufgerufen: Die Schleife mit der Schranke
	 * `i < 64` wurde nicht einmal betreten. Gemessen im Code-Review vom
	 * 23.09.2026: Ohne die Schranke lief dieselbe Fixture grün durch. Sie
	 * sicherte also nichts.
	 *
	 * Diese Fassung braucht **zwei** Treffer, und der Zyklus liegt in der
	 * Kette des einen, ohne den anderen zu enthalten. Ohne Schranke läuft die
	 * Suche darin endlos; mit Schranke kommen beide Läufe heraus.
	 *
	 * **Wer die Gegenprobe fährt, räumt danach auf.** Sie wurde mit
	 * `timeout 45 docker compose exec …` abgebrochen, und `timeout` beendet
	 * nur die Hülle auf dem Wirt: Der Prozess im Container drehte weiter und
	 * stand sechs Minuten später bei 5:55 CPU-Zeit auf einer Maschine, die
	 * sich mehrere Sitzungen teilen. Aufgefallen ist er ausgerechnet dem
	 * Hinweis selbst, der daraufhin korrekt «2 Läufe» meldete. Das ist
	 * dieselbe Grenze, um die es in dieser Datei geht, nur von der anderen
	 * Seite: Ein Signal an den Wirtprozess erreicht den Container nicht.
	 */
	it('hängt nicht an einem Zyklus in der Elternkette', () => {
		const zyklus = [
			{ pid: 1, ppid: 2, zeile: 'vitest run' },
			{ pid: 2, ppid: 3, zeile: 'sshd' },
			{ pid: 3, ppid: 4, zeile: 'bash' },
			{ pid: 4, ppid: 2, zeile: 'sh' },
			{ pid: 9, ppid: 0, zeile: 'npm run pruefen' }
		];
		expect(falteLaeufe(zyklus).sort()).toEqual(['npm run pruefen', 'vitest run']);
	});

	/**
	 * **Der Fall, der den Umbau ausgelöst hat, in der echten Topologie.**
	 *
	 * Am Wirt nachgemessen (23.09.2026): Ein Prozess im Container hängt dort
	 * nicht am `docker compose exec`, sondern am `containerd-shim-runc-v2`,
	 * und der hat PPid 1. Die Faltung über Vorfahren verbindet die beiden
	 * Wurzeln also nie. Eine erste Fassung des Umbaus meldete deshalb für
	 * einen einzigen Prüflauf weiterhin zwei Läufe; erkannt hat das erst der
	 * Code-Review, weil die Fixture alle Glieder als eine lineare Kette
	 * modellierte und die Containergrenze gar nicht enthielt.
	 */
	const WIRT = [
		{ pid: 10, ppid: 1, zeile: '/usr/bin/bash -c npm run pruefen' },
		{ pid: 11, ppid: 10, zeile: 'docker compose exec -T app npm run pruefen' },
		{ pid: 12, ppid: 11, zeile: '/usr/libexec/docker/cli-plugins/docker-compose compose exec -T app npm run pruefen' }
	];
	const CONTAINER = [
		{ pid: 900, ppid: 1, zeile: '/usr/bin/containerd-shim-runc-v2 -namespace moby -id b5aeba59' },
		{ pid: 901, ppid: 900, zeile: 'npm run pruefen' },
		{ pid: 902, ppid: 901, zeile: 'sh -c npm run check:code' }
	];

	it('zählt einen Prüflauf über die Containergrenze als einen Lauf', () => {
		expect(falteLaeufe([...WIRT, ...CONTAINER])).toEqual(['npm run pruefen']);
	});

	it('zeigt den Lauf im Container, nicht die Fernbedienung auf dem Wirt', () => {
		const [zeile] = falteLaeufe([...WIRT, ...CONTAINER]);
		expect(zeile, 'die Hülle sagt dem Leser weniger als der Lauf').not.toMatch(/docker/);
	});

	/**
	 * **Aber die Hülle zählt, wenn sonst nichts zu sehen ist.** Wäre der
	 * Container von hier aus nicht einsehbar, etwa auf einem anderen Wirt oder
	 * unter `hidepid`, bliebe sie die einzige Spur des Laufs. Sie
	 * wegzuwerfen hiesse, den Hinweis genau dann zu verlieren, wenn er am
	 * meisten wert ist.
	 */
	it('zählt die Fernbedienung, wenn der Lauf selbst unsichtbar ist', () => {
		expect(falteLaeufe(WIRT)).toHaveLength(1);
	});

	/**
	 * Seit dem 14.10.2026 fährt scripts/pruefen.sh den Lauf im
	 * Einmalcontainer (`docker run … npm run pruefen`), nicht mehr per
	 * `compose exec`. Dieselbe Grenze, eine andere Hülle.
	 */
	const WIRT_EINMAL = [
		{ pid: 20, ppid: 1, zeile: 'bash scripts/pruefen.sh' },
		{ pid: 21, ppid: 20, zeile: "docker run --rm --network versammlung_default --env-file /tmp/tmp.x -v /arbeit/versammlung-thema:/app -w /app --tmpfs /daten --entrypoint sh node:24-alpine -c mkdir -p /daten/dateien && npx svelte-kit sync >/dev/null && npm run pruefen" }
	];

	/** Die Containerseite des Einmalcontainers: PID 1 ist `sh -c …`, das MUSTER
	 * ebenfalls trifft; die Faltung über die Vorfahren nimmt den untersten. */
	const CONTAINER_EINMAL = [
		{ pid: 950, ppid: 1, zeile: '/usr/bin/containerd-shim-runc-v2 -namespace moby -id c1d2e3f4' },
		{ pid: 951, ppid: 950, zeile: '/sbin/docker-init -- sh -c mkdir -p /daten/dateien && npx svelte-kit sync >/dev/null && npm run pruefen' },
		{ pid: 952, ppid: 951, zeile: 'sh -c mkdir -p /daten/dateien && npx svelte-kit sync >/dev/null && npm run pruefen' },
		{ pid: 953, ppid: 952, zeile: 'npm run pruefen' }
	];

	it('zählt den Einmalcontainer über die Containergrenze als einen Lauf', () => {
		expect(falteLaeufe([...WIRT_EINMAL, ...CONTAINER_EINMAL])).toEqual(['npm run pruefen']);
	});

	it('hält docker-entrypoint.sh mit «run» nicht für eine Hülle', () => {
		const zwei = [
			...WIRT_EINMAL, ...CONTAINER_EINMAL,
			{ pid: 970, ppid: 1, zeile: '/usr/local/bin/docker-entrypoint.sh npx vitest run' }
		];
		expect(falteLaeufe(zwei)).toHaveLength(2);
	});

	it('erkennt die Hülle auch mit Optionen vor exec', () => {
		const container = [
			{ pid: 990, ppid: 1, zeile: '/usr/bin/containerd-shim-runc-v2 -namespace moby -id f0' },
			{ pid: 991, ppid: 990, zeile: 'npm run pruefen' }
		];
		for (const huelle of [
			'/usr/libexec/docker/cli-plugins/docker-compose compose -p versammlung exec -T app npm run pruefen',
			'docker container exec versammlung-app-1 npm run pruefen',
			'sudo docker exec versammlung-app-1 npm run pruefen'
		]) {
			expect(falteLaeufe([{ pid: 980, ppid: 1, zeile: huelle }, ...container]), huelle).toEqual([
				'npm run pruefen'
			]);
		}
	});

	it('zählt zwei Prüfläufe über die Containergrenze als zwei', () => {
		const zweiter = [...WIRT, ...CONTAINER].map((x) => ({
			...x,
			pid: x.pid + 1000,
			ppid: x.ppid === 1 ? 1 : x.ppid + 1000
		}));
		expect(falteLaeufe([...WIRT, ...CONTAINER, ...zweiter])).toHaveLength(2);
	});

	/**
	 * **Ein Zwischenglied ohne lesbare Kommandozeile darf die Kette nicht
	 * zerreissen.** Zombies und Kernel-Fäden haben keine; fielen sie aus der
	 * Elternkarte, zählte ein Treffer darunter als eigener Lauf.
	 */
	it('faltet über ein Zwischenglied ohne Kommandozeile hinweg', () => {
		expect(
			falteLaeufe([
				{ pid: 20, ppid: 1, zeile: 'npm run pruefen' },
				{ pid: 21, ppid: 20, zeile: '' },
				{ pid: 22, ppid: 21, zeile: 'vitest run' }
			])
		).toEqual(['vitest run']);
	});
});
