import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {generateKeyPairSync} from 'node:crypto';
if(existsSync('.ota-keys'))throw Error('.ota-keys exists; refusing to overwrite signing keys');
mkdirSync('.ota-keys',{mode:0o700});
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
writeFileSync('.ota-keys/private.pem',privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});
writeFileSync('.ota-keys/public.pem',publicKey.export({type:'spki',format:'pem'}));
console.log('Created local .ota-keys/private.pem and public.pem; never commit the private key.');
