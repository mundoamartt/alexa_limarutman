// Handler do RadioIntent: resolve o nome da rádio na tabela radio_stations
// e retorna uma diretiva AudioPlayer.Play com a URL do stream.

const Alexa = require('ask-sdk-core');
const { resolverRadio } = require('../services/radio');

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

const RadioIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'RadioIntent'
    );
  },
  async handle(handlerInput) {
    // Preferimos o valor canônico do slot; se não resolveu, usamos o cru.
    const nomeFalado =
      valorCanonico(handlerInput, 'radio') ||
      Alexa.getSlotValue(handlerInput.requestEnvelope, 'radio');

    if (!nomeFalado) {
      return handlerInput.responseBuilder
        .speak('Qual rádio você quer ouvir?')
        .reprompt('Qual rádio?')
        .getResponse();
    }

    try {
      const estacao = await resolverRadio(nomeFalado);
      if (!estacao) {
        return handlerInput.responseBuilder
          .speak(`Não encontrei a rádio "${nomeFalado}" na sua lista. Quer tentar outra?`)
          .reprompt('Qual rádio você quer ouvir?')
          .getResponse();
      }

      // token identifica o stream para os eventos de AudioPlayer que virão.
      const token = `radio:${estacao.name}`;

      return handlerInput.responseBuilder
        .speak(`Tocando ${estacao.name}.`)
        .addAudioPlayerPlayDirective(
          'REPLACE_ALL', // substitui qualquer áudio anterior na fila
          estacao.stream_url,
          token,
          0, // offset em ms
          null
        )
        .getResponse();
    } catch (erro) {
      console.error('[radio] erro:', erro.message);
      return handlerInput.responseBuilder
        .speak('Tive um problema pra tocar a rádio agora. Tenta de novo?')
        .reprompt('Qual rádio você quer ouvir?')
        .getResponse();
    }
  }
};

module.exports = { RadioIntentHandler };
