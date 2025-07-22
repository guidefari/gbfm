#! /bin/bash

curl -X POST https://openapi.guidefari.dev.goosebumps.fm/spotify/album \
  -H "Content-Type: application/json" \
  -d '{"id": "2ya7uWxjoKUFuvqwX5edQX"}' | jq .

