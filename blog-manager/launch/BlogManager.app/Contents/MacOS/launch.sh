#!/bin/bash

# Resolve the blog-manager directory (two levels up from MacOS/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BLOG_MANAGER_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

cd "$BLOG_MANAGER_DIR" || exit 1

# Kill any existing instance on port 9000
lsof -ti:9000 | xargs kill -9 2>/dev/null

# Start the server
node server.js &
SERVER_PID=$!

# Wait for server to be ready
for i in {1..10}; do
  curl -s http://localhost:9000 > /dev/null 2>&1 && break
  sleep 0.5
done

# Open browser
open http://localhost:9000

# Wait for the server process — keeps the app "running" in the dock
wait $SERVER_PID
