// src/tools/projects.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { uphouse, formatError } from '../services/api.js';
import type { Project, ProjectsApiResponse } from '../types.js';

export function registerProjectTools(server: McpServer): void {

  // LIST PROJECTS
  server.registerTool(
    'uphouse_list_projects',
    {
      title: 'List Projects',
      description: `List all projects in the Uphouse Dashboard.

Returns a list of all projects with their IDs, names, and status.
Use the project ID from this response when calling uphouse_list_phases or uphouse_create_phase.

Returns: Array of projects with id, name, description, status, created_at.`,
      inputSchema: z.object({}).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const data = await uphouse<ProjectsApiResponse>('/api/projects');
        const projects: Project[] = Array.isArray(data)
          ? data
          : ('projects' in data ? data.projects : data.data);

        if (!projects.length) {
          return { content: [{ type: 'text' as const, text: 'No projects found.' }] };
        }

        const text = projects
          .map(p => `- [${p.id}] ${p.name}${p.status ? ` (${p.status})` : ''}`)
          .join('\n');

        return {
          content: [{ type: 'text' as const, text: `Found ${projects.length} project(s):\n\n${text}` }],
          structuredContent: { projects },
        };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${formatError(err)}` }] };
      }
    }
  );

  // CREATE PROJECT
  server.registerTool(
    'uphouse_create_project',
    {
      title: 'Create Project',
      description: `Create a new project in the Uphouse Dashboard.

Args:
  - name (string): Project name
  - description (string, optional): Project description

Returns: The created project object with its new id.
After creating a project, use uphouse_create_phase to add phases.`,
      inputSchema: z.object({
        name: z.string().min(1).max(200).describe('Project name'),
        description: z.string().optional().describe('Project description'),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ name, description }) => {
      try {
        const project = await uphouse<Project>('/api/projects', 'POST', {
          name,
          ...(description ? { description } : {}),
        });

        return {
          content: [{
            type: 'text' as const,
            text: `Project created!\nID: ${project.id}\nName: ${project.name}`,
          }],
          structuredContent: { project },
        };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${formatError(err)}` }] };
      }
    }
  );
}
