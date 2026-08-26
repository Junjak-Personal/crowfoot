-- Free preview launch: drop the server-side word/wordbook caps.
--
-- The client-side Pro gates are toggled by the NEXT_PUBLIC_MONETIZATION_ENABLED
-- env (off => every gate unlocked via the isPro override in useSubscription).
-- That env cannot reach Postgres, so the BEFORE INSERT triggers from migration
-- 033 would still raise FREE_TIER_*_LIMIT_REACHED at 1000 words / 5 wordbooks.
--
-- While monetization is off we remove only the TRIGGERS — the enforcement
-- FUNCTIONS (enforce_free_word_limit / enforce_free_wordbook_limit) stay in
-- place so re-enabling later is a two-line CREATE TRIGGER (see bottom).
--
-- The quota RPCs (increment_quiz_used / _ocr_used / _ai_used) are intentionally
-- left untouched: is_pro stays false for everyone, so they keep recording usage
-- and preview demand can be measured via:
--   SELECT sum(quiz_used), sum(ocr_used), sum(ai_used) FROM user_subscription;

DROP TRIGGER IF EXISTS enforce_free_word_limit_trigger ON words;
DROP TRIGGER IF EXISTS enforce_free_wordbook_limit_trigger ON wordbooks;

-- ----------------------------------------------------------------------------
-- To re-enable the caps when monetization is turned on, run:
--
--   CREATE TRIGGER enforce_free_word_limit_trigger
--     BEFORE INSERT ON words
--     FOR EACH ROW EXECUTE FUNCTION enforce_free_word_limit();
--
--   CREATE TRIGGER enforce_free_wordbook_limit_trigger
--     BEFORE INSERT ON wordbooks
--     FOR EACH ROW EXECUTE FUNCTION enforce_free_wordbook_limit();
-- ----------------------------------------------------------------------------
