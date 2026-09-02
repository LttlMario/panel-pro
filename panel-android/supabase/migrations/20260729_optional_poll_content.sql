alter table public.community_posts
drop constraint if exists community_posts_content_check;

alter table public.community_posts
add constraint community_posts_content_check
check (length(content) between 0 and 4000);
