const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Streams SSE events from POST /run using fetch + ReadableStream.
 * Cannot use EventSource because the endpoint requires POST.
 */
export async function streamRun({ facilityId, token, onEvent, onError, onDone }) {
  let response;
  try {
    response = await fetch(`${API_BASE}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ facility_id: facilityId }),
    });
  } catch (err) {
    onError?.(err.message || 'Network error');
    return;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    onError?.(`HTTP ${response.status}: ${text}`);
    return;
  }

  if (!response.body) {
    onError?.('No response body');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const lines = part.split('\n');
        let dataStr = '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            dataStr += line.slice(6);
          }
        }
        if (dataStr) {
          try {
            onEvent?.(JSON.parse(dataStr));
          } catch {
            // malformed JSON chunk — skip
          }
        }
      }
    }

    // flush remaining buffer
    if (buffer.trim()) {
      const lines = buffer.split('\n');
      let dataStr = '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          dataStr += line.slice(6);
        }
      }
      if (dataStr) {
        try {
          onEvent?.(JSON.parse(dataStr));
        } catch {
          // malformed final chunk
        }
      }
    }
  } catch (err) {
    onError?.(err.message || 'Stream read error');
    return;
  }

  onDone?.();
}

/**
 * POST /proposals/{runId}/decision — submit a review decision.
 */
export async function submitDecision({ runId, status, feedbackText, token }) {
  const response = await fetch(`${API_BASE}/proposals/${runId}/decision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      status,
      feedback_text: feedbackText || null,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json();
}
