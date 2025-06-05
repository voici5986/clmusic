// src/_worker.js
// Cloudflare Pages Function (Advanced Mode: _worker.js) for Reverse Proxy and Static Assets Serving

const TARGET_API_BASE = 'https://music-api.gdstudio.xyz';
const API_ENDPOINT_SUFFIX = '/api.php';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- 1. 处理 API 代理请求 (/api/*) ---
    if (url.pathname.startsWith('/api')) {
      let pathAfterProxyBase = url.pathname.replace(/^\/api/, '');
      const targetUrl = new URL(TARGET_API_BASE + API_ENDPOINT_SUFFIX + pathAfterProxyBase + url.search);

      console.log(`Proxying API request from ${url.pathname} to: ${targetUrl.toString()}`);

      // 处理 CORS 预检请求 (OPTIONS)
      if (request.method === 'OPTIONS') {
        return handleCorsPreflight(request);
      }

      // 准备转发给目标 API 的请求
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('Host', new URL(TARGET_API_BASE).host);
      // 移除 Cloudflare 特定的头信息，避免暴露不必要信息
      requestHeaders.delete('cf-connecting-ip');
      requestHeaders.delete('cf-ipcountry');
      requestHeaders.delete('cf-ray');
      requestHeaders.delete('cf-visitor');
      requestHeaders.delete('x-forwarded-proto');
      requestHeaders.delete('x-real-ip');

      let response;
      try {
        response = await fetch(targetUrl.toString(), {
          method: request.method,
          headers: requestHeaders,
          body: request.body,
          redirect: 'follow'
        });
      } catch (error) {
        console.error('Error fetching target API:', error);
        return new Response('Proxy failed to fetch target API', { status: 502 });
      }

      // 准备返回给客户端的响应 (添加 CORS 头)
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*'); // 或者指定您的前端域名
      responseHeaders.append('Vary', 'Origin');
      responseHeaders.delete('X-Powered-By');
      responseHeaders.delete('server');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    }

    // --- 2. 处理静态文件请求 (所有非 /api 的请求) ---
    // 使用 Pages 提供的 `env.ASSETS.fetch` 来提供静态文件
    // 这通常是 Cloudflare Pages 默认提供静态文件的方式
    try {
      // env.ASSETS 是 Cloudflare Pages 自动绑定的KV命名空间，用于服务静态资产
      const assetResponse = await env.ASSETS.fetch(request);
      return assetResponse;
    } catch (error) {
      console.error("Error serving static asset:", error);
      // 如果静态文件找不到，通常返回 index.html (SPA 路由)
      // 对于 React SPA，所有非静态文件路径都应指向 index.html
      const indexHtmlRequest = new Request(new URL('/', request.url), request);
      return env.ASSETS.fetch(indexHtmlRequest);
    }
  }
};

/**
 * 处理 CORS 预检请求 (OPTIONS) 的辅助函数
 * @param {Request} request 传入的 OPTIONS 请求
 * @returns {Response} 带有 CORS 允许头的响应
 */
function handleCorsPreflight(request) {
  const headers = new Headers();
  const requestHeaders = request.headers;

  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, HEAD, OPTIONS');

  const requestedHeaders = requestHeaders.get('Access-Control-Request-Headers');
  if (requestedHeaders) {
    headers.set('Access-Control-Allow-Headers', requestedHeaders);
  } else {
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
  }
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(null, { status: 204, headers: headers });
}
