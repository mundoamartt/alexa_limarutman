-- ============================================================
-- Schema do Supabase para a Alexa Assistente
-- Fase 1: apenas conversation_history.
-- As demais tabelas entram nas fases seguintes (ver comentários).
-- ============================================================

-- Fase 1 — Histórico de conversa com o Claude.
-- Guardamos cada turno (user/assistant) por device_id da Alexa.
create table if not exists conversation_history (
  id          bigint generated always as identity primary key,
  device_id   text not null,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

-- Índice para carregar rápido os últimos turnos de um device.
create index if not exists idx_conversation_history_device_time
  on conversation_history (device_id, created_at desc);


-- Fase 2 — Listas (compartilhadas por device_id).
-- Um item por linha. status controla se foi concluído.
create table if not exists lists (
  id          bigint generated always as identity primary key,
  device_id   text not null,
  item        text not null,
  status      text not null default 'pendente' check (status in ('pendente', 'concluido')),
  tags        text[],
  created_at  timestamptz not null default now()
);

-- Índice para listar rápido os itens pendentes de um device.
create index if not exists idx_lists_device_status
  on lists (device_id, status, created_at);


-- ============================================================
-- As tabelas abaixo serão criadas nas próximas fases.
-- Deixadas aqui comentadas como referência do plano completo.
-- ============================================================

-- Fase 3 — Token da Tuya (cache single-row).
-- provider é a PK para permitir upsert (sempre a mesma linha 'tuya').
-- Cacheamos o access_token entre invocações do Lambda para não pedir
-- token novo a cada comando (evita latência e rate limit).
create table if not exists tuya_tokens (
  provider       text primary key default 'tuya',
  access_token   text,
  refresh_token  text,
  expires_at     timestamptz
);

-- Fase 4 — Rádios.
-- name = valor canônico (bate com o slot RADIO_NAME do interaction model).
-- aliases = variações faladas, para resolver por texto quando o slot não casar.
-- IMPORTANTE: stream_url DEVE ser HTTPS com certificado válido — a Alexa
-- não toca streams HTTP puro no AudioPlayer.
create table if not exists radio_stations (
  id          bigint generated always as identity primary key,
  name        text not null,
  stream_url  text not null,
  aliases     text[]
);

create index if not exists idx_radio_stations_name on radio_stations (name);

-- Fase 4 — Token do Spotify (cache single-row, mesma ideia da Tuya).
-- O refresh_token é o que importa (gerado uma vez pelo script de setup);
-- o access_token é renovado a partir dele quando expira.
create table if not exists spotify_tokens (
  provider       text primary key default 'spotify',
  access_token   text,
  refresh_token  text,
  expires_at     timestamptz
);
