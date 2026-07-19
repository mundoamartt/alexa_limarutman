// Handler do SessionEndedRequest: disparado quando a sessão termina
// (timeout, usuário disse "para", ou erro). Aqui só logamos — não é
// possível devolver fala numa resposta de SessionEnded.

const Alexa = require('ask-sdk-core');

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    const motivo = handlerInput.requestEnvelope.request.reason;
    console.log(`[session] sessão encerrada. Motivo: ${motivo}`);
    return handlerInput.responseBuilder.getResponse();
  }
};

module.exports = { SessionEndedRequestHandler };
