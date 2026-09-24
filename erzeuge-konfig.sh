#!/bin/sh
# Schreibt konfig.js aus den Netlify-Umgebungsvariablen.
# Wird nur beim Bauen auf Netlify ausgefuehrt - lokal legt man
# konfig.js von Hand an (Vorlage: konfig.beispiel.js).

set -e

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_PUBLISHABLE_KEY" ]; then
  echo "FEHLER: SUPABASE_URL oder SUPABASE_PUBLISHABLE_KEY fehlt."
  echo "Bitte in Netlify unter Site settings -> Environment variables eintragen."
  exit 1
fi

cat > konfig.js <<KONFIG
// Automatisch erzeugt beim Bauen - nicht von Hand aendern.
window.KONFIG = {
  supabaseUrl: "$SUPABASE_URL",
  supabaseSchluessel: "$SUPABASE_PUBLISHABLE_KEY",
};
KONFIG

echo "konfig.js erzeugt."
