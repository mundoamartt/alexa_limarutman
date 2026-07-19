// Script de SETUP do Spotify — rode UMA vez na sua máquina:
//   npm run spotify:setup
//
// Ele: (1) abre o navegador na tela de autorização do Spotify,
//      (2) sobe um servidor local para receber o código de autorização,
//      (3) troca o código pelo refresh_token,
//      (4) salva o refresh_token no Supabase (tabela spotify_tokens).
//
// Pré-requisitos no .env (na raiz do projeto):
//   SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI,
//   SUPABASE_URL, SUPABASE_KEY
//
// No Spotify Developer Dashboard, cadastre EXATAMENTE o mesmo redirect URI
// (recomendado: http://127.0.0.1:8888/callback).

require('dotenv').config();
const http = require('http');
const { URL } = require('url');
const { createClient } = require('@supabase/supabase-js');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:8888/callback';

// Escopos necessários para CONTROLAR a reprodução via Connect.
const SCOPES = ['user-modify-playback-state', 'user-read-playback-state'].join(' ');

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Faltam SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET no .env');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
  auth: { persistSession: false }
});

const redirect = new URL(REDIRECT_URI);
const PORT = redirect.port || 8888;

// URL de autorização que abriremos no navegador.
const authUrl =
  'https://accounts.spotify.com/authorize?' +
  new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES
  }).toString();

// Troca o "code" pelo refresh_token.
async function trocarCodigoPorToken(code) {
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization:
        'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI
    })
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(JSON.stringify(json));
  return json;
}

// Abre o navegador padrão (Windows/mac/Linux) na URL.
function abrirNavegador(url) {
  const { exec } = require('child_process');
  const cmd =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;
  exec(cmd, { shell: true }, (err) => {
    if (err) {
      console.log('Não consegui abrir o navegador automaticamente.');
      console.log('Abra manualmente esta URL:\n', url);
    }
  });
}

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith(redirect.pathname)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const code = url.searchParams.get('code');
  const erro = url.searchParams.get('error');

  if (erro) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h2>Autorização negada: ${erro}</h2>`);
    console.error('Autorização negada:', erro);
    server.close();
    return;
  }

  try {
    const token = await trocarCodigoPorToken(code);
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

    const { error } = await supabase.from('spotify_tokens').upsert({
      provider: 'spotify',
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: expiresAt
    });
    if (error) throw error;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>Spotify conectado! Pode fechar esta aba.</h2>');
    console.log('\n✅ Spotify conectado e refresh_token salvo no Supabase.');
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>Erro ao salvar o token. Veja o terminal.</h2>');
    console.error('Erro:', e.message);
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  console.log(`Servidor de setup ouvindo em ${REDIRECT_URI}`);
  console.log('Abrindo o navegador para autorização do Spotify...');
  abrirNavegador(authUrl);
});
