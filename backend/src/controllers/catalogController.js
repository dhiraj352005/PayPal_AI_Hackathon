import { getCatalog, getProductBySku, getProductsByCategory } from '../services/catalogService.js';

export async function listCatalogHandler(req, res, next) {
  try {
    const { category, search } = req.query;
    let catalog = await getCatalog();

    if (category) {
      catalog = catalog.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase();
      catalog = catalog.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }

    res.json({
      success: true,
      count: catalog.length,
      currency: process.env.CATALOG_CURRENCY || 'USD',
      catalog
    });
  } catch (error) {
    next(error);
  }
}

export async function getProductHandler(req, res, next) {
  try {
    const product = await getProductBySku(req.params.sku);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, product });
  } catch (error) {
    next(error);
  }
}
