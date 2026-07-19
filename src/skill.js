// Constrói e configura o Skill do ASK SDK.
//
// Diferente da versão Lambda (que terminava em .lambda()), aqui usamos
// .create() para obter um objeto Skill que sabemos INVOCAR manualmente
// (skill.invoke) a partir do endpoint HTTPS no Vercel (api/alexa.js).
//
// A ordem dos handlers importa: o SDK testa canHandle() de cima pra baixo
// e usa o primeiro que retornar true.

const Alexa = require('ask-sdk-core');

const { LaunchRequestHandler } = require('./handlers/launchRequest');
const { ConversationIntentHandler } = require('./handlers/conversationIntent');
const {
  AddListItemHandler,
  CompleteListItemHandler,
  ReadListHandler
} = require('./handlers/listIntent');
const { FeederIntentHandler } = require('./handlers/feederIntent');
const { RadioIntentHandler } = require('./handlers/radioIntent');
const { SpotifyIntentHandler } = require('./handlers/spotifyIntent');
const {
  AudioPlayerEventHandler,
  PauseIntentHandler,
  ResumeIntentHandler
} = require('./handlers/audioPlayer');
const { HelpIntentHandler, CancelAndStopIntentHandler } = require('./handlers/help');
const { SessionEndedRequestHandler } = require('./handlers/sessionEnded');
const { ErrorHandler } = require('./handlers/error');

const skill = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    ConversationIntentHandler,
    AddListItemHandler,
    CompleteListItemHandler,
    ReadListHandler,
    FeederIntentHandler,
    RadioIntentHandler,
    SpotifyIntentHandler,
    PauseIntentHandler,
    ResumeIntentHandler,
    AudioPlayerEventHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withCustomUserAgent('minha-assistente/1.0')
  .create();

module.exports = { skill };
