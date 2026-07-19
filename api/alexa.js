// Endpoint HTTPS da skill no Vercel (função serverless).
// Skill em modo desenvolvimento — sem verificação de assinatura.
// TODO: reativar SkillRequestSignatureVerifier antes de publicar na Store.

require('dotenv').config();

const { skill } = require('../src/skill');

const handler = async (req, res) => {
  // Health check (GET)
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(
      JSON.stringify({
        ok: true,
        servico: 'alexa-assistente',
        env: {
          ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
          SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
          SUPABASE_KEY: Boolean(process.env.SUPABASE_KEY)
        }
      })
    );
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // Vercel já parseia o body como JSON por padrão.
  // req.body é o objeto JavaScript com o requestEnvelope da Alexa.
  const requestEnvelope = req.body;
  if (!requestEnvelope || !requestEnvelope.version) {
    console.error('[alexa] requestEnvelope inválido:', JSON.stringify(requestEnvelope));
    res.status(400).send('Invalid Alexa request');
    return;
  }

  console.log('[alexa] request type:', requestEnvelope.request && requestEnvelope.request.type);

  try {
    const responseEnvelope = await skill.invoke(requestEnvelope);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(responseEnvelope));
  } catch (erro) {
    console.error('[alexa] erro no skill.invoke:', erro.message, '\n', erro.stack);
    res.status(500).send('Internal Server Error');
  }
};

module.exports = handler;
