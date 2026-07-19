// Serviço de rádios: resolve o nome falado para uma estação da tabela
// radio_stations. Primeiro tenta pelo nome canônico (que o slot RADIO_NAME
// já resolve), depois cai para busca por alias / texto parcial.

const { supabase } = require('../lib/supabase');

// Busca uma estação pelo nome canônico exato.
async function porNomeCanonico(nome) {
  const { data, error } = await supabase
    .from('radio_stations')
    .select('name, stream_url')
    .eq('name', nome)
    .maybeSingle();
  if (error) {
    console.error('[radio] erro busca canônica:', error.message);
    return null;
  }
  return data;
}

// Busca por texto: tenta bater no nome (parcial) ou nos aliases.
async function porTexto(texto) {
  // 1) nome parcial
  const { data: porNome } = await supabase
    .from('radio_stations')
    .select('name, stream_url')
    .ilike('name', `%${texto}%`)
    .limit(1);
  if (porNome && porNome.length) return porNome[0];

  // 2) alias (array contains) — precisa bater o alias inteiro
  const { data: porAlias } = await supabase
    .from('radio_stations')
    .select('name, stream_url')
    .contains('aliases', [texto])
    .limit(1);
  if (porAlias && porAlias.length) return porAlias[0];

  return null;
}

// Resolve o nome falado (valor bruto ou canônico) para uma estação.
async function resolverRadio(nomeFalado) {
  if (!nomeFalado) return null;
  const termo = nomeFalado.trim().toLowerCase();

  // Tenta canônico primeiro, depois texto/alias.
  return (await porNomeCanonico(termo)) || (await porTexto(termo));
}

module.exports = { resolverRadio };
