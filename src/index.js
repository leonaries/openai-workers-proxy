export default {
  async fetch(request, env, ctx) {
    console.log('Incoming request:', {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries())
    });

    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      console.log('Handling CORS preflight request');
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
      console.log('Method not allowed:', request.method);
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    try {
      // 检查环境变量
      if (!env.OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY is not set');
        return new Response(JSON.stringify({ 
          error: 'Configuration Error',
          message: 'OpenAI API key is not configured'
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // 获取请求体
      let requestBody;
      try {
        const requestText = await request.text();
        console.log('Request body text:', requestText);
        requestBody = JSON.parse(requestText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError.message);
        return new Response(JSON.stringify({ 
          error: 'Invalid JSON',
          message: 'Request body is not valid JSON'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      console.log('Parsed request body:', requestBody);
      
      // 验证必要的字段
      if (!requestBody.messages || !Array.isArray(requestBody.messages)) {
        console.error('Invalid messages format:', requestBody.messages);
        return new Response(JSON.stringify({ 
          error: 'Invalid messages format',
          message: 'messages field is required and must be an array'
        }), {
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

      console.log('Sending request to OpenAI:', {
        model: openaiRequestBody.model,
        messagesCount: openaiRequestBody.messages.length,
        stream: openaiRequestBody.stream
      });

      // 调用 OpenAI API
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(openaiRequestBody),
      });

      console.log('OpenAI response status:', openaiResponse.status);
      console.log('OpenAI response headers:', Object.fromEntries(openaiResponse.headers.entries()));

      // 检查 OpenAI API 响应状态
      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('OpenAI API error:', errorText);
        
        return new Response(JSON.stringify({
          error: 'OpenAI API Error',
          message: `OpenAI API returned ${openaiResponse.status}: ${errorText}`,
          status: openaiResponse.status
        }), {
          status: openaiResponse.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // 处理流式响应
      if (requestBody.stream) {
        console.log('Returning streaming response');
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
      console.log('OpenAI response data:', {
        id: responseData.id,
        model: responseData.model,
        choices: responseData.choices?.length
      });
      
      return new Response(JSON.stringify(responseData), {
        status: openaiResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (error) {
      console.error('Unhandled error:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      return new Response(JSON.stringify({ 
        error: 'Internal Server Error',
        message: error.message,
        type: error.name
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
