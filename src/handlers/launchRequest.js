// Handler do LaunchRequest: disparado quando o usuário abre a skill
// ("Alexa, abre minha assistente") sem pedir nada específico.

const Alexa = require('ask-sdk-core');

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  handle(handlerInput) {
    // SSML leve: uma pausa curta deixa a saudação menos robótica.
    const fala =
      'Oi! Eu sou sua assistente. <break time="300ms"/> ' +
      'Posso responder perguntas, cuidar das suas listas, ligar o alimentador dos gatos e tocar suas rádios. O que você quer?';

    return handlerInput.responseBuilder
      .speak(fala)
      .reprompt('Pode falar, estou te ouvindo.')
      .getResponse();
  }
};

module.exports = { LaunchRequestHandler };
