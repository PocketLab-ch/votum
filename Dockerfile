# Ein Bauartefakt für alle Umgebungen (AD-18): Entwicklung, Server und das
# Notebook im Versammlungsraum. Unterschiede liegen ausschliesslich in den
# Umgebungsvariablen.

FROM node:24-alpine AS bau
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Der Schichtenwächter läuft im Bau: Ein Verstoss gegen AD-1 bricht ihn ab.
RUN npm run build

FROM node:24-alpine AS laufzeit
WORKDIR /app
ENV NODE_ENV=production

# Die Anwendung läuft nicht als root.
RUN addgroup -S versammlung && adduser -S versammlung -G versammlung

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=bau /app/build ./build
COPY migrations ./migrations
COPY src/lib/server/migrate.ts ./src/lib/server/migrate.ts

# **Die Schriften für jedes PDF** (15.10.2026, beim Nachziehen des Betriebs
# gefunden, Auftrag M6). Vite bündelt sie nicht; `src/lib/server/pdf/basis.ts`
# liest sie zur Laufzeit und sucht dafür unter anderem in `/app/schriften`.
# Bis hierher kopierte das Abbild sie nirgendwohin: Versiegeln endete am
# Betrieb mit 500, und ebenso jedes andere PDF. Kein Prüflauf sah es, weil
# alle im Dev-Container laufen, wo `src/` neben dem gebauten Stand liegt.
COPY src/lib/server/pdf/schriften ./schriften

# **Das Skript für das erste Konto gehört ins Abbild** (11.09.2026, beim ersten
# Lauf von `scripts/einrichten.sh` gefunden).
#
# Ohne Konto kommt niemand in die Anwendung, und eine Selbstregistrierung gibt
# es bewusst nicht — jede frische Installation braucht diesen einen Aufruf.
# `docs/installation.md` beschrieb dafür einen Umweg über ein zweites
# `node:24-alpine` mit eingehängtem Arbeitsverzeichnis. Der setzt voraus, dass
# auf dem Wirt ein ausgepacktes `node_modules` liegt; auf einem frisch
# aufgesetzten Rechner liegt es nicht, und `argon2` bringt eine native Erweiterung
# mit, die sich nicht eben schnell nachinstallieren lässt.
#
# Hier ist beides schon da: `npm ci --omit=dev` eine Schicht darüber hat
# `postgres` und `argon2` gebaut. Vier Kilobyte, die eine ganze
# Installationsanleitung überflüssig machen.
COPY scripts/benutzer-anlegen.mjs ./scripts/benutzer-anlegen.mjs

# Die Dateiablage schon im Abbild anlegen, und zwar der Anwendung gehörend.
#
# Nicht der Ordnung halber: Ein frisch angelegter benannter Datenträger
# übernimmt Inhalt **und** Eigentümer aus dem Abbild. Fehlt das Verzeichnis
# hier, gehört der Einhängepunkt root, und die Anwendung — die bewusst nicht als
# root läuft — kann keine einzige Datei ablegen. Sichtbar wird das erst beim
# ersten Hochladen im Betrieb, also spät.
RUN mkdir -p /daten/dateien && chown -R versammlung:versammlung /daten
ENV VERSAMMLUNG_DATEIEN=/daten/dateien

USER versammlung
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
	CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "build"]
