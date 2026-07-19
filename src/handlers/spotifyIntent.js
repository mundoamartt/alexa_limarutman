// Handler do SpotifyIntent: controle remoto via Spotify Connect.
// Ações: tocar / pausar / próxima / anterior / continuar, e tocar uma
// música específica por busca ("toca tal música no spotify").

const Alexa = require('ask-sdk-core');
const spotify = require('../services/spotify');
const { falarSegurando } = require('../lib/progressiveResponse');

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

// Mensagem amigável quando não há dispositivo Spotify ativo.
function semDispositivo(handlerInput) {
  return handlerInput.responseBuilder
    .speak(
      'Não achei nenhum aparelho com o Spotify aberto. ' +
        'Abre o Spotify no seu celular ou computador e tenta de novo.'
    )
    .reprompt('Quer tentar de novo?')
    .getResponse();
}

const SpotifyIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'SpotifyIntent'
    );
  },
  async handle(handlerInput) {
    const acao = valorCanonico(handlerInput, 'acaoSpotify');
    const musica = Alexa.getSlotValue(handlerInput.requestEnvelope, 'musica');

    await falarSegurando(handlerInput, 'Um segundo...');

    try {
      // --- Tocar música específica por busca ---
      if (musica && (!acao || acao === 'tocar')) {
        const tocada = await spotify.playSearch(musica);
        if (!tocada) {
          return handlerInput.responseBuilder
            .speak(`Não achei "${musica}" no Spotify.`)
            .reprompt('Quer tentar outra música?')
            .getResponse();
        }
        return handlerInput.responseBuilder
          .speak(`Tocando ${tocada} no Spotify.`)
          .getResponse();
      }

      // --- Controles de transporte ---
      switch (acao) {
        case 'pausar':
          await spotify.pause();
          return handlerInput.responseBuilder.speak('Pausei o Spotify.').getResponse();
        case 'proxima':
          await spotify.next();
          return handlerInput.responseBuilder.speak('Próxima música.').getResponse();
        case 'anterior':
          await spotify.previous();
          return handlerInput.responseBuilder.speak('Voltando a anterior.').getResponse();
        case 'continuar':
        case 'tocar':
        default:
          await spotify.play();
          return handlerInput.responseBuilder.speak('Tocando no Spotify.').getResponse();
      }
    } catch (erro) {
      console.error('[spotify] erro:', erro.message);
      // Sem dispositivo ativo é o erro mais comum — tratamos com carinho.
      if (erro.reason === 'NO_ACTIVE_DEVICE' || erro.message === 'NO_DEVICE') {
        return semDispositivo(handlerInput);
      }
      // Não autorizado (setup não rodou).
      if (erro.message && erro.message.includes('não autorizado')) {
        return handlerInput.responseBuilder
          .speak('O Spotify ainda não está conectado. Roda o script de configuração primeiro.')
          .getResponse();
      }
      return handlerInput.responseBuilder
        .speak('Tive um problema com o Spotify agora. Tenta de novo?')
        .reprompt('Quer tentar de novo?')
        .getResponse();
    }
  }
};

module.exports = { SpotifyIntentHandler };
