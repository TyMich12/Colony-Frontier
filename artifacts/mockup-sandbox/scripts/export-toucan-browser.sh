#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/public/models"
TEMP_DIR="$(mktemp -d)"
TRANSFORMERS_JS_DIR="$TEMP_DIR/transformers.js"

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is needed only for this one-time model conversion." >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "Git is required to download the Transformers.js conversion tools." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "Downloading the Transformers.js v3 conversion tools..."
git clone --depth 1 --branch v3 https://github.com/huggingface/transformers.js.git "$TRANSFORMERS_JS_DIR"

python3 -m venv "$TEMP_DIR/venv"
# shellcheck disable=SC1091
source "$TEMP_DIR/venv/bin/activate"
python -m pip install --upgrade pip
python -m pip install -r "$TRANSFORMERS_JS_DIR/scripts/requirements.txt"

echo "Exporting Toucan to ONNX and creating fp16/q8 variants."
echo "This is a one-time preparation step; the game itself will not run Python."
cd "$TRANSFORMERS_JS_DIR"
python -m scripts.convert \
  --model_id UBC-NLP/toucan-base \
  --output_parent_dir "$OUTPUT_DIR" \
  --task text2text-generation-with-past \
  --quantize \
  --modes fp16 q8

echo
echo "Toucan browser model export finished."
echo "Expected model folder: $OUTPUT_DIR/UBC-NLP/toucan-base"
echo "Keep the generated model files out of source control if your repository has a size limit."
