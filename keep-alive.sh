#!/bin/bash
# NarrativeScope server keep-alive
# Checks if server is running, restarts if not

if ! curl -s http://localhost:3456/ > /dev/null 2>&1; then
  echo "$(date): NarrativeScope server down, restarting..."
  cd /opt/tessa
  nohup bun narrative-scope/serve.ts >> /opt/tessa/narrative-scope/server.log 2>&1 &
  echo "$(date): Restarted with PID $!"
fi
