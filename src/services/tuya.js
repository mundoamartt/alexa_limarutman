// Serviço Tuya Cloud API — controla o alimentador de gatos.
//
// Autenticação via CLOUD PROJECT (client_id + client_secret), NÃO por
// usuário/senha. Isso evita o problema de "ficar deslogando": o token é
// gerado por assinatura HMAC-SHA256 e pode ser renovado indefinidamente
// com as credenciais do projeto.
//
// O access_token é cacheado na tabela `tuya_tokens` do Supabase para não
// pedirmos token novo a cada comando (economiza latência e rate limit).
//
// Referência de assinatura: https://developer.tuya.com/en/docs/iot/singnature

const crypto = require('crypto');
const { supabase } = require('../lib/supabase');

const CLIENT_ID = process.env.TUYA_CLIENT_ID;
const CLIENT_SECRET = process.env.TUYA_CLIENT_SECRET;
const DEVICE_ID = process.env.TUYA_DEVICE_ID;

// Endpoint do data center. O padrão aqui é o das Américas (onde contas
// registradas no Brasil normalmente ficam). Sobrescreva com TUYA_ENDPOINT
// se sua conta estiver em outra região (ver guia no README).
const ENDPOINT = process.env.TUYA_ENDPOINT || 'https://openapi.tuyaus.com';

// Códigos DP (data points) do dispositivo. Alimentadores variam de modelo
// para modelo — estes são os padrões mais comuns, mas confirme via
// getFeederStatus() e sobrescreva por env se necessário.
//   - "switch": liga/desliga (bool). Alguns modelos usam isso.
//   - "manual_feed": dispara alimentação manual (int = porções).
const CODE_SWITCH = process.env.TUYA_CODE_SWITCH || 'switch';
const CODE_MANUAL_FEED = process.env.TUYA_CODE_MANUAL_FEED || 'manual_feed';

// SHA-256 de um corpo (string vazia tem hash conhecido).
function sha256(body) {
  return crypto.createHash('sha256').update(body || '', 'utf8').digest('hex');
}

// HMAC-SHA256 em hex maiúsculo, como a Tuya exige.
function hmac(str) {
  return crypto
    .createHmac('sha256', CLIENT_SECRET)
    .update(str, 'utf8')
    .digest('hex')
    .toUpperCase();
}

// Monta o "stringToSign" comum aos dois tipos de requisição.
// Formato: METHOD \n Content-SHA256 \n Headers \n Url
function stringToSign(method, path, body) {
  return [method, sha256(body), '', path].join('\n');
}

// Faz uma requisição assinada à Tuya.
// - Se `accessToken` for null, é uma chamada de TOKEN (assinatura sem token).
// - Caso contrário, é uma chamada de negócio (assinatura inclui o token).
async function requisicaoAssinada(method, path, { body = '', accessToken = null } = {}) {
  const t = Date.now().toString();
  const corpo = body ? JSON.stringify(body) : '';
  const str = stringToSign(method, path, corpo);

  // A string a assinar difere entre token e negócio.
  const strParaAssinar = accessToken
    ? CLIENT_ID + accessToken + t + str
    : CLIENT_ID + t + str;

  const headers = {
    client_id: CLIENT_ID,
    sign: hmac(strParaAssinar),
    t,
    sign_method: 'HMAC-SHA256',
    'Content-Type': 'application/json'
  };
  if (accessToken) headers.access_token = accessToken;

  const resposta = await fetch(`${ENDPOINT}${path}`, {
    method,
    headers,
    body: corpo || undefined
  });

  const json = await resposta.json();
  if (!json.success) {
    throw new Error(`Tuya API erro ${json.code}: ${json.msg}`);
  }
  return json.result;
}

// ---------------------------------------------------------------------------
// Gestão de token (cache no Supabase)
// ---------------------------------------------------------------------------

// Busca o token cacheado no Supabase, se ainda válido (com 60s de margem).
async function tokenCacheado() {
  const { data, error } = await supabase
    .from('tuya_tokens')
    .select('access_token, expires_at')
    .eq('provider', 'tuya')
    .maybeSingle();

  if (error || !data || !data.access_token) return null;

  const expiraEm = new Date(data.expires_at).getTime();
  if (expiraEm - Date.now() < 60_000) return null; // expirado ou quase

  return data.access_token;
}

// Pede um token novo à Tuya (grant_type=1 = modo simples do Cloud Project)
// e persiste no Supabase.
async function obterTokenNovo() {
  const result = await requisicaoAssinada('GET', '/v1.0/token?grant_type=1');
  const accessToken = result.access_token;
  // expire_time vem em segundos (normalmente 7200).
  const expiresAt = new Date(Date.now() + result.expire_time * 1000).toISOString();

  const { error } = await supabase
    .from('tuya_tokens')
    .upsert({
      provider: 'tuya',
      access_token: accessToken,
      refresh_token: result.refresh_token,
      expires_at: expiresAt
    });
  if (error) console.error('[tuya] erro ao salvar token:', error.message);

  return accessToken;
}

// Retorna um access_token válido: usa o cache se possível, senão renova.
async function getToken() {
  const cache = await tokenCacheado();
  if (cache) return cache;
  return obterTokenNovo();
}

// ---------------------------------------------------------------------------
// Operações do alimentador
// ---------------------------------------------------------------------------

// Retorna o status bruto do dispositivo: lista de { code, value } com todos
// os data points (bateria, nível de ração, etc.). Útil também para DESCOBRIR
// os códigos DP corretos do seu modelo de alimentador.
async function getFeederStatus() {
  const token = await getToken();
  const status = await requisicaoAssinada(
    'GET',
    `/v1.0/devices/${DEVICE_ID}/status`,
    { accessToken: token }
  );
  return status; // ex: [{ code: 'battery_percentage', value: 80 }, ...]
}

// Liga/desliga o alimentador (ou dispara alimentação, conforme o modelo).
// `state` = true (ligar/alimentar) ou false (desligar).
async function toggleFeeder(state) {
  const token = await getToken();
  const commands = [{ code: CODE_SWITCH, value: !!state }];
  return requisicaoAssinada('POST', `/v1.0/devices/${DEVICE_ID}/commands`, {
    body: { commands },
    accessToken: token
  });
}

// Dispara alimentação manual imediata de N porções (para modelos que usam
// o DP `manual_feed`). Muitos alimentadores não têm on/off e sim porções.
async function feedNow(porcoes = 1) {
  const token = await getToken();
  const commands = [{ code: CODE_MANUAL_FEED, value: porcoes }];
  return requisicaoAssinada('POST', `/v1.0/devices/${DEVICE_ID}/commands`, {
    body: { commands },
    accessToken: token
  });
}

// Agendamento de horário de alimentação.
// ATENÇÃO: o agendamento na Tuya usa o DP `meal_plan`, cujo formato é
// específico do modelo (geralmente uma string codificada em base64 com os
// horários e porções). Sem conhecer o formato exato do SEU alimentador não
// dá para montar isso às cegas. Esta função está deixada como ponto de
// extensão: rode getFeederStatus() para ver o code do plano no seu device
// e implemente a codificação conforme a doc do modelo.
async function scheduleFeeding(/* time */) {
  throw new Error(
    'Agendamento (meal_plan) depende do formato específico do seu modelo de ' +
    'alimentador. Rode getFeederStatus() para descobrir o DP e implemente a ' +
    'codificação conforme a documentação do dispositivo.'
  );
}

module.exports = {
  getFeederStatus,
  toggleFeeder,
  feedNow,
  scheduleFeeding
};
