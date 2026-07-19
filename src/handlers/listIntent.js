// Handler do ListIntent: adiciona itens, lê a lista e marca como concluído.
// A ação vem do slot `acao` (tipo LIST_ACTION, com resolução de sinônimos).
// Se o slot não resolver, inferimos pela presença ou não de item.

const Alexa = require('ask-sdk-core');
const { adicionarItem, listarPendentes, concluirItem } = require('../services/lists');

// Lê o valor canônico resolvido de um slot (via synonyms do interaction model).
// Cai para o valor falado cru se não houver resolução.
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

const ListIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'ListIntent'
    );
  },
  async handle(handlerInput) {
    const deviceId = Alexa.getDeviceId(handlerInput.requestEnvelope);
    const acao = valorCanonico(handlerInput, 'acao');
    const item = Alexa.getSlotValue(handlerInput.requestEnvelope, 'item');

    try {
      // --- LISTAR ---
      // Ação explícita "listar", ou nenhuma ação + nenhum item (ex: "minha lista").
      if (acao === 'listar' || (!acao && !item)) {
        const itens = await listarPendentes(deviceId);
        if (itens.length === 0) {
          return handlerInput.responseBuilder
            .speak('Sua lista está vazia no momento.')
            .reprompt('Quer adicionar alguma coisa?')
            .getResponse();
        }
        const nomes = itens.map((i) => i.item).join(', ');
        return handlerInput.responseBuilder
          .speak(`Na sua lista tem: ${nomes}.`)
          .reprompt('Quer adicionar ou concluir algum item?')
          .getResponse();
      }

      // --- CONCLUIR ---
      if (acao === 'concluir') {
        if (!item) {
          return handlerInput.responseBuilder
            .speak('Qual item você quer marcar como concluído?')
            .reprompt('Qual item?')
            .getResponse();
        }
        const marcado = await concluirItem(deviceId, item);
        if (!marcado) {
          return handlerInput.responseBuilder
            .speak(`Não achei "${item}" na sua lista de pendentes.`)
            .reprompt('Quer tentar outro item?')
            .getResponse();
        }
        return handlerInput.responseBuilder
          .speak(`Pronto, marquei "${marcado.item}" como concluído.`)
          .reprompt('Mais alguma coisa?')
          .getResponse();
      }

      // --- ADICIONAR --- (ação "adicionar", ou default quando há item)
      if (!item) {
        return handlerInput.responseBuilder
          .speak('O que você quer adicionar na lista?')
          .reprompt('O que devo adicionar?')
          .getResponse();
      }
      await adicionarItem(deviceId, item);
      return handlerInput.responseBuilder
        .speak(`Adicionei "${item}" na sua lista.`)
        .reprompt('Quer adicionar mais alguma coisa?')
        .getResponse();
    } catch (erro) {
      console.error('[list] erro:', erro.message);
      return handlerInput.responseBuilder
        .speak('Tive um problema pra mexer na sua lista agora. Tenta de novo?')
        .reprompt('Quer tentar de novo?')
        .getResponse();
    }
  }
};

module.exports = { ListIntentHandler };
