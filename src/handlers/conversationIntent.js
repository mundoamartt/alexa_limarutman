// Handler do ConversationIntent: o coração da skill.
// Pega a pergunta aberta do usuário, chama o Claude com o histórico e
// devolve a resposta falada. Usa Progressive Response para segurar a
// conversa enquanto o Claude pensa.

const Alexa = require('ask-sdk-core');
const { conversar } = require('../services/claude');
const { falarSegurando } = require('../lib/progressiveResponse');

const ConversationIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'ConversationIntent'
    );
  },
  async handle(handlerInput) {
    const pergunta = Alexa.getSlotValue(handlerInput.requestEnvelope, 'query');

    // Se por algum motivo não veio a pergunta, pedimos de novo.
    if (!pergunta || !pergunta.trim()) {
      return handlerInput.responseBuilder
        .speak('Desculpa, não entendi. Pode repetir?')
        .reprompt('Pode repetir sua pergunta?')
        .getResponse();
    }

    // device_id identifica de forma estável o aparelho Alexa — usamos como
    // chave do histórico no Supabase.
    const deviceId = Alexa.getDeviceId(handlerInput.requestEnvelope);

    // Segura a conversa: a Alexa fala isso na hora, antes do Claude responder.
    await falarSegurando(handlerInput, 'Deixa eu pensar...');

    try {
      const inicio = Date.now();
      const resposta = await conversar(deviceId, pergunta.trim());
      console.log(`[conversation] Claude respondeu em ${Date.now() - inicio}ms`);

      return handlerInput.responseBuilder
        .speak(resposta)
        .reprompt('Quer saber mais alguma coisa?')
        .getResponse();
    } catch (erro) {
      console.error('[conversation] erro ao chamar Claude:', erro.message);
      return handlerInput.responseBuilder
        .speak('Desculpa, tive um problema pra pensar agora. Tenta de novo daqui a pouco?')
        .reprompt('Quer tentar de novo?')
        .getResponse();
    }
  }
};

module.exports = { ConversationIntentHandler };
