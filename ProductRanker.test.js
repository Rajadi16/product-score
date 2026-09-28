// Plain Node assert tests — no framework/config needed, just `node ProductRanker.test.js`.
const assert = require('assert');
const ProductRanker = require('./ProductRanker.js');

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    throw err;
  }
}

test('empty catalog ranks to an empty list', () => {
  const r = new ProductRanker();
  assert.deepStrictEqual(r.rankProducts(), []);
});

test('single product gets neutral (1) normalized scores', () => {
  const r = new ProductRanker();
  r.addProduct({ productId: 'A', rating: 3, numberOfReviews: 5, price: 10 });
  const [p] = r.rankProducts();
  assert.strictEqual(p.normalizedReviewScore, 1);
  assert.strictEqual(p.normalizedPriceScore, 1);
});

test('higher rating, more reviews, lower price ranks first', () => {
  const r = new ProductRanker();
  r.addProduct({ productId: 'cheap-popular', rating: 4.8, numberOfReviews: 5000, price: 15 });
  r.addProduct({ productId: 'pricey-unknown', rating: 4.0, numberOfReviews: 2, price: 200 });
  const ranked = r.rankProducts();
  assert.strictEqual(ranked[0].productId, 'cheap-popular');
});

test('getTopProducts respects n and returns fewer if catalog is smaller', () => {
  const r = new ProductRanker();
  r.addProduct({ productId: 'A', rating: 4, numberOfReviews: 10, price: 20 });
  r.addProduct({ productId: 'B', rating: 5, numberOfReviews: 20, price: 10 });
  assert.strictEqual(r.getTopProducts(1).length, 1);
  assert.strictEqual(r.getTopProducts(10).length, 2);
});

test('invalid productId is rejected', () => {
  const r = new ProductRanker();
  assert.throws(() => r.addProduct({ productId: '', rating: 5, numberOfReviews: 0, price: 1 }), TypeError);
});

test('rating out of [0,5] range is rejected', () => {
  const r = new ProductRanker();
  assert.throws(() => r.addProduct({ productId: 'x', rating: 5.1, numberOfReviews: 0, price: 1 }), TypeError);
});

test('non-integer numberOfReviews is rejected', () => {
  const r = new ProductRanker();
  assert.throws(() => r.addProduct({ productId: 'x', rating: 4, numberOfReviews: 1.5, price: 1 }), TypeError);
});

test('negative price is rejected', () => {
  const r = new ProductRanker();
  assert.throws(() => r.addProduct({ productId: 'x', rating: 4, numberOfReviews: 1, price: -5 }), TypeError);
});

test('all products tied on reviews/price get neutral normalized scores', () => {
  const r = new ProductRanker();
  r.addProduct({ productId: 'A', rating: 4, numberOfReviews: 100, price: 50 });
  r.addProduct({ productId: 'B', rating: 5, numberOfReviews: 100, price: 50 });
  const ranked = r.rankProducts();
  ranked.forEach((p) => {
    assert.strictEqual(p.normalizedReviewScore, 1);
    assert.strictEqual(p.normalizedPriceScore, 1);
  });
  // Only rating should differentiate them here.
  assert.strictEqual(ranked[0].productId, 'B');
});

console.log('\nAll tests passed.');
