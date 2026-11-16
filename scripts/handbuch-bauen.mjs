#!/usr/bin/env node
// Baut aus docs/handbuch/*.md ein statisches HTML-Handbuch nach public/handbuch/.
//
// Laeuft zur BAUZEIT und liegt damit im Abbild. Zwei Gruende gegen die
// Alternativen:
//   - Ein eigener Dienst waere ein weiterer Container je Anwendung, und sein
//     Stand koennte vom Code abweichen. Hier koennen Handbuch und Anwendung
//     nicht auseinanderlaufen: dasselbe Abbild, derselbe Commit.
//   - Auf der Website waere es oeffentlich. Es steht Betriebswissen drin.
//     **Öffentlich ist es trotzdem**: `/handbuch` ist seit dem 12.11.2026 ohne
//     Anmeldung erreichbar (`static/robots.txt`, `Allow: /handbuch`). Deshalb
//     gehören nur Texte für Anwender hinein, und `BETRIEBSANGABEN` unten hält
//     Betriebswissen des Betreibers heraus.
//
// BEWUSST OHNE ABHAENGIGKEITEN. Die drei Anwendungen bringen unterschiedliche
// Werkzeuge mit (immotool react-markdown, CMMS und Versammlung gar keine).
// Ein Renderer, der ueberall gleich laeuft, ist mehr wert als der volle
// Markdown-Umfang — gerendert wird nur, was in unseren Handbuechern vorkommt.
//
// Erzeugt zusaetzlich hilfe.json: die Zuordnung Seite -> Handbuchstelle, aus
// der die Seitenhilfe ihren Sprungpunkt nimmt.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync, realpathSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));

/**
 * @typedef {{
 *   titel: string,
 *   quellen: string[],
 *   ziel: string,
 *   zuordnung?: string,
 *   dateien?: string[],
 *   zurueck?: string,
 *   hilfe: Record<string, string[]>,
 * }} Einstellung
 * @typedef {{ id: string, text: string }} Gliederungspunkt
 * @typedef {{ html: string, gliederung: Gliederungspunkt[], fehler: string[] }} Gerendert
 */

/** @type {Einstellung} */
export const CONFIG = {
  titel: "Versammlung — Handbuch",
  // Ein Ort genuegt: Das Abbild baut aus dem Repo-Stamm (`COPY . .`), docs/
  // ist dort vorhanden. Fehlt die Quelle trotzdem, bricht der Erzeuger ab —
  // ein Abbild, dessen Handbuch-Knopf ins Leere zeigt, faellt sonst erst der
  // Anwenderin auf.
  quellen: [join(HIER, "../docs")],
  ziel: join(HIER, "../static/handbuch"),
  // Die Zuordnung wandert zusaetzlich nach src/: Von dort kann die
  // Seitenhilfe sie zur Bauzeit importieren, statt sie zur Laufzeit zu holen.
  // Ein Fetch waere ein Flackern beim ersten Rendern und ein Fehlerfall mehr.
  zuordnung: join(HIER, "../src/lib/handbuch-hilfe.json"),
  // NUR diese Dateien, in dieser Reihenfolge. docs/ enthaelt daneben interne
  // Arbeitspapiere — den Pruefauftrag, den Befundbericht und den Stand der
  // juristischen Gegenlesung. Die sind fuer uns, nicht fuer die Anwendung.
  // gestaltung.md ist Entwicklerdoku und hat in einem Benutzerhandbuch
  // ebenfalls nichts verloren.
  dateien: [
    "README.md",
    "versammlung-fuehren.md",
    "verbund.md",
    "dienste.md",
    "installation.md",
    // `freigabe.md` stand hier vom 17.08. bis zum 15.11.2026 ohne Entscheid
    // (seit `d347adb2`). Es ist das Freigabeblatt, ein internes Arbeitspapier
    // mit Betriebsangaben, und war unter `/handbuch/freigabe.html` öffentlich
    // (Auftrag `.auftraege/2026-11-15-votum-handbuch-luecke.md`).
  ],

  // Seite in der Anwendung -> Stelle im Handbuch. Der Schluessel wird gegen
  // den Pfad gematcht (laengster Treffer gewinnt), damit /liegenschaften/42
  // dieselbe Hilfe bekommt wie /liegenschaften.
  hilfe: {
    "/": ["index", "welches-kapitel-sie-brauchen", "Übersicht"],
    "/gemeinschaften": ["versammlung-fuehren", "abschnitt-1-vorbereiten", "Vorbereiten"],
    // Ein `*` steht für ein Segment, hier die Kennung der Gemeinschaft (`stelleFuer`).
    "/gemeinschaften/*/lesarten": ["versammlung-fuehren", "lesarten-der-gemeinschaft", "Lesarten der Gemeinschaft"],
    "/versammlungen": ["versammlung-fuehren", "abschnitt-3-an-der-versammlung", "An der Versammlung"],
    "/personen": ["versammlung-fuehren", "abschnitt-1-vorbereiten", "Eigentümer zuordnen"],
    // Nicht der Vorbehalt am Schluss von index.md: Der steht als Warnung schon
    // auf der Seite selbst, und als letzter Abschnitt seines Kapitels kann ihn
    // der Browser gar nicht an den oberen Rand holen — gemessen am 17.08.2026,
    // 686 px unter der Bildkante. Die Hilfe beantwortet, was man hier tut.
    "/quorum": ["versammlung-fuehren", "schritt-6-die-mehrheitserfordernisse", "Mehrheitserfordernisse"],
    "/pruefen": ["versammlung-fuehren", "abschnitt-4-danach", "Ein Paket prüfen"],
    "/verlauf": ["versammlung-fuehren", "abschnitt-4-danach", "Verlauf"],
    "/tage": ["verbund", "die-gemeinsame-versammlung", "Der Verbund"],
    // Der laengste Treffer gewinnt: die Unterseite behaelt ihr eigenes Kapitel,
    // die Betreiberseite selbst zeigt auf ihre eigene Beschreibung. Vorher
    // schickte das «?» dort in die aeusseren Dienste — also an den Ort EINER
    // ihrer neun Kacheln (26.08.2026, aus dem Code-Review).
    "/betreiber": ["versammlung-fuehren", "die-betreiberseite", "Die Betreiberseite"],
    "/betreiber/dienste": ["dienste", "zwei-wege-etwas-einzurichten", "Äussere Dienste"],
    "/betreiber/loeschen": ["versammlung-fuehren", "aufbewahren-und-loschen", "Aufbewahren und löschen"],
    "/konto": ["versammlung-fuehren", "ihr-zugang", "Ihr Zugang"],
    "/anmelden": ["versammlung-fuehren", "ihr-zugang", "Anmelden"],
  },
};

// ─── Markdown ────────────────────────────────────────────────────────────
// Nur der Umfang, den unsere Handbuecher benutzen. Was hier fehlt, kommt in
// den Quellen nicht vor — und soll dann auch nicht lautlos halb gerendert
// werden, sondern auffallen.

/** @param {string} s */
const schuetzen = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Der Dateiname eines Kapitels im gebauten Handbuch.
 *
 * README wird zur Startseite und heisst dort `index`. Die Regel wird an zwei
 * Stellen gebraucht: beim Schreiben der Datei und beim Umschreiben der
 * Verweise. Bis zum 26.08.2026 stand sie nur an der ersten; die zweite wurde
 * durch einen Nachlauf ueber das fertige HTML geradegezogen, der `href="README.html`
 * suchte und ersetzte. Das war eine zweite Regel fuer dieselbe Sache — und die
 * Nachbesserung liess sich nicht pruefen, weil sie den Fehler beseitigte,
 * bevor der Waechter ihn sehen konnte. Jetzt eine Regel, zweimal benutzt.
 */
/** @param {string} name */
const kapitelDatei = (name) => (name === "README" ? "index" : name);

/** @param {string} text */
function anker(text) {
  return text
    .toLowerCase()
    .replace(/[äàâ]/g, "a").replace(/[öô]/g, "o").replace(/[üû]/g, "u").replace(/ß/g, "ss")
    .replace(/`|\*|_/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * **Betriebsangaben gehören nicht ins Handbuch.** Das Handbuch ist ohne
 * Anmeldung lesbar; ein Satz über die Abwehr, einen internen Host oder den Ort
 * eines Geheimnisses wird dort eine Anleitung für Angreifer. Der Bau bricht ab,
 * wenn eine Quelle eines dieser Muster trägt.
 *
 * Zwei Teile. Hier die allgemeinen Muster, die für jeden Betreiber gelten. Die
 * Namen des eigenen Betriebs (Hosts, Produkte der Abwehr, Orte von Geheimnissen)
 * stehen in `scripts/betriebsangaben-sperre.json`, die kein öffentlicher Stand
 * trägt (`.gitattributes`): Als Sperrliste im Quelltext wären sie selbst ein
 * Inventar des Betriebs (Sicherheitsprüfung des Codeberg-Stands, 15.11.2026).
 * Fehlt die Datei, prüft der Bau nur die allgemeinen Muster und sagt das; im
 * internen Repo hält `tests/waechter/handbuch-betriebsangaben.test.ts` den
 * Prüflauf rot, damit der Wächter dort nicht still schwächer wird.
 *
 * Authentik, Gotify, KI und Zeitstempel sind Dienste der Anwendung, die jede
 * Gemeinschaft selbst einrichtet; sie stehen bewusst nicht hier.
 */
export const BETRIEBSANGABEN_SPERRDATEI = join(HIER, "betriebsangaben-sperre.json");

/**
 * Die hauseigenen Regeln aus der Sperrdatei; `null`, wenn sie fehlt. Eine
 * Datei, die da ist, aber nicht taugt, bricht ab: Sie wäre ein Wächter, der
 * grün und blind ist.
 * @param {string} pfad
 * @returns {{ muster: RegExp, was: string }[] | null}
 */
export function ladeBetriebsangaben(pfad) {
  if (!existsSync(pfad)) return null;
  const { regeln } = JSON.parse(readFileSync(pfad, "utf8"));
  if (!Array.isArray(regeln) || regeln.length === 0) throw new Error(`${pfad}: keine Regeln`);
  return regeln.map((r) => {
    if (typeof r.muster !== "string" || typeof r.was !== "string" || !r.muster) {
      throw new Error(`${pfad}: Regel ohne «muster» oder «was»`);
    }
    const flags = typeof r.flags === "string" ? r.flags : "gi";
    return { muster: new RegExp(r.muster, flags.includes("g") ? flags : `${flags}g`), was: r.was };
  });
}

export const BETRIEBSANGABEN_HAUS = ladeBetriebsangaben(BETRIEBSANGABEN_SPERRDATEI);

export const BETRIEBSANGABEN = [
  ...(BETRIEBSANGABEN_HAUS ?? []),
  // «trusted» nur als Adresse, die eine Abwehr durchlässt; «Trusted Timestamping» bleibt erlaubt.
  { muster: /\btrusted[ _-]?(ips?|hosts?|prox(y|ies))\b|\bals\s+trusted\b/gi, was: "die Abwehr vor dem Betrieb" },
  { muster: /pendenzen-sicherheit|befunde-sicherheitsdurchgang|docs\/audit\//gi, was: "ein interner Sicherheitsbericht" },
  {
    muster: /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|\b172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b|\b192\.168\.\d{1,3}\.\d{1,3}\b/g,
    was: "eine private IP-Adresse",
  },
  // Der ganze Pfad, damit eine Ausnahme genau einen Pfad freigibt (Codeprüfung, N3).
  { muster: /\/root\/(?:[^\s`'"»),;:]*[^\s`'"»),;:.])?|\.env\.betrieb\b/g, was: "ein Pfad am Betriebshost" },
];

/**
 * Begründete Ausnahmen, je Datei und genau mit dem getroffenen Text. Was
 * hier steht, ist Anleitung für den Selbstbetrieb, nicht der Betrieb dieses
 * Hauses.
 */
export const BETRIEBSANGABEN_AUSNAHMEN = [
  // Die dokumentierte Vorgabe fürs Notebook im Saal, nicht ein Host dieses Hauses.
  { datei: "installation.md", treffer: "192.168.4.1" },
  // Anleitung zum eigenen Betrieb: der Name der Env-Datei.
  { datei: "installation.md", treffer: ".env.betrieb" },
];

/**
 * Die Betriebsangaben in einer Quelle, ohne die Ausnahmen dieser Datei.
 * @param {string} text
 * @param {string} datei
 * @param {{ muster: RegExp, was: string }[]} [regeln]
 * @returns {{ zeile: number, treffer: string, was: string }[]}
 */
export function betriebsangaben(text, datei, regeln = BETRIEBSANGABEN) {
  const erlaubt = new Set(BETRIEBSANGABEN_AUSNAHMEN.filter((a) => a.datei === datei).map((a) => a.treffer));
  /** @type {{ zeile: number, treffer: string, was: string }[]} */
  const funde = [];
  text.split("\n").forEach((zeile, i) => {
    for (const { muster, was } of regeln) {
      for (const t of zeile.matchAll(muster)) {
        if (!erlaubt.has(t[0])) funde.push({ zeile: i + 1, treffer: t[0], was });
      }
    }
  });
  return funde;
}

// Wird vor dem Rendern auf die Namen der aufgenommenen Kapitel gesetzt.
/** @type {Set<string> | null} */
let BEKANNTE_KAPITEL = null;

/** @param {string} s */
function inline(s) {
  let t = schuetzen(s);
  // Code zuerst: sein Inhalt darf nicht weiter ausgezeichnet werden.
  //
  // Der Platzhalter braucht ein Zeichen, das im Fliesstext nicht vorkommt.
  // Eine blosse Zahl genuegt NICHT: Beim Zuruecksetzen traefe das Muster
  // jede andere freistehende Zahl im Absatz — aus «Retention 30 Tage» wuerde
  // Code, und der eigentliche Schnipsel ginge verloren.
  /** @type {string[]} */
  const codes = [];
  t = t.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, /** @type {string} */ text, /** @type {string} */ ziel) => {
    // Verweise zwischen Kapiteln zeigen im Handbuch auf die HTML-Fassung.
    const md = ziel.match(/^([\w.-]+)\.md(#|$)/);
    if (md && BEKANNTE_KAPITEL && !BEKANNTE_KAPITEL.has(md[1])) {
      // Ziel ist nicht Teil des Handbuchs (etwa ein internes Arbeitspapier,
      // das die Auswahl bewusst weglaesst). Text behalten, Verweis fallen
      // lassen — ein Link auf eine Seite, die es im Abbild nicht gibt, waere
      // eine 404 vor den Augen der Anwenderin.
      return text;
    }
    const z = ziel.replace(/^([\w.-]+)\.md(#|$)/, (_, name, rest) => `${kapitelDatei(name)}.html${rest}`);
    const extern = /^https?:/.test(z);
    return `<a href="${z}"${extern ? ' target="_blank" rel="noopener"' : ""}>${text}</a>`;
  });
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[\s(])\*([^*]+)\*/g, "$1<em>$2</em>");
  // Das Nullbyte ist hier eine selbstgesetzte Marke, kein Zufall: Es kann in
  // keinem Handbuchtext vorkommen und trägt deshalb die ausgeschnittenen
  // Codeblöcke durch die übrigen Ersetzungen.
  // eslint-disable-next-line no-control-regex
  t = t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
  return t;
}

// Ein Listenpunkt: Einzug, Listenzeichen, Text. Die Regel wird an zwei Stellen
// gebraucht, beim Öffnen einer Liste und beim Beenden eines Absatzes.
const LISTENPUNKT = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
/** @param {string} zeichen */
const listenart = (zeichen) => (/\d/.test(zeichen) ? "ol" : "ul");
/** @param {string} zeile */
const einzugVon = (zeile) => zeile.length - zeile.trimStart().length;

/**
 * Markdown zu HTML.
 *
 * `alsPunkt` rendert den Körper eines Listenpunkts: Die erste Zeile ist dann
 * immer Fliesstext und steht ohne `<p>` da, auch wenn sie wie ein Block
 * beginnt. Ohne das würde aus «- 3. Dezember» eine Unterliste, die bei 3 zählt.
 *
 * `fehler` sammelt, was den Bau abbrechen soll (siehe Nummernlücke unten).
 *
 * @param {string} md
 * @param {boolean} [alsPunkt]
 * @returns {Gerendert}
 */
export function rendern(md, alsPunkt = false) {
  // Frontmatter weg (die Versammlungs-Doku benutzt sie). Nicht im Körper
  // eines Listenpunkts: Dort wäre «---» am Anfang Text und kein Dateikopf.
  if (!alsPunkt) md = md.replace(/^---\n[\s\S]*?\n---\n/, "");
  const zeilen = md.split("\n");
  /** @type {string[]} */
  const aus = [];
  /** @type {Gliederungspunkt[]} */
  const gliederung = [];
  /** @type {string[]} */
  const fehler = [];
  let i = 0;

  const absatzAb = () => {
    const absatz = [];
    while (i < zeilen.length && zeilen[i].trim() !== "" && !/^(#{1,4}\s|>|```|\||---+\s*$)/.test(zeilen[i])) {
      if (LISTENPUNKT.test(zeilen[i])) break;
      // Beschnitten, weil Fortsetzungszeilen eines Listenpunkts ihren Einzug
      // mitbringen; im Absatz wären das doppelte Leerzeichen.
      absatz.push(zeilen[i++].trim());
    }
    return absatz;
  };

  if (alsPunkt) {
    const kopf = zeilen[i++];
    aus.push(inline([kopf, ...absatzAb()].join(" ")));
  }

  while (i < zeilen.length) {
    const z = zeilen[i];

    // Codeblock
    if (/^```/.test(z)) {
      const sprache = z.slice(3).trim();
      const inhalt = [];
      i++;
      while (i < zeilen.length && !/^```/.test(zeilen[i])) inhalt.push(zeilen[i++]);
      i++;
      if (sprache === "mermaid") {
        // Ohne Diagramm-Bibliothek waere die Quelle nur Rauschen. Sie bleibt
        // zugaenglich, aber eingeklappt — der Fliesstext daneben traegt die
        // Aussage ohnehin.
        aus.push(
          `<details class="skizze"><summary>Ablaufskizze (Diagrammquelle)</summary><pre><code>${schuetzen(
            inhalt.join("\n")
          )}</code></pre></details>`
        );
      } else {
        aus.push(`<pre><code>${schuetzen(inhalt.join("\n"))}</code></pre>`);
      }
      continue;
    }

    // Ueberschrift
    const u = z.match(/^(#{1,4})\s+(.*)$/);
    if (u) {
      const stufe = u[1].length;
      const text = u[2].trim();
      const id = anker(text);
      aus.push(`<h${stufe} id="${id}">${inline(text)}</h${stufe}>`);
      if (stufe === 2) gliederung.push({ id, text: text.replace(/`/g, "") });
      i++;
      continue;
    }

    // Tabelle: Kopfzeile plus Trennzeile
    if (/^\|/.test(z) && /^\|[\s:|-]+\|?\s*$/.test(zeilen[i + 1] || "")) {
      /** @param {string} r */
      const zellen = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const kopf = zellen(z);
      i += 2;
      const koerper = [];
      while (i < zeilen.length && /^\|/.test(zeilen[i])) koerper.push(zellen(zeilen[i++]));
      aus.push(
        `<div class="tabelle"><table><thead><tr>${kopf
          .map((c) => `<th>${inline(c)}</th>`)
          .join("")}</tr></thead><tbody>${koerper
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`
      );
      continue;
    }

    // Zitatblock, ueber mehrere Zeilen
    if (/^>\s?/.test(z)) {
      const inhalt = [];
      while (i < zeilen.length && /^>\s?/.test(zeilen[i])) inhalt.push(zeilen[i++].replace(/^>\s?/, ""));
      const zitat = rendern(inhalt.join("\n"));
      fehler.push(...zitat.fehler);
      aus.push(`<blockquote>${zitat.html}</blockquote>`);
      continue;
    }

    // Trennlinie
    if (/^---+\s*$/.test(z)) {
      aus.push("<hr>");
      i++;
      continue;
    }

    // Beschreibungsliste: **Begriff** / : Erklaerung (das Glossar nutzt sie)
    if (/^\*\*[^*]+\*\*\s*$/.test(z) && /^:\s/.test(zeilen[i + 1] || "")) {
      aus.push("<dl>");
      while (i < zeilen.length && /^\*\*[^*]+\*\*\s*$/.test(zeilen[i]) && /^:\s/.test(zeilen[i + 1] || "")) {
        aus.push(`<dt>${inline(zeilen[i].trim())}</dt>`);
        i++;
        const def = [zeilen[i].replace(/^:\s?/, "")];
        i++;
        while (i < zeilen.length && /^\s{2,}\S/.test(zeilen[i])) def.push(zeilen[i++].trim());
        aus.push(`<dd>${inline(def.join(" "))}</dd>`);
        while (i < zeilen.length && zeilen[i].trim() === "") i++;
      }
      aus.push("</dl>");
      continue;
    }

    // Listen, inklusive Aufgabenhaken.
    //
    // Ein Punkt nimmt alles mit, was tiefer eingerückt ist als sein
    // Listenzeichen: Fortsetzungszeilen, weitere Absätze, Unterlisten, Zitate,
    // Codeblöcke. Dieser Körper wird ausgerückt und läuft noch einmal durch
    // `rendern`, so wie es der Zitatblock oben schon tut. Bis zum 02.10.2026
    // bekam ein Punkt nur seine erste Zeile; der Rest schloss die Liste und
    // wurde ein Absatz. Gemessen am Bestand: 160 von 177 Listen hatten genau
    // einen Punkt, und nummerierte Listen begannen je Punkt neu bei 1.
    //
    // Massgebend ist der Einzug des Listenzeichens, nicht die Spalte des
    // Textes dahinter: Die Aufgabenhaken in freigabe.md rücken ihre
    // Unterpunkte um 4 ein und ihre Fortsetzungszeilen um 6.
    const li = z.match(LISTENPUNKT);
    if (li) {
      const einzug = li[1].length;
      const art = listenart(li[2]);
      let erwartet = 1;
      const punkte = [];
      while (i < zeilen.length) {
        const m = zeilen[i].match(LISTENPUNKT);
        // Geschwister haben denselben Einzug und dieselbe Art. Ein Wechsel
        // zwischen Nummer und Strich beginnt eine neue Liste.
        if (!m || m[1].length !== einzug || listenart(m[2]) !== art) break;
        if (art === "ol") {
          // Der Browser zählt, die Quelle wird nur verglichen: Jede Liste
          // beginnt bei 1 und zählt durch. Eine Abweichung heisst fast immer,
          // dass eine Zeile ohne Einzug die Liste zerrissen hat; der zweite
          // Teil beginnt dann in der Quelle bei 3 und im Handbuch wieder bei
          // 1. Zu sehen wäre davon nur eine falsche Nummer. Deshalb bricht der
          // Bau ab (Produktentscheid 02.10.2026). Ein `start` gibt es
          // deshalb nicht: Es würde genau diesen Fall still richtig aussehen
          // lassen.
          const nummer = parseInt(m[2], 10);
          if (nummer !== erwartet) {
            fehler.push(`Listenpunkt «${m[2]} ${m[3].slice(0, 50)}» trägt die Nummer ${nummer}, erwartet war ${erwartet}`);
          }
          erwartet = nummer + 1;
        }
        const haken = m[3].match(/^\[([ xX])\]\s+(.*)$/);
        const koerper = [haken ? haken[2] : m[3]];
        i++;
        const rest = [];
        // Die Einzüge der Zeilen ausserhalb eines Codeblocks. Nur sie
        // bestimmen, wie weit der Körper ausgerückt wird: Eine Codezeile in
        // Spalte 0 liesse sonst den Zaun eingerückt stehen, und er würde
        // nicht mehr als Zaun erkannt.
        /** @type {number[]} */
        const einzuege = [];
        let imZaun = false;
        while (i < zeilen.length) {
          const l = zeilen[i];
          if (!imZaun && l.trim() === "") {
            // Leerzeilen gehören nur dazu, wenn danach wieder Eingerücktes
            // kommt. Sonst endet der Punkt vor ihnen.
            let j = i;
            while (j < zeilen.length && zeilen[j].trim() === "") j++;
            if (j === zeilen.length || einzugVon(zeilen[j]) <= einzug) break;
            for (; i < j; i++) rest.push("");
            continue;
          }
          // Eine Zeile ohne Einzug beendet den Punkt, auch ohne Leerzeile
          // davor. Im Codeblock gilt das nicht: Dort darf eine Zeile kürzer
          // eingerückt sein als der Punkt.
          if (!imZaun && einzugVon(l) <= einzug) break;
          const zaun = /^\s*```/.test(l);
          if (zaun || !imZaun) einzuege.push(einzugVon(l));
          if (zaun) imZaun = !imZaun;
          rest.push(l);
          i++;
        }
        const tiefe = einzuege.length ? Math.min(...einzuege) : 0;
        koerper.push(...rest.map((l) => l.slice(Math.min(tiefe, einzugVon(l)))));
        const punkt = rendern(koerper.join("\n"), true);
        fehler.push(...punkt.fehler);
        const klasse = haken ? ` class="aufgabe${haken[1] !== " " ? " erledigt" : ""}"` : "";
        punkte.push(`<li${klasse}>${punkt.html}</li>`);
        // Eine Leerzeile zwischen zwei Punkten beendet die Liste nicht.
        let j = i;
        while (j < zeilen.length && zeilen[j].trim() === "") j++;
        const naechster = (zeilen[j] || "").match(LISTENPUNKT);
        if (naechster && naechster[1].length === einzug && listenart(naechster[2]) === art) i = j;
      }
      aus.push(`<${art}>`, ...punkte, `</${art}>`);
      continue;
    }

    if (z.trim() === "") {
      i++;
      continue;
    }

    // Absatz
    // Bleibt der Absatz leer, steht hier eine Zeile, die wie ein Block
    // beginnt und keiner ist, etwa «|» ohne Tabellenkopf. Sie wird als Text
    // gesetzt. Bis zum 02.10.2026 fiel sie weg, ohne dass es jemand sah.
    const absatz = absatzAb();
    if (!absatz.length) absatz.push(zeilen[i++].trim());
    aus.push(`<p>${inline(absatz.join(" "))}</p>`);
  }
  return { html: aus.join("\n"), gliederung, fehler };
}

// ─── Seitengeruest ───────────────────────────────────────────────────────

const STIL = `
:root{--grund:#fff;--text:#1e293b;--matt:#64748b;--linie:#e2e8f0;--akzent:#0f766e;--kasten:#f8fafc}
@media (prefers-color-scheme:dark){:root{--grund:#0f172a;--text:#e2e8f0;--matt:#94a3b8;--linie:#1e293b;--akzent:#5eead4;--kasten:#1e293b}}
*{box-sizing:border-box}
body{margin:0;background:var(--grund);color:var(--text);font:16px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif}
.rahmen{display:flex;min-height:100vh;align-items:flex-start}
nav{width:280px;flex:0 0 280px;border-right:1px solid var(--linie);padding:1.5rem 1rem;position:sticky;top:0;max-height:100vh;overflow-y:auto}
nav h2{font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:var(--matt);margin:0 0 .75rem}
nav ol{list-style:none;margin:0;padding:0}
nav li{margin:.15rem 0}
nav a{display:block;padding:.35rem .5rem;border-radius:.375rem;color:var(--text);text-decoration:none;font-size:.9rem}
nav a:hover{background:var(--kasten)}
nav a.hier{background:var(--kasten);color:var(--akzent);font-weight:600}
nav .unter{margin-left:.6rem;border-left:1px solid var(--linie);padding-left:.4rem}
nav .unter a{font-size:.83rem;color:var(--matt)}
main{flex:1;min-width:0;padding:2rem clamp(1rem,4vw,3rem);max-width:56rem}
h1{font-size:1.9rem;line-height:1.2;margin:0 0 1.5rem}
h2{font-size:1.35rem;margin:2.5rem 0 .75rem;padding-top:.5rem;border-top:1px solid var(--linie)}
h3{font-size:1.1rem;margin:1.75rem 0 .5rem}
h4{font-size:1rem;margin:1.25rem 0 .5rem;color:var(--matt)}
a{color:var(--akzent)}
code{background:var(--kasten);padding:.1em .35em;border-radius:.25rem;font-size:.88em}
pre{background:var(--kasten);padding:1rem;border-radius:.5rem;overflow-x:auto}
pre code{background:none;padding:0}
blockquote{margin:1.25rem 0;padding:.75rem 1rem;border-left:3px solid var(--akzent);background:var(--kasten);border-radius:0 .375rem .375rem 0}
blockquote p:first-child{margin-top:0}blockquote p:last-child{margin-bottom:0}
.tabelle{overflow-x:auto;margin:1.25rem 0}
table{border-collapse:collapse;width:100%;font-size:.92rem}
th,td{border:1px solid var(--linie);padding:.5rem .7rem;text-align:left;vertical-align:top}
th{background:var(--kasten);font-weight:600}
dl{margin:1.25rem 0}
dt{font-weight:600;margin-top:1rem}
dd{margin:.25rem 0 0 1.25rem;color:var(--matt)}
hr{border:0;border-top:1px solid var(--linie);margin:2rem 0}
details.skizze{margin:1.25rem 0;border:1px solid var(--linie);border-radius:.5rem;padding:.5rem .75rem}
details.skizze summary{cursor:pointer;color:var(--matt);font-size:.9rem}
li.aufgabe{list-style:none;margin-left:-1.2rem}
li.aufgabe::before{content:"☐ ";color:var(--matt)}
li.aufgabe.erledigt::before{content:"☑ "}
li>p,li>blockquote,li>pre{margin:.5rem 0}
li>ul,li>ol{margin:.25rem 0}
.kopf{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;margin-bottom:2rem;padding-bottom:1rem;border-bottom:1px solid var(--linie)}
.kopf .name{font-weight:600}
.kopf a{font-size:.9rem}
@media (max-width:860px){.rahmen{flex-direction:column}nav{width:100%;flex:none;position:static;max-height:none;border-right:0;border-bottom:1px solid var(--linie)}}
`;

/**
 * @param {{
 *   titel: string,
 *   kopfTitel: string,
 *   kapitel: { datei: string, titel: string }[],
 *   aktuell: string,
 *   inhalt: string,
 *   gliederung: Gliederungspunkt[],
 *   zurueck: string,
 * }} teile
 */
function seite({ titel, kopfTitel, kapitel, aktuell, inhalt, gliederung, zurueck }) {
  const menue = kapitel
    .map((k) => {
      const hier = k.datei === aktuell;
      const unter =
        hier && gliederung.length
          ? `<ol class="unter">${gliederung
              .map((g) => `<li><a href="#${g.id}">${schuetzen(g.text)}</a></li>`)
              .join("")}</ol>`
          : "";
      return `<li><a class="${hier ? "hier" : ""}" href="${k.datei}.html">${schuetzen(k.titel)}</a>${unter}</li>`;
    })
    .join("");

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${schuetzen(titel)}</title>
<style>${STIL}</style>
</head>
<body>
<div class="rahmen">
<nav>
  <h2>${schuetzen(kopfTitel)}</h2>
  <ol>${menue}</ol>
</nav>
<main>
  <div class="kopf">
    <span class="name">${schuetzen(kopfTitel)}</span>
    <a href="${zurueck}">&larr; Zurück zur Anwendung</a>
  </div>
  ${inhalt}
</main>
</div>
</body>
</html>`;
}

// ─── Lauf ────────────────────────────────────────────────────────────────

/** @param {Einstellung} cfg */
function bauen(cfg) {
  const quelle = cfg.quellen.find((q) => existsSync(q));
  if (!quelle) {
    console.error(`handbuch-bauen: keine Quelle gefunden. Gesucht in:\n  ${cfg.quellen.join("\n  ")}`);
    process.exit(1);
  }
  // Mit `cfg.dateien` wird ausgewaehlt UND sortiert. Ohne sie kommt alles
  // mit, README zuerst. Die Auswahl braucht, wer neben dem Handbuch noch
  // interne Papiere im selben Ordner liegen hat — die gehoeren nicht in die
  // Anwendung, und ein Vergessen waere hier keine Panne, sondern eine
  // Veroeffentlichung.
  const dateien = cfg.dateien
    ? cfg.dateien.filter((f) => existsSync(join(quelle, f)))
    : readdirSync(quelle)
        .filter((f) => f.endsWith(".md"))
        .sort((a, b) => (a === "README.md" ? -1 : b === "README.md" ? 1 : a.localeCompare(b)));

  if (cfg.dateien) {
    const fehlend = cfg.dateien.filter((f) => !existsSync(join(quelle, f)));
    if (fehlend.length) {
      console.error(`handbuch-bauen: ausgewaehlte Datei(en) fehlen: ${fehlend.join(", ")}`);
      process.exit(1);
    }
  }

  if (!dateien.length) {
    console.error("handbuch-bauen: keine Markdown-Dateien gefunden");
    process.exit(1);
  }

  const kapitel = dateien.map((f) => {
    const roh = readFileSync(join(quelle, f), "utf8");
    const u1 = roh.match(/^#\s+(.*)$/m);
    return {
      datei: kapitelDatei(basename(f, ".md")),
      titel: (u1 ? u1[1] : basename(f, ".md")).replace(/^\d+\s*[—-]\s*/, ""),
      roh,
    };
  });

  BEKANNTE_KAPITEL = new Set(dateien.map((f) => basename(f, ".md")));

  if (!BETRIEBSANGABEN_HAUS) {
    console.warn(
      "handbuch-bauen: scripts/betriebsangaben-sperre.json fehlt (öffentlicher Stand); geprüft werden nur die allgemeinen Betriebsangaben."
    );
  }

  // Vor dem ersten Schreiben: Eine Quelle mit Betriebsangaben baut gar kein Handbuch.
  const betrieb = dateien.flatMap((f, i) =>
    betriebsangaben(kapitel[i].roh, f).map((b) => `${f}:${b.zeile}: «${b.treffer}», ${b.was}`)
  );
  if (betrieb.length) {
    console.error("handbuch-bauen: Betriebsangaben in einer Quelle des öffentlichen Handbuchs:");
    for (const b of betrieb) console.error(`  · ${b}`);
    console.error(
      "  Das Handbuch ist ohne Anmeldung lesbar. Den Satz kürzen oder in die Betriebsdoku verlegen;\n" +
        "  ist es Anleitung für den Selbstbetrieb, die Ausnahme in BETRIEBSANGABEN_AUSNAHMEN begründen."
    );
    process.exit(1);
  }

  rmSync(cfg.ziel, { recursive: true, force: true });
  mkdirSync(cfg.ziel, { recursive: true });

  const listenfehler = [];
  for (const k of kapitel) {
    const { html, gliederung, fehler } = rendern(k.roh);
    listenfehler.push(...fehler.map((f) => `${k.datei}: ${f}`));
    writeFileSync(
      join(cfg.ziel, `${k.datei}.html`),
      seite({
        titel: `${k.titel} — ${cfg.titel}`,
        kopfTitel: cfg.titel,
        kapitel,
        aktuell: k.datei,
        inhalt: html,
        gliederung,
        zurueck: cfg.zurueck || "/",
      })
    );
  }

  if (listenfehler.length) {
    console.error("handbuch-bauen: eine nummerierte Liste beginnt nicht bei 1 oder zählt nicht durch:");
    for (const f of listenfehler) console.error(`  · ${f}`);
    console.error(
      "  Häufige Ursachen: eine Zeile ohne Einzug mitten in der Liste, oder eine umbrochene\n" +
        "  Zeile, die zufällig mit «Zahl.» beginnt (dann den Umbruch verschieben)."
    );
    process.exit(1);
  }

  pruefeSprungziele(cfg);

  writeFileSync(join(cfg.ziel, "hilfe.json"), JSON.stringify(cfg.hilfe, null, 2));
  if (cfg.zuordnung) {
    mkdirSync(dirname(cfg.zuordnung), { recursive: true });
    writeFileSync(cfg.zuordnung, JSON.stringify(cfg.hilfe, null, 2) + "\n");
  }

  console.log(
    `handbuch-bauen: ${kapitel.length} Kapitel aus ${quelle} nach ${cfg.ziel}, ` +
      `${Object.keys(cfg.hilfe).length} Sprungziele geprueft`
  );
}

/**
 * Jedes Sprungziel der Seitenhilfe muss es geben.
 *
 * Die Anker werden aus den Ueberschriften gerechnet — wer eine Ueberschrift
 * umformuliert, aendert damit stillschweigend den Anker, und das «?» der
 * betroffenen Seite landet danach am Kapitelanfang statt an der Stelle. Zu
 * sehen ist das nirgends: Ein Sprung ins Leere sieht aus wie ein Kapitel, das
 * eben oben beginnt. Deshalb bricht der Bau ab, statt es durchzulassen.
 *
 * Geprueft wird gegen das eben erzeugte HTML, nicht gegen die Markdown-Quelle:
 * Was zaehlt, ist der Anker, den der Browser findet.
 */
/** @param {Einstellung} cfg */
function pruefeSprungziele(cfg) {
  const fehler = [];

  // Auch die Verweise INNERHALB der Kapitel. Dieselbe Fehlerklasse wie bei
  // der Seitenhilfe: Der Anker wird aus der Ueberschrift gerechnet, und die
  // Umlautbehandlung macht aus «GeBüV-Export» den Anker `gebuv-export` —
  // wer im Text `#gebuev-export` schreibt, springt ins Leere, ohne dass
  // irgendwo etwas rot wird. Genau so am 17.08.2026 zweimal passiert.
  const dateien = readdirSync(cfg.ziel).filter((f) => f.endsWith(".html"));
  const ankerJeDatei = new Map(
    dateien.map((d) => [
      d,
      new Set([...readFileSync(join(cfg.ziel, d), "utf8").matchAll(/id="([^"]+)"/g)].map((m) => m[1])),
    ])
  );

  for (const datei of dateien) {
    const html = readFileSync(join(cfg.ziel, datei), "utf8");
    const eigene = ankerJeDatei.get(datei) ?? new Set();

    // Innerhalb der Seite
    for (const [, ziel] of html.matchAll(/href="#([^"]+)"/g)) {
      if (!eigene.has(ziel)) fehler.push(`${datei}: Verweis auf #${ziel} findet keinen Anker`);
    }

    // UND ueber Kapitelgrenzen. Das Review vom 17.08.2026 hat gezeigt, dass
    // die erste Fassung nur seiteninterne Verweise sah — waehrend drei
    // kapitelueber greifende laengst kaputt waren, alle mit Umlaut im Anker.
    // Eine Pruefung, die die halbe Klasse abdeckt, ist gefaehrlicher als
    // keine: Sie erzeugt Vertrauen.
    // Der Anker ist ABSICHTLICH freigestellt: Ein Verweis auf ein Kapitel, das
    // es nicht gibt, ist dieselbe 404, ob mit Anker oder ohne. Die erste
    // Fassung verlangte ein `#` und sah die ankerlose Form nicht.
    //
    // **Was diese Pruefung NICHT sieht** — damit der naechste sich nicht auf
    // mehr verlaesst, als hier steht: Ein vertippter DATEIname wird von
    // `inline()` weiter oben zu Fliesstext gemacht und kommt nie als `href`
    // hier an. Und Ziele mit Pfad oder anderer Schreibweise (`./README.md`,
    // `docs/README.md`, `README.MD`) trifft `^([\w.-]+)\.md` gar nicht erst —
    // sie gehen woertlich ins HTML und enden im Browser als 404. Beides ist
    // Altbestand, beides kommt im heutigen Bestand nicht vor.
    for (const [, zielDatei, zielAnker] of html.matchAll(/href="([\w.-]+\.html)(?:#([^"]+))?"/g)) {
      const anker = ankerJeDatei.get(zielDatei);
      if (!anker) {
        fehler.push(`${datei}: Verweis auf ${zielDatei} — dieses Kapitel gibt es nicht`);
      } else if (zielAnker && !anker.has(zielAnker)) {
        fehler.push(`${datei}: Verweis auf ${zielDatei}#${zielAnker} findet keinen Anker`);
      }
    }
  }
  for (const [pfad, stelle] of Object.entries(cfg.hilfe || {})) {
    const [datei, anker] = stelle;
    const ziel = join(cfg.ziel, `${datei}.html`);
    if (!existsSync(ziel)) {
      fehler.push(`${pfad}: Kapitel ${datei}.html gibt es nicht`);
      continue;
    }
    if (anker && !readFileSync(ziel, "utf8").includes(`id="${anker}"`)) {
      fehler.push(`${pfad}: ${datei}.html hat keinen Anker #${anker}`);
    }
  }
  if (fehler.length) {
    console.error("handbuch-bauen: Sprungziele der Seitenhilfe gehen ins Leere —");
    for (const f of fehler) console.error(`  · ${f}`);
    process.exit(1);
  }
}

// Nur beim direkten Aufruf bauen. Die Probe unter tests/waechter/ holt sich
// `rendern`, und ein Import darf static/handbuch nicht neu schreiben.
// Verglichen wird der aufgelöste Pfad: Über einen Symlink aufgerufen, wären
// die beiden sonst verschieden, und der Bau liefe still nicht, mit Exit 0.
const aufruf = process.argv[1];
if (aufruf && existsSync(aufruf) && realpathSync(aufruf) === realpathSync(fileURLToPath(import.meta.url))) bauen(CONFIG);
