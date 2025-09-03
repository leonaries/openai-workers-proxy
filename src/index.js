export default {
  async fetch(request, env, ctx) {
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 只允许 POST 请求
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { 
        status: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    try {
      // 获取请求体
      const requestBody = await request.json();
      
      // 验证必要的字段
      if (!requestBody.messages || !Array.isArray(requestBody.messages)) {
        return new Response(JSON.stringify({ error: 'Invalid messages format' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // 准备发送给 OpenAI 的请求体
      const openaiRequestBody = {
        model: requestBody.model || 'gpt-3.5-turbo',
        messages: requestBody.messages,
        temperature: requestBody.temperature || 0.7,
        max_tokens: requestBody.max_tokens || 1000,
        stream: requestBody.stream || false,
        ...requestBody // 允许传递其他参数
      };

      // 调用 OpenAI API
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(openaiRequestBody),
      });

      // 处理流式响应
      if (requestBody.stream) {
        return new Response(openaiResponse.body, {
          status: openaiResponse.status,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // 处理普通响应
      const responseData = await openaiResponse.json();
      
      return new Response(JSON.stringify(responseData), {
        status: openaiResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (error) {
      console.error('Error:', error);
      
      return new Response(JSON.stringify({ 
        error: 'Internal Server Error',
        message: error.message 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
