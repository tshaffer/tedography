import { Router, type Router as RouterType } from 'express';
import { log } from '../logger.js';
import { getClaudeClient } from '../ai/claudeClient.js';
import { listPeople } from '../repositories/personRepository.js';
import { listKeywords } from '../repositories/keywordRepository.js';
import { listAlbumTreeNodes } from '../repositories/albumTreeRepository.js';
import type { Keyword } from '@tedography/domain';

export const nlSearchRoutes: RouterType = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a human-readable path label for a keyword, e.g. "Nature > Birds > Raptor".
 */
function buildKeywordPath(keyword: Keyword, keywordsById: Map<string, Keyword>): string {
  const parts: string[] = [];
  let current: Keyword | undefined = keyword;
  let depth = 0;
  while (current && depth < 10) {
    parts.unshift(current.label);
    current = current.parentKeywordId ? keywordsById.get(current.parentKeywordId) : undefined;
    depth++;
  }
  return parts.join(' > ');
}

// ─── POST /nl — translate natural language query into SearchFilters ────────────

nlSearchRoutes.post('/nl', async (req, res) => {
  const { query } = req.body as { query?: string };
  if (!query?.trim()) {
    res.status(400).json({ error: 'query is required' });
    return;
  }

  try {
    const [people, keywords, albumNodes] = await Promise.all([
      listPeople(),
      listKeywords(),
      listAlbumTreeNodes(),
    ]);

    const keywordsById = new Map(keywords.map((k) => [k.id, k]));

    // Build context strings for Claude
    const peopleContext =
      people.length > 0
        ? people.map((p) => `  - id: "${p.id}", name: "${p.displayName}"`).join('\n')
        : '  (none)';

    const keywordsContext =
      keywords.length > 0
        ? keywords
            .map((k) => `  - id: "${k.id}", label: "${k.label}", path: "${buildKeywordPath(k, keywordsById)}"`)
            .join('\n')
        : '  (none)';

    const albumsContext =
      albumNodes.length > 0
        ? albumNodes
            .map((n) => `  - id: "${n.id}", label: "${n.label}", type: "${n.nodeType}"`)
            .join('\n')
        : '  (none)';

    const systemInstructions = `You are a search assistant for a personal photo archive application called Tedography.

Your job is to translate a natural language search query into structured search filters by calling the set_search_filters tool.

## Photo States
Photos have one of four states:
- "New" — freshly imported, not yet reviewed
- "Pending" — deferred for later decision
- "Keep" — confirmed keeper
- "Discard" — rejected / hidden

## Date fields
captureDateFrom and captureDateTo are strings in "YYYY-MM-DD" format.
captureDateAvailability controls whether to include photos with or without a capture date:
- "datedOnly" — only photos that have a capture date (default, use when dates are specified)
- "datedOrUndated" — all photos regardless of date
- "undatedOnly" — only photos with no capture date

## People match modes
- "Any" — asset has at least one of the specified people
- "All" — asset has all of the specified people

## Keyword query
includeMode controls AND vs OR across included keywords:
- "all" — asset must have every included keyword
- "any" — asset must have at least one included keyword

## Rules
- Only set fields that are relevant to the query. Leave all others at their defaults.
- Match people names and keyword labels case-insensitively.
- For partial name matches, pick the closest match from the lists below.
- If a year is mentioned (e.g. "2022"), set captureDateFrom to "2022-01-01" and captureDateTo to "2022-12-31".
- If a year range is mentioned (e.g. "2020–2023"), set the appropriate from/to dates.
- albumIds are for leaf album nodes (type "Album"); groupIds are for group nodes (type "Group").`;

    const contextBlock = `## Available People
${peopleContext}

## Available Keywords
${keywordsContext}

## Available Albums and Groups
${albumsContext}`;

    const client = getClaudeClient();

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: systemInstructions,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: contextBlock,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [
        {
          name: 'set_search_filters',
          description: 'Set the search filters based on the user query.',
          input_schema: {
            type: 'object' as const,
            properties: {
              photoStates: {
                type: 'array',
                items: { type: 'string', enum: ['New', 'Pending', 'Keep', 'Discard'] },
                description: 'Filter by photo state(s). Empty array means no state filter.',
              },
              albumIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter to specific leaf album IDs.',
              },
              groupIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter to all albums within specific group IDs.',
              },
              filenamePattern: {
                type: 'string',
                description: 'Regex pattern to match against filenames.',
              },
              captureDateFrom: {
                type: 'string',
                description: 'Start of capture date range, YYYY-MM-DD.',
              },
              captureDateTo: {
                type: 'string',
                description: 'End of capture date range, YYYY-MM-DD.',
              },
              captureDateAvailability: {
                type: 'string',
                enum: ['datedOnly', 'datedOrUndated', 'undatedOnly'],
                description: 'Whether to include dated, undated, or both.',
              },
              peopleIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Include photos featuring these person IDs.',
              },
              peopleMatchMode: {
                type: 'string',
                enum: ['Any', 'All'],
                description: '"Any" = at least one match, "All" = must have all.',
              },
              excludedPeopleIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Exclude photos featuring these person IDs.',
              },
              hasNoPeople: {
                type: 'boolean',
                description: 'Only show photos with no identified people.',
              },
              hasKeywords: {
                type: 'boolean',
                description: 'Only show photos that have at least one keyword.',
              },
              keywordQuery: {
                type: 'object',
                properties: {
                  include: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        keywordId: { type: 'string' },
                        includeDescendants: { type: 'boolean' },
                      },
                      required: ['keywordId', 'includeDescendants'],
                    },
                  },
                  includeMode: {
                    type: 'string',
                    enum: ['all', 'any'],
                  },
                  exclude: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        keywordId: { type: 'string' },
                        includeDescendants: { type: 'boolean' },
                      },
                      required: ['keywordId', 'includeDescendants'],
                    },
                  },
                },
                description: 'Keyword include/exclude filters.',
              },
              isEditedImport: {
                type: 'boolean',
                description: 'Only show photos that were imported as edited versions.',
              },
              hasEditedVersion: {
                type: 'boolean',
                description: 'Only show photos that have an edited version.',
              },
              inEditQueue: {
                type: 'boolean',
                description: 'Only show photos currently in the edit queue.',
              },
            },
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'set_search_filters' },
      messages: [{ role: 'user', content: query.trim() }],
    });

    // Extract the tool call result
    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      res.status(500).json({ error: 'Claude did not return a tool call' });
      return;
    }

    log.info('NL search translated', {
      query: query.trim(),
      filters: toolUse.input,
      cacheCreation: response.usage.cache_creation_input_tokens,
      cacheRead: response.usage.cache_read_input_tokens,
    });

    res.json({ filters: toolUse.input });
  } catch (error) {
    if (error instanceof Error && error.message.includes('ANTHROPIC_API_KEY')) {
      res.status(503).json({ error: 'Claude API is not configured (missing ANTHROPIC_API_KEY)' });
      return;
    }
    log.error('NL search failed', error);
    res.status(500).json({ error: 'Failed to translate search query' });
  }
});
