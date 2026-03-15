// src/tools/users.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { uphouse, formatError } from '../services/api.js';
import type { User, UsersApiResponse } from '../types.js';

export function registerUserTools(server: McpServer): void {

  // LIST USERS
  server.registerTool(
    'uphouse_list_users',
    {
      title: 'List Users',
      description: `List all users in the Uphouse Dashboard with their UUIDs.

Returns a list of users with their UUID, name, email, role, and status.
Use the user UUID when assigning cards (assignee_id).

Optional filters:
  - role: Filter by 'admin' or 'user'
  - search: Search by name or email

Returns: Array of users with id (UUID), name, email, role, is_active, login_method.`,
      inputSchema: z.object({
        role: z.enum(['admin', 'user']).optional().describe('Filter by role'),
        search: z.string().optional().describe('Search by name or email'),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ role, search }) => {
      try {
        const params = new URLSearchParams({ limit: '100' });
        if (role) params.set('role', role);
        if (search) params.set('search', search);

        const data = await uphouse<UsersApiResponse>(`/api/admin/users?${params.toString()}`);
        const users: User[] = data.users;

        if (!users.length) {
          return { content: [{ type: 'text' as const, text: 'No users found.' }] };
        }

        const text = users
          .map(u => `- [${u.id}] ${u.name || '(unnamed)'} (${u.email}) — role: ${u.role}, status: ${u.is_active ? 'active' : 'inactive'}`)
          .join('\n');

        return {
          content: [{ type: 'text' as const, text: `Found ${users.length} user(s):\n\n${text}` }],
          structuredContent: { users },
        };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${formatError(err)}` }] };
      }
    }
  );
}
