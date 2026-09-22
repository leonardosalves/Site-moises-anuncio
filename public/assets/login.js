import {api,inlineError,icon} from './shared.js';
import {heroImage} from './demo-data.js';
document.getElementById('login-image').src=heroImage;
const form=document.getElementById('login-form'),submit=document.getElementById('login-submit');let setup=false;
form.querySelector('.password-toggle').addEventListener('click',event=>{const button=event.currentTarget,show=form.elements.password.type==='password';form.elements.password.type=show?'text':'password';button.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');button.setAttribute('aria-pressed',show);});
try{const status=await api('/status');setup=!status.configured;
  if(setup&&!status.setupAvailable)throw new Error('O primeiro acesso ainda não foi liberado. Configure a chave SETUP_TOKEN na hospedagem.');
  if(setup){document.getElementById('login-title').textContent='Vamos começar.';document.getElementById('login-description').textContent='Crie a primeira conta de administrador para organizar a sua vitrine.';document.getElementById('setup-fields').hidden=false;form.elements.name.required=true;form.elements.token.required=true;form.elements.password.minLength=12;form.elements.password.autocomplete='new-password';document.getElementById('password-hint').hidden=false;document.getElementById('login-footnote').textContent='A configuração inicial só fica disponível até a criação da primeira conta.';}
  else {try{await api('/me');location.replace('/admin.html');}catch{}}
  submit.disabled=false;submit.innerHTML=(setup?'Criar conta de administrador':'Entrar no painel')+' '+icon('arrow-right');
}catch(error){inlineError(form,error.message);submit.textContent='Acesso indisponível';}
form.addEventListener('submit',async event=>{event.preventDefault();if(submit.disabled)return;inlineError(form,'');submit.disabled=true;const old=submit.innerHTML;submit.textContent=setup?'Criando sua conta…':'Entrando…';try{const body=Object.fromEntries(new FormData(form));await api(setup?'/setup':'/login',{method:'POST',body});location.replace('/admin.html');}catch(error){inlineError(form,error.message);submit.disabled=false;submit.innerHTML=old;}});
