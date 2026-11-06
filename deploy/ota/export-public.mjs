import {createPrivateKey,createPublicKey} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const key=createPrivateKey(process.env.TUNEBOX_OTA_SIGNING_KEY||'');
if(key.asymmetricKeyType!=='ed25519')throw Error('Ed25519 signing key required');
writeFileSync('deploy/ota/public.pem',createPublicKey(key).export({format:'pem',type:'spki'}));
console.log('Public project verification key included in release bundle.');
