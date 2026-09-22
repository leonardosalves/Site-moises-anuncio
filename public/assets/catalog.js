import { icon, escapeHTML as e, money, safeURL, imageFallbacks } from './shared.js';
import { demoListings, heroImage } from './demo-data.js';
let listings = [], category = new URLSearchParams(location.search).get('categoria') || 'all';
if (!['all','imovel','veiculo'].includes(category)) category = 'all';
const hero = document.createElement('img'); hero.src = heroImage; hero.alt = 'Casa contemporânea branca com piscina e jardim'; hero.fetchPriority = 'high'; document.getElementById('hero-image').prepend(hero);
function render() {
  const visible = listings.filter(item => category === 'all' || item.category === category);
  const sort = document.getElementById('sort').value;
  visible.sort(sort === 'price-asc' ? (a,b)=>a.price_cents-b.price_cents : sort === 'price-desc' ? (a,b)=>b.price_cents-a.price_cents : (a,b)=>b.created_at.localeCompare(a.created_at));
  document.getElementById('result-count').textContent = `${visible.length} ${visible.length === 1 ? 'anúncio disponível' : 'anúncios disponíveis'}`;
  for (const value of ['all','imovel','veiculo']) document.getElementById(`count-${value}`).textContent = listings.filter(l=>value==='all'||l.category===value).length;
  document.querySelectorAll('[data-filter]').forEach(button => { button.classList.toggle('selected',button.dataset.filter===category); button.setAttribute('aria-pressed',button.dataset.filter===category); });
  document.querySelectorAll('[data-category]').forEach(link=>link.classList.toggle('active',link.dataset.category===category));
  document.getElementById('listing-grid').innerHTML = visible.length ? visible.map(item=>`<article class="listing-card"><a class="card-image" href="/anuncio.html?id=${encodeURIComponent(item.id)}" tabindex="-1" aria-hidden="true"><img src="${e(safeURL(item.images[0]))}" alt="" loading="lazy" width="600" height="400" data-listing-image><div class="image-badges"><span class="badge">${item.category==='imovel'?'IMÓVEL':'VEÍCULO'}</span>${item.featured?'<span class="badge badge-lime">EM DESTAQUE</span>':''}</div><span class="photo-count">${icon('image')} ${item.images.length}</span></a><div class="card-body"><span class="card-kind">${e(item.kind)}</span><h3><a href="/anuncio.html?id=${encodeURIComponent(item.id)}">${e(item.title)}</a></h3><p class="card-location">${icon('pin')}${e(item.location)}</p><div class="card-specs">${item.specs.slice(0,3).map(s=>`<span>${e(s)}</span>`).join('')}</div><div class="card-bottom"><span class="card-price">${money(item.price_cents)}</span><a class="circle-arrow" href="/anuncio.html?id=${encodeURIComponent(item.id)}" aria-label="Ver detalhes: ${e(item.title)}">${icon('arrow-up-right')}</a></div></div></article>`).join('') : `<div class="empty-state">${icon('home')}<h3>Novas oportunidades estão chegando</h3><p>Assim que um anúncio for publicado, ele aparecerá por aqui.</p></div>`;
  imageFallbacks();
}
function setCategory(next){category=next;const url=new URL(location.href);if(category==='all')url.searchParams.delete('categoria');else url.searchParams.set('categoria',category);history.replaceState(null,'',url);render();}
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>setCategory(button.dataset.filter)));
document.querySelectorAll('[data-category]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();setCategory(link.dataset.category);document.getElementById('anuncios').scrollIntoView({behavior:'smooth'});}));
document.getElementById('sort').addEventListener('change',render);
try {
  const response=await fetch('/api/listings');
  if(response.headers.get('content-type')?.includes('application/json')){const result=await response.json();if(!response.ok)throw new Error(result.error);listings=result.listings;document.getElementById('demo-note').hidden=!result.demo;}
  else {listings=demoListings;document.getElementById('demo-note').hidden=false;}
  render();
} catch(error){document.getElementById('result-count').textContent='';document.getElementById('listing-grid').innerHTML=`<div class="empty-state">${icon('info')}<h3>Não foi possível carregar os anúncios</h3><p>${e(error.message || 'Verifique sua conexão e tente novamente.')}</p><button class="button button-dark" id="reload">Tentar novamente</button></div>`;document.getElementById('reload').addEventListener('click',()=>location.reload());}
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'filter_listings',title:'Filtrar vitrine',description:'Filtra os anúncios visíveis por categoria.',inputSchema:{type:'object',properties:{category:{type:'string',enum:['all','imovel','veiculo']}},required:['category'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!['all','imovel','veiculo'].includes(input?.category))throw new Error('Categoria inválida');setCategory(input.category);return{count:listings.filter(l=>category==='all'||l.category===category).length,category};}})).catch(()=>{});}catch{}}
