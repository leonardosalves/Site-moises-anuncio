# Hospeda Anuncios

Vitrine de carros e imóveis com HTML, CSS e JavaScript, pronta para hospedar na Cloudflare. Inclui galeria de 5 a 20 fotos, valor, título, descrição, características, link da OLX, download do vídeo no Google Drive e painel de administração.

## O que está pronto

- Vitrine responsiva com categorias, ordenação por preço e páginas de detalhes.
- Galeria ampliada com navegação pelo teclado, celular e mouse.
- Login com sessões de 8 horas e encerramento de sessão.
- CRUD de anúncios: criar, consultar, editar e excluir.
- Rascunhos, publicação, destaque e marcação de vendido.
- CRUD de usuários, com perfis **Administrador** e **Editor** e desativação de acesso.
- Pasta de fotos originais visível apenas à equipe autenticada.
- Link público da OLX e botão para baixar o vídeo da campanha no Drive.

## Como funciona

A interface em `public/` é estática, sem React, sem etapa de compilação e sem dependências no navegador. O login e as alterações de dados precisam de um servidor: `src/worker.mjs` é a API do Cloudflare Worker, e o banco Cloudflare D1 guarda usuários, sessões e anúncios.

Publicar somente os arquivos HTML em uma hospedagem estática permite visualizar a demonstração, mas **não ativa login nem salva anúncios**. Para usar o sistema completo, publique o projeto como **Cloudflare Worker com Static Assets + D1**, seguindo os passos abaixo. Isso mantém tudo na sua própria conta Cloudflare.

Fotos e vídeos não são enviados ao banco. O sistema armazena seus links. As imagens da galeria devem ter URLs HTTPS públicas que abram a imagem diretamente; a pasta de produção pode permanecer compartilhada apenas com a equipe no Drive. Seu irmão pode cadastrar o material em um rascunho e você completar os links públicos depois.

## Abrir no computador

Instale o Node.js 24 ou superior. Na pasta do projeto:

```sh
npm ci
npm run dev
```

Abra `http://127.0.0.1:4173`. O painel fica em `http://127.0.0.1:4173/login.html`.

Na primeira execução, o servidor local cria seis anúncios demonstrativos e uma conta de administrador. O e-mail e a senha aleatória ficam em **`.local/ACESSO-LOCAL.txt`**. As alterações ficam salvas no banco **`.local/hospeda.sqlite`**, inclusive após reiniciar o computador.

Essa conta existe somente no computador. Nenhum dado local, senha local ou anúncio de exemplo é enviado à Cloudflare pelo comando de publicação. Não inclua `.local/`, `.dev.vars` ou `.wrangler/` em um repositório ou em um upload manual. A lista de exclusões já está no `.gitignore`.

Use `Ctrl+C` no terminal para encerrar a prévia. Para iniciar novamente, use `npm run dev`.

## Hospedar na sua Cloudflare

Este procedimento usa a [configuração oficial de Static Assets em Workers](https://developers.cloudflare.com/workers/static-assets/binding/) e o [banco D1](https://developers.cloudflare.com/d1/).

### 1. Instalar e entrar na Cloudflare

Abra o terminal dentro da pasta extraída do projeto:

```sh
npm ci
npx wrangler login
```

Conclua o login no navegador com a sua conta Cloudflare.

### 2. Criar o banco

```sh
npx wrangler d1 create hospeda-anuncios
```

Copie o `database_id` retornado. Abra `wrangler.jsonc` e substitua `SUBSTITUA_PELO_ID_DO_BANCO_D1` pelo ID real. O nome do vínculo deve continuar sendo `DB`.

### 3. Criar as tabelas e publicar

```sh
npm run db:remote
npm run deploy
```

O comando mostra o endereço `workers.dev` do seu site. A vitrine de produção começa **vazia**. Não há senha padrão e não é possível criar uma conta sem a chave inicial.

### 4. Liberar a configuração inicial

Gere uma chave aleatória e guarde-a temporariamente em um lugar privado:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Cadastre essa chave como um segredo do Worker:

```sh
npx wrangler secret put SETUP_TOKEN
```

Cole a chave quando o terminal solicitar. Não coloque essa chave em arquivos HTML ou JavaScript públicos.

### 5. Criar seu administrador

Abra o endereço do site acrescentando `/login.html`. A tela inicial solicita a chave, seu nome, e-mail e uma senha de pelo menos 12 caracteres. Depois da criação, você será levado ao painel. O cadastro inicial é fechado automaticamente assim que a primeira conta existe.

Depois de entrar, remova o segredo inicial:

```sh
npx wrangler secret delete SETUP_TOKEN
```

O login continuará funcionando. Para criar novos acessos, use **Usuários → Novo usuário**. Recomendo um perfil **Editor** para seu irmão: ele gerencia anúncios e materiais sem alterar as contas da equipe.

### 6. Cadastrar seu primeiro anúncio

1. Entre no painel e clique em **Novo anúncio**.
2. Preencha título, categoria, tipo, valor, localização e descrição.
3. Cole pelo menos cinco URLs de fotos públicas e diferentes. A primeira é a capa. É possível salvar um rascunho sem as fotos prontas.
4. Cole o link do anúncio na OLX. Somente domínios `olx.com.br` são aceitos.
5. No campo privado, cole o link da pasta com os arquivos originais.
6. Depois de criar o vídeo, coloque o arquivo no Drive e cole o link no campo **Vídeo da campanha**.
7. Escolha **Publicado** e salve. Rascunhos e itens vendidos não aparecem na vitrine.

### Vídeo no Google Drive

Use um link de **arquivo**, por exemplo `https://drive.google.com/file/d/ID_DO_ARQUIVO/view`. Links de pasta não são aceitos nesse campo.

Se o vídeo deve ser baixado por visitantes da vitrine, configure no Drive o acesso “Qualquer pessoa com o link” e permita downloads. A pasta de fotos originais não precisa ficar pública. O site não altera permissões no Google Drive.

O botão “Baixar vídeo” abre a rota de download do Drive. O Google pode exibir uma confirmação, exigir login se o compartilhamento estiver restrito ou aplicar seus próprios limites. O link “Abrir no Google Drive” também fica disponível. Não existe conexão OAuth, upload automático para o Drive ou leitura automática de uma pasta.

### Domínio próprio e atualizações

Você pode associar um domínio nas configurações de **Domains & Routes** do Worker na Cloudflare. Depois de alterar o código, rode novamente `npm run deploy`. Os registros do D1 são preservados. Futuras alterações de banco devem ser novas migrações na pasta `migrations/`.

## Permissões

| Função | Visitante | Editor | Administrador |
| --- | --- | --- | --- |
| Ver anúncios publicados, OLX e vídeo | Sim | Sim | Sim |
| Criar, editar e excluir anúncios | Não | Sim | Sim |
| Ver rascunhos e pasta original de fotos | Não | Sim | Sim |
| Gerenciar contas e redefinir senhas | Não | Não | Sim |

Contas são criadas pelo administrador. Não há cadastro público ou recuperação por e-mail. Um administrador pode definir uma nova senha ao editar outro usuário. Alterar dados de uma conta encerra suas sessões atuais. O sistema impede excluir a própria conta, retirar o próprio acesso de administrador e remover o último administrador ativo.

## Segurança implementada

- Senhas armazenadas como hashes PBKDF2-SHA-256 com salt aleatório e 100.000 iterações, executado pela Web Crypto API do Worker.
- Tokens de sessão aleatórios, somente seus hashes no banco; cookie `HttpOnly`, `SameSite=Strict` e `Secure` em HTTPS.
- Verificação de origem em alterações, permissões verificadas em cada endpoint e consultas SQL preparadas.
- Limite persistido de tentativas de login por conta e IP; expiração de sessão.
- A API pública seleciona explicitamente apenas os campos públicos: o link da pasta original nunca é enviado a visitantes.
- Validação de URLs HTTPS, domínio OLX, arquivo do Drive, cinco imagens distintas antes de publicar e limite de tamanho de requisição.
- Políticas de conteúdo, bloqueio de incorporação em outros sites e escape de texto exibido na interface.

## Testes e validação

```sh
npm test
npm run check
npx wrangler deploy --dry-run
```

Os testes usam SQLite real em memória para verificar autenticação, CRUD, permissões, proteção dos links privados, encerramento de sessões, proteção do administrador, limitação de tentativas, URLs e entradas inválidas.

Para emular o Worker e o D1 oficialmente no computador, copie `.dev.vars.example` para `.dev.vars`, escolha uma chave própria e execute:

```sh
npm run db:local
npm run preview:cloudflare
```

Esse ambiente usa um banco independente do servidor `npm run dev`. Nada será publicado. Para criar a primeira conta, abra o login e use a chave da sua `.dev.vars`.

## Arquivos

| Pasta ou arquivo | Conteúdo |
| --- | --- |
| `public/` | HTML, estilos, scripts e favicon |
| `src/worker.mjs` | API e autenticação |
| `migrations/` | Estrutura do banco D1 |
| `scripts/` | Prévia local e verificações |
| `tests/` | Testes de integração |
| `wrangler.jsonc` | Configuração para a Cloudflare |
| `CREDITOS.md` | Fontes das fotografias da demonstração |
| `.local/` | Banco, acesso e chave locais; não publicar |

As fotos e os dados de demonstração precisam ser substituídos pelos seus anúncios reais. Os seis exemplos existem apenas na prévia local e no fallback de visualização estática; não são cadastrados no banco de produção.
