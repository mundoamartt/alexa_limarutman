# Minha Assistente — Alexa Custom Skill com Claude

Alexa Custom Skill (pt-BR) que usa o **Claude (Anthropic)** como cérebro conversacional,
com controle de dispositivos, listas e rádios. Hospedada como **endpoint HTTPS no Vercel**
(deploy via GitHub), persistência no **Supabase**.

> **Status: todas as fases implementadas** — Conversa (Claude), Listas, Alimentador (Tuya),
> Rádios (AudioPlayer) e Spotify (Connect). Falta você configurar as credenciais e fazer o deploy.

---

## Arquitetura

```
Echo (voz) → Alexa (reconhecimento + interaction model)
           → POST HTTPS → Vercel (api/alexa.js)
                            ├─ verifica assinatura da Alexa
                            └─ ASK SDK (skill.invoke)
                                 ├─ Claude API (conversa)
                                 ├─ Supabase (histórico, listas, rádios, tokens)
                                 ├─ Tuya Cloud (alimentador)
                                 └─ Spotify Connect (música)
```

A Alexa aceita dois tipos de endpoint: AWS Lambda **ou** um endpoint HTTPS próprio.
Usamos o segundo, no Vercel — que já fornece HTTPS com certificado válido (exigência da
Alexa) e faz deploy automático a cada `git push`. Por ser endpoint próprio, a função
**verifica a assinatura** de cada requisição (obrigatório na certificação da Amazon).

---

## Pré-requisitos

- **Node.js 18+** (só para testes locais e `npm run spotify:setup`)
- Conta na [Amazon Developer](https://developer.amazon.com/) (grátis) — **não precisa de AWS**
- Conta no [Vercel](https://vercel.com/) ligada ao seu GitHub
- Projeto no [Supabase](https://supabase.com/)
- Chave da API Anthropic

---

## Estrutura do projeto

```
alexa-assistente/
├── vercel.json                 # config da função (maxDuration)
├── package.json                # deps na raiz (Vercel instala daqui)
├── .env.example / .env         # variáveis (local; em prod vão no painel do Vercel)
├── api/
│   └── alexa.js                # endpoint HTTPS: verifica assinatura + skill.invoke
├── src/
│   ├── skill.js                # monta o Skill do ASK SDK (.create())
│   ├── handlers/               # request handlers
│   ├── services/               # claude, tuya, spotify, radio, lists
│   └── lib/                    # supabase + progressiveResponse
├── scripts/
│   └── spotify-setup.js        # OAuth do Spotify (roda 1x local)
├── skill-package/
│   ├── skill.json              # manifesto (endpoint = URL do Vercel)
│   └── interactionModels/custom/pt-BR.json
└── sql/                        # schema.sql + seed_radios.sql
```

---

## Passo a passo do deploy

### 1. Supabase — criar tabelas
No **SQL Editor** do Supabase, rode em ordem:
1. [`sql/schema.sql`](sql/schema.sql) — cria as tabelas
2. [`sql/seed_radios.sql`](sql/seed_radios.sql) — popula as 10 rádios

### 2. GitHub — subir o repositório
Suba este projeto para um repositório no GitHub (o Vercel vai ler dele).

### 3. Vercel — importar e configurar
1. No Vercel, **Add New → Project** e importe o repositório do GitHub.
2. Em **Settings → Environment Variables**, adicione (no mínimo):
   - `ANTHROPIC_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_KEY` (a **service_role key** — o backend precisa escrever nas tabelas)
   - (Tuya e Spotify quando for usar esses recursos)
3. **Deploy**. Anote a URL final, algo como `https://seu-projeto.vercel.app`.
   O endpoint da skill é essa URL **+ `/api/alexa`**.

> A cada `git push`, o Vercel refaz o deploy automaticamente.

### 4. Alexa Developer Console — criar a skill
1. Em [developer.amazon.com/alexa/console/ask](https://developer.amazon.com/alexa/console/ask),
   **Create Skill** → nome "Minha Assistente", locale **Português (BR)**, modelo **Custom**,
   hosting **Provision your own**.
2. Em **Interaction Model → JSON Editor**, cole o conteúdo de
   [`skill-package/interactionModels/custom/pt-BR.json`](skill-package/interactionModels/custom/pt-BR.json)
   e **Save + Build Model**.
3. Em **Endpoint**, escolha **HTTPS**, e no campo de URL cole
   `https://seu-projeto.vercel.app/api/alexa`. No dropdown do certificado, escolha
   *"My development endpoint has a certificate from a trusted certificate authority"*.
4. **Save Endpoints**.

### 5. Testar e usar
- **Console**: aba **Test** → mude para **Development** → fale/digite "abre minha assistente".
- **No seu Echo**: como a skill está no **modo desenvolvimento** na sua conta, ela já
  aparece habilitada em qualquer Echo logado no **mesmo login** (o seu). Não precisa
  publicar na loja — é só falar "Alexa, abre minha assistente".
- **Logs**: no painel do Vercel, aba **Logs** da função (prefixos `[conversation]`,
  `[claude]`, `[alexa]`, `[error]`).

> **Precisa publicar?** Não, para uso pessoal. A publicação na loja (com certificação) só
> é necessária se outras contas Amazon forem instalar a skill.

---

## Guia: configurar a Tuya (alimentador de gatos)

Usamos autenticação via **Cloud Project** (client_id + secret), que **não desloga** —
diferente da Skill oficial da Tuya. Passo a passo:

### 1. Criar o Cloud Project
1. Entre em [iot.tuya.com](https://iot.tuya.com/) e crie uma conta de desenvolvedor (gratuita).
2. Vá em **Cloud → Development → Create Cloud Project**.
3. Dê um nome, escolha **Industry: Smart Home**, **Development Method: Custom**.
4. Em **Data Center**, escolha a região da sua conta do app Smart Life:
   - Brasil/Américas → **Western America Data Center** → endpoint `https://openapi.tuyaus.com` (padrão)
   - Se sua conta foi criada na Europa → **Central Europe** → `https://openapi.tuyaeu.com`
   - (defina `TUYA_ENDPOINT` no `.env` / painel do Vercel se não for o padrão das Américas)
5. Após criar, anote o **Access ID/Client ID** e o **Access Secret/Client Secret**.
   → esses são o `TUYA_CLIENT_ID` e `TUYA_CLIENT_SECRET`.

### 2. Vincular sua conta Smart Life ao projeto
1. No projeto, aba **Devices → Link App Account → Add App Account**.
2. Escaneie o QR Code com o app **Smart Life** (Perfil → ícone de scan no topo).
3. Isso vincula todos os seus dispositivos (incluindo o alimentador) ao projeto.

### 3. Habilitar a API
1. Aba **Service API → Go to Authorize**.
2. Habilite ao menos **IoT Core** (e **Device Status Notification** se disponível).

### 4. Descobrir o Device ID do alimentador
1. Aba **Devices → All Devices** — encontre o alimentador na lista.
2. Copie o **Device ID** → esse é o `TUYA_DEVICE_ID`.

### 5. Confirmar os códigos DP (data points) do seu modelo
Alimentadores variam: alguns usam `switch` (liga/desliga), outros `manual_feed`
(porções). Depois do deploy, rode uma vez o `FeederIntent` de status ("como está o
alimentador") e veja nos **Logs do Vercel** o retorno de `getFeederStatus()` — ele lista
todos os DP do seu device. Se o seu não usar `switch`, defina no ambiente:
- `TUYA_CODE_SWITCH` — código para ligar/desligar
- `TUYA_CODE_MANUAL_FEED` — código para alimentação manual

> **Agendamento:** o `scheduleFeeding()` depende do DP `meal_plan`, cujo formato é
> específico de cada modelo (geralmente base64). Está deixado como ponto de extensão —
> veja o comentário em `services/tuya.js`.

---

## Guia: rádios customizadas (AudioPlayer)

1. Rode [`sql/schema.sql`](sql/schema.sql) (cria `radio_stations`) e depois
   [`sql/seed_radios.sql`](sql/seed_radios.sql) para popular as estações.
2. As 10 URLs do seed foram **verificadas em 19/07/2026** (todas HTTP 200, `audio/aacp`,
   HTTPS — compatível com o AudioPlayer). Ainda assim, URLs de rádio mudam com o tempo;
   se alguma parar, ache o mount novo (ex.: em `radio-browser.info`) e atualize a linha.
   Para testar rápido:
   ```bash
   curl -I "https://a-url-do-stream"   # deve dar 200 + Content-Type de áudio
   ```
3. Para adicionar/trocar rádios, é só editar a tabela `radio_stations`
   (`name`, `stream_url`, `aliases`) — não precisa mexer no código. Se quiser que a
   Alexa reconheça o nome falado com mais precisão, adicione também no slot `RADIO_NAME`
   do interaction model e faça deploy.
4. Uso: "toca a CBN", "coloca a Kiss FM", "quero ouvir a Antena 1". Para parar: "para".

## Guia: conectar o Spotify (uma vez)

Controle remoto via **Spotify Connect** (o áudio sai no aparelho onde o Spotify está
aberto — celular/PC —, não no Echo; é a única forma dentro do ToS do Spotify).

1. Em [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard),
   crie um app. Anote **Client ID** e **Client Secret**.
2. Em **Settings → Redirect URIs**, adicione exatamente: `http://127.0.0.1:8888/callback`
3. Preencha no `.env` (raiz): `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`,
   `SPOTIFY_REDIRECT_URI=http://127.0.0.1:8888/callback`
4. Rode o setup (uma vez, da raiz do projeto):
   ```bash
   npm run spotify:setup
   ```
   O navegador abre, você autoriza, e o `refresh_token` é salvo no Supabase.
5. Uso: "toca no spotify", "pausa o spotify", "próxima música",
   "toca [música] no spotify". Precisa ter o Spotify **aberto e ativo** em algum aparelho.

---

## Decisões de arquitetura já tomadas

- **Histórico persistente entre sessões** (Supabase): o Claude lembra de conversas
  anteriores. Limite de **10 turnos** enviados por chamada para controlar tokens/latência.
- **Progressive Response**: uma fala curta ("Deixa eu pensar...") é dita antes da
  resposta do Claude, para não haver silêncio quando a API demora > 3s.
- **Modelo**: `claude-sonnet-4-6`, `max_tokens: 250`, system prompt pedindo respostas
  curtas e naturais para fala em pt-BR.
- **Spotify**: apenas a conta principal (única), via Spotify Connect (controle remoto;
  o áudio sai no aparelho onde o Spotify está aberto, não no Echo).
- **Hospedagem**: endpoint HTTPS no Vercel (deploy via GitHub), não AWS Lambda. A função
  `api/alexa.js` verifica a assinatura de cada requisição da Alexa.

---

## Roadmap

| Fase | Escopo | Status |
|------|--------|--------|
| 1 | Esqueleto + ConversationIntent (Claude) | ✅ Concluída |
| 2 | ListIntent (CRUD de listas no Supabase) | ✅ Concluída |
| 3 | FeederIntent (Tuya Cloud Project + controle) | ✅ Concluída |
| 4 | RadioIntent (AudioPlayer) + SpotifyIntent (Connect) | ✅ Concluída |
| 5 | Deploy + README completo | ✅ Concluída |
