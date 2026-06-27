#!/usr/bin/env bash
# Core of the `register-peer` composite action. Runs in the CONSUMER's checkout: it reads the
# consumer's OWN Atlas identity (atlas.yml) and published fingerprint (keys/atlas.fpr), then
# opens a consent PR that lists THAT Atlas as a peer of PEER_REPO — signed with the consumer's
# own peer-signer key. The bundled bin/register-atlas is the CODE; the identity is the
# consumer's DATA. (Mirrors the code-vs-data split tell's register action makes.)
#
# Inputs arrive as env (set by action.yml):
#   PEER_REPO         the peer Atlas to register with (required; never self)
#   GH_TOKEN          Contents+PR write on the peer (blank => print the entry to paste)
#   ATLAS_SIGNER_KEY  ssh private peer-signer key (blank => unsigned, with a warning)
#   ATLAS_YML         identity path in the workspace (default atlas.yml)
#   ATLAS_FPR_FILE    fingerprint path in the workspace (default keys/atlas.fpr)
#   ATLAS_BIN         dir holding the bundled register-atlas script (defaults to this action's)
set -euo pipefail

action_dir="$(cd "$(dirname "$0")" && pwd)"
REG="${ATLAS_BIN:-$action_dir/../../../bin}/register-atlas"
[ -x "$REG" ] || { echo "::error::register-atlas code not found at $REG"; exit 1; }

# DATA resolves to the CALLING repo's workspace (this step's CWD) — never the action's checkout.
# Fail closed if the consumer has no identity of their own: better to stop than to silently
# register the bundled template's Atlas.
: "${ATLAS_YML:=atlas.yml}"; : "${ATLAS_FPR_FILE:=keys/atlas.fpr}"
[ -f "$ATLAS_YML" ] || { echo "::error::no Atlas identity at '$ATLAS_YML' in the calling repo — add your own atlas.yml; refusing to register another Atlas's identity"; exit 1; }
[ -f "$ATLAS_FPR_FILE" ] || { echo "::error::no signer fingerprint at '$ATLAS_FPR_FILE' — run bin/atlas-bootstrap and commit keys/atlas.fpr"; exit 1; }
[ -n "${PEER_REPO:-}" ] || { echo "::error::peer input required (the peer Atlas to register with) — peering is never self"; exit 1; }
export ATLAS_YML ATLAS_FPR_FILE PEER_REPO

umask 077
if [ -n "${ATLAS_SIGNER_KEY:-}" ]; then
  keyf="$(mktemp)"
  printf '%s\n' "$ATLAS_SIGNER_KEY" > "$keyf"
  trap 'shred -u "$keyf" 2>/dev/null || rm -f "$keyf"' EXIT
  export ATLAS_SIGNER_KEY_FILE="$keyf"
else
  echo "::warning::no signer-key — the peer-registration commit can't be signed; the ownership claim won't verify against $(cat "$ATLAS_FPR_FILE")"
fi

# `pr` prints the entry to paste when GH_TOKEN is blank, or opens the signed PR otherwise.
"$REG" pr
