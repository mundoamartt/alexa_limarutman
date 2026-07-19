// Handlers de lista — divididos em três intents porque o slot do item é
// AMAZON.SearchQuery (slot de frase), que NÃO pode dividir uma frase com
// outro slot. Então a AÇÃO é definida pelo intent (não por um slot):
//   - AddListItemIntent      → adicionar
//   - CompleteListItemIntent → concluir
//   - ReadListIntent         → ler
//
// A lista é compartilhada por device_id.

const Alexa = require('ask-sdk-core');
const { adicionarItem, listarPendentes, concluirItem } = require('../services/lists');

// --- Adicionar item ---
const AddListItemHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'AddListItemIntent'
    );
  },
  async handle(handlerInput) {
    const deviceId = Alexa.getDeviceId(handlerInput.requestEnvelope);
    const item = Alexa.getSlotValue(handlerInput.requestEnvelope, 'item');

    if (!item) {
      return handlerInput.responseBuilder
        .speak('O que você quer adicionar na lista?')
        .reprompt('O que devo adicionar?')
        .getResponse();
    }
    try {
      await adicionarItem(deviceId, item);
      return handlerInput.responseBuilder
        .speak(`Adicionei "${item}" na sua lista.`)
        .reprompt('Quer adicionar mais alguma coisa?')
        .getResponse();
    } catch (erro) {
      console.error('[list:add] erro:', erro.message);
      return handlerInput.responseBuilder
        .speak('Tive um problema pra adicionar na lista agora. Tenta de novo?')
        .reprompt('Quer tentar de novo?')
        .getResponse();
    }
  }
};

// --- Concluir/remover item ---
const CompleteListItemHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'CompleteListItemIntent'
    );
  },
  async handle(handlerInput) {
    const deviceId = Alexa.getDeviceId(handlerInput.requestEnvelope);
    const item = Alexa.getSlotValue(handlerInput.requestEnvelope, 'item');

    if (!item) {
      return handlerInput.responseBuilder
        .speak('Qual item você quer marcar como concluído?')
        .reprompt('Qual item?')
        .getResponse();
    }
    try {
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
    } catch (erro) {
      console.error('[list:complete] erro:', erro.message);
      return handlerInput.responseBuilder
        .speak('Tive um problema pra mexer na sua lista agora. Tenta de novo?')
        .reprompt('Quer tentar de novo?')
        .getResponse();
    }
  }
};

// --- Ler a lista ---
const ReadListHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'ReadListIntent'
    );
  },
  async handle(handlerInput) {
    const deviceId = Alexa.getDeviceId(handlerInput.requestEnvelope);
    try {
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
    } catch (erro) {
      console.error('[list:read] erro:', erro.message);
      return handlerInput.responseBuilder
        .speak('Tive um problema pra ler sua lista agora. Tenta de novo?')
        .reprompt('Quer tentar de novo?')
        .getResponse();
    }
  }
};

module.exports = { AddListItemHandler, CompleteListItemHandler, ReadListHandler };
