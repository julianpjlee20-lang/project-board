// src/tools/cards.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { uphouse, formatError } from '../services/api.js';
import { CARD_STATUSES } from '../types.js';
import type { Card, CardsApiResponse } from '../types.js';

const cardStatusSchema = z.enum(CARD_STATUSES);
const dueDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format');

export function registerCardTools(server: McpServer): void {

  // LIST CARDS
  server.registerTool(
    'uphouse_list_cards',
    {
      title: 'List Cards',
      description: `List cards/tasks. Provide either project_id (all cards in project) or phase_id (cards in a specific phase).

Args:
  - project_id (string, optional): The project ID — returns ALL cards in the project
  - phase_id (string, optional): The phase ID — returns only cards assigned to that phase

At least one must be provided. If both are provided, project_id takes priority.

Returns: Array of cards with id, title, description, status, assignee, due_date.`,
      inputSchema: z.object({
        project_id: z.string().min(1).optional().describe('Project ID to list all cards for'),
        phase_id: z.string().min(1).optional().describe('Phase ID to list cards for (only cards assigned to this phase)'),
        include_archived: z.boolean().optional().describe('Include archived cards (default: false, only active cards are returned)'),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ project_id, phase_id, include_archived }) => {
      try {
        if (!project_id && !phase_id) {
          return { content: [{ type: 'text' as const, text: 'Error: Provide either project_id or phase_id.' }] };
        }

        const url = project_id
          ? `/api/cards?project_id=${project_id}${include_archived ? '&include_archived=true' : ''}`
          : `/api/phases/${phase_id}/cards${include_archived ? '?include_archived=true' : ''}`;

        const data = await uphouse<CardsApiResponse>(url);
        const cards: Card[] = Array.isArray(data)
          ? data
          : ('cards' in data ? data.cards : data.data);

        if (!cards.length) {
          const scope = project_id ? `project ${project_id}` : `phase ${phase_id}`;
          return { content: [{ type: 'text' as const, text: `No cards found in ${scope}.` }] };
        }

        const text = cards
          .map(c => `- [${c.id}] ${c.title}${c.status ? ` — ${c.status}` : ''}${c.assignee ? ` (@${c.assignee})` : ''}`)
          .join('\n');

        return {
          content: [{ type: 'text' as const, text: `Found ${cards.length} card(s):\n\n${text}` }],
          structuredContent: { cards },
        };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${formatError(err)}` }] };
      }
    }
  );

  // CREATE CARD
  server.registerTool(
    'uphouse_create_card',
    {
      title: 'Create Card',
      description: `Create a new card/task inside a phase.

Args:
  - phase_id (string): The phase ID to add the card to
  - title (string): Card title / task name
  - description (string, optional): Detailed description
  - status (enum, optional): Initial status: "todo", "in_progress", "done"
  - assignee (string, optional): Assignee name or ID
  - due_date (string, optional): Due date in YYYY-MM-DD format, e.g. "2026-06-30"

Returns: The created card with its new id.`,
      inputSchema: z.object({
        phase_id: z.string().min(1).describe('Phase ID'),
        title: z.string().min(1).max(500).describe('Card title'),
        description: z.string().optional().describe('Card description'),
        status: cardStatusSchema.optional().describe('Status: todo, in_progress, done'),
        assignee: z.string().optional().describe('Assignee name or ID'),
        due_date: dueDateSchema.optional().describe('Due date YYYY-MM-DD e.g. 2026-06-30'),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ phase_id, title, description, status, assignee, due_date }) => {
      try {
        const card = await uphouse<Card>(`/api/phases/${phase_id}/cards`, 'POST', {
          title,
          ...(description ? { description } : {}),
          ...(status ? { status } : {}),
          ...(assignee ? { assignee } : {}),
          ...(due_date ? { due_date } : {}),
        });

        return {
          content: [{
            type: 'text' as const,
            text: `Card created!\nID: ${card.id}\nTitle: ${card.title}`,
          }],
          structuredContent: { card },
        };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${formatError(err)}` }] };
      }
    }
  );

  // UPDATE CARD
  server.registerTool(
    'uphouse_update_card',
    {
      title: 'Update Card',
      description: `Update an existing card's fields.

Args:
  - card_id (string): The card ID to update
  - title (string, optional): New title
  - description (string, optional): New description
  - status (enum, optional): New status: "todo", "in_progress", "done"
  - assignee (string, optional): New assignee
  - due_date (string, optional): New due date YYYY-MM-DD

At least one optional field must be provided.
Returns: The updated card object.`,
      inputSchema: z.object({
        card_id: z.string().min(1).describe('Card ID to update'),
        title: z.string().min(1).max(500).optional().describe('New title'),
        description: z.string().optional().describe('New description'),
        status: cardStatusSchema.optional().describe('New status'),
        assignee: z.string().optional().describe('New assignee'),
        due_date: dueDateSchema.optional().describe('New due date YYYY-MM-DD'),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ card_id, ...updates }) => {
      try {
        const body = Object.fromEntries(
          Object.entries(updates).filter(([, v]) => v !== undefined)
        );

        if (Object.keys(body).length === 0) {
          return { content: [{ type: 'text' as const, text: 'Error: At least one field must be provided to update.' }] };
        }

        const card = await uphouse<Card>(`/api/cards/${card_id}`, 'PATCH', body);

        return {
          content: [{
            type: 'text' as const,
            text: `Card updated!\nID: ${card.id}\nTitle: ${card.title}`,
          }],
          structuredContent: { card },
        };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${formatError(err)}` }] };
      }
    }
  );

  // BULK CREATE CARDS
  server.registerTool(
    'uphouse_bulk_create_cards',
    {
      title: 'Bulk Create Cards',
      description: `Create multiple cards in a phase at once. More efficient than calling uphouse_create_card repeatedly.

Args:
  - phase_id (string): The phase ID to add cards to
  - cards (array): Array of card objects, each with:
    - title (string, required)
    - description (string, optional)
    - status (enum, optional): "todo", "in_progress", "done"

Returns: Summary of created cards with their IDs.`,
      inputSchema: z.object({
        phase_id: z.string().min(1).describe('Phase ID'),
        cards: z.array(z.object({
          title: z.string().min(1).max(500),
          description: z.string().optional(),
          status: cardStatusSchema.optional(),
        })).min(1).max(50).describe('Array of cards to create'),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ phase_id, cards }) => {
      const settled = await Promise.allSettled(
        cards.map(cardData =>
          uphouse<Card>(`/api/phases/${phase_id}/cards`, 'POST', cardData)
            .then(card => ({ title: cardData.title, id: card.id } as const))
        )
      );

      const results = settled.map((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        return { title: cards[i].title, error: formatError(r.reason) };
      });

      const succeeded = results.filter((r): r is { title: string; id: string } => 'id' in r);
      const failed = results.filter((r): r is { title: string; error: string } => 'error' in r);

      const lines = [
        `Created ${succeeded.length}/${cards.length} cards`,
        '',
        ...succeeded.map(r => `- [${r.id}] ${r.title}`),
        ...(failed.length ? ['\nFailed:', ...failed.map(r => `- ${r.title}: ${r.error}`)] : []),
      ];

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
        structuredContent: { results, succeeded: succeeded.length, failed: failed.length },
      };
    }
  );

  // PREVIEW DELETE CARDS (read-only)
  server.registerTool(
    'uphouse_preview_delete_cards',
    {
      title: 'Preview Delete Cards',
      description: `Preview cards before deletion. This is a read-only operation that fetches card details so the user can confirm before actual deletion.

Args:
  - card_ids (string[]): Array of card IDs to preview (1–20)

Returns: A summary of cards that will be deleted, including title and status.
After confirmation, use uphouse_delete_cards to execute.`,
      inputSchema: z.object({
        card_ids: z.array(z.string().min(1)).min(1).max(20).describe('Card IDs to preview for deletion'),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ card_ids }) => {
      try {
        const settled = await Promise.allSettled(
          card_ids.map(id => uphouse<Card>(`/api/cards/${id}`))
        );

        const found: { id: string; title: string; status?: string }[] = [];
        const notFound: { id: string; reason: string }[] = [];

        settled.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            found.push({ id: r.value.id, title: r.value.title, status: r.value.status });
          } else {
            notFound.push({ id: card_ids[i], reason: formatError(r.reason) });
          }
        });

        const lines: string[] = [
          `⚠️ 即將刪除以下 ${found.length} 張卡片（此操作不可逆）：`,
          '',
        ];

        found.forEach((c, i) => {
          lines.push(`${i + 1}. [${c.title}] (ID: ${c.id}) — 狀態: ${c.status ?? 'N/A'}`);
        });

        if (notFound.length) {
          lines.push('', '找不到的卡片：');
          notFound.forEach(n => {
            lines.push(`- ID ${n.id}: ${n.reason}`);
          });
        }

        lines.push('', '請確認後使用 uphouse_delete_cards 執行刪除。');

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
          structuredContent: { found, notFound, totalFound: found.length, totalNotFound: notFound.length },
        };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${formatError(err)}` }] };
      }
    }
  );

  // DELETE CARDS (destructive)
  server.registerTool(
    'uphouse_delete_cards',
    {
      title: 'Delete Cards',
      description: `⚠️ 破壞性操作！必須先呼叫 uphouse_preview_delete_cards 預覽，取得使用者確認後才能使用此工具。

Permanently delete one or more cards by ID.

Args:
  - card_ids (string[]): Array of card IDs to delete (1–20)

Returns: Summary of deletion results (succeeded / failed).`,
      inputSchema: z.object({
        card_ids: z.array(z.string().min(1)).min(1).max(20).describe('Card IDs to delete'),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ card_ids }) => {
      try {
        const settled = await Promise.allSettled(
          card_ids.map(id => uphouse<Record<string, unknown>>(`/api/cards/${id}`, 'DELETE'))
        );

        const succeeded: string[] = [];
        const failed: { id: string; error: string }[] = [];

        settled.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            succeeded.push(card_ids[i]);
          } else {
            failed.push({ id: card_ids[i], error: formatError(r.reason) });
          }
        });

        const lines = [
          `刪除完成：${succeeded.length}/${card_ids.length} 成功`,
          '',
          ...succeeded.map(id => `✅ ${id}`),
          ...(failed.length ? ['\n失敗：', ...failed.map(f => `❌ ${f.id}: ${f.error}`)] : []),
        ];

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
          structuredContent: { succeeded, failed, totalSucceeded: succeeded.length, totalFailed: failed.length },
        };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${formatError(err)}` }] };
      }
    }
  );
}
