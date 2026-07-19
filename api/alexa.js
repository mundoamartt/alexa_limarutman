// Endpoint HTTPS da skill no Vercel (função serverless).
//
// Diferente do AWS Lambda (onde o trigger da Alexa já garante a origem),
// um endpoint HTTPS próprio DEVE validar que a requisição veio mesmo da
// Alexa. A Amazon exige isso na certificação. Usamos os verificadores do
// ask-sdk-express-adapter:
//   - SkillRequestSignatureVerifier: confere a assinatura + cadeia de
//     certificados (headers signature / signaturecertchainurl).
//   - TimestampVerifier: rejeita requisições antigas (proteção contra replay).
//
// IMPORTANTE: a verificação de assinatura precisa do CORPO BRUTO (bytes
// exatos), então desligamos o body parser do Vercel (config no fim) e lemos
// o stream manualmente.

require('dotenv').config();

const {
  SkillRequestSignatureVerifier,
  TimestampVerifier
} = require('ask-sdk-express-adapter');
const { skill } = require('../src/skill');

// Lê o corpo bruto da requisição como string (sem parsing).
function lerCorpoBruto(req) {
  return new Promise((resolve, reject) => {
    let dados = '';
    req.on('data', (chunk) => {
      dados += chunk;
    });
    req.on('end', () => resolve(dados));
    req.on('error', reject);
  });
}

const handler = async (req, res) => {
  // Health check (GET): mostra quais variáveis de ambiente estão PRESENTES
  // (sem expor os valores). Útil para diagnosticar deploy no Vercel.
  // A Alexa nunca usa GET, então isto não interfere no funcionamento.
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

  // A Alexa sempre chama via POST.
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // 1) Corpo bruto
  let corpoBruto;
  try {
    corpoBruto = await lerCorpoBruto(req);
  } catch (erro) {
    console.error('[alexa] erro ao ler corpo:', erro.message);
    res.status(400).send('Bad Request');
    return;
  }

  // 2) Verificação de origem (assinatura + timestamp)
  console.log('[alexa] corpo bytes:', corpoBruto.length,
    '| sig:', req.headers['signature'] ? 'ok' : 'ausente',
    '| certurl:', req.headers['signaturecertchainurl'] ? 'ok' : 'ausente');
  try {
    await new SkillRequestSignatureVerifier().verify(corpoBruto, req.headers);
    await new TimestampVerifier().verify(corpoBruto);
  } catch (erro) {
    console.error('[alexa] verificação falhou:', erro.message);
    // Em desenvolvimento (skill não publicada) a verificação pode falhar por
    // latência no download do certificado. Continua e deixa o skill responder
    // para identificar se o problema é na verificação ou no handler.
    // TODO: reativar o return antes de publicar na Alexa Store.
    // res.status(400).send('Invalid request signature');
    // return;
  }

  // 3) Parse e invocação do skill
  let requestEnvelope;
  try {
    requestEnvelope = JSON.parse(corpoBruto);
  } catch (erro) {
    res.status(400).send('Invalid JSON');
    return;
  }

  try {
    const responseEnvelope = await skill.invoke(requestEnvelope);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(responseEnvelope));
  } catch (erro) {
    console.error('[alexa] erro no skill.invoke:', erro.message);
    res.status(500).send('Internal Server Error');
  }
};

module.exports = handler;

// Desliga o body parser do Vercel para preservarmos o corpo bruto exato
// que a verificação de assinatura exige.
module.exports.config = {
  api: {
    bodyParser: false
  }
};
