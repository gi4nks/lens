import { AIProvider, Message, ProviderConfig } from './types.js';

export type { AIProvider, Message, ProviderConfig };

export class OllamaProvider implements AIProvider {
  private endpoint: string;
  private model: string;

  constructor(config: Partial<ProviderConfig> = {}) {
    let base = config.endpoint || 'http://localhost:11434/api/chat';
    if (!base.startsWith('http://') && !base.startsWith('https://')) {
      base = 'http://' + base;
    }
    this.endpoint = base;
    this.model = config.model || 'llama3.2';
  }

  async *streamChat(messages: Message[]): AsyncGenerator<string, void, unknown> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, stream: true }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama error (${response.status}): ${errorText || response.statusText}`);
    }

    if (!response.body) throw new Error('No response body from Ollama');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n').filter((l) => l.trim())) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) yield parsed.message.content;
        } catch {}
      }
    }
  }
}

export function createProvider(name: string, config: Partial<ProviderConfig>): AIProvider {
  switch (name.toLowerCase()) {
    case 'ollama':   return new OllamaProvider(config);
    case 'gemini':   return new GeminiProvider(config);
    case 'openai':   return new OpenAIProvider(config);
    case 'anthropic': return new AnthropicProvider(config);
    default: throw new Error(`Unknown provider: ${name}`);
  }
}

// ─── Gemini ──────────────────────────────────────────────────────────────────

export class GeminiProvider implements AIProvider {
  private model: string;
  private apiKey: string;

  constructor(config: Partial<ProviderConfig> = {}) {
    this.model = config.model || 'gemini-2.0-flash';
    this.apiKey = config.apiKey || '';
  }

  async *streamChat(messages: Message[]): AsyncGenerator<string, void, unknown> {
    if (!this.apiKey) throw new Error('Gemini API key not set. Use /config to configure it.');

    // Convert from OpenAI-style messages to Gemini contents format
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    // Prepend system message as first user turn if present
    const systemMsg = messages.find((m) => m.role === 'system');
    if (systemMsg) {
      contents.unshift({ role: 'user', parts: [{ text: systemMsg.content }] });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini error ${response.status}: ${err}`);
    }
    if (!response.body) throw new Error('No response body from Gemini');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield text;
        } catch {}
      }
    }
  }
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

export class OpenAIProvider implements AIProvider {
  private model: string;
  private apiKey: string;
  private endpoint: string;

  constructor(config: Partial<ProviderConfig> = {}) {
    this.model = config.model || 'gpt-4o';
    this.apiKey = config.apiKey || '';
    this.endpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions';
  }

  async *streamChat(messages: Message[]): AsyncGenerator<string, void, unknown> {
    if (!this.apiKey) throw new Error('OpenAI API key not set. Use /config to configure it.');

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, messages, stream: true }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI error ${response.status}: ${err}`);
    }
    if (!response.body) throw new Error('No response body from OpenAI');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          const text = parsed?.choices?.[0]?.delta?.content;
          if (text) yield text;
        } catch {}
      }
    }
  }
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

export class AnthropicProvider implements AIProvider {
  private model: string;
  private apiKey: string;

  constructor(config: Partial<ProviderConfig> = {}) {
    this.model = config.model || 'claude-sonnet-4-6';
    this.apiKey = config.apiKey || '';
  }

  async *streamChat(messages: Message[]): AsyncGenerator<string, void, unknown> {
    if (!this.apiKey) throw new Error('Anthropic API key not set. Use /config to configure it.');

    const system = messages.find((m) => m.role === 'system')?.content;
    const filtered = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: 4096,
      messages: filtered,
      stream: true,
    };
    if (system) body.system = system;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic error ${response.status}: ${err}`);
    }
    if (!response.body) throw new Error('No response body from Anthropic');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            yield parsed.delta.text;
          }
        } catch {}
      }
    }
  }
}
