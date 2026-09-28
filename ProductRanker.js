/**
 * ProductRanker
 *
 * Ranks products using a configurable weighted score:
 *   score = rating * ratingWeight
 *         + normalizedReviewScore * reviewWeight
 *         + normalizedPriceScore  * priceWeight
 * Defaults match the spec: 0.6 / 0.2 / 0.2.
 *
 * NORMALIZATION APPROACH (documented per spec requirement):
 * - Reviews (normalizedReviewScore): raw review counts can range from 0 to
 *   the tens of thousands, so a plain min-max scale would let a handful of
 *   extreme outliers dominate the score. Each count is first compressed with
 *   log1p (log(1 + n)) to flatten that skew, then min-max scaled to [0, 1]
 *   across the current product set: (log1p(n) - min) / (max - min).
 * - Price (normalizedPriceScore): cheaper is better, so price is inverse
 *   min-max scaled: (max - price) / (max - min). The cheapest product in the
 *   set scores 1, the most expensive scores 0.
 * - Both normalizations are relative to the current catalog, so scores are
 *   only comparable within a single rankProducts() call, not across calls
 *   where products have been added/removed.
 * - Edge case: if every product shares the same value for a metric (or only
 *   one product exists), max === min and the ratio is undefined. In that
 *   case every product is given the neutral score 1 for that metric, since
 *   no product is relatively better or worse than another on it.
 */
class ProductRanker {
  constructor(weights = {}) {
    const { rating = 0.6, review = 0.2, price = 0.2 } = weights;
    if ([rating, review, price].some((w) => typeof w !== 'number' || !Number.isFinite(w) || w < 0)) {
      throw new TypeError('Weights must be non-negative finite numbers.');
    }
    this.weights = { rating, review, price };
    this.products = [];
  }

  /** Validates and stores a product. Throws TypeError on invalid input. */
  addProduct(product) {
    this._validate(product);
    // Store a defensive copy so external mutation can't corrupt state.
    this.products.push({ ...product });
    return this;
  }

  /** Returns all products ranked by score, highest first. */
  rankProducts() {
    if (this.products.length === 0) return [];

    const reviewLogs = this.products.map((p) => Math.log1p(p.numberOfReviews));
    const prices = this.products.map((p) => p.price);

    const reviewRange = this._range(reviewLogs);
    const priceRange = this._range(prices);

    const ranked = this.products.map((p, i) => {
      const normalizedReviewScore = this._normalize(reviewLogs[i], reviewRange);
      const normalizedPriceScore = this._normalize(prices[i], priceRange, true);
      const score =
        p.rating * this.weights.rating +
        normalizedReviewScore * this.weights.review +
        normalizedPriceScore * this.weights.price;
      return { ...p, normalizedReviewScore, normalizedPriceScore, score };
    });

    // Sort by score desc; tie-break by productId for a deterministic order.
    return ranked.sort((a, b) => b.score - a.score || String(a.productId).localeCompare(String(b.productId)));
  }

  /** Returns the top n ranked products. */
  getTopProducts(n) {
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
      throw new TypeError('n must be a non-negative number.');
    }
    return this.rankProducts().slice(0, Math.floor(n));
  }

  // --- internal helpers ---

  _range(values) {
    return { min: Math.min(...values), max: Math.max(...values) };
  }

  // inverse=true flips the scale so a lower raw value yields a higher score (used for price).
  _normalize(value, { min, max }, inverse = false) {
    if (max === min) return 1; // no spread to compare against; treat as neutral/best.
    return inverse ? (max - value) / (max - min) : (value - min) / (max - min);
  }

  _validate(product) {
    if (!product || typeof product !== 'object') {
      throw new TypeError('Product must be an object.');
    }
    const { productId, rating, numberOfReviews, price } = product;

    const idOk =
      (typeof productId === 'string' && productId.trim().length > 0) ||
      (typeof productId === 'number' && Number.isFinite(productId));
    if (!idOk) throw new TypeError('productId must be a non-empty string or a finite number.');

    if (typeof rating !== 'number' || !Number.isFinite(rating) || rating < 0 || rating > 5) {
      throw new TypeError('rating must be a number between 0 and 5.');
    }
    if (typeof numberOfReviews !== 'number' || !Number.isInteger(numberOfReviews) || numberOfReviews < 0) {
      throw new TypeError('numberOfReviews must be a non-negative integer.');
    }
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
      throw new TypeError('price must be a non-negative number.');
    }
  }
}

module.exports = ProductRanker;
