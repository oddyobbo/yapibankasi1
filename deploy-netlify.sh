#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
exec netlify deploy --prod --dir=.
