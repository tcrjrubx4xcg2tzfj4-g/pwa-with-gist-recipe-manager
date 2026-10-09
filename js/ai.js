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
    "You are a nutritionist. Estimate calories per ingredient in a recipe.",
    "Ingredient names may be in German or English.",
    "For every ingredient line, output:",
    "- kcal_per_100g: nutritional density per 100g",
    "- grams: estimated quantity in grams as used in the recipe",
    "Rules:",
    "- Understand common German units (EL, TL, Tasse, Prise, Bund, g, ml) and English/imperial units (tbsp, tsp, cup, oz, lb).",
    "- If no quantity is listed, estimate a plausible home-cooking amount.",
    "- Set kcal_per_100g to 0 for negligible ingredients (Wasser, Salz, Gew\u00fcrze in kleinen Mengen).",
    "- Do NOT skip ingredients. Every input line must have an entry.",
    'Return ONLY valid JSON. No markdown, no code fences, no explanation.',
    'Format: {"ingredients":[{"name":"...","kcal_per_100g":number,"grams":number},...]}',
  ].join("\n");

  const ingredientLines = (ingredients || [])
    .map((ing, i) => `${i + 1}. ${ing}`)
    .join("\n");

  const userPrompt = `Recipe: ${name || "Untitled"}\nIngredients:\n${ingredientLines}\n\nFor each ingredient, provide kcal_per_100g and estimated grams used.`;

  try {
    const ingredientCount = (ingredients || []).length;
    // Generous budget: each ingredient takes ~15-25 tokens in JSON response;
    // the formula below leaves ample margin for verbose models, longer names,
    // and model-specific tokenization. Truncation would produce partial JSON,
    // making the regex fallback return incomplete results and wrong totals.
    const dynamicTokens = Math.max(250, ingredientCount * 50 + 120);
    const response = await openRouterRequest(
      apiKey,
      model,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: dynamicTokens, temperature: 0 },
    );

    if (!response.ok) {
      console.error("[AI] OpenRouter error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const content = extractMessageContent(data);
    if (!content) return null;

    const ingredientData = parseIngredientEstimates(content);
    if (!ingredientData || ingredientData.length === 0) return null;

    // Calculate total: sum of (kcal_per_100g / 100) * grams per ingredient
    let total = 0;
    for (const item of ingredientData) {
      if (item.kcal_per_100g > 0 && item.grams > 0) {
        total += (item.kcal_per_100g / 100) * item.grams;
      }
    }

    if (total <= 0 || isNaN(total)) return null;

    return Math.round(total);
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

/**
 * Parse the AI response into an array of {name, kcal_per_100g, grams} objects.
 *
 * Expects clean valid JSON. If the response can't be parsed (truncated, malformed,
 * extra text), returns null rather than attempting regex salvage — partial data
 * would silently produce wrong calorie totals and hide model quality issues.
 */
function parseIngredientEstimates(content) {
  if (!content) return null;

  // Strip markdown code fences (some models wrap in ```json despite instructions)
  const cleaned = content.replace(/```(?:json)?/gi, "").replace(/`/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.ingredients && Array.isArray(parsed.ingredients)) {
      return parsed.ingredients
        .filter(i => i.name && typeof i.kcal_per_100g === "number" && typeof i.grams === "number")
        .map(i => ({ name: i.name, kcal_per_100g: i.kcal_per_100g, grams: i.grams }));
    }
  } catch (e) {
    console.warn("[AI] Failed to parse estimation JSON — model may be too weak or response was truncated");
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