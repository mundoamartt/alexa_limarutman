// ErrorHandler genérico: captura qualquer erro não tratado nos outros
// handlers e devolve uma fala graciosa em vez de a skill "morrer" muda.

const ErrorHandler = {
  canHandle() {
    return true; // captura todos os erros
  },
  handle(handlerInput, error) {
    console.error('[error] erro não tratado:', error.message);
    console.error(error.stack);

    return handlerInput.responseBuilder
      .speak('Ops, alguma coisa deu errado aqui. Pode tentar de novo?')
      .reprompt('Pode repetir, por favor?')
      .getResponse();
  }
};

module.exports = { ErrorHandler };
