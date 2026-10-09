-- リール（縦長の動画）を自動投稿のキューに載せるための列。
-- video_url がある行は、Instagram ではリール、Facebook ではページの動画として投稿する。
-- image_urls は NOT NULL のままにし、リールの行には表紙の画像を1枚入れる
-- （管理画面の一覧は image_urls を表示に使うため）。
alter table public.social_posts
  add column if not exists video_url text;
