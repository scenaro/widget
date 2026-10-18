#!/usr/bin/env bash
set -euo pipefail

if curl -s -o /dev/null --max-time 1 http://127.0.0.1:5173/; then
  echo "widget dev server already listening on 5173"
  exit 0
fi

exec npm run dev -- --host 0.0.0.0 --port 5173
