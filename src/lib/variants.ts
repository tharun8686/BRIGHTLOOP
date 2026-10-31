import { randomUUID } from 'node:crypto';
import { db, transaction } from './db';
export function saveVariantOptions(
  productId: string,
  variantId: string,
  names: string[],
  values: string[],
) {
  return transaction(() => {
    const pairs = names
      .map((name, i) => ({ name: name.trim(), value: (values[i] || '').trim() }))
      .filter((p) => p.name || p.value);
    if (
      pairs.length > 12 ||
      pairs.some((p) => !p.name || !p.value || p.name.length > 80 || p.value.length > 100) ||
      new Set(pairs.map((p) => p.name.toLowerCase())).size !== pairs.length
    )
      throw new Error('Use up to 12 distinct option names with values.');
    const variant = db()
      .prepare('SELECT id FROM product_variants WHERE id=? AND product_id=?')
      .get(variantId, productId);
    if (!variant) throw new Error('Variant does not belong to this product.');
    db().prepare('DELETE FROM variant_option_values WHERE variant_id=?').run(variantId);
    for (const pair of pairs) {
      let definition = db()
        .prepare('SELECT id FROM product_variant_definitions WHERE product_id=? AND name=?')
        .get(productId, pair.name) as any;
      if (!definition) {
        definition = { id: randomUUID() };
        db()
          .prepare('INSERT INTO product_variant_definitions VALUES(?,?,?)')
          .run(definition.id, productId, pair.name);
      }
      db()
        .prepare('INSERT INTO variant_option_values VALUES(?,?,?)')
        .run(variantId, definition.id, pair.value);
    }
  });
}
export function variantOptions(id: string) {
  return db()
    .prepare(
      'SELECT d.name,v.value FROM variant_option_values v JOIN product_variant_definitions d ON d.id=v.definition_id WHERE v.variant_id=? ORDER BY d.name',
    )
    .all(id) as { name: string; value: string }[];
}
