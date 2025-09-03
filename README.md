# OpenAI Workers Proxy

一个基于 Cloudflare Workers 的 OpenAI API 代理服务，支持 CORS 跨域请求，专为前端聊天应用设计。

## 功能特性

- 🔄 OpenAI API 代理转发
- 🌐 完整的 CORS 支持
- 📡 支持流式响应 (Server-Sent Events)
- 🛡️ 安全的 API Key 管理
- ⚡ 基于 Cloudflare Workers，全球边缘部署
- 📝 支持所有 OpenAI Chat Completions 参数

## 部署步骤

### 1. 克隆项目

```bash
git clone https://github.com/leonaries/openai-workers-proxy.git
cd openai-workers-proxy
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置 Wrangler

确保已安装 Wrangler CLI：

```bash
npm install -g wrangler
```

登录 Cloudflare 账户：

```bash
wrangler login
```

### 4. 设置环境变量

在 Cloudflare Workers Dashboard 中设置环境变量，或使用命令行：

```bash
# 设置生产环境的 OpenAI API Key
wrangler secret put OPENAI_API_KEY
```

### 5. 部署到 Cloudflare Workers

```bash
npm run deploy
```

## 本地开发

```bash
# 启动本地开发服务器
npm run dev

# 或者使用本地模式
npm run test
```

## API 使用方法

### 请求格式

```javascript
POST https://your-worker-domain.workers.dev/

// 请求体
{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "stream": false
}
```

### 前端调用示例

```javascript
// 普通请求
async function sendMessage(message) {
  const response = await fetch('https://your-worker-domain.workers.dev/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

// 流式请求
async function sendStreamMessage(message, onChunk) {
  const response = await fetch('https://your-worker-domain.workers.dev/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: message }
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        const data = JSON.parse(line.slice(6));
        const content = data.choices[0]?.delta?.content;
        if (content) {
          onChunk(content);
        }
      }
    }
  }
}
```

### React Hook 示例

```javascript
import { useState } from 'react';

function useOpenAI(workerUrl) {
  const [loading, setLoading] = useState(false);

  const sendMessage = async (messages, options = {}) => {
    setLoading(true);
    try {
      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages,
          temperature: 0.7,
          max_tokens: 1000,
          ...options
        })
      });

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { sendMessage, loading };
}
```

## 支持的参数

此代理支持 OpenAI Chat Completions API 的所有参数：

- `model` - 模型名称 (默认: gpt-3.5-turbo)
- `messages` - 消息数组 (必需)
- `temperature` - 温度参数 (默认: 0.7)
- `max_tokens` - 最大令牌数 (默认: 1000)
- `stream` - 是否启用流式响应 (默认: false)
- `top_p` - Top-p 采样
- `frequency_penalty` - 频率惩罚
- `presence_penalty` - 存在惩罚
- 以及其他 OpenAI API 支持的参数

## 错误处理

API 返回标准的 HTTP 状态码：

- `200` - 成功
- `400` - 请求格式错误
- `405` - 方法不允许 (只支持 POST)
- `500` - 服务器内部错误

错误响应格式：

```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

## 安全注意事项

1. **API Key 安全**: 永远不要在前端代码中暴露 OpenAI API Key
2. **域名限制**: 建议在生产环境中限制允许的域名
3. **速率限制**: 考虑添加速率限制以防止滥用
4. **监控**: 定期监控 API 使用量和成本

## 前端集成示例

### HTML + JavaScript

```html
<!DOCTYPE html>
<html>
<head>
    <title>OpenAI Chat</title>
</head>
<body>
    <div id="chat"></div>
    <input type="text" id="messageInput" placeholder="输入消息...">
    <button onclick="sendMessage()">发送</button>

    <script>
        const WORKER_URL = 'https://your-worker-domain.workers.dev/';
        const chatDiv = document.getElementById('chat');
        const messageInput = document.getElementById('messageInput');
        
        async function sendMessage() {
            const message = messageInput.value.trim();
            if (!message) return;
            
            // 显示用户消息
            appendMessage('用户', message);
            messageInput.value = '';
            
            try {
                const response = await fetch(WORKER_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'gpt-3.5-turbo',
                        messages: [
                            { role: 'user', content: message }
                        ],
                        temperature: 0.7,
                        max_tokens: 1000
                    })
                });
                
                const data = await response.json();
                const reply = data.choices[0].message.content;
                appendMessage('AI', reply);
            } catch (error) {
                appendMessage('错误', '发送消息失败: ' + error.message);
            }
        }
        
        function appendMessage(sender, content) {
            const messageDiv = document.createElement('div');
            messageDiv.innerHTML = `<strong>${sender}:</strong> ${content}`;
            chatDiv.appendChild(messageDiv);
        }
        
        // 按回车发送消息
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    </script>
</body>
</html>
```

### Vue.js 集成

```vue
<template>
  <div class="chat-container">
    <div class="messages">
      <div 
        v-for="message in messages" 
        :key="message.id"
        :class="['message', message.role]"
      >
        <strong>{{ message.role === 'user' ? '你' : 'AI' }}:</strong>
        {{ message.content }}
      </div>
    </div>
    <div class="input-container">
      <input 
        v-model="newMessage"
        @keyup.enter="sendMessage"
        :disabled="loading"
        placeholder="输入消息..."
      >
      <button @click="sendMessage" :disabled="loading || !newMessage.trim()">
        {{ loading ? '发送中...' : '发送' }}
      </button>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      messages: [],
      newMessage: '',
      loading: false,
      workerUrl: 'https://your-worker-domain.workers.dev/'
    }
  },
  methods: {
    async sendMessage() {
      if (!this.newMessage.trim() || this.loading) return;
      
      const userMessage = {
        id: Date.now(),
        role: 'user',
        content: this.newMessage
      };
      
      this.messages.push(userMessage);
      const messageText = this.newMessage;
      this.newMessage = '';
      this.loading = true;
      
      try {
        const response = await fetch(this.workerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: this.messages.map(msg => ({
              role: msg.role,
              content: msg.content
            })),
            temperature: 0.7,
            max_tokens: 1000
          })
        });
        
        const data = await response.json();
        const aiMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: data.choices[0].message.content
        };
        
        this.messages.push(aiMessage);
      } catch (error) {
        this.messages.push({
          id: Date.now() + 1,
          role: 'system',
          content: '发送消息失败: ' + error.message
        });
      } finally {
        this.loading = false;
      }
    }
  }
}
</script>
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 支持

如果这个项目对你有帮助，请给个 ⭐ Star！
