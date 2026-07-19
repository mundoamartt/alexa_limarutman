// Handlers padrão: Ajuda, Parar e Cancelar.

const Alexa = require('ask-sdk-core');

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent'
    );
  },
  handle(handlerInput) {
    const fala =
      'Você pode me fazer qualquer pergunta, tipo "me conta uma curiosidade". ' +
      'Pode gerenciar listas dizendo "adiciona leite na lista". ' +
      'Pode ligar o alimentador dizendo "liga o alimentador". ' +
      'Ou tocar uma rádio dizendo "toca a CBN". O que você quer fazer?';
    return handlerInput.responseBuilder
      .speak(fala)
      .reprompt('Como posso te ajudar?')
      .getResponse();
  }
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    const tipo = Alexa.getRequestType(handlerInput.requestEnvelope);
    if (tipo !== 'IntentRequest') return false;
    const nome = Alexa.getIntentName(handlerInput.requestEnvelope);
    return nome === 'AMAZON.CancelIntent' || nome === 'AMAZON.StopIntent';
  },
  handle(handlerInput) {
    // addAudioPlayerStopDirective é inofensivo se nada estiver tocando, e
    // para o stream caso a rádio esteja no ar quando o usuário diz "para".
    return handlerInput.responseBuilder
      .speak('Até mais! <break time="200ms"/> Qualquer coisa, é só me chamar.')
      .addAudioPlayerStopDirective()
      .getResponse();
  }
};

module.exports = { HelpIntentHandler, CancelAndStopIntentHandler };
