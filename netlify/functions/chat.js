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

  try {
    const { messages } = JSON.parse(event.body);

    // Separar system prompt del resto
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    // Convertir al formato de Gemini
    const geminiContents = chatMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const body = {
      system_instruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
      contents: geminiContents,
      generationConfig: { maxOutputTokens: 1000 }
    };

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Adaptar respuesta al formato que espera el frontend (igual que OpenAI)
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Error al obtener respuesta.';
    const adapted = {
      choices: [{ message: { content: text } }]
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(adapted),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: { message: err.message } }),
    };
  }
};
