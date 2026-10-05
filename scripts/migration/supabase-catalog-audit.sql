-- Read-only inventory for the Supabase blue/green migration.
-- Run with psql and a session-pooler connection; this script never reads row
-- contents or writes database state.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;

SELECT current_database() AS database_name,
       current_setting('server_version') AS server_version,
       current_setting('transaction_read_only') AS transaction_read_only,
       pg_database_size(current_database()) AS database_bytes;

SELECT n.nspname AS schema_name,
       c.relname AS relation_name,
       c.relkind AS relation_kind,
       c.relispartition AS is_partition,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls,
       pg_total_relation_size(c.oid) AS total_bytes
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = ANY (ARRAY[
  'public', 'supabase_migrations', 'auth', 'storage', 'realtime',
  'extensions', 'vault', 'graphql', 'graphql_public'
])
  AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
ORDER BY n.nspname, c.relname;

SELECT table_schema,
       table_name,
       column_name,
       ordinal_position,
       data_type,
       udt_name,
       is_nullable,
       column_default,
       is_identity,
       identity_generation
FROM information_schema.columns
WHERE table_schema = ANY (ARRAY['public', 'supabase_migrations'])
ORDER BY table_schema, table_name, ordinal_position;

SELECT n.nspname AS schema_name,
       t.relname AS table_name,
       c.conname AS constraint_name,
       c.contype AS constraint_type,
       c.convalidated AS validated,
       pg_get_constraintdef(c.oid, true) AS definition
FROM pg_constraint AS c
JOIN pg_class AS t ON t.oid = c.conrelid
JOIN pg_namespace AS n ON n.oid = t.relnamespace
WHERE n.nspname = ANY (ARRAY['public', 'supabase_migrations'])
ORDER BY n.nspname, t.relname, c.conname;

SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = ANY (ARRAY['public', 'supabase_migrations'])
ORDER BY schemaname, tablename, indexname;

SELECT n.nspname AS schema_name,
       t.typname AS enum_name,
       e.enumsortorder AS sort_order,
       e.enumlabel AS enum_label
FROM pg_type AS t
JOIN pg_namespace AS n ON n.oid = t.typnamespace
JOIN pg_enum AS e ON e.enumtypid = t.oid
WHERE n.nspname = ANY (ARRAY[
  'public', 'supabase_migrations', 'auth', 'storage', 'realtime',
  'extensions', 'vault', 'graphql', 'graphql_public'
])
ORDER BY n.nspname, t.typname, e.enumsortorder;

SELECT schemaname,
       sequencename,
       sequenceowner,
       data_type,
       start_value,
       min_value,
       max_value,
       increment_by,
       cycle,
       cache_size,
       last_value
FROM pg_sequences
WHERE schemaname = ANY (ARRAY['public', 'supabase_migrations'])
ORDER BY schemaname, sequencename;

SELECT n.nspname AS schema_name,
       p.proname AS routine_name,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       l.lanname AS language,
       p.prokind AS routine_kind,
       p.prosecdef AS security_definer,
       p.proconfig AS routine_settings,
       encode(digest(pg_get_functiondef(p.oid), 'sha256'), 'hex') AS definition_sha256
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
JOIN pg_language AS l ON l.oid = p.prolang
WHERE n.nspname = ANY (ARRAY[
  'public', 'supabase_migrations', 'auth', 'storage', 'realtime',
  'extensions', 'vault', 'graphql', 'graphql_public'
])
ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid);

SELECT n.nspname AS schema_name,
       t.relname AS table_name,
       g.tgname AS trigger_name,
       g.tgenabled AS enabled,
       pn.nspname AS function_schema,
       p.proname AS function_name,
       pg_get_triggerdef(g.oid, true) AS definition
FROM pg_trigger AS g
JOIN pg_class AS t ON t.oid = g.tgrelid
JOIN pg_namespace AS n ON n.oid = t.relnamespace
JOIN pg_proc AS p ON p.oid = g.tgfoid
JOIN pg_namespace AS pn ON pn.oid = p.pronamespace
WHERE NOT g.tgisinternal
  AND n.nspname = ANY (ARRAY[
    'public', 'supabase_migrations', 'auth', 'storage', 'realtime',
    'extensions', 'vault', 'graphql', 'graphql_public'
  ])
ORDER BY n.nspname, t.relname, g.tgname;

SELECT e.evtname AS event_trigger_name,
       e.evtevent AS event_name,
       e.evtenabled AS enabled,
       n.nspname AS function_schema,
       p.proname AS function_name
FROM pg_event_trigger AS e
JOIN pg_proc AS p ON p.oid = e.evtfoid
JOIN pg_namespace AS n ON n.oid = p.pronamespace
ORDER BY e.evtname;

SELECT schemaname,
       tablename,
       policyname,
       permissive,
       roles,
       cmd,
       qual,
       with_check
FROM pg_policies
WHERE schemaname = ANY (ARRAY[
  'public', 'supabase_migrations', 'auth', 'storage', 'realtime'
])
ORDER BY schemaname, tablename, policyname;

SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
ORDER BY c.relname;

SELECT n.nspname AS schema_name,
       pg_get_userbyid(n.nspowner) AS owner_name,
       n.nspacl AS schema_acl
FROM pg_namespace AS n
WHERE n.nspname = ANY (ARRAY[
  'public', 'supabase_migrations', 'auth', 'storage', 'realtime',
  'extensions', 'vault', 'graphql', 'graphql_public'
])
ORDER BY n.nspname;

SELECT n.nspname AS schema_name,
       c.relname AS relation_name,
       c.relkind AS relation_kind,
       c.relacl AS relation_acl
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = ANY (ARRAY[
  'public', 'supabase_migrations', 'auth', 'storage', 'realtime'
])
  AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
ORDER BY n.nspname, c.relname;

SELECT n.nspname AS schema_name,
       pg_get_userbyid(d.defaclrole) AS owner_name,
       d.defaclobjtype AS object_type,
       d.defaclacl AS default_acl
FROM pg_default_acl AS d
LEFT JOIN pg_namespace AS n ON n.oid = d.defaclnamespace
ORDER BY n.nspname, owner_name, d.defaclobjtype;

SELECT granted.rolname AS granted_role,
       member.rolname AS member_role,
       grantor.rolname AS grantor_role,
       m.admin_option
FROM pg_auth_members AS m
JOIN pg_roles AS granted ON granted.oid = m.roleid
JOIN pg_roles AS member ON member.oid = m.member
JOIN pg_roles AS grantor ON grantor.oid = m.grantor
ORDER BY granted.rolname, member.rolname;

SELECT e.extname AS extension_name,
       e.extversion AS version,
       n.nspname AS extension_schema
FROM pg_extension AS e
JOIN pg_namespace AS n ON n.oid = e.extnamespace
ORDER BY e.extname;

SELECT p.pubname AS publication,
       p.puballtables AS all_tables,
       p.pubinsert AS publishes_insert,
       p.pubupdate AS publishes_update,
       p.pubdelete AS publishes_delete,
       p.pubtruncate AS publishes_truncate,
       p.pubviaroot AS publishes_via_root,
       pt.schemaname AS table_schema,
       pt.tablename AS table_name
FROM pg_publication AS p
LEFT JOIN pg_publication_tables AS pt ON pt.pubname = p.pubname
ORDER BY p.pubname, pt.schemaname, pt.tablename;

SELECT b.id AS bucket_id,
       b.name AS bucket_name,
       b.public AS is_public,
       b.file_size_limit,
       b.allowed_mime_types,
       count(o.id)::bigint AS object_count,
       COALESCE(sum(NULLIF(o.metadata->>'size', '')::numeric), 0)::numeric AS logical_bytes
FROM storage.buckets AS b
LEFT JOIN storage.objects AS o ON o.bucket_id = b.id
GROUP BY b.id, b.name, b.public, b.file_size_limit, b.allowed_mime_types
ORDER BY b.name;

SELECT split_part(name, '/', 1) AS path_prefix,
       count(*)::bigint AS object_count,
       COALESCE(sum(NULLIF(metadata->>'size', '')::numeric), 0)::numeric AS logical_bytes
FROM storage.objects
GROUP BY split_part(name, '/', 1)
ORDER BY path_prefix;

SELECT migration_name,
       checksum,
       finished_at,
       rolled_back_at,
       applied_steps_count
FROM public."_prisma_migrations"
ORDER BY migration_name, started_at;

SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;

ROLLBACK;
