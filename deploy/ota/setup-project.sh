#!/usr/bin/env bash
# One-time project setup, run on the owner's Mac. Private material never printed.
set -euo pipefail
umask 077
repo='ducasebas/daw-one-music-interface'
key_dir="${TUNEBOX_OTA_KEY_DIR:-$HOME/.config/tunebox/ota}"
device="${1:?Usage: setup-project.sh SSH_USER@PI_HOST}"
private_key="$key_dir/private.pem"
public_key="$key_dir/public.pem"

for executable in node gh scp; do
  if ! command -v "$executable" >/dev/null 2>&1; then
    printf 'Missing: %s. On a Mac with Homebrew: brew install gh node\n' "$executable" >&2
    exit 1
  fi
done
node -e 'if(Number(process.versions.node.split(".")[0])<22)throw Error("Use Node.js 22 or newer")'

if ! gh auth status --hostname github.com >/dev/null 2>&1; then
  gh auth login --hostname github.com --git-protocol https --web
fi
secret_exists=$(gh secret list --repo "$repo" --json name --jq 'any(.[]; .name == "TUNEBOX_OTA_SIGNING_KEY")')
if [[ "$secret_exists" == true && ! -f "$private_key" ]]; then
  printf '%s\n' 'GitHub already has an OTA signing secret, but this local key is missing.' >&2
  printf '%s\n' 'Stop here: recover the existing private key; do not generate a replacement.' >&2
  printf 'Set TUNEBOX_OTA_KEY_DIR to the directory containing that private.pem and retry.\n' >&2
  exit 2
fi

node --input-type=module - "$key_dir" <<'JS'
import {mkdirSync,existsSync,readFileSync,writeFileSync,chmodSync,lstatSync} from 'node:fs';
import {join} from 'node:path';
import {generateKeyPairSync,createPrivateKey,createPublicKey,createHash} from 'node:crypto';
const dir=process.argv[2],secret=join(dir,'private.pem'),pub=join(dir,'public.pem');
mkdirSync(dir,{recursive:true,mode:0o700});
if(lstatSync(dir).isSymbolicLink())throw Error('Use a private real key directory, not a symlink');
chmodSync(dir,0o700);
for(const p of [secret,pub])if(existsSync(p)&&lstatSync(p).isSymbolicLink())throw Error('Key files must not be symlinks');
let key;
if(existsSync(secret)){
  key=createPrivateKey(readFileSync(secret));
}else{
  if(existsSync(pub))throw Error('Public key exists without its private key; recover the matching private key first');
  key=generateKeyPairSync('ed25519').privateKey;
  writeFileSync(secret,key.export({type:'pkcs8',format:'pem'}),{mode:0o600,flag:'wx'});
}
if(key.asymmetricKeyType!=='ed25519')throw Error('Expected an Ed25519 signing key');
const publicKey=createPublicKey(key),pem=publicKey.export({type:'spki',format:'pem'});
const der=publicKey.export({type:'spki',format:'der'});
if(existsSync(pub)){
  const existing=createPublicKey(readFileSync(pub)).export({type:'spki',format:'der'});
  if(!existing.equals(der))throw Error('Existing public and private keys differ; no files replaced');
}else writeFileSync(pub,pem,{mode:0o600,flag:'wx'});
chmodSync(secret,0o600);chmodSync(pub,0o600);
console.log('Public-key SHA-256: '+createHash('sha256').update(der).digest('hex'));
console.log('Key directory: '+dir);
console.log('Keep an offline backup of private.pem; never send it to the Pi or paste it in chat.');
JS

if [[ "$secret_exists" == false ]]; then
  gh secret set TUNEBOX_OTA_SIGNING_KEY --repo "$repo" < "$private_key"
  printf '%s\n' 'Created the GitHub signing secret without displaying its contents.'
else
  printf '%s\n' 'Existing GitHub signing secret retained. Release verification will check the matching public key.'
fi

gh workflow run check.yml --repo "$repo" --ref main
printf '%s\n' 'Verify started. The signed-preview publisher runs after all checks pass.'
printf 'Follow progress: https://github.com/%s/actions\n' "$repo"

# Copy only the public verification key. Device activation remains a separate step.
scp "$public_key" "$device:tunebox-ota-public.pem"
printf '\n%s\n' 'Public key copied to the Pi. The private key stays on this Mac and in the GitHub secret.'
printf '%s\n' 'After the first signed release is published, use the Pi activation steps.'
