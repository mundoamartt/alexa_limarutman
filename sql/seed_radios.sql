-- ============================================================
-- SEED de rádios para a tabela radio_stations.
--
-- ✅ URLs VERIFICADAS em 2026-07-19: todas responderam HTTP 200 com
--    Content-Type audio/aacp sobre HTTPS (formato AAC+, compatível com o
--    AudioPlayer da Alexa). Streams via Triton/streamtheworld e crossradio.
--
-- Observações:
-- - A Alexa (AudioPlayer) SÓ toca HTTPS com certificado válido — todas abaixo são HTTPS.
-- - URLs de rádio mudam com o tempo; se alguma parar de tocar, procure o
--   mount atualizado (ex.: na API pública radio-browser.info) e atualize a linha.
-- - As "livestream-redirect" apontam para um nó que muda de número; use sempre
--   a URL de redirect (estável), não o nó final.
-- - Como testar rápido uma URL:  curl -I "https://a-url-do-stream"
-- ============================================================

insert into radio_stations (name, stream_url, aliases) values
  ('cbn',          'https://playerservices.streamtheworld.com/api/livestream-redirect/CBN_SP_ADP_SC.aac',      array['rádio cbn','a cbn']),
  ('band news',    'https://playerservices.streamtheworld.com/api/livestream-redirect/BANDNEWSFM_SPAAC.aac',   array['band','band news fm','bandnews']),
  ('radio globo',  'https://playerservices.streamtheworld.com/api/livestream-redirect/RADIO_GLOBO_RJAAC.aac',  array['globo','rádio globo','a globo']),
  ('antena 1',     'https://antenaone.crossradio.com.br/stream/1',                                             array['antena um','antena one','a antena']),
  ('kiss fm',      'https://playerservices.streamtheworld.com/api/livestream-redirect/RADIO_KISSFMAAC.aac',    array['kiss','a kiss']),
  ('nova brasil',  'https://playerservices.streamtheworld.com/api/livestream-redirect/NOVABRASIL_SPAAC.aac',   array['nova brasil fm','novabrasil']),
  ('alpha fm',     'https://playerservices.streamtheworld.com/api/livestream-redirect/RADIO_ALPHAFM_ADP.aac',  array['alpha','alfa']),
  ('mix fm',       'https://playerservices.streamtheworld.com/api/livestream-redirect/MIXFM_SAOPAULOAAC.aac',  array['mix','a mix']),
  ('transamerica', 'https://playerservices.streamtheworld.com/api/livestream-redirect/RT_SPAAC.aac',           array['transamérica','trans américa']),
  ('radio rock',   'https://playerservices.streamtheworld.com/api/livestream-redirect/RADIO_89FM_ADP.aac',     array['rádio rock','a rádio rock','oitenta e nove','89 fm'])
on conflict do nothing;
