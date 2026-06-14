#!/usr/bin/env bash
set -euo pipefail

REPO="guidefari/gbfm"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

detect_target() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Linux)  os="linux" ;;
    Darwin) os="darwin" ;;
    *) echo "error: unsupported OS: $os" >&2; exit 1 ;;
  esac

  case "$arch" in
    x86_64|amd64)  arch="x86_64" ;;
    aarch64|arm64) arch="aarch64" ;;
    *) echo "error: unsupported architecture: $arch" >&2; exit 1 ;;
  esac

  echo "process-mix-${os}-${arch}"
}

get_latest_url() {
  local target="$1"
  curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep -o "\"browser_download_url\": \"[^\"]*${target}[^\"]*\"" \
    | head -1 \
    | cut -d'"' -f4
}

main() {
  local target
  target="$(detect_target)"
  echo "detected target: ${target}"

  local url
  url="$(get_latest_url "$target")"
  if [ -z "$url" ]; then
    echo "error: no release asset found for ${target}" >&2
    exit 1
  fi

  echo "downloading ${url}"
  curl -fsSL "$url" -o "${TMP_DIR}/release.tar.gz"

  echo "extracting"
  tar -xzf "${TMP_DIR}/release.tar.gz" -C "${TMP_DIR}"

  mkdir -p "$INSTALL_DIR"
  mv "${TMP_DIR}/process-mix" "${INSTALL_DIR}/process-mix"
  chmod +x "${INSTALL_DIR}/process-mix"
  mv "${TMP_DIR}/intro.wav" "${INSTALL_DIR}/intro.wav"

  echo "installed process-mix to ${INSTALL_DIR}/process-mix"
  echo "installed intro.wav to ${INSTALL_DIR}/intro.wav"

  if ! command -v process-mix &>/dev/null; then
    echo ""
    echo "add ${INSTALL_DIR} to your PATH:"
    echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
  fi
}

main
