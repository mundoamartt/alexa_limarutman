// Handlers relacionados ao AudioPlayer.
//
// 1) AudioPlayerEventHandler: a Alexa envia eventos assíncronos durante a
//    reprodução (PlaybackStarted, PlaybackFinished, PlaybackFailed, etc.).
//    A skill DEVE responder a eles — normalmente com uma resposta vazia — ou
//    o sistema registra erro. Aqui só logamos (útil para depurar PlaybackFailed).
//
// 2) PauseIntentHandler / ResumeIntentHandler: controlam a reprodução por voz.
//    Para rádio ao vivo, pausar = parar o stream; retomar = tocar de novo.

const Alexa = require('ask-sdk-core');

const AudioPlayerEventHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope).startsWith('AudioPlayer.');
  },
  handle(handlerInput) {
    const tipo = Alexa.getRequestType(handlerInput.requestEnvelope);
    const req = handlerInput.requestEnvelope.request;

    // PlaybackFailed traz o motivo — essencial para depurar URL/HTTPS quebrado.
    if (tipo === 'AudioPlayer.PlaybackFailed') {
      console.error('[audio] PlaybackFailed:', JSON.stringify(req.error || {}));
    } else {
      console.log(`[audio] evento ${tipo} | token=${req.token}`);
    }

    // Eventos de AudioPlayer não podem devolver fala; resposta vazia.
    return handlerInput.responseBuilder.getResponse();
  }
};

const PauseIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.PauseIntent'
    );
  },
  handle(handlerInput) {
    // Para o stream. Em rádio ao vivo não há "posição" para retomar.
    return handlerInput.responseBuilder
      .addAudioPlayerStopDirective()
      .getResponse();
  }
};

const ResumeIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.ResumeIntent'
    );
  },
  handle(handlerInput) {
    // Rádio ao vivo não tem estado salvo; pedimos o nome de novo.
    return handlerInput.responseBuilder
      .speak('Qual rádio você quer que eu toque?')
      .reprompt('Qual rádio?')
      .getResponse();
  }
};

module.exports = { AudioPlayerEventHandler, PauseIntentHandler, ResumeIntentHandler };
