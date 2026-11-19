# Estação Bebidas

Site de catálogo para distribuidora de bebidas, com login, cadastro de clientes e painel administrativo. A interface usa HTML, CSS e JavaScript; a API usa Node.js, Express e MySQL.

## O que o projeto faz

- A primeira tela é o login. A pessoa também pode abrir o formulário de cadastro.
- O cadastro cria sempre um usuário do tipo `customer`; ninguém pode se cadastrar como administrador.
- Senhas são gravadas como hash bcrypt no MySQL.
- Depois do login, clientes consultam bebidas disponíveis, preço e estoque.
- O catálogo separa produtos em Whiskeys, Cervejas, Refrigerantes, Gelos Saborizados, Energéticos Variados, Águas, Salgadinhos e Doces.
- O administrador cadastra, edita, oculta e remove produtos, com categoria, descrição, preço, estoque e foto JPG, PNG ou WEBP de até 5 MB.
- O comando `npm run seed-catalog` inclui 15 itens em cada uma das oito categorias (120 no total); preços e estoques são exemplos editáveis.
- O painel administrativo também lista as contas cadastradas.
- Cada produto de demonstração tem uma foto própria em `public/products/individual`; o arquivo é servido localmente pela WEB01. A foto de Água Prata fornecida para o projeto também é mantida local.
- As fotos do catálogo são servidas pela própria WEB01 e não precisam de conexão externa durante o uso. Não é necessário configurar API nem chave de imagem.
- O MySQL guarda os caminhos locais das fotos e os dados dos produtos e usuários. Fotos enviadas pelo administrador ficam na WEB01.
- `systemd` mantém a aplicação ativa sem o VS Code e inicia o serviço novamente após reinicialização da WEB01.

## Testar localmente no Windows com WAMP

Este fluxo usa o MySQL local do WAMP e abre o site em `http://127.0.0.1:3000`.

1. Inicie o serviço MySQL pelo WAMP. Confira a porta definida em `my.ini` e em PowerShell confirme que a porta responde: `Test-NetConnection 127.0.0.1 -Port 3306` (troque 3306 se o WAMP usar outra).
2. Copie `.env.example` para `.env`. Confira `WEB_ORIGIN=http://127.0.0.1:3000`, `DB_HOST=127.0.0.1`, `DB_PORT` com a porta do WAMP e `DB_PASSWORD` com a senha configurada para `app_bebidas`.
3. Em uma conexão administrativa local do MySQL Workbench, execute `database/schema.sql` para um banco novo. Se estiver usando o banco da versão anterior do projeto, execute `database/migration-categories.sql` uma vez como administrador.
4. Se ainda não existir o usuário local da aplicação, crie-o no Workbench com a mesma senha de `DB_PASSWORD`:

   ```sql
   CREATE USER IF NOT EXISTS 'app_bebidas'@'localhost' IDENTIFIED BY 'SENHA_FORTE';
   ALTER USER 'app_bebidas'@'localhost' IDENTIFIED BY 'SENHA_FORTE';
   GRANT SELECT, INSERT, UPDATE, DELETE ON distribuidora.* TO 'app_bebidas'@'localhost';
   ```

5. No terminal, na pasta do projeto, rode `npm install` (na primeira configuração), depois `npm run seed-catalog`. O comando adiciona os itens de demonstração e troca as imagens genéricas antigas pelas fotos individuais, preservando fotos enviadas pelo administrador.
6. Se ainda não criou o usuário administrador, rode `npm run create-admin`. Em seguida, inicie com `npm start` e abra `http://127.0.0.1:3000`.

As fotos de demonstração e suas páginas de origem estão listadas em [FONTES-IMAGENS.md](FONTES-IMAGENS.md). Elas ficam no projeto e não precisam de acesso à internet durante o uso. As imagens têm suas fontes anotadas; essa indicação não concede licença para uso comercial. Você pode editar preços, descrições, estoques e fotos pelo painel administrativo.

## Arquitetura do cenário

```text
Navegador
   │ HTTP :80
   ▼
WEB01 — 192.168.1.10/24
Nginx :80 → Node.js/Express em 127.0.0.1:3000
   │ MySQL :3306 (somente a partir da WEB01)
   ▼
DB01 — 192.168.1.20/24
MySQL
```

No cadastro, o navegador envia os dados à API da WEB01; a API valida e grava o usuário no MySQL da DB01 e responde com a confirmação para a interface.

Os endereços acima são exemplos. Reserve IPs fora da faixa DHCP do roteador, adapte o gateway, nome da interface de rede e endereço de acesso ao seu ambiente. No VirtualBox, coloque as duas placas de rede em **Modo Bridge**. A máscara `255.255.255.0` corresponde a `/24`.

## 1. Preparar a rede das VMs

Use Ubuntu Server 24.04 ou distribuição equivalente nas duas VMs. O cenário informado (2 vCPU, 4 GB RAM e disco de 40 GB em cada VM) atende esta aplicação de pequeno porte.

Configure IP estático nas duas VMs. Exemplo de valores:

| VM | Endereço | Máscara | Gateway (exemplo) |
| --- | --- | --- | --- |
| WEB01 | `192.168.1.10` | `255.255.255.0` | `192.168.1.1` |
| DB01 | `192.168.1.20` | `255.255.255.0` | `192.168.1.1` |

No Netplan, use o nome real da interface (descubra com `ip link`) e o gateway da sua rede. Faça a mudança com acesso ao console da VM ou tenha como reverter a configuração se o endereço/gateway estiver incorreto.

## 2. Preparar o MySQL na DB01

Instale e inicie o MySQL Server na DB01. Copie `database/schema.sql` para ela e crie as tabelas como administrador local:

```bash
sudo mysql < /caminho/para/schema.sql
```

Se estiver atualizando um banco de uma versão anterior do projeto, execute também `database/migration-categories.sql` como administrador MySQL para adicionar a categoria aos produtos existentes.

Edite `/etc/mysql/mysql.conf.d/mysqld.cnf` e limite o MySQL ao endereço da DB01:

```ini
bind-address = 192.168.1.20
```

Reinicie o serviço e crie um usuário de aplicação que só pode conectar a partir da WEB01. Troque a senha de exemplo por uma senha forte:

```bash
sudo systemctl restart mysql
sudo mysql
```

No prompt do MySQL:

```sql
CREATE USER 'app_bebidas'@'192.168.1.10' IDENTIFIED BY 'TROQUE_POR_UMA_SENHA_FORTE';
GRANT SELECT, INSERT, UPDATE, DELETE ON distribuidora.* TO 'app_bebidas'@'192.168.1.10';
FLUSH PRIVILEGES;
EXIT;
```

Permita a porta 3306 apenas da WEB01. Com UFW:

```bash
sudo ufw allow from 192.168.1.10 to any port 3306 proto tcp
```

Não crie regra geral liberando a porta 3306 para toda a rede. O serviço MySQL precisa aceitar conexões de rede no IP da DB01; a regra de firewall e o usuário MySQL limitam o acesso ao servidor da aplicação.

## 3. Preparar a WEB01

Instale Node.js **24 LTS** ou outra versão LTS suportada e Nginx. Confira a versão com `node --version` (o projeto exige Node.js 24 ou superior). A tabela oficial de versões e os instaladores estão em [nodejs.org](https://nodejs.org/en/about/previous-releases). O serviço abaixo usa `/usr/bin/node`; se a instalação colocar o executável em outro local, substitua esse caminho pelo resultado de `command -v node`.

Copie a pasta deste projeto para `/opt/distribuidora`. Exemplo, depois de transferir o projeto para a WEB01:

```bash
sudo mkdir -p /opt/distribuidora
sudo cp -a distribuidora-bebidas/. /opt/distribuidora/
sudo useradd --system --home /opt/distribuidora --shell /usr/sbin/nologin bebidas
sudo chown -R root:root /opt/distribuidora
sudo chown bebidas:bebidas /opt/distribuidora/uploads
sudo cp /opt/distribuidora/.env.example /opt/distribuidora/.env
```

Edite `/opt/distribuidora/.env` com os IPs e a mesma senha que cadastrou para o usuário MySQL:

```dotenv
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
WEB_ORIGIN=http://192.168.1.10
DB_HOST=192.168.1.20
DB_PORT=3306
DB_NAME=distribuidora
DB_USER=app_bebidas
DB_PASSWORD=COLOQUE_A_MESMA_SENHA_DO_MYSQL
SESSION_SECRET=COLOQUE_AQUI_UMA_CHAVE_ALEATORIA_LONGA
SESSION_COOKIE_SECURE=false
UPLOAD_DIR=/opt/distribuidora/uploads
```

Gere uma chave para `SESSION_SECRET` com `openssl rand -hex 32`. Defina permissões para que apenas administrador e serviço leiam a configuração:

```bash
sudo chown root:bebidas /opt/distribuidora/.env
sudo chmod 640 /opt/distribuidora/.env
```

Instale as dependências de produção:

```bash
cd /opt/distribuidora
sudo npm install --omit=dev
```

Carregue os 120 produtos de demonstração (15 por categoria):

```bash
sudo -u bebidas /usr/bin/node /opt/distribuidora/scripts/seed-catalog.js
```

Os preços e estoques iniciais são exemplos e podem ser ajustados no painel.

## 4. Criar o primeiro administrador

Execute na WEB01, dentro da pasta do projeto. O script pede nome, e-mail e senha e grava a conta de administrador no MySQL:

```bash
cd /opt/distribuidora
sudo -u bebidas /usr/bin/node /opt/distribuidora/scripts/create-admin.js
```

Escolha uma senha forte de pelo menos 10 caracteres. Não há credencial administrativa padrão. Depois, os demais logins são criados pelo link **Criar conta** na tela inicial.

## 5. Manter o Node.js rodando sem o VS Code

Crie `/etc/systemd/system/distribuidora.service`:

```ini
[Unit]
Description=Site da Distribuidora de Bebidas
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=bebidas
Group=bebidas
WorkingDirectory=/opt/distribuidora
EnvironmentFile=/opt/distribuidora/.env
ExecStart=/usr/bin/node /opt/distribuidora/server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/distribuidora/uploads

[Install]
WantedBy=multi-user.target
```

Ative e inicie:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now distribuidora
sudo systemctl status distribuidora
```

O serviço fica ativo em segundo plano, independente do terminal ou VS Code. Para consultar os registros: `sudo journalctl -u distribuidora -f`.

## 6. Publicar pelo Nginx

Crie `/etc/nginx/sites-available/distribuidora`:

```nginx
server {
    listen 80;
    server_name 192.168.1.10;
    client_max_body_size 6m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ative a configuração e libere a porta web:

```bash
sudo ln -s /etc/nginx/sites-available/distribuidora /etc/nginx/sites-enabled/distribuidora
sudo nginx -t
sudo systemctl reload nginx
sudo ufw allow 80/tcp
```

Acesse `http://192.168.1.10` em um navegador conectado à mesma rede. A porta 3000 fica vinculada a `127.0.0.1`; os navegadores acessam a aplicação pelo Nginx na porta 80. Para publicar na internet, configure domínio e HTTPS no Nginx, atualize `WEB_ORIGIN` para o endereço HTTPS e mude `SESSION_COOKIE_SECURE=true`.

## Rotina de operação

- Reiniciar a aplicação: `sudo systemctl restart distribuidora`
- Conferir aplicação e logs: `sudo systemctl status distribuidora` e `sudo journalctl -u distribuidora -n 100`
- Verificar conexão com o banco: `curl http://127.0.0.1:3000/api/health` na WEB01
- As fotos estão em `/opt/distribuidora/uploads`; faça cópia dessa pasta junto com o backup do MySQL.
- Backup do banco (execute na DB01): `sudo mysqldump distribuidora > distribuidora.sql`.

## Personalização

O nome, textos, identidade visual e cores estão em `public/index.html` e `public/styles.css`. A validação e as rotas da API ficam em `server.js`. O schema MySQL fica em `database/schema.sql`.
