--
-- PostgreSQL database dump
--

\restrict NhCphA12JGwn3JnIg1uU5rSO6D5vsLKF8MxbFrCfsf3RynFVwdik3Jqny1a0zht

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: pg_cron; Type: EXTENSION; Schema: -; Owner: -
--
-- Re-stated by hand. The live database has both, enabled through the Supabase
-- dashboard; the local Postgres this was dumped from has neither binary, so
-- they were stubbed to let the migrations run and are absent from the dump.
--

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;


--
-- Name: kanji_reading_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.kanji_reading_type AS ENUM (
    'on',
    'kun'
);


--
-- Name: ai_messages_update_session_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ai_messages_update_session_activity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  update ai_sessions
  set
    last_message_at = greatest(coalesce(last_message_at, '-infinity'::timestamptz), new.created_at),
    message_count   = message_count + 1,
    total_input_tokens = total_input_tokens + coalesce(new.input_tokens, 0),
    total_output_tokens = total_output_tokens + coalesce(new.output_tokens, 0),
    updated_at      = now()
  where id = new.session_id;
  return new;
end;
$$;


--
-- Name: check_and_increment_rate_limit(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_and_increment_rate_limit(p_route text, p_max_per_minute integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  minute_now timestamptz := date_trunc('minute', now());
  new_count int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  INSERT INTO api_rate_limits (user_id, route, minute_bucket, count)
  VALUES (uid, p_route, minute_now, 1)
  ON CONFLICT (user_id, route, minute_bucket)
  DO UPDATE SET count = api_rate_limits.count + 1
  RETURNING count INTO new_count;

  RETURN jsonb_build_object(
    'allowed', new_count <= p_max_per_minute,
    'count', new_count,
    'limit', p_max_per_minute
  );
END;
$$;


--
-- Name: enforce_free_word_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_free_word_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_is_pro boolean;
  word_count int;
BEGIN
  SELECT is_pro INTO user_is_pro
  FROM user_subscription WHERE user_id = NEW.user_id;

  IF user_is_pro IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO word_count FROM words WHERE user_id = NEW.user_id;
  IF word_count >= 1000 THEN
    RAISE EXCEPTION 'FREE_TIER_WORD_LIMIT_REACHED'
      USING HINT = '1000';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: enforce_free_wordbook_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_free_wordbook_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_is_pro boolean;
  wb_count int;
BEGIN
  SELECT is_pro INTO user_is_pro
  FROM user_subscription WHERE user_id = NEW.user_id;

  IF user_is_pro IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO wb_count FROM wordbooks WHERE user_id = NEW.user_id;
  IF wb_count >= 5 THEN
    RAISE EXCEPTION 'FREE_TIER_WORDBOOK_LIMIT_REACHED'
      USING HINT = '5';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: ensure_user_subscription_row(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_user_subscription_row() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.user_subscription (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: get_random_new_words(integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_random_new_words(p_jlpt_filter integer DEFAULT NULL::integer, p_priority_filter integer DEFAULT NULL::integer, p_count integer DEFAULT 60) RETURNS TABLE(id uuid, user_id uuid, term text, reading text, meaning text, notes text, tags text[], jlpt_level smallint, created_at timestamp with time zone, updated_at timestamp with time zone, priority smallint, mastered boolean, mastered_at timestamp with time zone, is_leech boolean, leech_at timestamp with time zone, dictionary_entry_id uuid)
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  SELECT
    v.id, v.user_id, v.term, v.reading, v.meaning, v.notes,
    v.tags, v.jlpt_level, v.created_at, v.updated_at,
    v.priority, v.mastered, v.mastered_at, v.is_leech, v.leech_at,
    v.dictionary_entry_id
  FROM v_words_active v
  WHERE NOT EXISTS (
    SELECT 1 FROM study_progress sp
    WHERE sp.word_id = v.id
      AND sp.user_id = auth.uid()
  )
    AND (p_jlpt_filter IS NULL OR v.jlpt_level = p_jlpt_filter)
    AND (p_priority_filter IS NULL OR v.priority = p_priority_filter)
  ORDER BY random()
  LIMIT p_count;
$$;


--
-- Name: get_user_email(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_email(uid uuid) RETURNS text
    LANGUAGE sql SECURITY DEFINER
    AS $$ SELECT email FROM auth.users WHERE id = uid; $$;


--
-- Name: get_user_emails(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_emails(uids uuid[]) RETURNS TABLE(uid uuid, email text)
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT id, email FROM auth.users WHERE id = ANY(uids);
$$;


--
-- Name: get_wordbook_mastered_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_wordbook_mastered_count(wb_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT COUNT(*)::integer FROM wordbook_items wi
  JOIN user_word_state uws ON uws.word_id = wi.word_id AND uws.user_id = auth.uid()
  WHERE wi.wordbook_id = wb_id AND uws.mastered = true;
$$;


--
-- Name: get_wordbook_mastered_counts(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_wordbook_mastered_counts(wb_ids uuid[]) RETURNS TABLE(wordbook_id uuid, mastered_count integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT wi.wordbook_id, COUNT(*)::integer
  FROM wordbook_items wi
  JOIN user_word_state uws ON uws.word_id = wi.word_id AND uws.user_id = auth.uid()
  WHERE wi.wordbook_id = ANY(wb_ids) AND uws.mastered = true
  GROUP BY wi.wordbook_id;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.user_settings (user_id, jlpt_level, nickname, privacy_agreed_at)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'jlpt_level')::integer,
    'user-' || substr(NEW.id::text, 1, 8),
    CASE
      WHEN (NEW.raw_user_meta_data->>'privacy_agreed')::boolean = true THEN now()
      ELSE NULL
    END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: increment_ai_used(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_ai_used() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  result_row user_subscription;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  UPDATE user_subscription
  SET ai_used = ai_used + 1, updated_at = now()
  WHERE user_id = uid AND is_pro = false
  RETURNING * INTO result_row;

  IF NOT FOUND THEN
    SELECT * INTO result_row FROM user_subscription WHERE user_id = uid;
  END IF;

  RETURN jsonb_build_object(
    'ai_used', result_row.ai_used,
    'is_pro', result_row.is_pro
  );
END;
$$;


--
-- Name: increment_import_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_import_count(wb_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    AS $$
  UPDATE wordbooks SET import_count = import_count + 1 WHERE id = wb_id;
$$;


--
-- Name: increment_ocr_used(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_ocr_used() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  result_row user_subscription;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  UPDATE user_subscription
  SET ocr_used = ocr_used + 1, updated_at = now()
  WHERE user_id = uid AND is_pro = false
  RETURNING * INTO result_row;

  IF NOT FOUND THEN
    SELECT * INTO result_row FROM user_subscription WHERE user_id = uid;
  END IF;

  RETURN jsonb_build_object(
    'ocr_used', result_row.ocr_used,
    'is_pro', result_row.is_pro
  );
END;
$$;


--
-- Name: increment_quiz_used(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_quiz_used() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  today_kst date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  result_row user_subscription;
  did_count boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  UPDATE user_subscription
  SET quiz_used = quiz_used + 1,
      quiz_last_counted_date = today_kst,
      updated_at = now()
  WHERE user_id = uid
    AND is_pro = false
    AND (quiz_last_counted_date IS NULL OR quiz_last_counted_date < today_kst)
  RETURNING * INTO result_row;

  did_count := FOUND;

  IF NOT did_count THEN
    SELECT * INTO result_row FROM user_subscription WHERE user_id = uid;
  END IF;

  RETURN jsonb_build_object(
    'quiz_used', result_row.quiz_used,
    'is_pro', result_row.is_pro,
    'counted', did_count
  );
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    unlocked_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    content jsonb NOT NULL,
    tool_calls jsonb,
    status text DEFAULT 'complete'::text NOT NULL,
    finish_reason text,
    input_tokens integer,
    output_tokens integer,
    model_variant text,
    error_code text,
    error_message text,
    attachment_ids jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    feedback text,
    CONSTRAINT ai_messages_feedback_check CHECK (((feedback IS NULL) OR (feedback = ANY (ARRAY['thumbs_up'::text, 'thumbs_down'::text])))),
    CONSTRAINT ai_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'tool'::text, 'system'::text]))),
    CONSTRAINT ai_messages_status_check CHECK ((status = ANY (ARRAY['streaming'::text, 'complete'::text, 'truncated'::text, 'cancelled'::text, 'failed'::text])))
);


--
-- Name: COLUMN ai_messages.feedback; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_messages.feedback IS 'User rating on this assistant message. NULL = no rating.';


--
-- Name: ai_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    scope text DEFAULT 'general'::text NOT NULL,
    scope_entity_id text,
    title text,
    context_snapshot jsonb,
    last_message_at timestamp with time zone,
    message_count integer DEFAULT 0 NOT NULL,
    total_input_tokens integer DEFAULT 0 NOT NULL,
    total_output_tokens integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    context_summary text,
    summarized_through_message_id uuid,
    summarized_message_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT ai_sessions_scope_check CHECK ((scope = 'general'::text))
);


--
-- Name: COLUMN ai_sessions.context_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_sessions.context_summary IS 'Auto-generated summary of older messages, inserted as a system addendum during inference. Regenerated as the session grows.';


--
-- Name: ai_telemetry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_telemetry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    event text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    scope text,
    model_variant text,
    platform text,
    app_version text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE ai_telemetry; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ai_telemetry IS 'Opt-in anonymous AI usage telemetry. NEVER stores message content. Toggled by the user in Settings → AI Assistant.';


--
-- Name: ai_tool_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_tool_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    tool_name text NOT NULL,
    tool_call_id text NOT NULL,
    args jsonb NOT NULL,
    status text NOT NULL,
    result jsonb,
    error_message text,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT ai_tool_executions_status_check CHECK ((status = ANY (ARRAY['awaiting_confirm'::text, 'running'::text, 'done'::text, 'cancelled'::text, 'failed'::text, 'skipped_by_user'::text])))
);


--
-- Name: api_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_rate_limits (
    user_id uuid NOT NULL,
    route text NOT NULL,
    minute_bucket timestamp with time zone NOT NULL,
    count integer DEFAULT 0 NOT NULL
);


--
-- Name: daily_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    stat_date date NOT NULL,
    new_count integer DEFAULT 0 NOT NULL,
    review_count integer DEFAULT 0 NOT NULL,
    again_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    review_again_count integer DEFAULT 0 NOT NULL,
    new_again_count integer DEFAULT 0 NOT NULL,
    practice_count integer DEFAULT 0 NOT NULL,
    practice_known_count integer DEFAULT 0 NOT NULL,
    hard_count integer DEFAULT 0 NOT NULL,
    good_count integer DEFAULT 0 NOT NULL,
    easy_count integer DEFAULT 0 NOT NULL,
    mastered_in_session_count integer DEFAULT 0 NOT NULL,
    notification_sent_at timestamp with time zone
);


--
-- Name: dictionary_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dictionary_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    term text NOT NULL,
    reading text DEFAULT ''::text NOT NULL,
    meanings text[] DEFAULT '{}'::text[] NOT NULL,
    parts_of_speech text[] DEFAULT '{}'::text[],
    jlpt_level smallint,
    source text DEFAULT 'jisho'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    meanings_ko text[] DEFAULT '{}'::text[]
);


--
-- Name: feedback_survey; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback_survey (
    user_id uuid NOT NULL,
    sat_words smallint,
    sat_wordbooks smallint,
    sat_ocr smallint,
    sat_assistant smallint,
    sat_quiz smallint,
    comment text,
    purchase_intent text,
    price_bucket text,
    price_499_intent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    milestone smallint NOT NULL,
    pain_points text,
    feature_requests text,
    CONSTRAINT feedback_survey_comment_check CHECK ((char_length(comment) <= 2000)),
    CONSTRAINT feedback_survey_feature_requests_check CHECK ((char_length(feature_requests) <= 2000)),
    CONSTRAINT feedback_survey_milestone_check CHECK ((milestone = ANY (ARRAY[3, 7, 30]))),
    CONSTRAINT feedback_survey_pain_points_check CHECK ((char_length(pain_points) <= 2000)),
    CONSTRAINT feedback_survey_price_499_intent_check CHECK ((price_499_intent = ANY (ARRAY['yes'::text, 'maybe'::text, 'no'::text]))),
    CONSTRAINT feedback_survey_price_bucket_check CHECK ((price_bucket = ANY (ARRAY['free'::text, 'lt2500'::text, 'lt5000'::text, 'lt7000'::text, 'gte7000'::text]))),
    CONSTRAINT feedback_survey_purchase_intent_check CHECK ((purchase_intent = ANY (ARRAY['yes'::text, 'maybe'::text, 'no'::text]))),
    CONSTRAINT feedback_survey_sat_assistant_check CHECK (((sat_assistant >= 1) AND (sat_assistant <= 5))),
    CONSTRAINT feedback_survey_sat_ocr_check CHECK (((sat_ocr >= 1) AND (sat_ocr <= 5))),
    CONSTRAINT feedback_survey_sat_quiz_check CHECK (((sat_quiz >= 1) AND (sat_quiz <= 5))),
    CONSTRAINT feedback_survey_sat_wordbooks_check CHECK (((sat_wordbooks >= 1) AND (sat_wordbooks <= 5))),
    CONSTRAINT feedback_survey_sat_words_check CHECK (((sat_words >= 1) AND (sat_words <= 5)))
);


--
-- Name: kanji_readings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kanji_readings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "character" text NOT NULL,
    reading text NOT NULL,
    reading_type public.kanji_reading_type NOT NULL,
    meanings text[] DEFAULT '{}'::text[] NOT NULL,
    meanings_ko text[] DEFAULT '{}'::text[] NOT NULL,
    "position" smallint DEFAULT 0 NOT NULL
);


--
-- Name: kanjis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kanjis (
    "character" text NOT NULL,
    stroke_count smallint,
    jlpt_level smallint,
    grade smallint,
    frequency integer,
    source text DEFAULT 'kanjidic2'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    platform text DEFAULT 'expo'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: quiz_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    new_per_day integer DEFAULT 20 NOT NULL,
    max_reviews_per_day integer DEFAULT 100 NOT NULL,
    jlpt_filter integer,
    priority_filter integer,
    new_card_order text DEFAULT 'recent'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    card_direction text DEFAULT 'term_first'::text NOT NULL,
    session_size integer DEFAULT 20 NOT NULL,
    leech_threshold integer DEFAULT 8 NOT NULL,
    notification_enabled boolean DEFAULT false NOT NULL,
    notification_hour smallint DEFAULT 9 NOT NULL,
    notification_minute smallint DEFAULT 0 NOT NULL
);


--
-- Name: study_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.study_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    word_id uuid NOT NULL,
    next_review timestamp with time zone DEFAULT now(),
    interval_days real DEFAULT 0,
    ease_factor real DEFAULT 2.5,
    review_count integer DEFAULT 0,
    last_reviewed_at timestamp with time zone,
    stability real DEFAULT 0 NOT NULL,
    difficulty real DEFAULT 0 NOT NULL,
    elapsed_days integer DEFAULT 0 NOT NULL,
    scheduled_days integer DEFAULT 0 NOT NULL,
    learning_steps integer DEFAULT 0 NOT NULL,
    lapses integer DEFAULT 0 NOT NULL,
    card_state integer DEFAULT 0 NOT NULL,
    consecutive_easy_count integer DEFAULT 0 NOT NULL
);


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    nickname text,
    avatar_url text,
    jlpt_level integer,
    study_purpose text,
    privacy_agreed_at timestamp with time zone,
    storage_agreed_at timestamp with time zone,
    CONSTRAINT user_settings_jlpt_level_check CHECK (((jlpt_level >= 1) AND (jlpt_level <= 5)))
);


--
-- Name: user_subscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_subscription (
    user_id uuid NOT NULL,
    is_pro boolean DEFAULT false NOT NULL,
    pro_purchased_at timestamp with time zone,
    pro_product_id text,
    pro_transaction_id text,
    revenuecat_synced_at timestamp with time zone,
    quiz_used integer DEFAULT 0 NOT NULL,
    ocr_used integer DEFAULT 0 NOT NULL,
    ai_used integer DEFAULT 0 NOT NULL,
    quiz_last_counted_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_word_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_word_state (
    user_id uuid NOT NULL,
    word_id uuid NOT NULL,
    mastered boolean DEFAULT false NOT NULL,
    mastered_at timestamp with time zone,
    priority smallint DEFAULT 2 NOT NULL,
    is_leech boolean DEFAULT false NOT NULL,
    leech_at timestamp with time zone
);


--
-- Name: words; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.words (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    term text NOT NULL,
    reading text NOT NULL,
    meaning text NOT NULL,
    part_of_speech text,
    notes text,
    tags text[] DEFAULT '{}'::text[],
    jlpt_level smallint,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    dictionary_entry_id uuid NOT NULL
);


--
-- Name: v_words_active; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_words_active WITH (security_invoker='true') AS
 SELECT w.id,
    w.user_id,
    w.term,
    w.reading,
    w.meaning,
    w.notes,
    w.tags,
    w.jlpt_level,
    w.created_at,
    w.updated_at,
    (COALESCE((uws.priority)::integer, 2))::smallint AS priority,
    COALESCE(uws.mastered, false) AS mastered,
    uws.mastered_at,
    COALESCE(uws.is_leech, false) AS is_leech,
    uws.leech_at,
    w.dictionary_entry_id
   FROM (public.words w
     LEFT JOIN public.user_word_state uws ON (((uws.word_id = w.id) AND (uws.user_id = auth.uid()))))
  WHERE (uws.mastered IS NOT TRUE);


--
-- Name: word_examples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.word_examples (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sentence_ja text NOT NULL,
    sentence_reading text,
    sentence_meaning text,
    source text DEFAULT 'manual'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    dictionary_entry_id uuid NOT NULL
);


--
-- Name: wordbook_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wordbook_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wordbook_id uuid NOT NULL,
    word_id uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now()
);


--
-- Name: wordbook_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wordbook_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wordbook_id uuid NOT NULL,
    subscriber_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: wordbooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wordbooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_shared boolean DEFAULT false NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    import_count integer DEFAULT 0 NOT NULL
);


--
-- Name: achievements achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);


--
-- Name: achievements achievements_user_id_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_user_id_type_key UNIQUE (user_id, type);


--
-- Name: ai_messages ai_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_pkey PRIMARY KEY (id);


--
-- Name: ai_sessions ai_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_sessions
    ADD CONSTRAINT ai_sessions_pkey PRIMARY KEY (id);


--
-- Name: ai_telemetry ai_telemetry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_telemetry
    ADD CONSTRAINT ai_telemetry_pkey PRIMARY KEY (id);


--
-- Name: ai_tool_executions ai_tool_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_tool_executions
    ADD CONSTRAINT ai_tool_executions_pkey PRIMARY KEY (id);


--
-- Name: api_rate_limits api_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_rate_limits
    ADD CONSTRAINT api_rate_limits_pkey PRIMARY KEY (user_id, route, minute_bucket);


--
-- Name: daily_stats daily_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_stats
    ADD CONSTRAINT daily_stats_pkey PRIMARY KEY (id);


--
-- Name: daily_stats daily_stats_user_id_stat_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_stats
    ADD CONSTRAINT daily_stats_user_id_stat_date_key UNIQUE (user_id, stat_date);


--
-- Name: dictionary_entries dictionary_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dictionary_entries
    ADD CONSTRAINT dictionary_entries_pkey PRIMARY KEY (id);


--
-- Name: dictionary_entries dictionary_entries_term_reading_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dictionary_entries
    ADD CONSTRAINT dictionary_entries_term_reading_key UNIQUE (term, reading);


--
-- Name: feedback_survey feedback_survey_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback_survey
    ADD CONSTRAINT feedback_survey_pkey PRIMARY KEY (user_id, milestone);


--
-- Name: kanji_readings kanji_readings_character_reading_reading_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kanji_readings
    ADD CONSTRAINT kanji_readings_character_reading_reading_type_key UNIQUE ("character", reading, reading_type);


--
-- Name: kanji_readings kanji_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kanji_readings
    ADD CONSTRAINT kanji_readings_pkey PRIMARY KEY (id);


--
-- Name: kanjis kanjis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kanjis
    ADD CONSTRAINT kanjis_pkey PRIMARY KEY ("character");


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_user_id_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_user_id_token_key UNIQUE (user_id, token);


--
-- Name: quiz_settings quiz_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_settings
    ADD CONSTRAINT quiz_settings_pkey PRIMARY KEY (id);


--
-- Name: quiz_settings quiz_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_settings
    ADD CONSTRAINT quiz_settings_user_id_key UNIQUE (user_id);


--
-- Name: study_progress study_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_progress
    ADD CONSTRAINT study_progress_pkey PRIMARY KEY (id);


--
-- Name: study_progress study_progress_user_id_word_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_progress
    ADD CONSTRAINT study_progress_user_id_word_id_key UNIQUE (user_id, word_id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);


--
-- Name: user_subscription user_subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscription
    ADD CONSTRAINT user_subscription_pkey PRIMARY KEY (user_id);


--
-- Name: user_word_state user_word_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_word_state
    ADD CONSTRAINT user_word_state_pkey PRIMARY KEY (user_id, word_id);


--
-- Name: word_examples word_examples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.word_examples
    ADD CONSTRAINT word_examples_pkey PRIMARY KEY (id);


--
-- Name: wordbook_items wordbook_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wordbook_items
    ADD CONSTRAINT wordbook_items_pkey PRIMARY KEY (id);


--
-- Name: wordbook_items wordbook_items_wordbook_id_word_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wordbook_items
    ADD CONSTRAINT wordbook_items_wordbook_id_word_id_key UNIQUE (wordbook_id, word_id);


--
-- Name: wordbook_subscriptions wordbook_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wordbook_subscriptions
    ADD CONSTRAINT wordbook_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: wordbook_subscriptions wordbook_subscriptions_wordbook_id_subscriber_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wordbook_subscriptions
    ADD CONSTRAINT wordbook_subscriptions_wordbook_id_subscriber_id_key UNIQUE (wordbook_id, subscriber_id);


--
-- Name: wordbooks wordbooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wordbooks
    ADD CONSTRAINT wordbooks_pkey PRIMARY KEY (id);


--
-- Name: words words_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.words
    ADD CONSTRAINT words_pkey PRIMARY KEY (id);


--
-- Name: ai_messages_session_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_messages_session_created_idx ON public.ai_messages USING btree (session_id, created_at);


--
-- Name: ai_messages_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_messages_user_idx ON public.ai_messages USING btree (user_id);


--
-- Name: ai_sessions_user_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_sessions_user_active_idx ON public.ai_sessions USING btree (user_id, last_message_at DESC NULLS LAST);


--
-- Name: ai_tool_executions_user_tool_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_tool_executions_user_tool_idx ON public.ai_tool_executions USING btree (user_id, tool_name, created_at DESC);


--
-- Name: idx_ai_messages_feedback; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_messages_feedback ON public.ai_messages USING btree (user_id, feedback) WHERE (feedback IS NOT NULL);


--
-- Name: idx_ai_telemetry_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_telemetry_event ON public.ai_telemetry USING btree (event);


--
-- Name: idx_ai_telemetry_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_telemetry_user_created ON public.ai_telemetry USING btree (user_id, created_at DESC);


--
-- Name: idx_dictionary_entries_reading; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dictionary_entries_reading ON public.dictionary_entries USING btree (reading);


--
-- Name: idx_dictionary_entries_term; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dictionary_entries_term ON public.dictionary_entries USING btree (term);


--
-- Name: idx_kanji_readings_character; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kanji_readings_character ON public.kanji_readings USING btree ("character");


--
-- Name: idx_push_subs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_subs_user ON public.push_subscriptions USING btree (user_id);


--
-- Name: idx_rate_limits_cleanup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limits_cleanup ON public.api_rate_limits USING btree (minute_bucket);


--
-- Name: idx_study_progress_next_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_study_progress_next_review ON public.study_progress USING btree (next_review);


--
-- Name: idx_study_progress_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_study_progress_user_id ON public.study_progress USING btree (user_id);


--
-- Name: idx_study_progress_word_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_study_progress_word_id ON public.study_progress USING btree (word_id);


--
-- Name: idx_uws_leech; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uws_leech ON public.user_word_state USING btree (user_id, is_leech) WHERE (is_leech = true);


--
-- Name: idx_uws_mastered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uws_mastered ON public.user_word_state USING btree (user_id, mastered);


--
-- Name: idx_uws_word; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uws_word ON public.user_word_state USING btree (word_id);


--
-- Name: idx_wb_subs_subscriber; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wb_subs_subscriber ON public.wordbook_subscriptions USING btree (subscriber_id);


--
-- Name: idx_wb_subs_wordbook; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wb_subs_wordbook ON public.wordbook_subscriptions USING btree (wordbook_id);


--
-- Name: idx_word_examples_dict; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_word_examples_dict ON public.word_examples USING btree (dictionary_entry_id);


--
-- Name: idx_wordbook_items_word; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wordbook_items_word ON public.wordbook_items USING btree (word_id);


--
-- Name: idx_wordbook_items_wordbook; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wordbook_items_wordbook ON public.wordbook_items USING btree (wordbook_id);


--
-- Name: idx_wordbooks_shared; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wordbooks_shared ON public.wordbooks USING btree (is_shared) WHERE (is_shared = true);


--
-- Name: idx_wordbooks_user_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_wordbooks_user_name ON public.wordbooks USING btree (user_id, name);


--
-- Name: idx_words_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_words_created_at ON public.words USING btree (created_at DESC);


--
-- Name: idx_words_dict; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_words_dict ON public.words USING btree (dictionary_entry_id);


--
-- Name: idx_words_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_words_user_id ON public.words USING btree (user_id);


--
-- Name: idx_words_user_term_reading; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_words_user_term_reading ON public.words USING btree (user_id, term, reading);


--
-- Name: word_examples_dict_sentence_uk; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX word_examples_dict_sentence_uk ON public.word_examples USING btree (dictionary_entry_id, sentence_ja);


--
-- Name: words_user_dict_uk; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX words_user_dict_uk ON public.words USING btree (user_id, dictionary_entry_id);


--
-- Name: ai_messages ai_messages_after_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ai_messages_after_insert AFTER INSERT ON public.ai_messages FOR EACH ROW EXECUTE FUNCTION public.ai_messages_update_session_activity();


--
-- Name: achievements achievements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_messages ai_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.ai_sessions(id) ON DELETE CASCADE;


--
-- Name: ai_messages ai_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_sessions ai_sessions_summarized_through_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_sessions
    ADD CONSTRAINT ai_sessions_summarized_through_message_id_fkey FOREIGN KEY (summarized_through_message_id) REFERENCES public.ai_messages(id) ON DELETE SET NULL;


--
-- Name: ai_sessions ai_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_sessions
    ADD CONSTRAINT ai_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_telemetry ai_telemetry_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_telemetry
    ADD CONSTRAINT ai_telemetry_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_tool_executions ai_tool_executions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_tool_executions
    ADD CONSTRAINT ai_tool_executions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.ai_messages(id) ON DELETE CASCADE;


--
-- Name: ai_tool_executions ai_tool_executions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_tool_executions
    ADD CONSTRAINT ai_tool_executions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: api_rate_limits api_rate_limits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_rate_limits
    ADD CONSTRAINT api_rate_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: daily_stats daily_stats_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_stats
    ADD CONSTRAINT daily_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: feedback_survey feedback_survey_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback_survey
    ADD CONSTRAINT feedback_survey_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: kanji_readings kanji_readings_character_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kanji_readings
    ADD CONSTRAINT kanji_readings_character_fkey FOREIGN KEY ("character") REFERENCES public.kanjis("character") ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: push_tokens push_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: quiz_settings quiz_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_settings
    ADD CONSTRAINT quiz_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: study_progress study_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_progress
    ADD CONSTRAINT study_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: study_progress study_progress_word_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_progress
    ADD CONSTRAINT study_progress_word_id_fkey FOREIGN KEY (word_id) REFERENCES public.words(id) ON DELETE CASCADE;


--
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_subscription user_subscription_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscription
    ADD CONSTRAINT user_subscription_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_word_state user_word_state_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_word_state
    ADD CONSTRAINT user_word_state_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_word_state user_word_state_word_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_word_state
    ADD CONSTRAINT user_word_state_word_id_fkey FOREIGN KEY (word_id) REFERENCES public.words(id) ON DELETE CASCADE;


--
-- Name: word_examples word_examples_dictionary_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.word_examples
    ADD CONSTRAINT word_examples_dictionary_entry_id_fkey FOREIGN KEY (dictionary_entry_id) REFERENCES public.dictionary_entries(id) ON DELETE CASCADE;


--
-- Name: wordbook_items wordbook_items_word_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wordbook_items
    ADD CONSTRAINT wordbook_items_word_id_fkey FOREIGN KEY (word_id) REFERENCES public.words(id) ON DELETE CASCADE;


--
-- Name: wordbook_items wordbook_items_wordbook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wordbook_items
    ADD CONSTRAINT wordbook_items_wordbook_id_fkey FOREIGN KEY (wordbook_id) REFERENCES public.wordbooks(id) ON DELETE CASCADE;


--
-- Name: wordbook_subscriptions wordbook_subscriptions_subscriber_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wordbook_subscriptions
    ADD CONSTRAINT wordbook_subscriptions_subscriber_id_fkey FOREIGN KEY (subscriber_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: wordbook_subscriptions wordbook_subscriptions_wordbook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wordbook_subscriptions
    ADD CONSTRAINT wordbook_subscriptions_wordbook_id_fkey FOREIGN KEY (wordbook_id) REFERENCES public.wordbooks(id) ON DELETE CASCADE;


--
-- Name: wordbooks wordbooks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wordbooks
    ADD CONSTRAINT wordbooks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: words words_dictionary_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.words
    ADD CONSTRAINT words_dictionary_entry_id_fkey FOREIGN KEY (dictionary_entry_id) REFERENCES public.dictionary_entries(id);


--
-- Name: words words_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.words
    ADD CONSTRAINT words_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: dictionary_entries Anyone can insert dictionary entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert dictionary entries" ON public.dictionary_entries FOR INSERT WITH CHECK (true);


--
-- Name: dictionary_entries Anyone can read dictionary entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read dictionary entries" ON public.dictionary_entries FOR SELECT USING (true);


--
-- Name: kanji_readings Anyone can read kanji readings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read kanji readings" ON public.kanji_readings FOR SELECT USING (true);


--
-- Name: kanjis Anyone can read kanjis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read kanjis" ON public.kanjis FOR SELECT USING (true);


--
-- Name: word_examples Anyone can read word examples; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read word examples" ON public.word_examples FOR SELECT USING (true);


--
-- Name: word_examples Authenticated can delete word examples; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can delete word examples" ON public.word_examples FOR DELETE TO authenticated USING (true);


--
-- Name: word_examples Authenticated can insert word examples; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can insert word examples" ON public.word_examples FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: word_examples Authenticated can update word examples; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can update word examples" ON public.word_examples FOR UPDATE TO authenticated USING (true);


--
-- Name: ai_telemetry Nobody can select telemetry from client; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Nobody can select telemetry from client" ON public.ai_telemetry FOR SELECT USING (false);


--
-- Name: study_progress Users can CRUD own progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can CRUD own progress" ON public.study_progress USING ((auth.uid() = user_id));


--
-- Name: user_settings Users can CRUD own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can CRUD own settings" ON public.user_settings USING ((auth.uid() = user_id));


--
-- Name: words Users can CRUD own words; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can CRUD own words" ON public.words USING ((auth.uid() = user_id));


--
-- Name: push_subscriptions Users can delete own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own subscriptions" ON public.push_subscriptions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: wordbook_items Users can delete own wordbook items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own wordbook items" ON public.wordbook_items FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.wordbooks
  WHERE ((wordbooks.id = wordbook_items.wordbook_id) AND (wordbooks.user_id = auth.uid())))));


--
-- Name: wordbooks Users can delete own wordbooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own wordbooks" ON public.wordbooks FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: push_subscriptions Users can insert own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own subscriptions" ON public.push_subscriptions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: feedback_survey Users can insert own survey; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own survey" ON public.feedback_survey FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: ai_telemetry Users can insert own telemetry; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own telemetry" ON public.ai_telemetry FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: wordbook_items Users can insert own wordbook items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own wordbook items" ON public.wordbook_items FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.wordbooks
  WHERE ((wordbooks.id = wordbook_items.wordbook_id) AND (wordbooks.user_id = auth.uid())))));


--
-- Name: wordbooks Users can insert own wordbooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own wordbooks" ON public.wordbooks FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_word_state Users can manage own word state; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own word state" ON public.user_word_state USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: achievements Users can manage their own achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own achievements" ON public.achievements USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: daily_stats Users can manage their own daily stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own daily stats" ON public.daily_stats USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: quiz_settings Users can manage their own quiz settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own quiz settings" ON public.quiz_settings USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_subscription Users can read own subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own subscription" ON public.user_subscription FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: push_subscriptions Users can read own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own subscriptions" ON public.push_subscriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: feedback_survey Users can read own survey; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own survey" ON public.feedback_survey FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: wordbook_subscriptions Users can subscribe to shared wordbooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can subscribe to shared wordbooks" ON public.wordbook_subscriptions FOR INSERT WITH CHECK (((auth.uid() = subscriber_id) AND (EXISTS ( SELECT 1
   FROM public.wordbooks
  WHERE ((wordbooks.id = wordbook_subscriptions.wordbook_id) AND (wordbooks.is_shared = true))))));


--
-- Name: wordbook_subscriptions Users can unsubscribe; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can unsubscribe" ON public.wordbook_subscriptions FOR DELETE USING ((auth.uid() = subscriber_id));


--
-- Name: feedback_survey Users can update own survey; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own survey" ON public.feedback_survey FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: wordbooks Users can update own wordbooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own wordbooks" ON public.wordbooks FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: wordbook_items Users can view own or shared wordbook items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own or shared wordbook items" ON public.wordbook_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.wordbooks
  WHERE ((wordbooks.id = wordbook_items.wordbook_id) AND ((wordbooks.user_id = auth.uid()) OR ((wordbooks.is_shared = true) AND (auth.role() = 'authenticated'::text)))))));


--
-- Name: wordbooks Users can view own or shared wordbooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own or shared wordbooks" ON public.wordbooks FOR SELECT USING (((auth.uid() = user_id) OR ((is_shared = true) AND (auth.role() = 'authenticated'::text))));


--
-- Name: wordbook_subscriptions Users can view own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own subscriptions" ON public.wordbook_subscriptions FOR SELECT USING ((auth.uid() = subscriber_id));


--
-- Name: words Users can view words from subscribed wordbooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view words from subscribed wordbooks" ON public.words FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.wordbook_items
     JOIN public.wordbook_subscriptions ON ((wordbook_subscriptions.wordbook_id = wordbook_items.wordbook_id)))
  WHERE ((wordbook_items.word_id = words.id) AND (wordbook_subscriptions.subscriber_id = auth.uid())))));


--
-- Name: push_tokens Users manage own tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own tokens" ON public.push_tokens USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: achievements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_telemetry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_telemetry ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_tool_executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_tool_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: api_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: dictionary_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dictionary_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: feedback_survey; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feedback_survey ENABLE ROW LEVEL SECURITY;

--
-- Name: kanji_readings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kanji_readings ENABLE ROW LEVEL SECURITY;

--
-- Name: kanjis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kanjis ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: push_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: quiz_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quiz_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: study_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.study_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: user_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: user_subscription; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_subscription ENABLE ROW LEVEL SECURITY;

--
-- Name: user_word_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_word_state ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_messages users access own ai_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users access own ai_messages" ON public.ai_messages USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: ai_sessions users access own ai_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users access own ai_sessions" ON public.ai_sessions USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: ai_tool_executions users access own ai_tool_executions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users access own ai_tool_executions" ON public.ai_tool_executions USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: word_examples; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.word_examples ENABLE ROW LEVEL SECURITY;

--
-- Name: wordbook_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wordbook_items ENABLE ROW LEVEL SECURITY;

--
-- Name: wordbook_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wordbook_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: wordbooks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wordbooks ENABLE ROW LEVEL SECURITY;

--
-- Name: words; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict NhCphA12JGwn3JnIg1uU5rSO6D5vsLKF8MxbFrCfsf3RynFVwdik3Jqny1a0zht

