alter table public.platform_tasks
  add column if not exists task_type text not null default 'employee_advancement';

alter table public.platform_tasks
  drop constraint if exists platform_tasks_task_type_check;

alter table public.platform_tasks
  add constraint platform_tasks_task_type_check
  check (task_type in ('employee_advancement', 'organization_weekly'));

create index if not exists platform_tasks_type_idx
  on public.platform_tasks (organization_id, task_type, status, due_at);
