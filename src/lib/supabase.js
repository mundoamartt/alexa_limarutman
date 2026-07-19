// Cliente Supabase compartilhado por todos os serviços e handlers.
// Instanciado uma única vez e reaproveitado entre invocações do Lambda
// (fica em cache enquanto o container do Lambda estiver "quente").

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    auth: {
      // Não precisamos de sessão de usuário aqui: usamos a service key
      // e identificamos tudo pelo device_id da Alexa.
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

module.exports = { supabase };
