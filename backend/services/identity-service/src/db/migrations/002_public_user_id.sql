CREATE SEQUENCE IF NOT EXISTS accounts_public_id_seq;

CREATE OR REPLACE FUNCTION next_account_public_id() RETURNS VARCHAR AS $$
DECLARE
  n BIGINT;
BEGIN
  n := nextval('accounts_public_id_seq');
  RETURN 'user_' || LPAD(n::text, GREATEST(2, LENGTH(n::text)), '0');
END;
$$ LANGUAGE plpgsql;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS public_id VARCHAR(32);
ALTER SEQUENCE accounts_public_id_seq OWNED BY accounts.public_id;
ALTER TABLE accounts ALTER COLUMN public_id
  SET DEFAULT next_account_public_id();

-- Assign stable aliases to accounts created before this migration.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (
    ORDER BY CASE WHEN email = 'admin@gmail.com' THEN 0 ELSE 1 END, created_at, id
  ) AS n
  FROM accounts
  WHERE public_id IS NULL
)
UPDATE accounts AS a
SET public_id = 'user_' || LPAD(numbered.n::text, GREATEST(2, LENGTH(numbered.n::text)), '0')
FROM numbered
WHERE a.id = numbered.id;

SELECT setval('accounts_public_id_seq', GREATEST(COUNT(*), 1), COUNT(*) > 0)
FROM accounts;

ALTER TABLE accounts ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_public_id_unique ON accounts(public_id);
