export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderConfig {
  model: string;
  apiKey?: string;
  endpoint?: string;
}

export interface AIProvider {
  streamChat(messages: Message[]): AsyncGenerator<string, void, unknown>;
}
