#! /bin/bash

curl -X POST https://openapi.guidefari.dev.goosebumps.fm/spotify/playlist \
  -H "Content-Type: application/json" \
  -d '{"id": "1QWp1dZFkp1FR9e4w0THxW"}' | jq .

