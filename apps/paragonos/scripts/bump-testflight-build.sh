#!/bin/bash
set -euo pipefail
cd "${PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
xcrun agvtool next-version -all
