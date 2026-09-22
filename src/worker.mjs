const encoder = new TextEncoder();
const SESSION_SECONDS = 60 * 60 * 8;
const PASSWORD_ITERATIONS = 100000;
const hex = bytes => Array.from(new Uint8Array(bytes), b=>b.toString(16).padStart(2,'0')).join('');
const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const digest = async value => hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
class HTTPError extends Error { constructor(status,message){super(message);this.status=status;} }
const fail = (status,message) => {throw new HTTPError(status,message)};
export async function hashPassword(password,salt=randomToken()){
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:PASSWORD_ITERATIONS,hash:'SHA-256'},key,256);
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${salt}$${hex(bits)}`;
}
function constantEqual(a,b){let difference=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)difference|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return difference===0;}
async function checkPassword(password,hash){const parts=hash.split('$');if(parts[0]!=='pbkdf2-sha256'||Number(parts[1])!==PASSWORD_ITERATIONS)return false;return constantEqual(await hashPassword(password,parts[2]),hash);}
function string(value,label,max=200,required=true){if(typeof value!=='string') {if(!required&&value==null)return '';fail(400,`${label}: informe um texto válido.`)}const result=value.trim();if((required&&!result)||result.length>max)fail(400,`${label}: preencha até ${max} caracteres.`);return result;}
function passwordValue(value){if(typeof value!=='string'||value.length<12||value.length>128)fail(400,'A senha deve ter entre 12 e 128 caracteres.');return value;}
function emailValue(value){const email=string(value,'E-mail',254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Informe um e-mail válido.');return email;}
function httpsURL(value,label,domain){const text=string(value,label,2048,false);if(!text)return '';try{const url=new URL(text);if(url.protocol!=='https:'||url.username||url.password)throw new Error();if(domain&&!domain.some(d=>url.hostname===d||url.hostname.endsWith('.'+d)))throw new Error();return url.href;}catch{fail(400,`${label}: use um link HTTPS válido${domain?' de '+domain.join(' ou '):''}.`)}}
export function validateListing(body){
  const title=string(body.title,'Título',120);if(title.length<5)fail(400,'O título deve ter pelo menos 5 caracteres.');
  const category=body.category;if(!['imovel','veiculo'].includes(category))fail(400,'Selecione imóvel ou veículo.');
  const status=body.status||'draft';if(!['draft','published','sold'].includes(status))fail(400,'Situação inválida.');
  const price_cents=body.price_cents;if(!Number.isSafeInteger(price_cents)||price_cents<0||price_cents>10000000000000)fail(400,'Informe um valor válido em reais.');
  const description=string(body.description,'Descrição',10000);if(description.length<20)fail(400,'Escreva uma descrição com pelo menos 20 caracteres.');
  if(!Array.isArray(body.images)||body.images.length>20)fail(400,'Adicione até 20 fotos.');
  const images=body.images.map(url=>httpsURL(url,'Foto')).filter(Boolean);if(new Set(images).size!==images.length)fail(400,'Use links diferentes para cada foto.');
  if(status==='published'&&images.length<5)fail(400,'Para publicar, adicione pelo menos 5 fotos diferentes.');
  const olx_url=httpsURL(body.olx_url,'Anúncio na OLX',['olx.com.br']);if(status==='published'&&!olx_url)fail(400,'Para publicar, informe o link do anúncio na OLX.');
  const video_url=httpsURL(body.video_url,'Vídeo da campanha',['drive.google.com']);
  if(video_url){const url=new URL(video_url);if(!/^\/file\/d\/[\w-]+(?:\/|$)/.test(url.pathname)&&!((url.pathname==='/open'||url.pathname==='/uc')&&/^[\w-]+$/.test(url.searchParams.get('id')||'')))fail(400,'Use o link de um arquivo de vídeo no Google Drive, não de uma pasta.');}
  if(!Array.isArray(body.specs)||body.specs.length>6)fail(400,'Informe até 6 características.');
  return {title,category,kind:string(body.kind,'Tipo',80),description,price_cents,location:string(body.location,'Localização',160),specs:body.specs.map(s=>string(s,'Característica',60)).filter(Boolean),images,olx_url,video_url,source_photos_url:httpsURL(body.source_photos_url,'Pasta de fotos originais'),status,featured:body.featured?1:0};
}
const publicFields='id, title, category, kind, description, price_cents, location, specs, images, olx_url, video_url, status, featured, created_at, updated_at';
function listingJSON(row,env){if(!row)return null;return{...row,images:JSON.parse(row.images),specs:JSON.parse(row.specs),featured:!!row.featured,...(env.LOCAL_PREVIEW==='true'&&row.id.startsWith('demo-')?{demo:true}:{})};}
function userJSON(row){return{id:row.id,name:row.name,email:row.email,role:row.role,active:!!row.active,created_at:row.created_at};}
async function readBody(request){if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Envie os dados em JSON.');const size=Number(request.headers.get('content-length')||0);if(size>65536)fail(413,'Os dados excedem o tamanho permitido.');let length=0;const chunks=[];if(request.body){const reader=request.body.getReader();while(true){const{value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>65536){await reader.cancel();fail(413,'Os dados excedem o tamanho permitido.')}chunks.push(value)}}const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}try{const body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();return body;}catch{fail(400,'Os dados enviados não são válidos.');}}
async function requireUser(request,env,admin=false){const token=request.headers.get('cookie')?.split(';').map(c=>c.trim()).find(c=>c.startsWith('ha_session='))?.slice(11);if(!token||!/^[a-f0-9]{64}$/.test(token))fail(401,'Entre na sua conta para continuar.');const user=await env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1').bind(await digest(token),Date.now()).first();if(!user)fail(401,'Sua sessão expirou. Entre novamente.');if(admin&&user.role!=='admin')fail(403,'Somente administradores podem gerenciar usuários.');return user;}
function sessionCookie(request,token,maxAge=SESSION_SECONDS){return `ha_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
async function createSession(request,env,user){const token=randomToken();await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),user.id,Date.now()+SESSION_SECONDS*1000).run();return json({user:userJSON(user)},200,{'Set-Cookie':sessionCookie(request,token)});}
async function rateLimit(env,key,max=10){const now=Date.now();const row=await env.DB.prepare('INSERT INTO login_limits(key,attempts,resets_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN resets_at<=? THEN 1 ELSE attempts+1 END, resets_at=CASE WHEN resets_at<=? THEN ? ELSE resets_at END RETURNING attempts').bind(key,now+15*60*1000,now,now,now+15*60*1000).first();if(row.attempts>max)fail(429,'Muitas tentativas. Aguarde 15 minutos e tente novamente.');}
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin',...headers}});
async function route(request,env,ctx){
  const url=new URL(request.url),path=url.pathname.replace(/\/$/,'');
  if(!path.startsWith('/api/'))return env.ASSETS.fetch(request);
  if(!env.DB)fail(503,'O banco de dados ainda não foi conectado.');
  if(!['GET','HEAD'].includes(request.method)){if(request.headers.get('origin')!==url.origin)fail(403,'Origem da solicitação não permitida.');if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Envie os dados em JSON.');}
  if(path==='/api/status'&&request.method==='GET'){const row=await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first();return json({configured:row.count>0,setupAvailable:row.count===0&&!!env.SETUP_TOKEN});}
  if(path==='/api/setup'&&request.method==='POST'){
    await rateLimit(env,'setup:'+await digest(request.headers.get('cf-connecting-ip')||'local'),5);
    if((await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first()).count>0)fail(409,'A primeira conta já foi criada.');
    const body=await readBody(request);if(!env.SETUP_TOKEN||env.SETUP_TOKEN.length<32||typeof body.token!=='string'||!constantEqual(await digest(body.token),await digest(env.SETUP_TOKEN)))fail(403,'A chave de configuração é inválida.');
    const now=new Date().toISOString(),user={id:'initial-admin',name:string(body.name,'Nome',100),email:emailValue(body.email),role:'admin',active:1,created_at:now};
    await env.DB.prepare('INSERT INTO users(id,name,email,password_hash,role,active,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?)').bind(user.id,user.name,user.email,await hashPassword(passwordValue(body.password)),user.role,now,now).run();
    return createSession(request,env,user);
  }
  if(path==='/api/login'&&request.method==='POST'){
    const body=await readBody(request);const email=emailValue(body.email);if(typeof body.password!=='string'||body.password.length>128)fail(400,'Informe sua senha.');
    await rateLimit(env,'ip:'+await digest(request.headers.get('cf-connecting-ip')||'local'),30);await rateLimit(env,'email:'+await digest(email),10);
    const user=await env.DB.prepare('SELECT * FROM users WHERE email=? COLLATE NOCASE').bind(email).first();
    const hash=user?.password_hash||`pbkdf2-sha256$${PASSWORD_ITERATIONS}$${'0'.repeat(64)}$${'0'.repeat(64)}`;
    const valid=await checkPassword(body.password,hash);if(!user||!user.active||!valid)fail(401,'E-mail ou senha incorretos.');
    await env.DB.prepare('DELETE FROM login_limits WHERE key=?').bind('email:'+await digest(email)).run();
    ctx?.waitUntil?.(env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(Date.now()),env.DB.prepare('DELETE FROM login_limits WHERE resets_at<?').bind(Date.now())]));
    return createSession(request,env,user);
  }
  if(path==='/api/logout'&&request.method==='POST'){const token=request.headers.get('cookie')?.split(';').map(c=>c.trim()).find(c=>c.startsWith('ha_session='))?.slice(11);if(token)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();return json({ok:true},200,{'Set-Cookie':sessionCookie(request,'',0)});}
  if(path==='/api/me'&&request.method==='GET')return json({user:userJSON(await requireUser(request,env))});
  if(path==='/api/listings'&&request.method==='GET'){const rows=await env.DB.prepare(`SELECT ${publicFields} FROM listings WHERE status='published' ORDER BY created_at DESC`).all();return json({listings:rows.results.map(r=>listingJSON(r,env)),demo:env.LOCAL_PREVIEW==='true'&&rows.results.some(r=>r.id.startsWith('demo-'))});}
  const publicId=path.match(/^\/api\/listings\/([a-zA-Z0-9-]+)$/)?.[1];
  if(publicId&&request.method==='GET'){const row=await env.DB.prepare(`SELECT ${publicFields} FROM listings WHERE id=? AND status='published'`).bind(publicId).first();if(!row)fail(404,'Este anúncio não está disponível.');return json({listing:listingJSON(row,env)});}
  if(path==='/api/admin/listings'&&request.method==='GET'){await requireUser(request,env);const rows=await env.DB.prepare('SELECT * FROM listings ORDER BY created_at DESC').all();return json({listings:rows.results.map(r=>listingJSON(r,env))});}
  if(path==='/api/admin/listings'&&request.method==='POST'){
    const user=await requireUser(request,env),data=validateListing(await readBody(request)),id=crypto.randomUUID(),now=new Date().toISOString();
    await env.DB.prepare('INSERT INTO listings(id,title,category,kind,description,price_cents,location,specs,images,olx_url,video_url,source_photos_url,status,featured,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,data.title,data.category,data.kind,data.description,data.price_cents,data.location,JSON.stringify(data.specs),JSON.stringify(data.images),data.olx_url,data.video_url,data.source_photos_url,data.status,data.featured,user.id,now,now).run();
    return json({id},201);
  }
  const adminId=path.match(/^\/api\/admin\/listings\/([a-zA-Z0-9-]+)$/)?.[1];
  if(adminId){await requireUser(request,env);const row=await env.DB.prepare('SELECT * FROM listings WHERE id=?').bind(adminId).first();if(!row)fail(404,'Anúncio não encontrado.');
    if(request.method==='GET')return json({listing:listingJSON(row,env)});
    if(request.method==='PUT'){const data=validateListing(await readBody(request));await env.DB.prepare('UPDATE listings SET title=?,category=?,kind=?,description=?,price_cents=?,location=?,specs=?,images=?,olx_url=?,video_url=?,source_photos_url=?,status=?,featured=?,updated_at=? WHERE id=?').bind(data.title,data.category,data.kind,data.description,data.price_cents,data.location,JSON.stringify(data.specs),JSON.stringify(data.images),data.olx_url,data.video_url,data.source_photos_url,data.status,data.featured,new Date().toISOString(),adminId).run();return json({id:adminId});}
    if(request.method==='DELETE'){await env.DB.prepare('DELETE FROM listings WHERE id=?').bind(adminId).run();return json({ok:true});}
  }
  if(path==='/api/admin/users'&&request.method==='GET'){await requireUser(request,env,true);const rows=await env.DB.prepare('SELECT id,name,email,role,active,created_at FROM users ORDER BY created_at DESC').all();return json({users:rows.results.map(userJSON)});}
  if(path==='/api/admin/users'&&request.method==='POST'){
    await requireUser(request,env,true);const body=await readBody(request);if(!['admin','editor'].includes(body.role))fail(400,'Escolha um perfil válido.');const id=crypto.randomUUID(),now=new Date().toISOString();
    await env.DB.prepare('INSERT INTO users(id,name,email,password_hash,role,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,string(body.name,'Nome',100),emailValue(body.email),await hashPassword(passwordValue(body.password)),body.role,body.active===false?0:1,now,now).run();return json({id},201);
  }
  const userId=path.match(/^\/api\/admin\/users\/([a-zA-Z0-9-]+)$/)?.[1];
  if(userId){const caller=await requireUser(request,env,true),user=await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(userId).first();if(!user)fail(404,'Usuário não encontrado.');
    if(request.method==='PUT'){const body=await readBody(request);if(!['admin','editor'].includes(body.role))fail(400,'Escolha um perfil válido.');if(caller.id===userId&&(body.role!=='admin'||body.active===false))fail(400,'Você não pode remover seu próprio acesso de administrador.');const newHash=body.password?await hashPassword(passwordValue(body.password)):user.password_hash;await env.DB.batch([env.DB.prepare('UPDATE users SET name=?,email=?,password_hash=?,role=?,active=?,updated_at=? WHERE id=?').bind(string(body.name,'Nome',100),emailValue(body.email),newHash,body.role,body.active===false?0:1,new Date().toISOString(),userId),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId)]);return json({id:userId,reauthenticate:caller.id===userId});}
    if(request.method==='DELETE'){if(caller.id===userId)fail(400,'Você não pode excluir sua própria conta.');await env.DB.prepare('DELETE FROM users WHERE id=?').bind(userId).run();return json({ok:true});}
  }
  fail(404,'Página não encontrada.');
}
export default { async fetch(request,env,ctx){try{return await route(request,env,ctx)}catch(error){if(error.status)return json({error:error.message},error.status);if(/UNIQUE constraint failed: users.email/i.test(error.message))return json({error:'Este e-mail já está cadastrado.'},409);if(/last_admin/i.test(error.message))return json({error:'Mantenha pelo menos um administrador ativo.'},400);if(/UNIQUE constraint failed: users.id/i.test(error.message))return json({error:'A primeira conta já foi criada.'},409);console.error('API request failed:',error.message);return json({error:'Não foi possível concluir. Tente novamente em instantes.'},500);}} };
