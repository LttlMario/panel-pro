alter table public.platform_tasks
  add column if not exists task_group_id uuid;

update public.platform_tasks
set task_group_id = id
where task_group_id is null;

alter table public.platform_tasks
  alter column task_group_id set default gen_random_uuid(),
  alter column task_group_id set not null;

create index if not exists platform_tasks_group_idx
  on public.platform_tasks (task_group_id, status, due_at);
