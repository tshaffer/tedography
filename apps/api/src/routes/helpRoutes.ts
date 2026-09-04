import { Router, type Router as RouterType } from 'express';
import type Anthropic from '@anthropic-ai/sdk';
import { log } from '../logger.js';
import { getClaudeClient } from '../ai/claudeClient.js';
import { helpTopics } from '@tedography/shared';

export const helpRoutes: RouterType = Router();

// ─── POST /ask — answer a natural-language question from the help docs ────────

const MAX_HISTORY_TURNS = 6;

interface HelpConversationTurn {
  question: string;
  answer: string;
  citedSlugs: string[];
  toolUseId: string;
}

const systemInstructions = `You are the in-app Help assistant for Tedography, a personal photo archive and curation application.

Your job is to answer the user's question using ONLY the help documentation provided below, by calling the provide_answer tool.

## Rules
- Base your answer strictly on the provided documentation. Do not invent features, menu items, or behavior that isn't described.
- If the documentation doesn't cover the question, say so plainly in the answer (e.g. "The help docs don't cover that") rather than guessing.
- Keep answers concise and task-oriented — a few sentences or a short list, not a full article.
- The conversation may include earlier questions and answers. Use them for context (e.g. resolving "it"/"that" or follow-ups), but always ground the actual answer in the documentation.
- In citedSlugs, list the slugs of the topics you actually drew on to answer, in relevance order. If none of the docs were relevant, return an empty array.`;

function buildContextBlock(): string {
  return helpTopics
    .map((topic) => `### [${topic.slug}] ${topic.title}\n\n${topic.body}`)
    .join('\n\n---\n\n');
}

function buildHistoryMessages(history: HelpConversationTurn[]): Anthropic.MessageParam[] {
  return history.slice(-MAX_HISTORY_TURNS).flatMap((turn): Anthropic.MessageParam[] => [
    { role: 'user', content: turn.question },
    {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: turn.toolUseId,
          name: 'provide_answer',
          input: { answer: turn.answer, citedSlugs: turn.citedSlugs },
        },
      ],
    },
    {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: turn.toolUseId, content: 'Acknowledged.' }],
    },
  ]);
}

helpRoutes.post('/ask', async (req, res) => {
  const { question, history } = req.body as { question?: string; history?: HelpConversationTurn[] };
  if (!question?.trim()) {
    res.status(400).json({ error: 'question is required' });
    return;
  }

  try {
    const client = getClaudeClient();

    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: systemInstructions,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: buildContextBlock(),
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [
        {
          name: 'provide_answer',
          description: 'Provide the answer to the user\'s help question.',
          input_schema: {
            type: 'object' as const,
            properties: {
              answer: {
                type: 'string',
                description: 'The answer to the user\'s question, based only on the provided help documentation.',
              },
              citedSlugs: {
                type: 'array',
                items: { type: 'string' },
                description: 'Slugs of the help topics actually used to answer, in relevance order. Empty if none were relevant.',
              },
            },
            required: ['answer', 'citedSlugs'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'provide_answer' },
      messages: [...buildHistoryMessages(history ?? []), { role: 'user', content: question.trim() }],
    });

    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      res.status(500).json({ error: 'Claude did not return an answer' });
      return;
    }

    const input = toolUse.input as { answer: string; citedSlugs: string[] };
    const topicsBySlug = new Map(helpTopics.map((topic) => [topic.slug, topic]));
    const citations = (input.citedSlugs ?? [])
      .map((slug) => topicsBySlug.get(slug))
      .filter((topic): topic is (typeof helpTopics)[number] => topic !== undefined)
      .map((topic) => ({ slug: topic.slug, title: topic.title }));

    log.info('Help question answered', {
      question: question.trim(),
      historyTurns: history?.length ?? 0,
      citedSlugs: input.citedSlugs,
      cacheCreation: response.usage.cache_creation_input_tokens,
      cacheRead: response.usage.cache_read_input_tokens,
    });

    res.json({
      answer: input.answer,
      citations,
      citedSlugs: input.citedSlugs ?? [],
      toolUseId: toolUse.id,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('ANTHROPIC_API_KEY')) {
      res.status(503).json({ error: 'Claude API is not configured (missing ANTHROPIC_API_KEY)' });
      return;
    }
    log.error('Help question failed', error);
    res.status(500).json({ error: 'Failed to answer question' });
  }
});
