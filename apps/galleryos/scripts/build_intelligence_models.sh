#!/bin/bash
# GalleryOS: one-time preparation of the on-device models for People and sentence search.
# Run from anywhere:  bash ~/apple-style-app/apps/galleryos/scripts/build_intelligence_models.sh
# Needs Xcode and about 3 GB of free space while it works; the result is ~110 MB.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$HOME/Library/Caches/GalleryOS-models"
DEST="$ROOT/GalleryOS/Resources/Models"
mkdir -p "$WORK" "$DEST"

PY=/usr/bin/python3
if ! "$PY" -c 'import sys; assert (3, 9) <= sys.version_info[:2] <= (3, 12)' 2>/dev/null; then
  for candidate in python3.12 python3.11 python3.10 python3; do
    if command -v "$candidate" >/dev/null && "$candidate" -c 'import sys; assert (3, 9) <= sys.version_info[:2] <= (3, 12)' 2>/dev/null; then
      PY="$(command -v "$candidate")"; break
    fi
  done
fi
echo "Python: $("$PY" --version)"

if [ ! -x "$WORK/env/bin/python" ]; then
  echo "Tworzę osobne środowisko (nie zmienia systemu)…"
  "$PY" -m venv "$WORK/env"
fi
"$WORK/env/bin/python" -m pip install --quiet --upgrade pip
echo "Instaluję narzędzia Apple Core ML i PyTorch (raz, ok. 1 GB)…"
"$WORK/env/bin/python" -m pip install --quiet \
  "numpy==1.26.4" "torch==2.4.1" "torchvision==0.19.1" "coremltools==8.1" \
  "scikit-learn==1.5.2" "onnx==1.16.2" "onnx2torch==1.5.15" "open_clip_torch==2.26.1" "pillow"

SFACE="$WORK/face_recognition_sface_2021dec.onnx"
if [ ! -s "$SFACE" ]; then
  echo "Pobieram model twarzy SFace (OpenCV Zoo, Apache 2.0)…"
  curl -fL --retry 3 -o "$SFACE" \
    "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"
fi

rm -rf "$WORK/out"
"$WORK/env/bin/python" "$ROOT/scripts/convert_models.py" "$WORK/out" "$SFACE"

echo "Kompiluję dla iPhone'a i iPada…"
for name in GalleryFace GalleryCLIPImage GalleryCLIPText; do
  rm -rf "$DEST/$name.mlmodelc"
  xcrun coremlcompiler compile "$WORK/out/$name.mlpackage" "$DEST" >/dev/null
done

echo ""
du -sh "$DEST"/*.mlmodelc
echo ""
echo "Modele są w GalleryOS/Resources/Models. Zbuduj aplikację w Xcode."
