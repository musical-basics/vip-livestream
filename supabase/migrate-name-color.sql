-- Migration: Add custom name color selection for members
ALTER TABLE members ADD COLUMN name_color text DEFAULT null;
