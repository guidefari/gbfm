#! /bin/bash

curl -X GET https://api.local.staging.goosebumps.fm/content?type=mix \
  -H "Content-Type: application/json" | jq .