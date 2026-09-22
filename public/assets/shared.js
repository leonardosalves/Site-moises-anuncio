const shapes = {
  'arrow-up-right':'<path d="M7 17 17 7M7 7h10v10"/>', 'arrow-down-right':'<path d="m7 7 10 10M7 17h10V7"/>',
  'arrow-left':'<path d="m12 5-7 7 7 7M5 12h14"/>', 'arrow-right':'<path d="m12 5 7 7-7 7M5 12h14"/>',
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1Z"/>',
  car:'<path d="m5 6-2 7v6h3v-3h12v3h3v-6l-2-7ZM3 12h18M6 6h12M6 15h1m10 0h1"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  pin:'<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-6-6-12 12"/>',
  film:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4m-4 6h4m10-6h4m-4 6h4"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 4v3"/>',
  users:'<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 3a4 4 0 0 1 0 8m2 3a6 6 0 0 1 3 5v2"/>',
  user:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', edit:'<path d="m16 3 5 5-13 13H3v-5ZM13 6l5 5"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>', check:'<path d="m5 12 4 4L19 6"/>',
  logout:'<path d="M9 21H3V3h6m6 4 5 5-5 5M8 12h12"/>',
  link:'<path d="m10 14 4-4m-6 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m4 0 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(2 -1) scale(.9)"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  sort:'<path d="M4 6h16M7 12h10m-7 6h4"/>', search:'<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  folder:'<path d="M3 7V4h6l3 3h9v13H3Z"/>', chevron:'<path d="m6 9 6 6 6-6"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>', area:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m8 16 8-8M8 8h8v8"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};
export const icon = name => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] || shapes.grid}</svg>`;
export function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money = cents => new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL',minimumFractionDigits:cents%100?2:0,maximumFractionDigits:2}).format(cents/100);
export function safeURL(value) { if(typeof value!=='string'||!value.trim())return '';try { const u = new URL(value, location.origin); return (u.protocol === 'https:' || (u.origin === location.origin && u.protocol === 'http:')) && !u.username && !u.password ? u.href : ''; } catch { return ''; } }
export const initials = name => name.split(' ').filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase();
export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { credentials:'same-origin', ...options, headers:{ ...(options.body ? {'Content-Type':'application/json'} : {}), ...options.headers }, body:options.body ? JSON.stringify(options.body) : undefined });
  if (!response.headers.get('content-type')?.includes('application/json')) throw Object.assign(new Error('Conecte o site à API da Cloudflare para usar esta função.'), {status:503});
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || 'Não foi possível concluir. Tente novamente.'), {status:response.status});
  return result;
}
let toastTimer;
export function toast(message) { const el = document.getElementById('toast'); if (!el) return; clearTimeout(toastTimer); el.textContent = message; el.hidden = false; toastTimer = setTimeout(()=>el.hidden = true, 5000); }
export function inlineError(form, message) { const el = form.querySelector('[data-error]'); el.textContent = message; el.hidden = !message; if(message) el.focus(); }
export function imageFallbacks(root=document) { root.querySelectorAll('img[data-listing-image]').forEach(img=> img.addEventListener('error', ()=> { img.classList.add('image-unavailable'); img.alt = 'Foto indisponível'; }, {once:true})); }
hydrateIcons();
document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
