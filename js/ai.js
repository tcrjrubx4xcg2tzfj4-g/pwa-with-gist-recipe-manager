// ==================== AI Calorie Estimation ====================

const OPENROUTER_CONFIG = {
  endpoint: "https://openrouter.ai/api/v1/chat/completions",
};

/**
 * Minimal OpenRouter chat-completion request. Shared by estimation and
 * settings validation so headers/body formatting live in one place.
 *
 * @returns {Promise<Response>}
 */
function openRouterRequest(apiKey, model, messages, { maxTokens, temperature } = {}) {
  return fetch(OPENROUTER_CONFIG.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });
}

/**
 * Estimate total calories for a recipe from its name and ingredient lines.
 *
 * @param {string} name - Recipe title.
 * @param {string[]} ingredients - Ingredient lines, e.g. ["2 cups flour", "3 eggs"].
 * @returns {Promise<number|null>} - Rounded calorie total, or null on any error.
 *
 * Pure data function: no UI interaction, silent failure.
 */
async function estimateCalories(name, ingredients) {
  const apiKey = getSetting("ai_api_key");
  const model = getSetting("ai_model") || DEFAULT_AI_MODEL;

  if (!apiKey) return null;

  const systemPrompt = [
    "You are a nutritionist. Estimate the total calorie count for a recipe.",
    'Given the recipe name and ingredient lines, return a JSON object with exactly one key: {"total_calories": number}.',
    "Use reasonable real-world estimates. If details are ambiguous, make your best guess based on typical quantities.",
    "Return only the JSON. No markdown, no code fences, no explanation.",
  ].join("\n");

  const ingredientLines = (ingredients || [])
    .map((ing, i) => `${i + 1}. ${ing}`)
    .join("\n");

  const userPrompt = `Recipe name: ${name || "Untitled"}\nIngredients:\n${ingredientLines}`;

  try {
    const response = await openRouterRequest(
      apiKey,
      model,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: 30, temperature: 0 },
    );

    if (!response.ok) {
      console.error("[AI] OpenRouter error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const content = extractMessageContent(data);
    const totalCalories = parseCalories(content);

    if (totalCalories === null || totalCalories < 0 || isNaN(totalCalories)) {
      return null;
    }

    return Math.round(totalCalories);
  } catch (e) {
    console.error("[AI] Estimation error:", e);
    return null;
  }
}

function extractMessageContent(data) {
  const message =
    data && data.choices && data.choices[0] && data.choices[0].message;

  if (!message) return null;

  if (typeof message.content === "string") {
    return message.content;
  }

  // Some providers return content as an array of parts.
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) =>
        typeof part === "string" ? part : part && part.text ? part.text : "",
      )
      .join("");
  }

  return null;
}

function parseCalories(content) {
  if (!content) return null;

  // Try parsing the whole content as JSON first.
  try {
    const parsed = JSON.parse(content.trim());
    const value = extractCaloriesValue(parsed);
    if (value !== null) return value;
  } catch (e) {
    // Fall through to regex-based extraction.
  }

  // Strip markdown code fences and backticks if present.
  const cleaned = content
    .replace(/```(?:json)?/gi, "")
    .replace(/`/g, "")
    .trim();

  // Look for "total_calories": <number> (with or without quotes around value).
  const keyMatch = cleaned.match(/"total_calories"\s*:\s*(-?\d+(?:\.\d+)?)/);
  if (keyMatch) return parseFloat(keyMatch[1]);

  // Last resort: first standalone number.
  const numberMatch = cleaned.match(/(-?\d+(?:\.\d+)?)/);
  return numberMatch ? parseFloat(numberMatch[1]) : null;
}

function extractCaloriesValue(obj) {
  if (obj == null) return null;
  if (typeof obj === "number") return obj;

  if (typeof obj === "object") {
    const keys = ["total_calories", "totalCalories", "calories"];
    for (const key of keys) {
      if (typeof obj[key] === "number") return obj[key];
      if (typeof obj[key] === "string" && obj[key].trim() !== "") {
        const n = parseFloat(obj[key]);
        if (!isNaN(n)) return n;
      }
    }
  }

  return null;
}

/**
 * Validate an OpenRouter API key + model with a minimal request.
 *
 * @returns {Promise<{ok: boolean, field?: string, message?: string}>}
 *   `field` is 'key' | 'model' | 'network' for non-ok results.
 */
async function testOpenRouterConfig(apiKey, model) {
  try {
    const response = await openRouterRequest(
      apiKey,
      model || DEFAULT_AI_MODEL,
      [{ role: "user", content: "ok" }],
      { maxTokens: 2, temperature: 0 },
    );

    if (response.ok) {
      return { ok: true };
    }

    let detail = "";
    try {
      const data = await response.json();
      detail =
        data && data.error && data.error.message ? data.error.message : "";
    } catch (e) {
      // Ignore response body parse failures.
    }

    if (response.status === 401 || response.status === 403) {
      return { ok: false, field: "key", message: "Invalid API key" };
    }

    if (response.status === 404 || /model/i.test(detail)) {
      return { ok: false, field: "model", message: `Model not found: ${model}` };
    }

    return {
      ok: false,
      field: "key",
      message: `OpenRouter error ${response.status}${detail ? `: ${detail}` : ""}`,
    };
  } catch (e) {
    return { ok: false, field: "network", message: `Network error: ${e.message}` };
  }
}