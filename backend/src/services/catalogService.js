import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CATALOG_FILE = path.resolve(__dirname, '../data/catalog.json');

let cachedCatalog = null;

export async function getCatalog() {
  if (cachedCatalog) return cachedCatalog;
  try {
    const raw = await fs.readFile(CATALOG_FILE, 'utf-8');
    cachedCatalog = JSON.parse(raw);
    return cachedCatalog;
  } catch (error) {
    console.error('[CatalogService] Failed to load catalog:', error);
    return [];
  }
}

export async function getProductBySku(sku) {
  const catalog = await getCatalog();
  return catalog.find(item => item.sku.toLowerCase() === sku.toLowerCase()) || null;
}

export async function getProductsByCategory(category) {
  const catalog = await getCatalog();
  return catalog.filter(item => item.category.toLowerCase() === category.toLowerCase());
}

/**
 * Validates an order cart against trusted catalog prices and availability.
 * Computes official subtotal and verifies items.
 */
export async function validateCartItems(items) {
  const catalog = await getCatalog();
  const catalogMap = new Map(catalog.map(p => [p.sku, p]));

  const validatedItems = [];
  let subtotal = 0;
  const errors = [];

  for (const item of items) {
    const trustedProduct = catalogMap.get(item.sku);
    if (!trustedProduct) {
      errors.push(`Unknown product SKU: ${item.sku}`);
      continue;
    }

    const qty = parseInt(item.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      errors.push(`Invalid quantity for ${trustedProduct.name}: ${item.quantity}`);
      continue;
    }

    if (qty > trustedProduct.availability) {
      errors.push(`Requested quantity (${qty}) exceeds stock (${trustedProduct.availability}) for ${trustedProduct.name}`);
      continue;
    }

    const itemTotal = Number((trustedProduct.unitPrice * qty).toFixed(2));
    subtotal += itemTotal;

    validatedItems.push({
      sku: trustedProduct.sku,
      name: trustedProduct.name,
      category: trustedProduct.category,
      unitPrice: trustedProduct.unitPrice,
      quantity: qty,
      subtotal: itemTotal,
      currency: trustedProduct.currency
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    items: validatedItems,
    subtotal: Number(subtotal.toFixed(2))
  };
}
