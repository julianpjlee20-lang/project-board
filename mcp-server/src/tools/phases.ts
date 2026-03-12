// src/tools/phases.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { uphouse, formatError } from '../services/api.js';
import type { Phase, PhasesApiResponse } from '../types.js';

// 與前端 PRESET_COLORS 一致，用於自動分配顏色
const PRESET_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#06B6D4'];
let colorIndex = 0;

export function registerPhaseTools(server: McpServer): void {

  // LIST PHASES
  server.registerTool(
    'uphouse_list_phases',
    {
      title: 'List Phases',
      description: `List all phases in a specific project.

Args:
  - project_id (string): The project ID from uphouse_list_projects

Returns: Array of phases with id, name, and position.
Use phase IDs when calling uphouse_create_card or uphouse_list_cards.`,
      inputSchema: z.object({
        project_id: z.string().min(1).describe('Project ID to list phases for'),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ project_id }) => {
      try {
        const data = await uphouse<PhasesApiResponse>(`/api/projects/${project_id}/phases`);
        const phases: Phase[] = Array.isArray(data)
          ? data
          : ('phases' in data ? data.phases : data.data);

        if (!phases.length) {
          return { content: [{ type: 'text' as const, text: `No phases found for project ${project_id}.` }] };
        }

        const text = phases
          .map((p, i) => `- [${p.id}] ${p.name} (position: ${p.position ?? i})`)
          .join('\n');

        return {
          content: [{ type: 'text' as const, text: `Found ${phases.length} phase(s):\n\n${text}` }],
          structuredContent: { phases },
        };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${formatError(err)}` }] };
      }
    }
  );

  // CREATE PHASE
  server.registerTool(
    'uphouse_create_phase',
    {
      title: 'Create Phase',
      description: `Create a new phase inside a project.

Args:
  - project_id (string): The project ID to add the phase to
  - name (string): Phase name
  - color (string, optional): Display color in hex format (e.g. #FF5733)

Returns: The created phase object with its new id.
After creating phases, use uphouse_create_card to add cards/tasks.`,
      inputSchema: z.object({
        project_id: z.string().min(1).describe('Project ID'),
        name: z.string().min(1).max(200).describe('Phase name'),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe('Display color in hex format (e.g. #FF5733)'),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ project_id, name, color }) => {
      try {
        // 沒傳顏色時自動循環分配不同顏色
        const resolvedColor = color ?? PRESET_COLORS[colorIndex++ % PRESET_COLORS.length];
        const phase = await uphouse<Phase>(`/api/projects/${project_id}/phases`, 'POST', {
          name,
          color: resolvedColor,
        });

        return {
          content: [{
            type: 'text' as const,
            text: `Phase created!\nID: ${phase.id}\nName: ${phase.name}`,
          }],
          structuredContent: { phase },
        };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${formatError(err)}` }] };
      }
    }
  );
}
