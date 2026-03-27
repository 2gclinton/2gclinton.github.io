#!/bin/bash
export PATH="/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")"

# Kill any existing instance
lsof -ti:9000 | xargs kill -9 2>/dev/null
sleep 0.5

echo "Starting Blog Manager..."
node server.js &
SERVER_PID=$!

# Wait for server
for i in {1..20}; do
  curl -s http://localhost:9000 > /dev/null 2>&1 && break
  sleep 0.5
done

echo "Blog Manager running at http://localhost:9000"
echo "Press Ctrl+C to stop."
echo ""
open http://localhost:9000

# Kill server when this script exits
trap "kill $SERVER_PID 2>/dev/null; echo 'Server stopped.'" EXIT
wait $SERVER_PID
