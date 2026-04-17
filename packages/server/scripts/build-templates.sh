#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="$SCRIPT_DIR/../docker/templates"

echo "Building Docker template images..."

build_template() {
  local template=$1
  local template_dir="$TEMPLATES_DIR/$template"
  local image_name="code-link-$template:latest"

  echo "Building $template template..."
  docker build -t "$image_name" "$template_dir"
  echo "✓ $image_name built successfully"
}

# 构建所有模板
build_template "node"
build_template "node+java"
build_template "node+python"

echo "All template images built successfully!"
