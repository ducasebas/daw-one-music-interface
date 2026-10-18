#!/bin/bash
set -euo pipefail
curl --fail --silent --max-time 5 http://127.0.0.1:3001/api/health | node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{const h=JSON.parse(s);console.log(JSON.stringify(h));if(!h.ok||!["simulation","music-assistant"].includes(h.mode))process.exit(1)})'
