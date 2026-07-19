// Cliente Supabase compartilhado por todos os serviços e handlers.
//
// Instanciação PREGUIÇOSA (lazy): o cliente só é criado na primeira vez que
// alguém usa `supabase.algumMetodo(...)`. Isso é importante em serverless —
// se as variáveis de ambiente não estiverem presentes, o módulo NÃO quebra
// no import (o que derrubaria a função inteira, até health checks). Em vez
// disso, o erro só aparece quando o Supabase é realmente chamado.

const { createClient } = require('@supabase/supabase-js');

let _client = null;

function clienteReal() {
  if (!_client) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      throw new Error('SUPABASE_URL e/ou SUPABASE_KEY ausentes no ambiente');
    }
    _client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
      auth: {
        // Usamos a service key e identificamos tudo pelo device_id da Alexa.
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return _client;
}

// Proxy que encaminha qualquer acesso (supabase.from, supabase.rpc, ...)
// para o cliente real, criando-o sob demanda.
const supabase = new Proxy(
  {},
  {
    get(_alvo, prop) {
      const real = clienteReal();
      const valor = real[prop];
      return typeof valor === 'function' ? valor.bind(real) : valor;
    }
  }
);

module.exports = { supabase };
