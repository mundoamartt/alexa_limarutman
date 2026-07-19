// Helper para enviar uma "Progressive Response": uma fala curta que a Alexa
// diz IMEDIATAMENTE enquanto ainda estamos processando (chamada ao Claude ou
// à Tuya, que podem passar de 3s). Isso segura a conversa e evita silêncio
// desconfortável antes da resposta final.

const https = require('https');

async function falarSegurando(handlerInput, texto) {
  try {
    const requestEnvelope = handlerInput.requestEnvelope;
    const apiEndpoint = requestEnvelope.context.System.apiEndpoint;
    const apiAccessToken = requestEnvelope.context.System.apiAccessToken;
    const requestId = requestEnvelope.request.requestId;

    const payload = JSON.stringify({
      header: { requestId },
      directive: {
        type: 'VoicePlayer.Speak',
        speech: texto
      }
    });

    const url = new URL(`${apiEndpoint}/v1/directives`);

    await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiAccessToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        },
        (res) => {
          res.on('data', () => {});
          res.on('end', resolve);
        }
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  } catch (erro) {
    // Progressive response é "melhor esforço": se falhar, seguimos sem ela.
    console.error('[progressive] falhou:', erro.message);
  }
}

module.exports = { falarSegurando };
