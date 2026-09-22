import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
let count=0;
for(const directory of ['src','scripts','tests','public/assets'])for(const name of await readdir(directory)){if(!/\.(mjs|js)$/.test(name))continue;const path=join(directory,name),result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});if(result.status!==0){console.error(result.stderr);process.exit(1)}count++;}
for(const name of (await readdir('public')).filter(n=>n.endsWith('.html'))){const html=await readFile(join('public',name),'utf8');if(!html.includes('lang="pt-BR"')||!html.includes('name="viewport"'))throw new Error(`Metadados ausentes: ${name}`);for(const match of html.matchAll(/(?:src|href)="(\/(?:assets\/|favicon)[^"?#]*)/g)){await readFile(join('public',match[1]));}}
console.log(`${count} arquivos JavaScript válidos. Referências locais e metadados HTML conferidos.`);
