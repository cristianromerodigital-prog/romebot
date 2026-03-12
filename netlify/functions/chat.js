exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const { messages } = JSON.parse(event.body);

  // ── 1. INTENTAR OPENAI ────────────────────────────────
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 1000, messages }),
      });

      const data = await res.json();

      // Si hay créditos y responde bien, devolvemos directo
      if (data.choices?.[0]?.message?.content) {
        return { statusCode: 200, headers, body: JSON.stringify(data) };
      }

      // Si el error NO es de quota/billing, lo devolvemos igual
      const errCode = data.error?.code || '';
      const isQuotaError = errCode === 'insufficient_quota' || errCode === 'billing_hard_limit_reached';
      if (!isQuotaError) {
        return { statusCode: 200, headers, body: JSON.stringify(data) };
      }

      // Si es quota → caemos a Gemini
      console.log('OpenAI sin créditos, usando Gemini como fallback...');
    } catch (e) {
      console.log('OpenAI falló, usando Gemini como fallback:', e.message);
    }
  }

  // ── 2. FALLBACK: GEMINI ───────────────────────────────
  if (process.env.GEMINI_API_KEY) {
    try {
      const systemMsg = messages.find(m => m.role === 'system');
      const chatMessages = messages.filter(m => m.role !== 'system');

      const geminiContents = chatMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const body = {
        contents: geminiContents,
        generationConfig: { maxOutputTokens: 1000 }
      };
      if (systemMsg) {
        body.system_instruction = { parts: [{ text: systemMsg.content }] };
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ choices: [{ message: { content: text } }] }),
        };
      }
    } catch (e) {
      console.log('Gemini también falló:', e.message);
    }
  }

  // ── 3. AMBOS FALLARON ─────────────────────────────────
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      choices: [{ message: { content: 'Servicio temporalmente no disponible. Intentá en unos minutos.' } }]
    }),
  };
};
