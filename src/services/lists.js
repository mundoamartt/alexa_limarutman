// Serviço de listas: CRUD simples sobre a tabela `lists` do Supabase.
// Lista compartilhada por device_id (uso doméstico, mesmo login).

const { supabase } = require('../lib/supabase');

// Adiciona um item pendente na lista.
async function adicionarItem(deviceId, item) {
  const { error } = await supabase
    .from('lists')
    .insert({ device_id: deviceId, item, status: 'pendente' });

  if (error) {
    console.error('[lists] erro ao adicionar:', error.message);
    throw error;
  }
}

// Retorna os itens pendentes (mais antigos primeiro).
async function listarPendentes(deviceId) {
  const { data, error } = await supabase
    .from('lists')
    .select('id, item')
    .eq('device_id', deviceId)
    .eq('status', 'pendente')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[lists] erro ao listar:', error.message);
    throw error;
  }
  return data || [];
}

// Marca como concluído o item pendente cujo texto mais se parece com o pedido.
// Usa ilike (case-insensitive, parcial) porque a transcrição de voz raramente
// bate 100% com o texto salvo. Retorna o item marcado, ou null se não achou.
async function concluirItem(deviceId, item) {
  // Busca candidatos pendentes que contenham o termo falado.
  const { data, error } = await supabase
    .from('lists')
    .select('id, item')
    .eq('device_id', deviceId)
    .eq('status', 'pendente')
    .ilike('item', `%${item}%`)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    console.error('[lists] erro ao buscar p/ concluir:', error.message);
    throw error;
  }
  if (!data || data.length === 0) {
    return null;
  }

  const alvo = data[0];
  const { error: erroUpdate } = await supabase
    .from('lists')
    .update({ status: 'concluido' })
    .eq('id', alvo.id);

  if (erroUpdate) {
    console.error('[lists] erro ao concluir:', erroUpdate.message);
    throw erroUpdate;
  }
  return alvo;
}

module.exports = { adicionarItem, listarPendentes, concluirItem };
