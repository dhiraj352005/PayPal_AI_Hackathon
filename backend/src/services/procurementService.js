import { getCatalog } from './catalogService.js';
import { generateGeminiContent, isGeminiConfigured } from './geminiService.js';

/**
 * Deterministic B2B Catalog Matcher & Budget Optimizer
 * Used as fallback or to refine and constrain AI outputs strictly within budget.
 */
export async function optimizeProcurementDeterministic(prompt, maxBudget) {
  const catalog = await getCatalog();
  const lowerPrompt = prompt.toLowerCase();

  // Extract desired team/person count if mentioned (e.g., "5-person", "five developers", "10 chairs")
  let targetQuantity = 1;
  const wordMap = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  
  // Look for number words first or count followed by descriptors
  const contextCountMatch = lowerPrompt.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:-| )*(?:person|people|developers|devs|engineers|users|stations|units|workstations|chairs|monitors|headsets|keyboards)\b/);
  const wordCountMatch = lowerPrompt.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/);

  if (contextCountMatch) {
    const raw = contextCountMatch[1].toLowerCase();
    targetQuantity = parseInt(raw, 10) || wordMap[raw] || 1;
  } else if (wordCountMatch) {
    targetQuantity = wordMap[wordCountMatch[1].toLowerCase()] || 1;
  }


  // Keywords to catalog categories and priorities
  const intentKeywords = [
    { words: ['monitor', 'screen', 'display', '4k'], category: 'Monitors', minQty: targetQuantity },
    { words: ['keyboard', 'mechanical'], category: 'Keyboards and mice', sub: 'key', minQty: targetQuantity },
    { words: ['mouse', 'mice'], category: 'Keyboards and mice', sub: 'mou', minQty: targetQuantity },
    { words: ['headset', 'headphones', 'noise-canceling', 'mic', 'audio'], category: 'Headsets and webcams', sub: 'aud', minQty: targetQuantity },
    { words: ['webcam', 'camera'], category: 'Headsets and webcams', sub: 'cam', minQty: targetQuantity },
    { words: ['chair', 'ergonomic', 'desk', 'standing desk'], category: 'Office furniture', minQty: targetQuantity },
    { words: ['laptop', 'macbook', 'workstation', 'computer'], category: 'Computers and accessories', minQty: 1 },
    { words: ['network', 'switch', 'router', 'wifi'], category: 'Networking equipment', minQty: 1 },
    { words: ['podcast', 'stream', 'studio'], category: 'Productivity equipment', minQty: 1 },
    { words: ['software', 'copilot', 'license'], category: 'Software licenses', minQty: targetQuantity }
  ];

  // Score catalog items based on prompt
  const matchedCategories = [];
  for (const ik of intentKeywords) {
    if (ik.words.some(w => lowerPrompt.includes(w))) {
      matchedCategories.push(ik);
    }
  }

  // If no specific category matched, provide an all-round professional dev workstation default
  if (matchedCategories.length === 0) {
    matchedCategories.push(
      { words: ['monitor'], category: 'Monitors', minQty: targetQuantity },
      { words: ['keyboard'], category: 'Keyboards and mice', minQty: targetQuantity },
      { words: ['headset'], category: 'Headsets and webcams', minQty: targetQuantity }
    );
  }

  // Candidate selection per category
  const selectedItems = [];
  let currentTotal = 0;
  const unmetRequirements = [];

  for (const match of matchedCategories) {
    // Find candidate items in category, sorted by price ascending or value
    let candidates = catalog.filter(item => item.category === match.category);
    if (match.sub) {
      const subFiltered = candidates.filter(item => item.sku.toLowerCase().includes(match.sub));
      if (subFiltered.length > 0) candidates = subFiltered;
    }

    if (candidates.length === 0) continue;

    // Sort by price ascending to maximize budget fit
    candidates.sort((a, b) => a.unitPrice - b.unitPrice);

    let chosenCandidate = null;
    let chosenQty = match.minQty;

    // Try finding the best item where unitPrice * chosenQty fits within remaining budget
    for (const candidate of candidates) {
      const cost = candidate.unitPrice * chosenQty;
      if (currentTotal + cost <= maxBudget) {
        chosenCandidate = candidate;
        // If we can afford a higher tier item, check the next one
      }
    }

    // If even lowest priced item * chosenQty exceeds remaining budget, try scaling down or record unmet
    if (!chosenCandidate && candidates.length > 0) {
      const cheapest = candidates[0];
      const maxPossibleQty = Math.floor((maxBudget - currentTotal) / cheapest.unitPrice);
      if (maxPossibleQty > 0) {
        chosenCandidate = cheapest;
        chosenQty = maxPossibleQty;
        unmetRequirements.push(
          `Reduced quantity of ${cheapest.name} to ${maxPossibleQty} units (requested ${match.minQty}) to avoid exceeding budget.`
        );
      } else {
        unmetRequirements.push(
          `Could not include ${match.category} (${cheapest.name}) because adding it would exceed the remaining budget ($${(maxBudget - currentTotal).toFixed(2)} available vs $${cheapest.unitPrice.toFixed(2)} needed).`
        );
      }
    }

    if (chosenCandidate) {
      const subtotal = Number((chosenCandidate.unitPrice * chosenQty).toFixed(2));
      currentTotal += subtotal;
      selectedItems.push({
        sku: chosenCandidate.sku,
        name: chosenCandidate.name,
        category: chosenCandidate.category,
        supplier: chosenCandidate.supplier,
        unitPrice: chosenCandidate.unitPrice,
        quantity: chosenQty,
        subtotal,
        confidence: 0.95
      });
    }
  }

  const remainingBudget = Number(Math.max(0, maxBudget - currentTotal).toFixed(2));
  const savingsPercentage = Number((((maxBudget - currentTotal) / maxBudget) * 100).toFixed(1));

  return {
    mode: 'fallback',
    requestSummary: `Procurement request parsed for ${targetQuantity} station(s) with maximum budget limit of $${maxBudget.toLocaleString()}.`,
    reasoningSummary: `Deterministic B2B optimization matched ${selectedItems.length} product lines to your specifications. Bundle total of $${currentTotal.toFixed(2)} provides $${remainingBudget.toFixed(2)} in surplus budget.`,
    selectedCatalogItems: selectedItems,
    totalCost: Number(currentTotal.toFixed(2)),
    maxBudget: Number(maxBudget),
    remainingBudget,
    savingsPercentage: savingsPercentage > 0 ? savingsPercentage : 0,
    unmetRequirements: unmetRequirements.length > 0 ? unmetRequirements : ['All matched requirements satisfied within budget.']
  };
}

/**
 * Main Procurement Entrypoint:
 * Uses live Gemini if configured, then validates against real catalog and budget.
 * Falls back deterministically if Gemini is unavailable or quota is exceeded.
 */
export async function runProcurementAgent({ prompt, maxBudget = 3500 }) {
  const budgetNum = Math.max(100, Number(maxBudget) || 3500);

  if (!isGeminiConfigured()) {
    console.info('[ProcurementService] Gemini API key not configured. Using deterministic fallback.');
    return optimizeProcurementDeterministic(prompt, budgetNum);
  }

  const catalog = await getCatalog();
  const catalogSummary = catalog.map(p => ({
    sku: p.sku,
    name: p.name,
    category: p.category,
    unitPrice: p.unitPrice,
    availability: p.availability
  }));

  const systemInstruction = `You are PayFlow AI's autonomous procurement agent.
Analyze the user's purchasing prompt and select suitable items EXCLUSIVELY from the provided B2B catalog.
Never invent SKUs or prices.
The total cost of (unitPrice * quantity) across all items MUST NOT exceed the user's maxBudget of $${budgetNum}.
If budget is tight, pick cost-effective alternatives or adjust quantities and state the trade-offs.

Output strictly a JSON object:
{
  "requestSummary": "Brief overview of what was requested",
  "reasoningSummary": "Concise explanation of product selection, rationale, and budget allocation",
  "selectedItems": [
    {
      "sku": "EXACT_SKU_FROM_CATALOG",
      "quantity": 5,
      "confidence": 0.95
    }
  ],
  "unmetRequirements": ["Any trade-offs or items that could not fit into budget"]
}`;

  try {
    const aiResult = await generateGeminiContent({
      prompt: `User Request: "${prompt}"\nUser Max Budget: $${budgetNum}\n\nAvailable Catalog:\n${JSON.stringify(catalogSummary, null, 2)}`,
      systemInstruction
    });

    const parsed = aiResult.data;
    if (!parsed || !Array.isArray(parsed.selectedItems) || parsed.selectedItems.length === 0) {
      throw new Error('Gemini did not return valid selectedItems');
    }

    // Validate every item against trusted catalog and compute trusted prices
    const catalogMap = new Map(catalog.map(c => [c.sku, c]));
    let totalCost = 0;
    const validatedItems = [];

    for (const item of parsed.selectedItems) {
      const trusted = catalogMap.get(item.sku);
      if (!trusted) continue;

      const qty = Math.max(1, Math.min(trusted.availability, parseInt(item.quantity, 10) || 1));
      const subtotal = Number((trusted.unitPrice * qty).toFixed(2));

      // Guard against budget overrun
      if (totalCost + subtotal <= budgetNum) {
        totalCost += subtotal;
        validatedItems.push({
          sku: trusted.sku,
          name: trusted.name,
          category: trusted.category,
          supplier: trusted.supplier,
          unitPrice: trusted.unitPrice,
          quantity: qty,
          subtotal,
          confidence: item.confidence || 0.9
        });
      }
    }

    // If AI items were valid and within budget, return them
    if (validatedItems.length > 0) {
      const remainingBudget = Number(Math.max(0, budgetNum - totalCost).toFixed(2));
      const savingsPercentage = Number((((budgetNum - totalCost) / budgetNum) * 100).toFixed(1));

      return {
        mode: 'live',
        requestSummary: parsed.requestSummary || `Procurement analysis for: ${prompt}`,
        reasoningSummary: parsed.reasoningSummary || `Selected ${validatedItems.length} catalog items using Gemini ${aiResult.model}.`,
        selectedCatalogItems: validatedItems,
        totalCost: Number(totalCost.toFixed(2)),
        maxBudget: budgetNum,
        remainingBudget,
        savingsPercentage: savingsPercentage > 0 ? savingsPercentage : 0,
        unmetRequirements: Array.isArray(parsed.unmetRequirements) && parsed.unmetRequirements.length > 0
          ? parsed.unmetRequirements
          : ['All requested items accommodated within budget.']
      };
    }

    // Fallback if AI selection exceeded budget or was invalid
    console.warn('[ProcurementService] AI output failed budget validation. Falling back to deterministic optimization.');
    return optimizeProcurementDeterministic(prompt, budgetNum);
  } catch (err) {
    console.warn('[ProcurementService] Gemini error, using fallback:', err.message);
    const fallback = await optimizeProcurementDeterministic(prompt, budgetNum);
    fallback.note = `AI service unavailable (${err.message}). Deterministic catalog optimizer used.`;
    return fallback;
  }
}
