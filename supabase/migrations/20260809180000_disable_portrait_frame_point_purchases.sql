-- Portrait-frame shop is a preview until a dedicated cosmetic currency exists.
-- Remove the former point-ledger purchase endpoint from databases where the
-- initial inventory migration may already have been applied.

drop function if exists public.purchase_portrait_frame(text);
