drop trigger if exists "set_doc_file_paths_organization_id_trigger" on "public"."doc_file_paths";

drop trigger if exists "set_github_pull_request_comments_organization_id_trigger" on "public"."github_pull_request_comments";

drop trigger if exists "set_github_pull_requests_organization_id_trigger" on "public"."github_pull_requests";

drop trigger if exists "set_knowledge_suggestion_doc_mappings_organization_id_trigger" on "public"."knowledge_suggestion_doc_mappings";

drop trigger if exists "set_knowledge_suggestions_organization_id_trigger" on "public"."knowledge_suggestions";

drop trigger if exists "set_migration_pull_request_mappings_organization_id_trigger" on "public"."migration_pull_request_mappings";

drop trigger if exists "set_migrations_organization_id_trigger" on "public"."migrations";

drop trigger if exists "set_overall_review_knowledge_suggestion_mappings_organization_i" on "public"."overall_review_knowledge_suggestion_mappings";

drop trigger if exists "set_overall_reviews_organization_id_trigger" on "public"."overall_reviews";

drop trigger if exists "set_review_feedback_comments_organization_id_trigger" on "public"."review_feedback_comments";

drop trigger if exists "set_review_feedback_knowledge_suggestion_mappings_organization_" on "public"."review_feedback_knowledge_suggestion_mappings";

drop trigger if exists "set_review_feedbacks_organization_id_trigger" on "public"."review_feedbacks";

drop trigger if exists "set_review_suggestion_snippets_organization_id_trigger" on "public"."review_suggestion_snippets";

drop policy "authenticated_users_can_insert_org_doc_file_paths" on "public"."doc_file_paths";

drop policy "authenticated_users_can_select_org_doc_file_paths" on "public"."doc_file_paths";

drop policy "service_role_can_select_all_doc_file_paths" on "public"."doc_file_paths";

drop policy "service_role_can_insert_all_github_pull_request_comments" on "public"."github_pull_request_comments";

drop policy "service_role_can_select_all_github_pull_request_comments" on "public"."github_pull_request_comments";

drop policy "authenticated_users_can_select_org_github_pull_requests" on "public"."github_pull_requests";

drop policy "service_role_can_insert_all_github_pull_requests" on "public"."github_pull_requests";

drop policy "service_role_can_select_all_github_pull_requests" on "public"."github_pull_requests";

drop policy "authenticated_users_can_insert_org_knowledge_suggestion_doc_map" on "public"."knowledge_suggestion_doc_mappings";

drop policy "authenticated_users_can_select_org_knowledge_suggestion_doc_map" on "public"."knowledge_suggestion_doc_mappings";

drop policy "service_role_can_insert_all_knowledge_suggestion_doc_mappings" on "public"."knowledge_suggestion_doc_mappings";

drop policy "authenticated_users_can_insert_org_knowledge_suggestions" on "public"."knowledge_suggestions";

drop policy "authenticated_users_can_select_org_knowledge_suggestions" on "public"."knowledge_suggestions";

drop policy "authenticated_users_can_update_org_knowledge_suggestions" on "public"."knowledge_suggestions";

drop policy "service_role_can_delete_all_knowledge_suggestions" on "public"."knowledge_suggestions";

drop policy "service_role_can_insert_all_knowledge_suggestions" on "public"."knowledge_suggestions";

drop policy "service_role_can_select_all_knowledge_suggestions" on "public"."knowledge_suggestions";

drop policy "service_role_can_update_all_knowledge_suggestions" on "public"."knowledge_suggestions";

drop policy "authenticated_users_can_select_org_migration_pull_request_mappi" on "public"."migration_pull_request_mappings";

drop policy "service_role_can_insert_all_migration_pull_request_mappings" on "public"."migration_pull_request_mappings";

drop policy "service_role_can_select_all_migration_pull_request_mappings" on "public"."migration_pull_request_mappings";

drop policy "authenticated_users_can_select_org_migrations" on "public"."migrations";

drop policy "service_role_can_insert_all_migrations" on "public"."migrations";

drop policy "service_role_can_select_all_migrations" on "public"."migrations";

drop policy "service_role_can_update_all_migrations" on "public"."migrations";

drop policy "authenticated_users_can_select_org_overall_review_knowledge_sug" on "public"."overall_review_knowledge_suggestion_mappings";

drop policy "service_role_can_insert_all_overall_review_knowledge_suggestion" on "public"."overall_review_knowledge_suggestion_mappings";

drop policy "authenticated_users_can_select_org_overall_reviews" on "public"."overall_reviews";

drop policy "service_role_can_insert_all_overall_reviews" on "public"."overall_reviews";

drop policy "service_role_can_select_all_overall_reviews" on "public"."overall_reviews";

drop policy "authenticated_users_can_insert_org_review_feedback_comments" on "public"."review_feedback_comments";

drop policy "authenticated_users_can_select_org_review_feedback_comments" on "public"."review_feedback_comments";

drop policy "authenticated_users_can_select_org_review_feedback_knowledge_su" on "public"."review_feedback_knowledge_suggestion_mappings";

drop policy "service_role_can_insert_all_review_feedback_knowledge_suggestio" on "public"."review_feedback_knowledge_suggestion_mappings";

drop policy "service_role_can_select_all_review_feedback_knowledge_suggestio" on "public"."review_feedback_knowledge_suggestion_mappings";

drop policy "authenticated_users_can_select_org_review_feedbacks" on "public"."review_feedbacks";

drop policy "authenticated_users_can_update_org_review_feedbacks" on "public"."review_feedbacks";

drop policy "service_role_can_insert_all_review_feedbacks" on "public"."review_feedbacks";

drop policy "authenticated_users_can_select_org_review_suggestion_snippets" on "public"."review_suggestion_snippets";

drop policy "service_role_can_insert_all_review_suggestion_snippets" on "public"."review_suggestion_snippets";

revoke delete on table "public"."doc_file_paths" from "authenticated";

revoke insert on table "public"."doc_file_paths" from "authenticated";

revoke references on table "public"."doc_file_paths" from "authenticated";

revoke select on table "public"."doc_file_paths" from "authenticated";

revoke trigger on table "public"."doc_file_paths" from "authenticated";

revoke truncate on table "public"."doc_file_paths" from "authenticated";

revoke update on table "public"."doc_file_paths" from "authenticated";

revoke delete on table "public"."doc_file_paths" from "service_role";

revoke insert on table "public"."doc_file_paths" from "service_role";

revoke references on table "public"."doc_file_paths" from "service_role";

revoke select on table "public"."doc_file_paths" from "service_role";

revoke trigger on table "public"."doc_file_paths" from "service_role";

revoke truncate on table "public"."doc_file_paths" from "service_role";

revoke update on table "public"."doc_file_paths" from "service_role";

revoke delete on table "public"."github_pull_request_comments" from "authenticated";

revoke insert on table "public"."github_pull_request_comments" from "authenticated";

revoke references on table "public"."github_pull_request_comments" from "authenticated";

revoke select on table "public"."github_pull_request_comments" from "authenticated";

revoke trigger on table "public"."github_pull_request_comments" from "authenticated";

revoke truncate on table "public"."github_pull_request_comments" from "authenticated";

revoke update on table "public"."github_pull_request_comments" from "authenticated";

revoke delete on table "public"."github_pull_request_comments" from "service_role";

revoke insert on table "public"."github_pull_request_comments" from "service_role";

revoke references on table "public"."github_pull_request_comments" from "service_role";

revoke select on table "public"."github_pull_request_comments" from "service_role";

revoke trigger on table "public"."github_pull_request_comments" from "service_role";

revoke truncate on table "public"."github_pull_request_comments" from "service_role";

revoke update on table "public"."github_pull_request_comments" from "service_role";

revoke delete on table "public"."github_pull_requests" from "authenticated";

revoke insert on table "public"."github_pull_requests" from "authenticated";

revoke references on table "public"."github_pull_requests" from "authenticated";

revoke select on table "public"."github_pull_requests" from "authenticated";

revoke trigger on table "public"."github_pull_requests" from "authenticated";

revoke truncate on table "public"."github_pull_requests" from "authenticated";

revoke update on table "public"."github_pull_requests" from "authenticated";

revoke delete on table "public"."github_pull_requests" from "service_role";

revoke insert on table "public"."github_pull_requests" from "service_role";

revoke references on table "public"."github_pull_requests" from "service_role";

revoke select on table "public"."github_pull_requests" from "service_role";

revoke trigger on table "public"."github_pull_requests" from "service_role";

revoke truncate on table "public"."github_pull_requests" from "service_role";

revoke update on table "public"."github_pull_requests" from "service_role";

revoke delete on table "public"."knowledge_suggestion_doc_mappings" from "authenticated";

revoke insert on table "public"."knowledge_suggestion_doc_mappings" from "authenticated";

revoke references on table "public"."knowledge_suggestion_doc_mappings" from "authenticated";

revoke select on table "public"."knowledge_suggestion_doc_mappings" from "authenticated";

revoke trigger on table "public"."knowledge_suggestion_doc_mappings" from "authenticated";

revoke truncate on table "public"."knowledge_suggestion_doc_mappings" from "authenticated";

revoke update on table "public"."knowledge_suggestion_doc_mappings" from "authenticated";

revoke delete on table "public"."knowledge_suggestion_doc_mappings" from "service_role";

revoke insert on table "public"."knowledge_suggestion_doc_mappings" from "service_role";

revoke references on table "public"."knowledge_suggestion_doc_mappings" from "service_role";

revoke select on table "public"."knowledge_suggestion_doc_mappings" from "service_role";

revoke trigger on table "public"."knowledge_suggestion_doc_mappings" from "service_role";

revoke truncate on table "public"."knowledge_suggestion_doc_mappings" from "service_role";

revoke update on table "public"."knowledge_suggestion_doc_mappings" from "service_role";

revoke delete on table "public"."knowledge_suggestions" from "authenticated";

revoke insert on table "public"."knowledge_suggestions" from "authenticated";

revoke references on table "public"."knowledge_suggestions" from "authenticated";

revoke select on table "public"."knowledge_suggestions" from "authenticated";

revoke trigger on table "public"."knowledge_suggestions" from "authenticated";

revoke truncate on table "public"."knowledge_suggestions" from "authenticated";

revoke update on table "public"."knowledge_suggestions" from "authenticated";

revoke delete on table "public"."knowledge_suggestions" from "service_role";

revoke insert on table "public"."knowledge_suggestions" from "service_role";

revoke references on table "public"."knowledge_suggestions" from "service_role";

revoke select on table "public"."knowledge_suggestions" from "service_role";

revoke trigger on table "public"."knowledge_suggestions" from "service_role";

revoke truncate on table "public"."knowledge_suggestions" from "service_role";

revoke update on table "public"."knowledge_suggestions" from "service_role";

revoke delete on table "public"."migration_pull_request_mappings" from "authenticated";

revoke insert on table "public"."migration_pull_request_mappings" from "authenticated";

revoke references on table "public"."migration_pull_request_mappings" from "authenticated";

revoke select on table "public"."migration_pull_request_mappings" from "authenticated";

revoke trigger on table "public"."migration_pull_request_mappings" from "authenticated";

revoke truncate on table "public"."migration_pull_request_mappings" from "authenticated";

revoke update on table "public"."migration_pull_request_mappings" from "authenticated";

revoke delete on table "public"."migration_pull_request_mappings" from "service_role";

revoke insert on table "public"."migration_pull_request_mappings" from "service_role";

revoke references on table "public"."migration_pull_request_mappings" from "service_role";

revoke select on table "public"."migration_pull_request_mappings" from "service_role";

revoke trigger on table "public"."migration_pull_request_mappings" from "service_role";

revoke truncate on table "public"."migration_pull_request_mappings" from "service_role";

revoke update on table "public"."migration_pull_request_mappings" from "service_role";

revoke delete on table "public"."migrations" from "authenticated";

revoke insert on table "public"."migrations" from "authenticated";

revoke references on table "public"."migrations" from "authenticated";

revoke select on table "public"."migrations" from "authenticated";

revoke trigger on table "public"."migrations" from "authenticated";

revoke truncate on table "public"."migrations" from "authenticated";

revoke update on table "public"."migrations" from "authenticated";

revoke delete on table "public"."migrations" from "service_role";

revoke insert on table "public"."migrations" from "service_role";

revoke references on table "public"."migrations" from "service_role";

revoke select on table "public"."migrations" from "service_role";

revoke trigger on table "public"."migrations" from "service_role";

revoke truncate on table "public"."migrations" from "service_role";

revoke update on table "public"."migrations" from "service_role";

revoke delete on table "public"."overall_review_knowledge_suggestion_mappings" from "authenticated";

revoke insert on table "public"."overall_review_knowledge_suggestion_mappings" from "authenticated";

revoke references on table "public"."overall_review_knowledge_suggestion_mappings" from "authenticated";

revoke select on table "public"."overall_review_knowledge_suggestion_mappings" from "authenticated";

revoke trigger on table "public"."overall_review_knowledge_suggestion_mappings" from "authenticated";

revoke truncate on table "public"."overall_review_knowledge_suggestion_mappings" from "authenticated";

revoke update on table "public"."overall_review_knowledge_suggestion_mappings" from "authenticated";

revoke delete on table "public"."overall_review_knowledge_suggestion_mappings" from "service_role";

revoke insert on table "public"."overall_review_knowledge_suggestion_mappings" from "service_role";

revoke references on table "public"."overall_review_knowledge_suggestion_mappings" from "service_role";

revoke select on table "public"."overall_review_knowledge_suggestion_mappings" from "service_role";

revoke trigger on table "public"."overall_review_knowledge_suggestion_mappings" from "service_role";

revoke truncate on table "public"."overall_review_knowledge_suggestion_mappings" from "service_role";

revoke update on table "public"."overall_review_knowledge_suggestion_mappings" from "service_role";

revoke delete on table "public"."overall_reviews" from "authenticated";

revoke insert on table "public"."overall_reviews" from "authenticated";

revoke references on table "public"."overall_reviews" from "authenticated";

revoke select on table "public"."overall_reviews" from "authenticated";

revoke trigger on table "public"."overall_reviews" from "authenticated";

revoke truncate on table "public"."overall_reviews" from "authenticated";

revoke update on table "public"."overall_reviews" from "authenticated";

revoke delete on table "public"."overall_reviews" from "service_role";

revoke insert on table "public"."overall_reviews" from "service_role";

revoke references on table "public"."overall_reviews" from "service_role";

revoke select on table "public"."overall_reviews" from "service_role";

revoke trigger on table "public"."overall_reviews" from "service_role";

revoke truncate on table "public"."overall_reviews" from "service_role";

revoke update on table "public"."overall_reviews" from "service_role";

revoke delete on table "public"."review_feedback_comments" from "authenticated";

revoke insert on table "public"."review_feedback_comments" from "authenticated";

revoke references on table "public"."review_feedback_comments" from "authenticated";

revoke select on table "public"."review_feedback_comments" from "authenticated";

revoke trigger on table "public"."review_feedback_comments" from "authenticated";

revoke truncate on table "public"."review_feedback_comments" from "authenticated";

revoke update on table "public"."review_feedback_comments" from "authenticated";

revoke delete on table "public"."review_feedback_comments" from "service_role";

revoke insert on table "public"."review_feedback_comments" from "service_role";

revoke references on table "public"."review_feedback_comments" from "service_role";

revoke select on table "public"."review_feedback_comments" from "service_role";

revoke trigger on table "public"."review_feedback_comments" from "service_role";

revoke truncate on table "public"."review_feedback_comments" from "service_role";

revoke update on table "public"."review_feedback_comments" from "service_role";

revoke delete on table "public"."review_feedback_knowledge_suggestion_mappings" from "authenticated";

revoke insert on table "public"."review_feedback_knowledge_suggestion_mappings" from "authenticated";

revoke references on table "public"."review_feedback_knowledge_suggestion_mappings" from "authenticated";

revoke select on table "public"."review_feedback_knowledge_suggestion_mappings" from "authenticated";

revoke trigger on table "public"."review_feedback_knowledge_suggestion_mappings" from "authenticated";

revoke truncate on table "public"."review_feedback_knowledge_suggestion_mappings" from "authenticated";

revoke update on table "public"."review_feedback_knowledge_suggestion_mappings" from "authenticated";

revoke delete on table "public"."review_feedback_knowledge_suggestion_mappings" from "service_role";

revoke insert on table "public"."review_feedback_knowledge_suggestion_mappings" from "service_role";

revoke references on table "public"."review_feedback_knowledge_suggestion_mappings" from "service_role";

revoke select on table "public"."review_feedback_knowledge_suggestion_mappings" from "service_role";

revoke trigger on table "public"."review_feedback_knowledge_suggestion_mappings" from "service_role";

revoke truncate on table "public"."review_feedback_knowledge_suggestion_mappings" from "service_role";

revoke update on table "public"."review_feedback_knowledge_suggestion_mappings" from "service_role";

revoke delete on table "public"."review_feedbacks" from "authenticated";

revoke insert on table "public"."review_feedbacks" from "authenticated";

revoke references on table "public"."review_feedbacks" from "authenticated";

revoke select on table "public"."review_feedbacks" from "authenticated";

revoke trigger on table "public"."review_feedbacks" from "authenticated";

revoke truncate on table "public"."review_feedbacks" from "authenticated";

revoke update on table "public"."review_feedbacks" from "authenticated";

revoke delete on table "public"."review_feedbacks" from "service_role";

revoke insert on table "public"."review_feedbacks" from "service_role";

revoke references on table "public"."review_feedbacks" from "service_role";

revoke select on table "public"."review_feedbacks" from "service_role";

revoke trigger on table "public"."review_feedbacks" from "service_role";

revoke truncate on table "public"."review_feedbacks" from "service_role";

revoke update on table "public"."review_feedbacks" from "service_role";

revoke delete on table "public"."review_suggestion_snippets" from "authenticated";

revoke insert on table "public"."review_suggestion_snippets" from "authenticated";

revoke references on table "public"."review_suggestion_snippets" from "authenticated";

revoke select on table "public"."review_suggestion_snippets" from "authenticated";

revoke trigger on table "public"."review_suggestion_snippets" from "authenticated";

revoke truncate on table "public"."review_suggestion_snippets" from "authenticated";

revoke update on table "public"."review_suggestion_snippets" from "authenticated";

revoke delete on table "public"."review_suggestion_snippets" from "service_role";

revoke insert on table "public"."review_suggestion_snippets" from "service_role";

revoke references on table "public"."review_suggestion_snippets" from "service_role";

revoke select on table "public"."review_suggestion_snippets" from "service_role";

revoke trigger on table "public"."review_suggestion_snippets" from "service_role";

revoke truncate on table "public"."review_suggestion_snippets" from "service_role";

revoke update on table "public"."review_suggestion_snippets" from "service_role";

alter table "public"."doc_file_paths" drop constraint "doc_file_paths_organization_id_fkey";

alter table "public"."doc_file_paths" drop constraint "github_doc_file_path_project_id_fkey";

alter table "public"."github_pull_request_comments" drop constraint "github_pull_request_comments_github_comment_identifier_key";

alter table "public"."github_pull_request_comments" drop constraint "github_pull_request_comments_github_pull_request_id_fkey";

alter table "public"."github_pull_request_comments" drop constraint "github_pull_request_comments_github_pull_request_id_key";

alter table "public"."github_pull_request_comments" drop constraint "github_pull_request_comments_organization_id_fkey";

alter table "public"."github_pull_requests" drop constraint "github_pull_request_repository_id_fkey";

alter table "public"."github_pull_requests" drop constraint "github_pull_requests_organization_id_fkey";

alter table "public"."knowledge_suggestion_doc_mappings" drop constraint "knowledge_suggestion_doc_mapping_doc_file_path_id_fkey";

alter table "public"."knowledge_suggestion_doc_mappings" drop constraint "knowledge_suggestion_doc_mapping_knowledge_suggestion_id_fkey";

alter table "public"."knowledge_suggestion_doc_mappings" drop constraint "knowledge_suggestion_doc_mappings_organization_id_fkey";

alter table "public"."knowledge_suggestions" drop constraint "knowledge_suggestion_project_id_fkey";

alter table "public"."knowledge_suggestions" drop constraint "knowledge_suggestions_organization_id_fkey";

alter table "public"."migration_pull_request_mappings" drop constraint "migration_pull_request_mapping_migration_id_fkey";

alter table "public"."migration_pull_request_mappings" drop constraint "migration_pull_request_mapping_migration_id_pull_request_id_key";

alter table "public"."migration_pull_request_mappings" drop constraint "migration_pull_request_mapping_pull_request_id_fkey";

alter table "public"."migration_pull_request_mappings" drop constraint "migration_pull_request_mappings_organization_id_fkey";

alter table "public"."migrations" drop constraint "migration_project_id_fkey";

alter table "public"."migrations" drop constraint "migrations_organization_id_fkey";

alter table "public"."overall_review_knowledge_suggestion_mappings" drop constraint "overall_review_knowledge_suggestion_mapping_knowledge_suggestio";

alter table "public"."overall_review_knowledge_suggestion_mappings" drop constraint "overall_review_knowledge_suggestion_mapping_overall_review_id_f";

alter table "public"."overall_review_knowledge_suggestion_mappings" drop constraint "overall_review_knowledge_suggestion_mappings_organization_id_fk";

alter table "public"."overall_reviews" drop constraint "overall_review_migration_id_fkey";

alter table "public"."overall_reviews" drop constraint "overall_reviews_organization_id_fkey";

alter table "public"."review_feedback_comments" drop constraint "review_feedback_comment_review_feedback_id_fkey";

alter table "public"."review_feedback_comments" drop constraint "review_feedback_comment_user_id_fkey";

alter table "public"."review_feedback_comments" drop constraint "review_feedback_comments_organization_id_fkey";

alter table "public"."review_feedback_knowledge_suggestion_mappings" drop constraint "review_feedback_knowledge_suggesti_knowledge_suggestion_id_fkey";

alter table "public"."review_feedback_knowledge_suggestion_mappings" drop constraint "review_feedback_knowledge_suggestion_ma_review_feedback_id_fkey";

alter table "public"."review_feedback_knowledge_suggestion_mappings" drop constraint "review_feedback_knowledge_suggestion_mappings_organization_id_f";

alter table "public"."review_feedbacks" drop constraint "review_feedback_overall_review_id_fkey";

alter table "public"."review_feedbacks" drop constraint "review_feedbacks_organization_id_fkey";

alter table "public"."review_suggestion_snippets" drop constraint "review_suggestion_snippet_review_feedback_id_fkey";

alter table "public"."review_suggestion_snippets" drop constraint "review_suggestion_snippets_organization_id_fkey";

drop function if exists "public"."set_doc_file_paths_organization_id"();

drop function if exists "public"."set_github_pull_request_comments_organization_id"();

drop function if exists "public"."set_github_pull_requests_organization_id"();

drop function if exists "public"."set_knowledge_suggestion_doc_mappings_organization_id"();

drop function if exists "public"."set_knowledge_suggestions_organization_id"();

drop function if exists "public"."set_migration_pull_request_mappings_organization_id"();

drop function if exists "public"."set_migrations_organization_id"();

drop function if exists "public"."set_overall_review_knowledge_suggestion_mappings_organization_i"();

drop function if exists "public"."set_overall_reviews_organization_id"();

drop function if exists "public"."set_review_feedback_comments_organization_id"();

drop function if exists "public"."set_review_feedback_knowledge_suggestion_mappings_organization_"();

drop function if exists "public"."set_review_feedbacks_organization_id"();

drop function if exists "public"."set_review_suggestion_snippets_organization_id"();

alter table "public"."doc_file_paths" drop constraint "github_doc_file_path_pkey";

alter table "public"."github_pull_request_comments" drop constraint "github_pull_request_comments_pkey";

alter table "public"."github_pull_requests" drop constraint "pull_request_pkey";

alter table "public"."knowledge_suggestion_doc_mappings" drop constraint "knowledge_suggestion_doc_mapping_pkey";

alter table "public"."knowledge_suggestions" drop constraint "knowledge_suggestion_pkey";

alter table "public"."migration_pull_request_mappings" drop constraint "migration_pull_request_mappings_pkey";

alter table "public"."migrations" drop constraint "migration_pkey";

alter table "public"."overall_review_knowledge_suggestion_mappings" drop constraint "overall_review_knowledge_suggestion_mapping_pkey";

alter table "public"."overall_reviews" drop constraint "overall_review_pkey";

alter table "public"."review_feedback_comments" drop constraint "review_feedback_comment_pkey";

alter table "public"."review_feedbacks" drop constraint "review_feedback_pkey";

alter table "public"."review_suggestion_snippets" drop constraint "review_suggestion_snippet_pkey";

drop index if exists "public"."doc_file_path_path_project_id_key";

drop index if exists "public"."github_doc_file_path_pkey";

drop index if exists "public"."github_pull_request_comments_github_comment_identifier_key";

drop index if exists "public"."github_pull_request_comments_github_pull_request_id_key";

drop index if exists "public"."github_pull_request_comments_pkey";

drop index if exists "public"."github_pull_request_repository_id_pull_number_key";

drop index if exists "public"."idx_review_feedback_comment_review_feedback_id";

drop index if exists "public"."knowledge_suggestion_doc_mapping_pkey";

drop index if exists "public"."knowledge_suggestion_doc_mapping_unique_mapping";

drop index if exists "public"."knowledge_suggestion_pkey";

drop index if exists "public"."migration_pkey";

drop index if exists "public"."migration_pull_request_mapping_migration_id_pull_request_id_key";

drop index if exists "public"."migration_pull_request_mappings_pkey";

drop index if exists "public"."overall_review_knowledge_suggestion_mapping_pkey";

drop index if exists "public"."overall_review_knowledge_suggestion_mapping_unique_mapping";

drop index if exists "public"."overall_review_pkey";

drop index if exists "public"."pull_request_pkey";

drop index if exists "public"."review_feedback_comment_pkey";

drop index if exists "public"."review_feedback_pkey";

drop index if exists "public"."review_suggestion_snippet_pkey";

drop table "public"."doc_file_paths";

drop table "public"."github_pull_request_comments";

drop table "public"."github_pull_requests";

drop table "public"."knowledge_suggestion_doc_mappings";

drop table "public"."knowledge_suggestions";

drop table "public"."migration_pull_request_mappings";

drop table "public"."migrations";

drop table "public"."overall_review_knowledge_suggestion_mappings";

drop table "public"."overall_reviews";

drop table "public"."review_feedback_comments";

drop table "public"."review_feedback_knowledge_suggestion_mappings";

drop table "public"."review_feedbacks";

drop table "public"."review_suggestion_snippets";

drop type "public"."category_enum";

drop type "public"."knowledge_type";

drop type "public"."severity_enum";


