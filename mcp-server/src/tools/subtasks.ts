// src/tools/subtasks.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { uphouse, formatError } from '../services/api.js';
import type { Subtask } from '../types.js';

const dueDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format');

export function registerSubtaskTools(server: McpServer): void {

  // LIST SUBTASKS
  server.registerTool(
    'uphouse_list_subtasks',
    {
      title: 'List Subtasks',
      description: `List all subtasks of a card.

Args:
  - card_id (string): The card ID to list subtasks for

Returns: Array of subtasks with id, title, is_completed, due_date, assignee_name.`,
      inputSchema: z.object({
        card_id: z.string().min(1).describe('Card ID to list subtasks for'),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ card_id }) => {
      try {
        const subtasks = await uphouse<Subtask[]>(`/api/cards/${card_id}/subtasks`);

        if (!subtasks.length) {
          return { content: [{ type: 'text' as const, text: `No subtasks found for card ${card_id}.` }] };
        }

        const text = subtasks
          .map(s => {
            const status = s.is_completed ? '完成' : '未完成';
            const due = s.due_date ? ` due: ${s.due_date}` : '';
            const assignee = s.assignee_name ? ` @${s.assignee_name}` : '';
            return `- [${s.id}] ${s.title} (${status})${due}${assignee}`;
          })
          .join('\n');

        return {
          content: [{ type: 'text' as const, text: `Found ${subtasks.length} subtask(s):\n\n${text}` }],
          structuredContent: { subtasks },
        };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${formatError(err)}` }] };
      }
    }
  );

  // CREATE SUBTASK
  server.registerTool(
    'uphouse_create_subtask',
    {
      title: 'Create Subtask',
      description: `Create a new subtask inside a card.

Args:
  - card_id (string): The card ID to add the subtask to
  - title (string): Subtask title (1-200 characters)
  - due_date (string, optional): Due date in YYYY-MM-DD format
  - assignee_id (string, optional): Assignee user UUID

Returns: The created subtask object.`,
      inputSchema: z.object({
        card_id: z.string().min(1).describe('Card ID'),
        title: z.string().min(1).max(200).describe('Subtask title'),
        due_date: dueDateSchema.optional().describe('Due date YYYY-MM-DD'),
        assignee_id: z.string().uuid().optional().describe('Assignee user UUID'),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ card_id, title, due_date, assignee_id }) => {
      try {
        const subtask = await uphouse<Subtask>(`/api/cards/${card_id}/subtasks`, 'POST', {
          title,
          ...(due_date ? { due_date } : {}),
          ...(assignee_id ? { assignee_id } : {}),
        });

        return {
          content: [{
            type: 'text' as const,
            text: `Subtask created!\nID: ${subtask.id}\nTitle: ${subtask.title}`,
          }],
          structuredContent: { subtask },
        };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${formatError(err)}` }] };
      }
    }
  );

  // UPDATE SUBTASK
  server.registerTool(
    'uphouse_update_subtask',
    {
      title: 'Update Subtask',
      description: `Update an existing subtask's fields.

Args:
  - card_id (string): The card ID the subtask belongs to
  - subtask_id (string): The subtask ID to update
  - title (string, optional): New title
  - is_completed (boolean, optional): Mark as completed or not
  - due_date (string, optional): New due date YYYY-MM-DD, or empty string to clear
  - assignee_id (string, optional): New assignee UUID, or empty string to clear

At least one optional field must be provided.
Returns: The updated subtask object (may include auto_transition info).`,
      inputSchema: z.object({
        card_id: z.string().min(1).describe('Card ID'),
        subtask_id: z.string().min(1).describe('Subtask ID to update'),
        title: z.string().min(1).max(200).optional().describe('New title'),
        is_completed: z.boolean().optional().describe('Mark completed or not'),
        due_date: z.union([dueDateSchema, z.literal('')]).optional().describe('New due date YYYY-MM-DD or empty string to clear'),
        assignee_id: z.union([z.string().uuid(), z.literal('')]).optional().describe('New assignee UUID or empty string to clear'),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ card_id, subtask_id, ...updates }) => {
      try {
        const body = Object.fromEntries(
          Object.entries(updates).filter(([, v]) => v !== undefined)
        );

        if (Object.keys(body).length === 0) {
          return { content: [{ type: 'text' as const, text: 'Error: At least one field must be provided to update.' }] };
        }

        const result = await uphouse<Subtask & { auto_transition?: unknown }>(`/api/cards/${card_id}/subtasks`, 'PUT', {
          subtask_id,
          ...body,
        });

        const autoInfo = 'auto_transition' in result && result.auto_transition
          ? `\nAuto transition: ${JSON.stringify(result.auto_transition)}`
          : '';

        return {
          content: [{
            type: 'text' as const,
            text: `Subtask updated!\nID: ${result.id}\nTitle: ${result.title}\nCompleted: ${result.is_completed}${autoInfo}`,
          }],
          structuredContent: { subtask: result },
        };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${formatError(err)}` }] };
      }
    }
  );

  // DELETE SUBTASK
  server.registerTool(
    'uphouse_delete_subtask',
    {
      title: 'Delete Subtask',
      description: `Permanently delete a subtask from a card.

Args:
  - card_id (string): The card ID the subtask belongs to
  - subtask_id (string): The subtask ID to delete

Returns: Success message.`,
      inputSchema: z.object({
        card_id: z.string().min(1).describe('Card ID'),
        subtask_id: z.string().min(1).describe('Subtask ID to delete'),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ card_id, subtask_id }) => {
      try {
        await uphouse<Record<string, unknown>>(`/api/cards/${encodeURIComponent(card_id)}/subtasks?subtask_id=${encodeURIComponent(subtask_id)}`, 'DELETE');

        return {
          content: [{
            type: 'text' as const,
            text: `Subtask ${subtask_id} deleted successfully.`,
          }],
          structuredContent: { deleted: true, subtask_id },
        };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${formatError(err)}` }] };
      }
    }
  );
}
