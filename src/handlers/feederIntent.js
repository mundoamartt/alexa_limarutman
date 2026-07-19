// Handler do FeederIntent: liga/desliga o alimentador e consulta status.
// A ação vem do slot `acao` (FEEDER_ACTION: ligar / desligar / status).

const Alexa = require('ask-sdk-core');
const { getFeederStatus, toggleFeeder } = require('../services/tuya');
const { falarSegurando } = require('../lib/progressiveResponse');

// Lê o valor canônico resolvido de um slot (via synonyms do interaction model).
function valorCanonico(handlerInput, nomeSlot) {
  const slot = Alexa.getSlot(handlerInput.requestEnvelope, nomeSlot);
  if (!slot) return null;
  const resolucoes = slot.resolutions && slot.resolutions.resolutionsPerAuthority;
  if (resolucoes) {
    for (const autoridade of resolucoes) {
      if (autoridade.status.code === 'ER_SUCCESS_MATCH') {
        return autoridade.values[0].value.name;
      }
    }
  }
  return slot.value || null;
}

// Monta uma frase amigável a partir do status bruto do dispositivo.
function resumirStatus(status) {
  // status é uma lista de { code, value }. Procuramos alguns DP comuns.
  const mapa = {};
  for (const dp of status) mapa[dp.code] = dp.value;

  const partes = [];
  if (typeof mapa.battery_percentage === 'number') {
    partes.push(`bateria em ${mapa.battery_percentage} por cento`);
  }
  // Alguns modelos reportam nível/quantidade de ração com nomes variados.
  if (typeof mapa.feed_state === 'string') {
    partes.push(`estado: ${mapa.feed_state}`);
  }

  if (partes.length === 0) {
    return 'O alimentador está conectado e respondendo.';
  }
  return `O alimentador está conectado. ${partes.join(', ')}.`;
}

const FeederIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'FeederIntent'
    );
  },
  async handle(handlerInput) {
    const acao = valorCanonico(handlerInput, 'acao') || 'ligar';

    // Segura a conversa: a chamada à Tuya pode demorar.
    await falarSegurando(handlerInput, 'Só um instante...');

    try {
      // --- STATUS ---
      if (acao === 'status') {
        const status = await getFeederStatus();
        return handlerInput.responseBuilder
          .speak(resumirStatus(status))
          .reprompt('Quer que eu ligue o alimentador?')
          .getResponse();
      }

      // --- LIGAR / DESLIGAR ---
      const ligar = acao === 'ligar';
      await toggleFeeder(ligar);
      const fala = ligar
        ? 'Pronto, acionei o alimentador. Os gatos agradecem! <break time="200ms"/> Miau.'
        : 'Ok, desliguei o alimentador.';
      return handlerInput.responseBuilder
        .speak(fala)
        .reprompt('Mais alguma coisa?')
        .getResponse();
    } catch (erro) {
      console.error('[feeder] erro:', erro.message);
      return handlerInput.responseBuilder
        .speak('Não consegui falar com o alimentador agora. Verifica se ele está online e tenta de novo?')
        .reprompt('Quer tentar de novo?')
        .getResponse();
    }
  }
};

module.exports = { FeederIntentHandler };
