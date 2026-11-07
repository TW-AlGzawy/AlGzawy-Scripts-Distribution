#!/usr/bin/env bash
# TW-AlGzawy-Auto — deploy reviewed PR #19 strict outgoing-command match and accuracy reporting to the existing Hetzner Runner.
# No schema reset, no git reset/clean, no .env rewrite, no tunnel restart. Operator has tested troop recall.
set -Eeuo pipefail
EXPECTED_SHA='c2f17cad00812cbb326a68ff5eb81ccc75a02d18'
BACKUPS='/root/tw-algzawy-production-backups'
trap 'echo "DEPLOY FAILED near line ${LINENO}. Inspect output; never reset the data directory." >&2' ERR

repos=()
while IFS= read -r compose_file; do
  candidate="$(dirname "$(dirname "$compose_file")")"
  remote="$(git -C "$candidate" remote get-url origin 2>/dev/null || true)"
  case "$remote" in
    *TW-AlGzawy/TW-AlGzawy-Auto*) repos+=("$candidate") ;;
  esac
done < <(find /root /opt /srv /home /var/www /app -maxdepth 7 -type f -path '*/runner/docker-compose.yml' -print 2>/dev/null || true)

if (( ${#repos[@]} != 1 )); then
  printf 'Expected exactly one authenticated TW-AlGzawy-Auto deployment; found %s. Stopping.\n' "${#repos[@]}" >&2
  exit 2
fi
repo="${repos[0]}"
cd "$repo"

if [[ "$(git branch --show-current)" != 'main' ]]; then
  echo 'Current checkout is not main. Stopping rather than switching a production branch.' >&2
  exit 2
fi
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo 'Tracked production files have local changes. Stopping to protect them.' >&2
  exit 2
fi
if [[ ! -f runner/.env || ! -d runner/data ]]; then
  echo 'Required runner/.env or runner/data is missing. Stopping.' >&2
  exit 2
fi
# The owner has confirmed live troop recall. Keep the exact .env unchanged, including TROOPS_RECALL=1.
echo 'Preserving existing .env and TROOPS_RECALL setting without modification.'
command -v docker >/dev/null || { echo 'Docker is missing' >&2; exit 2; }
docker compose version >/dev/null

echo 'Fetching the reviewed production commit...'
git fetch origin main
if [[ "$(git rev-parse origin/main)" != "$EXPECTED_SHA" ]]; then
  echo 'Remote main changed after review. Stopping to avoid deploying unreviewed changes.' >&2
  exit 2
fi
previous_sha="$(git rev-parse HEAD)"
mkdir -p -m 700 "$BACKUPS"
chmod 700 "$BACKUPS"
backup="$BACKUPS/runner-before-send-v6-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
echo 'Creating restricted backup of runner/.env and runner/data...'
tar -czf "$backup" -C "$repo/runner" .env data
chmod 600 "$backup"

echo "Backup created: $backup"
echo "Previous checkout: $previous_sha"
echo 'Fast-forwarding production checkout...'
git merge --ff-only origin/main
cd runner
docker compose config --quiet

# Refuse container restart when any send is already being prepared or armed.
# Uses existing authenticated localhost API; never prints RUNNER_TOKEN.
check_send_tabs() {
  if ! docker compose ps --status running --services | grep -qx 'runner'; then
    echo 'No running Runner container detected: no live send tabs to inspect.'
    return 0
  fi
  docker compose exec -T runner node -e '
const http=require("node:http");
const tok=process.env.RUNNER_TOKEN, port=Number(process.env.PORT||8787);
if(!tok){console.error("Cannot verify scheduled sends: missing RUNNER_TOKEN");process.exit(2)}
function get(path){
 return new Promise((resolve,reject)=>{
  const req=http.get({hostname:"127.0.0.1",port,path,headers:{authorization:"Bearer "+tok},timeout:5000},res=>{
   let txt="";res.on("data",c=>{txt+=c;if(txt.length>1e6)req.destroy(Error("Response too large"))});
   res.on("end",()=>{if(res.statusCode!==200)return reject(Error("API status "+res.statusCode));try{resolve(JSON.parse(txt))}catch(e){reject(e)}});
  });req.on("timeout",()=>req.destroy(Error("API timeout")));req.on("error",reject);
 });
}
(async()=>{
 const list=await get("/sessions");
 if(!Array.isArray(list.sessions))throw Error("Unexpected sessions response");
 for(const item of list.sessions){
  // Check all sessions: summary.scripts lists open tabs, not every configured future job.
  const info=await get("/sessions/"+encodeURIComponent(item.id));
  if(!Array.isArray(info.tabs))throw Error("Unexpected bot state");
  if(info.tabs.some(t=>String(t.id||"").startsWith("send:") || (t.script==="send-automation" && t.armed))){
   console.error("DEPLOY BLOCKED: an active/armed scheduled-send tab exists; run after your scheduled attacks finish.");
   process.exitCode=15;return;
  }
 }
 console.log("Preflight: no open precise-send tabs were found.");
})().catch(e=>{console.error("Cannot safely verify scheduled sends:",e.message);process.exitCode=14});
'
}

check_send_tabs

echo 'Building updated runner while the existing container is still running...'
docker compose build runner

# Check again after image build: a scheduled send could have been armed in the meantime.
check_send_tabs

echo 'Recreating runner container; tunnel service is not changed...'
docker compose up -d --no-deps runner

echo 'Checking container and local runner health...'
docker compose ps runner
docker compose exec -T runner node -e '
const http=require("node:http");
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const port=Number(process.env.PORT||8787);
function check(){
 return new Promise((resolve,reject)=>{
  const req=http.get({hostname:"127.0.0.1",port,path:"/health",timeout:2500},res=>{
   let str="";
   res.on("data",chunk=>{str+=chunk;if(str.length>8192)req.destroy(Error("Health response too large"));});
   res.on("end",()=>{try{resolve({status:res.statusCode,body:JSON.parse(str)})}catch(e){reject(Error("Health JSON invalid"))}});
  });
  req.on("timeout",()=>req.destroy(Error("Health timeout")));
  req.on("error",reject);
 });
}
(async()=>{
 let last="starting";
 for(let i=0;i<75;i++){
  try{
   const result=await check();
   if(result.body?.restore==="blocked"){
    console.error("Recovery is BLOCKED. Preserve running.bin and inspect Runner logs.");
    process.exitCode=2;return;
   }
   if(result.status===200&&result.body?.ok===true&&result.body?.restore==="ready"){
    console.log("Runner health:",JSON.stringify(result.body));return;
   }
   last="HTTP "+result.status+" restore="+String(result.body?.restore||"unknown");
  }catch(e){last=e.message}
  await delay(2000);
 }
 console.error("Health verification did not reach ready state:",last);
 process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1});
'
echo "Done. Commit: $(git -C "$repo" rev-parse HEAD)"
echo "Recovery backup (contains secrets — keep private): $backup"
