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

  try {
    const { messages } = JSON.parse(event.body);

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

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Si Gemini devuelve error, lo mostramos
    if (data.error) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          choices: [{ message: { content: `Error Gemini: ${data.error.message}` } }]
        }),
      };
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                 `Sin respuesta. Data: ${JSON.stringify(data)}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ choices: [{ message: { content: text } }] }),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ choices: [{ message: { content: `Error: ${err.message}` } }] }),
    };
  }
};
