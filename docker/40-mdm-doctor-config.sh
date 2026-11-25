#!/bin/sh
# MDM Doctor: schreibt beim Containerstart die Laufzeit-Konfiguration (config.js) aus den
# Umgebungsvariablen. So lässt sich ein fertiges Image (ghcr.io) ohne eigenen Build betreiben.
# Läuft über den Einstiegspunkt des nginx-Images (/docker-entrypoint.d/).
#
# Erlaubt sind nur streng geprüfte Werte (GUID, Domain, URL, Zahl); alles andere bricht den Start
# ab, damit nie beliebiger Text in ein ausgeführtes Skript gelangt.
set -eu

TARGET="${MDM_DOCTOR_CONFIG_PATH:-/usr/share/nginx/html/config.js}"
GUID='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
DOMAIN='^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$'
NL='
'
URL='^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?(/[A-Za-z0-9._~/-]*)?$'

fail() {
  echo "mdm-doctor: $1 ist ungültig – Container wird nicht gestartet." >&2
  exit 1
}

# check NAME REGEX…: leer ist immer erlaubt (dann gilt der Build-Wert bzw. der Standard).
check() {
  name="$1"
  shift
  eval "value=\${$name:-}"
  [ -z "$value" ] && return 0
  # grep prüft zeilenweise – mehrzeilige Werte deshalb vorab ablehnen.
  case "$value" in *"$NL"*) fail "$name" ;; esac
  for pattern in "$@"; do
    printf '%s' "$value" | grep -Eq "$pattern" && return 0
  done
  fail "$name"
}

check VITE_APP_MODE '^(demo|live)$'
check VITE_MSAL_CLIENT_ID "$GUID"
check VITE_MSAL_TENANT_ID "$GUID" "$DOMAIN"
check VITE_MSAL_REDIRECT_URI "$URL"
check VITE_IDLE_TIMEOUT_MINUTES '^[0-9]{1,4}$'

{
  echo '// Erzeugt beim Containerstart (docker/40-mdm-doctor-config.sh).'
  echo 'window.__MDM_DOCTOR_CONFIG__ = {'
  for name in VITE_APP_MODE VITE_MSAL_CLIENT_ID VITE_MSAL_TENANT_ID VITE_MSAL_REDIRECT_URI VITE_IDLE_TIMEOUT_MINUTES; do
    eval "value=\${$name:-}"
    [ -n "$value" ] && echo "  $name: \"$value\","
  done
  echo '};'
} > "$TARGET"

echo "mdm-doctor: Laufzeit-Konfiguration geschrieben ($TARGET)."
