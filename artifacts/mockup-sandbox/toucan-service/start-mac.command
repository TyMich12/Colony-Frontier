#!/bin/zsh
set -e
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required. Install Python 3.11 or newer, then run this file again."
  read -k 1 "?Press any key to close..."
  exit 1
fi

if [ ! -d .venv ]; then
  python3 -m venv .venv
  source .venv/bin/activate
  python -m pip install --upgrade pip
  python -m pip install -r requirements.txt
else
  source .venv/bin/activate
fi

echo "Starting local Toucan service. The first launch downloads approximately 2.35 GB."
python -m uvicorn server:app --host 127.0.0.1 --port 8765
