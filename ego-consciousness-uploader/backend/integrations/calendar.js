import { callTool } from './mcp-tools.js';

const TOOL_CREATE = process.env.CAL_TOOL_CREATE || 'gcal_create_event';
const TOOL_LIST = process.env.CAL_TOOL_LIST || 'gcal_list_events';
const DEFAULT_CALENDAR_ID = process.env.CALENDAR_ID || 'primary';
const MCP_SERVER_URL = process.env.SMITHERY_SERVER_URL || null;

export async function handleCreateCalendarEvent(req, res) {
  try {
    const {
      summary,
      description = '',
      start, // ISO string or { dateTime, timeZone }
      end,   // ISO string or { dateTime, timeZone }
      attendees = [], // [{ email }]
      location = undefined,
      calendarId = DEFAULT_CALENDAR_ID,
      timeZone = undefined,
      serverUrl = MCP_SERVER_URL,
    } = req.body || {};

    if (!summary || !start || !end) {
      return res.status(400).json({ error: 'summary, start, and end are required' });
    }

    // Normalize start/end to objects if strings provided
    const normalizeDate = (v) => (typeof v === 'string' ? { dateTime: v, timeZone } : v);
    const args = {
      calendarId,
      summary,
      description,
      location,
      start: normalizeDate(start),
      end: normalizeDate(end),
      attendees,
    };

    const result = await callTool(TOOL_CREATE, args, serverUrl);
    return res.json({ ok: true, result });
  } catch (error) {
    console.error('[Calendar] Create event failed:', error);
    return res.status(500).json({ error: 'Failed to create calendar event' });
  }
}

export async function handleListCalendarEvents(req, res) {
  try {
    const {
      calendarId = DEFAULT_CALENDAR_ID,
      timeMin,
      timeMax,
      maxResults = 10,
      serverUrl = MCP_SERVER_URL,
    } = req.query || {};

    if (!timeMin && !timeMax) {
      // Recommend at least a window; but allow listing upcoming by default
    }

    const args = {
      calendarId,
      timeMin,
      timeMax,
      maxResults: Number(maxResults) || 10,
    };

    const result = await callTool(TOOL_LIST, args, serverUrl);
    return res.json({ ok: true, events: result });
  } catch (error) {
    console.error('[Calendar] List events failed:', error);
    return res.status(500).json({ error: 'Failed to list calendar events' });
  }
}

