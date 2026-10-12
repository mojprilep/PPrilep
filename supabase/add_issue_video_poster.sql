-- Poster frame for report videos. 2026-10-12.
--
-- The app grabs one frame from the uploaded video and stores it as
-- issue-photos/video-<…>-poster.jpg; the feed and the issue page show it
-- instead of a black box. The orphan sweeper scans every column of `issues`,
-- so the poster is protected like the video. The app saves without the column
-- if this hasn't run (just no poster).

alter table public.issues add column if not exists video_poster_url text;
