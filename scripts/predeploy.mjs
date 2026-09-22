import {readFile} from 'node:fs/promises';
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
if(!/^[a-f0-9-]{36}$/i.test(config.d1_databases?.[0]?.database_id||'')){
  console.error('Configure o database_id do banco D1 em wrangler.jsonc antes de publicar. Siga o guia LEIA-ME.md.');process.exit(1);
}
console.log('Configuração D1 encontrada. Publicando somente public/ e o Worker; .local/ não é enviada.');
