-- Data-only backfill (XR-13): a product with live variants owns no stock of its
-- own; its "stockQuantity" is the sum of its live variants' "stock". Sales and
-- cancellations only ever moved the variant rows, so every such product's
-- column had drifted. The application keeps it in step from here on
-- (syncVariantStock in src/helpers/product.ts). Products without live variants
-- are untouched.
UPDATE "Product" p
SET "stockQuantity" = t.total
FROM (
    SELECT "productId", SUM("stock")::int AS total
    FROM "ProductVariant"
    WHERE "isDeleted" = false
    GROUP BY "productId"
) t
WHERE t."productId" = p.id
  AND p."stockQuantity" <> t.total;
