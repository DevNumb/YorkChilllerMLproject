/**
 * Assistant Context Builder
 * Creates context object for the AI Assistant based on current application state
 */

/**
 * Build context object for the AI Assistant
 * @param {Object} params - Parameters object
 * @param {Object} params.lastRecommendation - The latest recommendation from optimizer
 * @param {Object} params.liveConditions - Current weather and conditions
 * @param {Array} params.history - Historical data for context
 * @param {Object} params.location - Current location settings
 * @returns {Object} Context object for the assistant
 */
export function buildAssistantContext({ lastRecommendation, liveConditions, history, location }) {
  const context = {};
  
  // Add recommendation context
  if (lastRecommendation) {
    context.recommendation = {
      type: lastRecommendation.type,
      priority: lastRecommendation.priority,
      description: lastRecommendation.description,
      potentialSavings: lastRecommendation.potentialSavings,
      timestamp: lastRecommendation.timestamp
    };
  }
  
  // Add live conditions context
  if (liveConditions) {
    context.conditions = {
      outdoorTemp: liveConditions.temperature,
      humidity: liveConditions.humidity,
      load: liveConditions.load,
      efficiency: liveConditions.efficiency
    };
  }
  
  // Add location context
  if (location) {
    context.location = {
      city: location.city,
      timezone: location.timezone
    };
  }
  
  return context;
}

export default { buildAssistantContext };