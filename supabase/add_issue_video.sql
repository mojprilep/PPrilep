-- Optional short video on issue reports (≤30s, one per issue). 2026-10-12.
--
-- The file lives in the existing public `issue-photos` bucket (prefix
-- "video-"), so no storage change is needed: the orphan sweeper scans every
-- column of `issues`, so it already protects this URL. Existing grants and RLS
-- on `issues` cover the new column.
--
-- The app only sends video_url when a video is attached and retries the detail
-- read without it, so the order of SQL vs. OTA doesn't break anything — but
-- videos can't be saved until this runs.

alter table public.issues add column if not exists video_url text;
