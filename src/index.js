export default {
  async fetch(request, env, ctx) {
    console.log('Incoming request:', {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries())
    });

    const url = new URL(request.url);

    // 统一的 CORS 响应头
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-openai-key',
      'Access-Control-Max-Age': '86400',
    };

    // 处理 CORS 预检请求 - 对所有路径都返回正确的 CORS 头
    if (request.method === 'OPTIONS') {
      console.log('Handling CORS preflight request for:', url.pathname);
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    // GraphQL 路由处理
    if (url.pathname === '/graphql') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      try {
        const { query, variables, operationName } = await request.json();
        console.log('GraphQL request:', { operationName, querySnippet: query?.slice(0, 80) });

        const sendJson = (data, status = 200) => new Response(JSON.stringify({ data }), {
          status,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          },
        });

        const sendGraphQLError = (message, status = 400) => new Response(JSON.stringify({ errors: [{ message }] }), {
          status,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          },
        });

        const normalized = (query || '').replace(/\s+/g, ' ').toLowerCase();

        // createSession
        if (normalized.includes('mutation') && normalized.includes('createsession')) {
          const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          return sendJson({ createSession: { sessionId, success: true } });
        }

        // chatHistory（示例返回空数组）
        if (normalized.includes('query') && normalized.includes('chathistory')) {
          return sendJson({ chatHistory: [] });
        }

        // sendMessage（回显用户消息，便于前端先乐观更新）
        if (normalized.includes('mutation') && normalized.includes('sendmessage')) {
          const input = variables?.input || {};
          const content = input.content || '';
          const message = {
            id: `msg_${Date.now()}_user`,
            content,
            isUser: true,
            timestamp: new Date().toISOString(),
            success: true,
            error: null
          };
          return sendJson({ sendMessage: message });
        }

        // getAIResponse（转发到 OpenAI 并返回 assistant 消息）
        if (normalized.includes('mutation') && normalized.includes('getairesponse')) {
          const resolvedApiKey = request.headers.get('x-openai-key') || env.OPENAI_API_KEY;
          if (!resolvedApiKey) {
            return sendGraphQLError('OpenAI API key is not configured', 500);
          }

          const input = variables?.input || {};
          const openaiRequestBody = {
            model: input.model || 'gpt-3.5-turbo',
            messages: input.messages || [],
            temperature: input.temperature ?? 0.7,
            max_tokens: input.max_tokens ?? 1000,
            stream: false,
            ...input,
          };

          const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${resolvedApiKey}`,
            },
            body: JSON.stringify(openaiRequestBody),
          });

          if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text();
            console.error('OpenAI API error (GraphQL):', errorText);
            return sendGraphQLError(`OpenAI API returned ${openaiResponse.status}: ${errorText}`, openaiResponse.status);
          }

          const responseData = await openaiResponse.json();
          const content = responseData.choices?.[0]?.message?.content || '';
          const message = {
            id: responseData.id || `msg_${Date.now()}_ai`,
            content,
            isUser: false,
            timestamp: new Date().toISOString(),
            success: true,
            error: null,
          };
          return sendJson({ getAIResponse: message });
        }

        return sendGraphQLError('Unsupported GraphQL operation');
      } catch (error) {
        console.error('GraphQL handler error:', error);
        return new Response(JSON.stringify({ errors: [{ message: error.message }] }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          },
        });
      }
    }

    // 只允许 POST 请求（REST API）
    if (request.method !== 'POST') {
      console.log('Method not allowed:', request.method);
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    try {
      // 检查环境变量（允许通过请求头 x-openai-key 覆盖，便于本地联调）
      const resolvedApiKey = request.headers.get('x-openai-key') || env.OPENAI_API_KEY;
      if (!resolvedApiKey) {
        console.error('OPENAI_API_KEY is not set');
        return new Response(JSON.stringify({ 
          error: 'Configuration Error',
          message: 'OpenAI API key is not configured'
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
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
            ...corsHeaders
          },
        });
      }

      console.log('Parsed request body:', requestBody);

      // 验证必要的字段（聊天请求）
      if (!requestBody.messages || !Array.isArray(requestBody.messages)) {
        console.error('Invalid messages format:', requestBody.messages);
        return new Response(JSON.stringify({ 
          error: 'Invalid messages format',
          message: 'messages field is required and must be an array'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
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
          'Authorization': `Bearer ${resolvedApiKey}`,
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
            ...corsHeaders
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
            ...corsHeaders
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
          ...corsHeaders
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
          ...corsHeaders
        },
      });
    }
  },
};
