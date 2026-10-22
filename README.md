# Painel de disponibilidade — Fazenda São Bento

Aplicação web **separada** da landing page do empreendimento, hospedável gratuitamente no GitHub Pages. Permite importar manualmente a resposta JSON do mapa do CV CRM para o Supabase do projeto Fazenda São Bento.

## Publicar o painel

1. Abra **Settings → Pages** neste repositório.
2. Em **Build and deployment / Source**, escolha **Deploy from a branch**.
3. Selecione **main**, **/(root)**, depois **Save**.
4. Após a publicação, abra **https://gustaprojects014.github.io/fazenda-sao-bento-painel/**.

O GitHub Pages hospeda os arquivos estáticos (`index.html`, `admin.css`, `admin.js`). A tela é publicamente acessível, mas **a importação exige autenticação do Supabase** e inscrição explícita na tabela privada `map_import_admins`. Não contém chave `service_role` nem token do CV CRM.

## Como atualizar os lotes

1. Entre no painel de corretor do CV CRM com a sua conta e abra o mapa Fazenda São Bento.
2. No navegador: **F12 → Rede → Fetch/XHR**, localize a resposta da rota `.../mapadisponibilidade/22/map/50/servidor` e salve **somente o JSON da resposta**, sem cookies, tokens, senha ou exportação HAR.
3. Abra o endereço do painel administrativo e entre com seu login previamente criado no **Supabase Auth**.
4. Selecione `.json` ou `.txt` contendo o JSON; clique em **Validar arquivo**.
5. Confira o resumo, confirme sua autorização e clique em **Publicar**.
6. O mapa público consulta a última importação no Supabase e mostra a data da atualização.

## Arquitetura e limitações

- **Site público:** repositório privado `GustaProjects014/fazenda-s-o-bento` — separado deste painel.
- **Autenticação:** Supabase Auth; acesso a importação permitido pelo back-end para IDs presentes em `public.map_import_admins`.
- **Importação:** Edge Function Supabase `map-import-admin`, que valida conteúdo e só troca o snapshot publicado após gravá-lo.
- **Leitura pública:** Edge Function `lot-map-public`.
- **Sem sincronização automática:** os status mudam apenas quando você envia um novo JSON; informações podem ficar desatualizadas.
- **Atenção à planta:** o posicionamento dos marcadores ainda usa uma calibração provisória e precisa ser validado sobre a mesma imagem usada no site antes de divulgar os status como geograficamente corretos.
- **Legenda confirmada:** código `3` / cor vermelha `EC5D59` representa **Vendido**. O backend grava `vendido`, e a prévia mostra “Vendidos (vermelho)”.
- **Privacidade:** não compartilhar nem versionar senhas, tokens, cookies, arquivos completos de clientes ou relatórios privados do CV CRM. O painel não publica dados pessoais dos compradores.

Este repositório guarda apenas código do painel, enquanto o banco, os privilégios e a publicação do snapshot continuam no Supabase. Para o uso da imagem e dos dados comerciais, mantenha a autorização do responsável pelo empreendimento.


## Correção de classificação — 22/10/2026

O usuário confirmou que os lotes vermelhos mostrados anteriormente como “Bloqueados/Indisponíveis” são **Vendidos**. O backend `map-import-admin` está atualizado e 73 registros antigos foram corrigidos no Supabase. Os lotes azuis continuam “Em processo” e os cinzas “A confirmar”.
