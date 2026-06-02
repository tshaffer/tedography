import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

/**
 * Singleton Anthropic client for backend use.
 * Throws at call time if ANTHROPIC_API_KEY is not set.
 */
export function getClaudeClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey?.trim()) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }
  _client = new Anthropic({ apiKey });
  return _client;
}
