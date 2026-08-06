-- Function to handle checkpoint and blobs insertion atomically
create or replace function put_checkpoint(
  p_checkpoint jsonb,
  p_blobs jsonb
) returns void as $$
begin
  -- Insert checkpoint
  insert into checkpoints (
    thread_id,
    checkpoint_ns,
    checkpoint_id,
    parent_checkpoint_id,
    checkpoint,
    metadata,
    organization_id,
    created_at,
    updated_at
  ) values (
    (p_checkpoint->>'thread_id')::text,
    (p_checkpoint->>'checkpoint_ns')::text,
    (p_checkpoint->>'checkpoint_id')::text,
    (p_checkpoint->>'parent_checkpoint_id')::text,
    p_checkpoint->'checkpoint',
    p_checkpoint->'metadata',
    (p_checkpoint->>'organization_id')::uuid,
    (p_checkpoint->>'created_at')::timestamptz,
    (p_checkpoint->>'updated_at')::timestamptz
  )
  on conflict (thread_id, checkpoint_ns, checkpoint_id, organization_id)
  do update set
    parent_checkpoint_id = excluded.parent_checkpoint_id,
    checkpoint = excluded.checkpoint,
    metadata = excluded.metadata,
    updated_at = excluded.updated_at;

  -- Insert blobs if provided
  if p_blobs is not null and jsonb_array_length(p_blobs) > 0 then
    insert into checkpoint_blobs (
      thread_id,
      checkpoint_ns,
      channel,
      version,
      type,
      blob,
      organization_id
    )
    select
      (blob->>'thread_id')::text,
      (blob->>'checkpoint_ns')::text,
      (blob->>'channel')::text,
      (blob->>'version')::text,
      (blob->>'type')::text,
      case
        when blob->>'blob' is null then null
        else decode(blob->>'blob', 'base64')
      end,
      (blob->>'organization_id')::uuid
    from jsonb_array_elements(p_blobs) as blob
    on conflict (thread_id, checkpoint_ns, channel, version, organization_id)
    do update set
      type = excluded.type,
      blob = excluded.blob;
  end if;
end;
$$ language plpgsql;

revoke all on function put_checkpoint(jsonb, jsonb) from anon;
