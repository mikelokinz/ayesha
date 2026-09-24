import { getANPRIncidents, API_BASE_URL } from './api';

export const incidentApi = {
  getIncidents: async () => {
    return getANPRIncidents();
  },

  logHitAndRun: async (incidentPayload) => {
    const response = await fetch(`${API_BASE_URL}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incidentPayload),
    });
    if (!response.ok) throw new Error(`logHitAndRun failed: ${response.status}`);
    return response.json();
  },

  broadcastPoliceAlert: async (incidentId, channel = 'GCTP_ALL_SECTORS') => {
    const response = await fetch(
      `${API_BASE_URL}/api/events/${incidentId}/status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'VERIFIED', note: `Broadcast to ${channel}` }),
      }
    );
    if (!response.ok) throw new Error(`broadcastPoliceAlert failed: ${response.status}`);
    return response.json();
  },
};