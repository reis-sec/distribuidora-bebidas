USE distribuidora;

SET @category_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'distribuidora'
    AND TABLE_NAME = 'products'
    AND COLUMN_NAME = 'category'
);

SET @category_migration = IF(
  @category_exists = 0,
  'ALTER TABLE products ADD COLUMN category VARCHAR(80) NOT NULL DEFAULT ''Outros'' AFTER name',
  'SELECT 1'
);

PREPARE category_statement FROM @category_migration;
EXECUTE category_statement;
DEALLOCATE PREPARE category_statement;
