// Serviço Spotify Connect — controla a reprodução na conta principal.
//
// IMPORTANTE: o Spotify NÃO permite tocar o áudio direto no Echo via Custom
// Skill (restrição de ToS). O que fazemos aqui é CONTROLE remoto via Spotify
// Connect: os comandos (play/pause/próxima) atuam no dispositivo onde o
// Spotify está ativo (celular, computador, TV). Precisa haver um dispositivo
// Spotify ativo/disponível.
//
// Autenticação: o refresh_token é gerado UMA vez pelo script
// scripts/spotify-setup.js e guardado no Supabase. Aqui trocamos o
// refresh_token por um access_token de curta duração quando necessário.

const { supabase } = require('../lib/supabase');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const API = 'https://api.spotify.com/v1';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

// Basic auth exigido no endpoint de token (client_id:client_secret em base64).
function basicAuth() {
  return 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
}

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

async function tokenCacheado() {
  const { data, error } = await supabase
    .from('spotify_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('provider', 'spotify')
    .maybeSingle();
  if (error) {
    console.error('[spotify] erro ao ler token:', error.message);
    return null;
  }
  return data;
}

// Troca o refresh_token por um access_token novo e persiste.
async function renovarAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuth(),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(`Spotify token erro: ${JSON.stringify(json)}`);
  }

  const expiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString();
  // O Spotify às vezes devolve um refresh_token novo; se vier, atualizamos.
  const novoRefresh = json.refresh_token || refreshToken;

  const { error } = await supabase.from('spotify_tokens').upsert({
    provider: 'spotify',
    access_token: json.access_token,
    refresh_token: novoRefresh,
    expires_at: expiresAt
  });
  if (error) console.error('[spotify] erro ao salvar token:', error.message);

  return json.access_token;
}

// Retorna um access_token válido (usa cache; renova se expirado).
async function getToken() {
  const cache = await tokenCacheado();
  if (!cache || !cache.refresh_token) {
    throw new Error(
      'Spotify não autorizado. Rode "npm run spotify:setup" para conectar sua conta.'
    );
  }
  const expiraEm = cache.expires_at ? new Date(cache.expires_at).getTime() : 0;
  if (cache.access_token && expiraEm - Date.now() > 60_000) {
    return cache.access_token;
  }
  return renovarAccessToken(cache.refresh_token);
}

// ---------------------------------------------------------------------------
// Operações do player (Spotify Connect)
// ---------------------------------------------------------------------------

// Faz uma chamada à Web API com o access_token.
async function chamada(method, path, { token, body = null } = {}) {
  const resp = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  // Muitos endpoints do player devolvem 204 (sem corpo) em sucesso.
  if (resp.status === 204) return null;
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const erro = new Error(json.error ? json.error.message : `HTTP ${resp.status}`);
    erro.status = resp.status;
    erro.reason = json.error && json.error.reason;
    throw erro;
  }
  return json;
}

// Retorna o id do primeiro dispositivo disponível (ativo de preferência),
// ou null se não houver nenhum. Necessário porque o Connect precisa de um
// dispositivo alvo.
async function dispositivoAlvo(token) {
  const { devices } = await chamada('GET', '/me/player/devices', { token });
  if (!devices || devices.length === 0) return null;
  const ativo = devices.find((d) => d.is_active);
  return (ativo || devices[0]).id;
}

// Inicia/retoma a reprodução. Se `uris` vier, toca essas faixas.
async function play(uris = null) {
  const token = await getToken();
  const deviceId = await dispositivoAlvo(token);
  if (!deviceId) {
    const e = new Error('NO_DEVICE');
    e.reason = 'NO_ACTIVE_DEVICE';
    throw e;
  }
  const body = uris ? { uris } : undefined;
  await chamada('PUT', `/me/player/play?device_id=${deviceId}`, { token, body });
}

async function pause() {
  const token = await getToken();
  await chamada('PUT', '/me/player/pause', { token });
}

async function next() {
  const token = await getToken();
  await chamada('POST', '/me/player/next', { token });
}

async function previous() {
  const token = await getToken();
  await chamada('POST', '/me/player/previous', { token });
}

// Busca uma faixa por texto e toca a primeira. Retorna o nome tocado, ou null.
async function playSearch(query) {
  const token = await getToken();
  const busca = await chamada(
    'GET',
    `/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
    { token }
  );
  const faixa = busca.tracks && busca.tracks.items && busca.tracks.items[0];
  if (!faixa) return null;

  const deviceId = await dispositivoAlvo(token);
  if (!deviceId) {
    const e = new Error('NO_DEVICE');
    e.reason = 'NO_ACTIVE_DEVICE';
    throw e;
  }
  await chamada('PUT', `/me/player/play?device_id=${deviceId}`, {
    token,
    body: { uris: [faixa.uri] }
  });
  return `${faixa.name}, de ${faixa.artists[0].name}`;
}

module.exports = { play, pause, next, previous, playSearch };
