import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { demoListings } from '../public/assets/demo-data.js';
import { hashPassword } from '../src/worker.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url))), publicRoot=resolve(root,'public');
await mkdir(resolve(root,'.local'),{recursive:true});
const db=new DatabaseSync(resolve(root,'.local','hospeda.sqlite'));db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
const firstRun=!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
if(firstRun)db.exec(await readFile(resolve(root,'migrations/0001_initial.sql'),'utf8'));
if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='local_meta'").get()){
  for(const item of demoListings)db.prepare('INSERT INTO listings(id,title,category,kind,description,price_cents,location,specs,images,olx_url,video_url,source_photos_url,status,featured,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(item.id,item.title,item.category,item.kind,item.description,item.price_cents,item.location,JSON.stringify(item.specs),JSON.stringify(item.images),'','','','published',item.featured?1:0,item.created_at,item.created_at);
  db.exec('CREATE TABLE local_meta (seeded INTEGER NOT NULL); INSERT INTO local_meta VALUES(1)');
}
const wrap=(sql,args=[])=>({bind(...values){return wrap(sql,values)},async first(){return db.prepare(sql).get(...args)||null},async all(){return{results:db.prepare(sql).all(...args)}},async run(){const result=db.prepare(sql).run(...args);return{success:true,meta:{changes:Number(result.changes)}}}});
const DB={prepare:sql=>wrap(sql),async batch(statements){db.exec('BEGIN');try{const results=[];for(const stmt of statements)results.push(await stmt.run());db.exec('COMMIT');return results}catch(error){db.exec('ROLLBACK');throw error}}};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'};
const ASSETS={async fetch(request){const url=new URL(request.url);let pathname;try{pathname=decodeURIComponent(url.pathname)}catch{return new Response('URL inválida',{status:400})}let filename=resolve(publicRoot,'.'+(pathname==='/'?'/index.html':pathname));if(!filename.startsWith(publicRoot+sep))return new Response('Não encontrado',{status:404});try{const data=await readFile(filename);return new Response(data,{headers:{'Content-Type':mime[extname(filename)]||'application/octet-stream','Cache-Control':'no-store'}})}catch{try{return new Response(await readFile(resolve(publicRoot,'404.html')),{status:404,headers:{'Content-Type':'text/html; charset=utf-8'}})}catch{return new Response('Não encontrado',{status:404})}}}};
let setupToken;try{setupToken=(await readFile(resolve(root,'.local','setup-token.txt'),'utf8')).trim()}catch{setupToken=randomBytes(32).toString('hex');await writeFile(resolve(root,'.local','setup-token.txt'),setupToken,{mode:0o600})}
const env={DB,ASSETS,SETUP_TOKEN:setupToken,LOCAL_PREVIEW:'true'};
if(!db.prepare('SELECT id FROM users LIMIT 1').get()){
  const password=randomBytes(18).toString('base64url'),now=new Date().toISOString();
  db.prepare('INSERT INTO users(id,name,email,password_hash,role,active,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?)').run('local-admin','Administrador','admin@hospeda.local',await hashPassword(password),'admin',now,now);
  await writeFile(resolve(root,'.local','ACESSO-LOCAL.txt'),`HOSPEDA ANUNCIOS — ACESSO LOCAL\n\nPágina: http://127.0.0.1:${process.env.PORT||4173}/login.html\nE-mail: admin@hospeda.local\nSenha: ${password}\n\nEsta conta e este banco existem SOMENTE na prévia local.\nNão publique a pasta .local e não reutilize esta senha na internet.\nNa Cloudflare, crie sua própria conta no primeiro acesso.\n`,{mode:0o600});
}
let lastWorkerTime=0,worker;
const server=createServer(async(req,res)=>{try{const origin=`http://127.0.0.1:${server.address().port}`;let body;if(!['GET','HEAD'].includes(req.method)){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>65536){res.writeHead(413);res.end('Payload too large');return}chunks.push(chunk)}body=Buffer.concat(chunks)}const request=new Request(new URL(req.url,origin),{method:req.method,headers:req.headers,...(body?{body,duplex:'half'}:{})});let response;if(new URL(request.url).pathname.startsWith('/api/')){try{const modified=(await stat(resolve(root,'src/worker.mjs'))).mtimeMs;if(modified!==lastWorkerTime){worker=(await import(new URL(`../src/worker.mjs?v=${modified}`,import.meta.url))).default;lastWorkerTime=modified}response=await worker.fetch(request,env,{waitUntil:promise=>promise.catch(console.error)})}catch(error){if(error.code==='ENOENT')response=new Response('Prévia estática',{status:404});else{console.error(error);response=Response.json({error:'Erro no servidor local.'},{status:500})}}}else response=await ASSETS.fetch(request);const headers=Object.fromEntries(response.headers);res.writeHead(response.status,headers);res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()))}catch(error){console.error(error);res.writeHead(500);res.end('Erro local')}});
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>{console.log(`Hospeda Anuncios — Local: http://127.0.0.1:${server.address().port}`);console.log('Prévia local. Banco e chave de configuração em .local/. Nenhum dado é enviado à Cloudflare.');});
