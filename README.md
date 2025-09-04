# OpenAI Workers Proxy

一个基于 Cloudflare Workers 的 OpenAI API 代理服务，支持 CORS 跨域请求，专为前端聊天应用设计。现已支持 DALL-E 图片生成功能！

> 说明：该仓库仅包含 Cloudflare Workers 端代码，不提供前端 Demo。可直接将本服务部署到 Cloudflare Workers 后，在任意前端或后端通过 HTTP 请求调用。

## 功能特性

- 🔄 OpenAI Chat Completions API 代理转发
- 🎨 DALL-E 图片生成 API 支持 (新增)
- 🌐 完整的 CORS 支持
- 📡 支持流式响应 (Server-Sent Events)
- 🛡️ 安全的 API Key 管理
- ⚡ 基于 Cloudflare Workers，全球边缘部署
- 📝 支持 GraphQL 和 REST API 两种接口
- 🔧 本地开发时支持 x-openai-key 请求头覆盖

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

本地开发时，可以创建 `.env` 文件：

```bash
echo "OPENAI_API_KEY=your-api-key-here" > .env
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

### 🗣️ 聊天对话 API

#### REST API 方式

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

#### GraphQL 方式

```javascript
POST https://your-worker-domain.workers.dev/graphql

// GraphQL Query
{
  "query": "mutation GetAIResponse($input: ChatInput!) { getAIResponse(input: $input) { id content isUser timestamp success error } }",
  "variables": {
    "input": {
      "model": "gpt-3.5-turbo",
      "messages": [
        { "role": "user", "content": "Hello!" }
      ],
      "temperature": 0.7,
      "max_tokens": 1000
    }
  }
}
```

### 🎨 图片生成 API (新功能)

#### REST API 方式

```javascript
// 方式1: 使用专用路由
POST https://your-worker-domain.workers.dev/images/generations

// 方式2: 使用通用路由 + 标识
POST https://your-worker-domain.workers.dev/

// 请求体
{
  "prompt": "A beautiful sunset over the ocean with palm trees",
  "model": "dall-e-3",
  "n": 1,
  "size": "1024x1024",
  "quality": "standard",
  "style": "vivid",
  "response_format": "url"
}

// 或者使用 action 标识
{
  "action": "generate-image",
  "prompt": "A cat sitting on a rainbow"
}
```

#### GraphQL 方式

```javascript
POST https://your-worker-domain.workers.dev/graphql

// GraphQL Mutation
{
  "query": "mutation GenerateImage($input: ImageInput!) { generateImage(input: $input) { id prompt images { url } model size quality style timestamp success error } }",
  "variables": {
    "input": {
      "prompt": "A futuristic city with flying cars",
      "model": "dall-e-3",
      "size": "1024x1024",
      "quality": "hd",
      "style": "vivid"
    }
  }
}
```

### 前端调用示例

```javascript
// 聊天功能
async function sendChatMessage(message) {
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

// 图片生成功能
async function generateImage(prompt) {
  const response = await fetch('https://your-worker-domain.workers.dev/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: prompt,
      model: 'dall-e-3',
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'vivid'
    })
  });

  const data = await response.json();
  return data.data[0].url; // 返回图片URL
}

// 使用示例
async function example() {
  // 生成聊天回复
  const reply = await sendChatMessage("What's a good recipe for pasta?");
  console.log('AI Reply:', reply);

  // 生成图片
  const imageUrl = await generateImage("A delicious pasta dish with tomato sauce");
  console.log('Generated Image URL:', imageUrl);
}
```

### 本地开发时的特殊功能

可以通过 `x-openai-key` 请求头传递 API Key，无需配置环境变量：

```javascript
fetch('http://localhost:8787/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-openai-key': 'your-api-key-here' // 本地开发用
  },
  body: JSON.stringify({
    prompt: "A test image"
  })
});
```

## 支持的参数

### 聊天 API 参数

- `model` - 模型名称 (默认: gpt-3.5-turbo)
- `messages` - 消息数组 (必需)
- `temperature` - 温度参数 (默认: 0.7)
- `max_tokens` - 最大令牌数 (默认: 1000)
- `stream` - 是否启用流式响应 (默认: false)
- `top_p` - Top-p 采样
- `frequency_penalty` - 频率惩罚
- `presence_penalty` - 存在惩罚

### 图片生成 API 参数

- `prompt` - 图片描述文本 (必需)
- `model` - 模型名称 (默认: dall-e-3，可选: dall-e-2)
- `n` - 生成图片数量 (默认: 1，dall-e-3 只支持 1)
- `size` - 图片尺寸 (默认: 1024x1024)
  - dall-e-2: `256x256`, `512x512`, `1024x1024`
  - dall-e-3: `1024x1024`, `1792x1024`, `1024x1792`
- `quality` - 图片质量 (默认: standard，可选: hd，仅 dall-e-3)
- `style` - 图片风格 (默认: vivid，可选: natural，仅 dall-e-3)
- `response_format` - 响应格式 (默认: url，可选: b64_json)

## GraphQL Schema 示例

```graphql
# 聊天相关
mutation GetAIResponse($input: ChatInput!) {
  getAIResponse(input: $input) {
    id
    content
    isUser
    timestamp
    success
    error
  }
}

# 图片生成
mutation GenerateImage($input: ImageInput!) {
  generateImage(input: $input) {
    id
    prompt
    images {
      url
      b64_json
    }
    model
    size
    quality
    style
    timestamp
    success
    error
  }
}

# 会话管理
mutation CreateSession {
  createSession {
    sessionId
    success
  }
}

query ChatHistory($sessionId: String) {
  chatHistory(sessionId: $sessionId) {
    id
    content
    isUser
    timestamp
  }
}
```

## 错误处理

API 返回标准的 HTTP 状态码：

- `200` - 成功
- `400` - 请求格式错误
- `405` - 方法不允许
- `500` - 服务器内部错误

错误响应格式：

```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

GraphQL 错误格式：

```json
{
  "errors": [
    {
      "message": "Error description"
    }
  ]
}
```

## 安全注意事项

1. **API Key 安全**: 永远不要在前端代码中暴露 OpenAI API Key
2. **域名限制**: 建议在生产环境中限制允许的域名
3. **速率限制**: 考虑添加速率限制以防止滥用
4. **监控**: 定期监控 API 使用量和成本
5. **图片存储**: OpenAI 生成的图片 URL 有时效性，建议及时保存到自己的存储服务

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 支持

如果这个项目对你有帮助，请给个 ⭐ Star！
