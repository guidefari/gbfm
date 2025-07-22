#! /bin/bash

curl -X GET https://api.local.staging.goosebumps.fm/rss \
  -H "Content-Type: application/json" | jq .