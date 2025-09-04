var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-ZCd3a3/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/bundle-ZCd3a3/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/index.js
var src_default = {
  async fetch(request, env, ctx) {
    console.log("Incoming request:", {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries())
    });
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      console.log("Handling CORS preflight request");
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400"
        }
      });
    }
    if (url.pathname === "/graphql") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
      try {
        const { query, variables, operationName } = await request.json();
        console.log("GraphQL request:", { operationName, querySnippet: query?.slice(0, 80) });
        const sendJson = /* @__PURE__ */ __name((data, status = 200) => new Response(JSON.stringify({ data }), {
          status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }), "sendJson");
        const sendGraphQLError = /* @__PURE__ */ __name((message, status = 400) => new Response(JSON.stringify({ errors: [{ message }] }), {
          status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }), "sendGraphQLError");
        const normalized = (query || "").replace(/\s+/g, " ").toLowerCase();
        if (normalized.includes("mutation") && normalized.includes("createsession")) {
          const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          return sendJson({ createSession: { sessionId, success: true } });
        }
        if (normalized.includes("query") && normalized.includes("chathistory")) {
          return sendJson({ chatHistory: [] });
        }
        if (normalized.includes("mutation") && normalized.includes("sendmessage")) {
          const input = variables?.input || {};
          const content = input.content || "";
          const message = {
            id: `msg_${Date.now()}_user`,
            content,
            isUser: true,
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            success: true,
            error: null
          };
          return sendJson({ sendMessage: message });
        }
        if (normalized.includes("mutation") && normalized.includes("getairesponse")) {
          const resolvedApiKey = request.headers.get("x-openai-key") || env.OPENAI_API_KEY;
          if (!resolvedApiKey) {
            return sendGraphQLError("OpenAI API key is not configured", 500);
          }
          const input = variables?.input || {};
          const openaiRequestBody = {
            model: input.model || "gpt-3.5-turbo",
            messages: input.messages || [],
            temperature: input.temperature ?? 0.7,
            max_tokens: input.max_tokens ?? 1e3,
            stream: false,
            ...input
          };
          const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${resolvedApiKey}`
            },
            body: JSON.stringify(openaiRequestBody)
          });
          if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text();
            console.error("OpenAI API error (GraphQL):", errorText);
            return sendGraphQLError(`OpenAI API returned ${openaiResponse.status}: ${errorText}`, openaiResponse.status);
          }
          const responseData = await openaiResponse.json();
          const content = responseData.choices?.[0]?.message?.content || "";
          const message = {
            id: responseData.id || `msg_${Date.now()}_ai`,
            content,
            isUser: false,
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            success: true,
            error: null
          };
          return sendJson({ getAIResponse: message });
        }
        return sendGraphQLError("Unsupported GraphQL operation");
      } catch (error) {
        console.error("GraphQL handler error:", error);
        return new Response(JSON.stringify({ errors: [{ message: error.message }] }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    }
    if (request.method !== "POST") {
      console.log("Method not allowed:", request.method);
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    try {
      const resolvedApiKey = request.headers.get("x-openai-key") || env.OPENAI_API_KEY;
      if (!resolvedApiKey) {
        console.error("OPENAI_API_KEY is not set");
        return new Response(JSON.stringify({
          error: "Configuration Error",
          message: "OpenAI API key is not configured"
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
      let requestBody;
      try {
        const requestText = await request.text();
        console.log("Request body text:", requestText);
        requestBody = JSON.parse(requestText);
      } catch (parseError) {
        console.error("JSON parse error:", parseError.message);
        return new Response(JSON.stringify({
          error: "Invalid JSON",
          message: "Request body is not valid JSON"
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
      console.log("Parsed request body:", requestBody);
      if (!requestBody.messages || !Array.isArray(requestBody.messages)) {
        console.error("Invalid messages format:", requestBody.messages);
        return new Response(JSON.stringify({
          error: "Invalid messages format",
          message: "messages field is required and must be an array"
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
      const openaiRequestBody = {
        model: requestBody.model || "gpt-3.5-turbo",
        messages: requestBody.messages,
        temperature: requestBody.temperature || 0.7,
        max_tokens: requestBody.max_tokens || 1e3,
        stream: requestBody.stream || false,
        ...requestBody
        // 允许传递其他参数
      };
      console.log("Sending request to OpenAI:", {
        model: openaiRequestBody.model,
        messagesCount: openaiRequestBody.messages.length,
        stream: openaiRequestBody.stream
      });
      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resolvedApiKey}`
        },
        body: JSON.stringify(openaiRequestBody)
      });
      console.log("OpenAI response status:", openaiResponse.status);
      console.log("OpenAI response headers:", Object.fromEntries(openaiResponse.headers.entries()));
      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error("OpenAI API error:", errorText);
        return new Response(JSON.stringify({
          error: "OpenAI API Error",
          message: `OpenAI API returned ${openaiResponse.status}: ${errorText}`,
          status: openaiResponse.status
        }), {
          status: openaiResponse.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
      if (requestBody.stream) {
        console.log("Returning streaming response");
        return new Response(openaiResponse.body, {
          status: openaiResponse.status,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
      const responseData = await openaiResponse.json();
      console.log("OpenAI response data:", {
        id: responseData.id,
        model: responseData.model,
        choices: responseData.choices?.length
      });
      return new Response(JSON.stringify(responseData), {
        status: openaiResponse.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (error) {
      console.error("Unhandled error:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      return new Response(JSON.stringify({
        error: "Internal Server Error",
        message: error.message,
        type: error.name
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-ZCd3a3/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-ZCd3a3/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
