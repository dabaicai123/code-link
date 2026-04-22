#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="$SCRIPT_DIR/../docker/templates"

echo "Building Docker template images..."

build_template() {
  local template=$1
  local image_name
  case "$template" in
    node)       image_name="code-link-node:latest" ;;
    node+java)  image_name="code-link-node-java:latest" ;;
    node+python) image_name="code-link-node-python:latest" ;;
    *)          image_name="code-link-$template:latest" ;;
  esac

  echo "Building $template template..."
  docker build -t "$image_name" -f "$TEMPLATES_DIR/$template/Dockerfile" "$TEMPLATES_DIR"
  echo "✓ $image_name built successfully"
}

# 构建所有模板
build_template "node"
build_template "node+java"
build_template "node+python"

echo "All template images built successfully!"
