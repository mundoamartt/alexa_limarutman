// Serviço que conversa com a API da Anthropic (Claude) e gerencia o
// histórico de conversa, persistido no Supabase para lembrar entre sessões.

const Anthropic = require('@anthropic-ai/sdk');
const { supabase } = require('../lib/supabase');

// Cliente Anthropic instanciado sob demanda (lazy) — assim o módulo não
// quebra no import se ANTHROPIC_API_KEY estiver ausente no ambiente.
let _anthropic = null;
function anthropic() {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY ausente no ambiente');
    }
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

// Modelo e limites otimizados para VOZ:
// - respostas curtas (max_tokens baixo) porque é fala, não texto
// - Sonnet é rápido e inteligente o suficiente
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 250;
const MAX_TURNOS = 10; // quantos pares user/assistant enviamos ao Claude

// Instruções de sistema: pedimos respostas naturais e faladas em pt-BR.
const SYSTEM_PROMPT = [
  'Você é uma assistente doméstica falando por uma caixa de som Alexa.',
  'Responda SEMPRE em português do Brasil.',
  'Seja natural, calorosa e conversacional, como uma pessoa falando.',
  'Respostas curtas: no máximo 2 ou 3 frases. É fala, não texto — nada de listas, tópicos ou markdown.',
  'Se não souber algo, admita de forma leve. Nunca invente dados como horários, preços ou notícias.'
].join(' ');

// Busca os últimos turnos de conversa desse device no Supabase.
async function carregarHistorico(deviceId) {
  const { data, error } = await supabase
    .from('conversation_history')
    .select('role, content')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(MAX_TURNOS * 2); // *2 porque cada turno tem user + assistant

  if (error) {
    console.error('[claude] erro ao carregar histórico:', error.message);
    return [];
  }

  // Veio em ordem decrescente (mais recente primeiro); invertemos para
  // ficar na ordem cronológica que a API espera.
  return (data || []).reverse().map((linha) => ({
    role: linha.role,
    content: linha.content
  }));
}

// Salva um turno (user ou assistant) no histórico.
async function salvarTurno(deviceId, role, content) {
  const { error } = await supabase
    .from('conversation_history')
    .insert({ device_id: deviceId, role, content });

  if (error) {
    console.error('[claude] erro ao salvar turno:', error.message);
  }
}

// Função principal: recebe a pergunta do usuário e devolve a resposta do Claude.
async function conversar(deviceId, perguntaUsuario) {
  const historico = await carregarHistorico(deviceId);

  const mensagens = [
    ...historico,
    { role: 'user', content: perguntaUsuario }
  ];

  const resposta = await anthropic().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: mensagens
  });

  const textoResposta = resposta.content[0].text.trim();

  // Persiste os dois lados do turno (não bloqueia a resposta se falhar).
  await salvarTurno(deviceId, 'user', perguntaUsuario);
  await salvarTurno(deviceId, 'assistant', textoResposta);

  return textoResposta;
}

module.exports = { conversar };
