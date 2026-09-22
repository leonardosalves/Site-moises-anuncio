// Executar somente contra o emulador local, nunca contra um domínio publicado.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
const base='http://127.0.0.1:8787';let cookie;
async function call(path,method='GET',body){const response=await fetch(base+'/api'+path,{method,headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return{status:response.status,data:await response.json()};}
const status=await call('/status');assert.equal(status.status,200);
let credentials;const path='.local/cloudflare-smoke-credentials.json';
if(!status.data.configured){const vars=await readFile('.dev.vars','utf8');const token=vars.match(/^SETUP_TOKEN\s*=\s*["']?([^\r\n"']+)/m)?.[1];assert.ok(token);credentials={email:'smoke-test@hospeda.local',password:randomBytes(24).toString('base64url')};assert.equal((await call('/setup','POST',{...credentials,name:'Teste do emulador',token})).status,200);await mkdir('.local',{recursive:true});await writeFile(path,JSON.stringify(credentials),{mode:0o600});}
else credentials=JSON.parse(await readFile(path,'utf8'));
assert.equal((await call('/login','POST',credentials)).status,200);assert.equal((await call('/me')).data.user.role,'admin');
const listing={title:'Anúncio temporário do teste Cloudflare',category:'imovel',kind:'Casa',description:'Registro descartável para verificar a publicação no emulador do Worker.',price_cents:123456789,location:'Local de teste',specs:['100 m²'],images:Array.from({length:5},(_,i)=>`https://images.example.com/${i}.jpg`),olx_url:'https://www.olx.com.br/teste',video_url:'https://drive.google.com/file/d/teste123/view',source_photos_url:'https://drive.google.com/drive/folders/privado',status:'published'};
const created=await call('/admin/listings','POST',listing);assert.equal(created.status,201);try{const pub=await call(`/listings/${created.data.id}`);assert.equal(pub.status,200);assert.equal(pub.data.listing.price_cents,123456789);assert.ok(!JSON.stringify(pub.data).includes('privado'));assert.equal((await call(`/admin/listings/${created.data.id}`,'PUT',{...listing,status:'sold'})).status,200);assert.equal((await call(`/listings/${created.data.id}`)).status,404);}finally{assert.equal((await call(`/admin/listings/${created.data.id}`,'DELETE',{})).status,200);}
const response=await fetch(base+'/');assert.equal(response.status,200);assert.match(response.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);assert.equal((await call('/logout','POST',{})).status,200);assert.equal((await call('/me')).status,401);
console.log('Cloudflare real (emulador workerd + D1): setup, login, publicação, atualização, privacidade, exclusão, headers e logout OK.');
