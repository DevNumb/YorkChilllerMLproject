/**
 * AI Assistant Service - Frontend API Client
 * Calls the serverless function at /api/assistant
 */

const API_PATH = '/api/assistant';

/**
 * Send a question to the AI Assistant
 * @param {Object} params - Parameters object
 * @param {string} params.question - The question to ask the assistant
 * @param {Object} params.context - Optional context data (recommendations, conditions, etc.)
 * @returns {Promise<string>} The assistant's reply
 * @throws {Error} If the request fails
 */
export async function sendAssistantMessage({ question, context }) {
  const response = await fetch(API_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      context: context || {},
    }),
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // If we can't parse JSON, use the status text
      errorMessage = response.statusText || errorMessage;
    }
    
    throw new Error(errorMessage);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error);
  }

  return data.reply || 'No assistant reply was returned.';
}

export default { sendAssistantMessage };