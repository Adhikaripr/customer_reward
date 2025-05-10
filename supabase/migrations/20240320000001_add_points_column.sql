-- Add points column to customers table
ALTER TABLE customers
ADD COLUMN points integer NOT NULL DEFAULT 0; 