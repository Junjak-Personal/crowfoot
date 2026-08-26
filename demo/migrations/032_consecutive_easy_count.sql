-- Track consecutive Easy (q=5) reviews per card so the app can auto-master
-- a word after 2 in a row. Replaces the explicit "암기 완료" button on the
-- SRS flashcard with an implicit pattern based on user confidence.
ALTER TABLE study_progress
  ADD COLUMN consecutive_easy_count INTEGER NOT NULL DEFAULT 0;
