#!/usr/bin/env bash
#
# Richtet die Git-Hooks dieses Projekts ein.
#
# **Warum ein eigener Ort.** Hooks liegen normalerweise unter `.git/hooks` und
# werden damit **nicht** mitversioniert — jede neue Arbeitskopie stünde ohne da,
# und niemand merkte es. Hier liegen sie im Repository, und `core.hooksPath`
# zeigt darauf.
#
# Einmal je Arbeitskopie aufzurufen:
#
#   ./scripts/hooks-einrichten.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath scripts/git-hooks
echo "Eingerichtet: $(git config core.hooksPath)"
echo "Vor jedem Commit läuft nun «npm run pruefen» im Container."
echo "Wieder lösen:  git config --unset core.hooksPath"
