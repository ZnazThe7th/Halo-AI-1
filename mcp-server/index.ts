#!/usr/bin/env node
/**
 * Halo Assistant MCP Server
 * 
 * Connects Claude Desktop (or any MCP client) to your Halo Assistant business.
 * 
 * Setup:
 *   1. Generate an API key in Halo Assistant → Settings → AI Integrations
 *   2. Set HALO_API_KEY and HALO_API_URL environment variables
 *   3. Add this server to your Claude Desktop config (see README)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const API_KEY = process.env.HALO_API_KEY || '';
const API_URL = process.env.HALO_API_URL || 'https://halo-ai-1.vercel.app';

if (!API_KEY) {
  console.error('❌ HALO_API_KEY environment variable is required.');
  console.error('   Generate one at: Halo Assistant → Settings → AI Integrations');
  process.exit(1);
}

// ── HTTP helper ──
async function apiCall(method: string, path: string, body?: any): Promise<any> {
  const url = `${API_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

// ── MCP Server ──
const server = new Server(
  { name: 'halo-assistant', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_schedule',
      description: 'Get the appointment schedule for a specific date. Defaults to today if no date is provided.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD format. Defaults to today.' }
        }
      }
    },
    {
      name: 'book_appointment',
      description: 'Book a new appointment for a client.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          clientName: { type: 'string', description: 'Name of the client' },
          serviceName: { type: 'string', description: 'Name of the service (partial match OK)' },
          date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
          time: { type: 'string', description: 'Time in HH:MM 24-hour format (e.g. 14:30)' },
          notes: { type: 'string', description: 'Optional notes' }
        },
        required: ['clientName', 'date', 'time']
      }
    },
    {
      name: 'update_appointment_status',
      description: 'Mark an appointment as completed, cancelled, confirmed, pending, or blocked.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'The appointment ID' },
          status: { type: 'string', enum: ['CONFIRMED', 'PENDING', 'COMPLETED', 'CANCELLED', 'BLOCKED'], description: 'New status' }
        },
        required: ['id', 'status']
      }
    },
    {
      name: 'list_clients',
      description: 'List all clients, optionally filtered by a search term.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          search: { type: 'string', description: 'Filter clients by name or email' }
        }
      }
    },
    {
      name: 'add_client',
      description: 'Add a new client to the business.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: "Client's full name" },
          clientEmail: { type: 'string', description: "Client's email" },
          phone: { type: 'string', description: "Client's phone number" },
          preferences: { type: 'string', description: 'Client preferences or notes' }
        },
        required: ['name']
      }
    },
    {
      name: 'get_business_stats',
      description: 'Get business profile info and key statistics: total clients, appointments, revenue, expenses, net earnings, and monthly goal.',
      inputSchema: {
        type: 'object' as const,
        properties: {}
      }
    },
    {
      name: 'get_earnings_breakdown',
      description: 'Get a detailed financial breakdown: revenue by service, expenses by category, bonus income, and totals.',
      inputSchema: {
        type: 'object' as const,
        properties: {}
      }
    }
  ]
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      case 'get_schedule': {
        const query = args?.date ? `?date=${args.date}` : '';
        result = await apiCall('GET', `/api/ai/schedule${query}`);
        break;
      }
      case 'book_appointment': {
        result = await apiCall('POST', '/api/ai/appointments', args);
        break;
      }
      case 'update_appointment_status': {
        const { id, status } = args as { id: string; status: string };
        result = await apiCall('PATCH', `/api/ai/appointments/${id}`, { status });
        break;
      }
      case 'list_clients': {
        const query = args?.search ? `?search=${encodeURIComponent(args.search as string)}` : '';
        result = await apiCall('GET', `/api/ai/clients${query}`);
        break;
      }
      case 'add_client': {
        result = await apiCall('POST', '/api/ai/clients', args);
        break;
      }
      case 'get_business_stats': {
        result = await apiCall('GET', '/api/ai/business');
        break;
      }
      case 'get_earnings_breakdown': {
        result = await apiCall('GET', '/api/ai/earnings');
        break;
      }
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🟢 Halo MCP Server running');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
