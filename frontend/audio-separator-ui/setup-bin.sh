#!/bin/bash
BIN_DIR="$(dirname "$0")/node_modules/.bin"
mkdir -p "$BIN_DIR"

create_wrapper() {
  local name="$1"
  local target="$2"
  cat > "$BIN_DIR/$name" << WRAPPER
#!/bin/sh
exec node "\$(dirname "\$0")/$target" "\$@"
WRAPPER
  chmod +x "$BIN_DIR/$name"
}

create_wrapper "tsc" "../typescript/bin/tsc"
create_wrapper "vite" "../vite/bin/vite.js"
create_wrapper "eslint" "../eslint/bin/eslint.js"
create_wrapper "electron" "../electron/cli.js"
create_wrapper "electron-builder" "../electron-builder/out/cli/cli.js"

echo "Frontend binary wrappers created in $BIN_DIR"
