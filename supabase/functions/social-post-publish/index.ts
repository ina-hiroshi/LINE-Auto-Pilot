import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { sendAdminAlert } from "../_shared/admin-alert.ts";
import { getToken } from "../_shared/meta-tokens.ts";

const IG_BASE = "https://graph.instagram.com/v21.0";
const FB_BASE = "https://graph.facebook.com/v21.0";

// claim_next_social_post_batch() の max_attempts、および marketing-posts/queue.ts の
// MAX_ATTEMPTS と同じ値。この回数に達した failed 行はキューから拾われなくなる。
const MAX_ATTEMPTS = 3;

type SocialPost = {
  id: string;
  slug: string;
  platform: "instagram" | "facebook";
  caption: string;
  image_urls: string[];
  status: string;
  attempts: number;
};

type PublishFailure = { platform: string; error: string; slug: string; attempts: number };

async function pollIgStatus(id: string, token: string, maxAttempts = 10, delayMs = 4000) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${IG_BASE}/${id}?fields=status_code&access_token=${token}`);
    const json = await res.json();
    if (json.status_code === "FINISHED") return;
    if (json.status_code === "ERROR") {
      throw new Error(`Container ${id} failed: ${JSON.stringify(json)}`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Container ${id} did not finish within timeout`);
}

// 子コンテナ作成の再試行。Metaが画像URLを取得しにいって失敗すると、実際には
// 一時的な取得失敗でも 9004/2207052（is_transient: false）で返ってくる。
// 2026-09-30 の post23 は、他で成功済みの同一ファイルがこれで落ちて、
// 後続の投稿日も押し下げた。認証エラーなど再試行しても直らないものは即座に諦める。
const CHILD_RETRY_DELAYS_MS = [3000, 8000];

function isRetryableChildError(json: { error?: { code?: number; is_transient?: boolean; message?: string } }): boolean {
  return json.error?.code === 9004 || json.error?.is_transient === true;
}

async function createCarouselChild(imageUrl: string, token: string, igUserId: string): Promise<string> {
  const params = new URLSearchParams({
    image_url: imageUrl,
    is_carousel_item: "true",
    access_token: token,
  });
  for (let attempt = 0; ; attempt++) {
    let json: { id?: string; error?: { code?: number; is_transient?: boolean; message?: string } };
    try {
      const res = await fetch(`${IG_BASE}/${igUserId}/media`, { method: "POST", body: params });
      json = await res.json();
    } catch (networkError) {
      // fetch自体の失敗（接続断など）はMeta側の応答が無いので、そのまま再試行対象にする
      json = { error: { is_transient: true, message: `network error: ${String(networkError)}` } };
    }
    if (json.id) return json.id;

    const delay = CHILD_RETRY_DELAYS_MS[attempt];
    if (delay === undefined || !isRetryableChildError(json)) {
      throw new Error(`Failed to create child for ${imageUrl}: ${JSON.stringify(json)}`);
    }
    console.warn(`child create failed (${imageUrl}), retry ${attempt + 1}/${CHILD_RETRY_DELAYS_MS.length}:`, JSON.stringify(json));
    await new Promise((r) => setTimeout(r, delay));
  }
}

async function publishInstagramCarousel(post: SocialPost, token: string, igUserId: string) {
  // 1. create child containers
  const childIds: string[] = [];
  for (const imageUrl of post.image_urls) {
    childIds.push(await createCarouselChild(imageUrl, token, igUserId));
  }

  // 2. wait for children to finish processing. Polled together rather than one
  // after another: serially, a 5-image carousel could burn 5x the poll timeout
  // before the parent container is even created.
  await Promise.all(childIds.map((id) => pollIgStatus(id, token)));

  // 3. create parent carousel container
  const parentParams = new URLSearchParams({
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption: post.caption,
    access_token: token,
  });
  const parentRes = await fetch(`${IG_BASE}/${igUserId}/media`, { method: "POST", body: parentParams });
  const parentJson = await parentRes.json();
  if (!parentJson.id) throw new Error(`Failed to create parent container: ${JSON.stringify(parentJson)}`);
  const parentId = parentJson.id;

  // 4. wait for parent to finish
  await pollIgStatus(parentId, token);

  // 5. publish
  const publishParams = new URLSearchParams({ creation_id: parentId, access_token: token });
  const publishRes = await fetch(`${IG_BASE}/${igUserId}/media_publish`, { method: "POST", body: publishParams });
  const publishJson = await publishRes.json();
  if (!publishJson.id) throw new Error(`Failed to publish: ${JSON.stringify(publishJson)}`);
  const mediaId = publishJson.id;

  // 6. fetch permalink
  const permalinkRes = await fetch(`${IG_BASE}/${mediaId}?fields=permalink&access_token=${token}`);
  const permalinkJson = await permalinkRes.json();

  return { mediaId, permalink: permalinkJson.permalink as string | undefined };
}

async function publishFacebookPost(post: SocialPost, token: string, pageId: string) {
  if (post.image_urls.length === 1) {
    const params = new URLSearchParams({
      url: post.image_urls[0],
      caption: post.caption,
      access_token: token,
    });
    const res = await fetch(`${FB_BASE}/${pageId}/photos`, { method: "POST", body: params });
    const json = await res.json();
    if (!json.post_id && !json.id) throw new Error(`Failed to publish Facebook photo: ${JSON.stringify(json)}`);
    const mediaId = (json.post_id as string | undefined) ?? (json.id as string);
    return { mediaId, permalink: `https://www.facebook.com/${mediaId}` };
  }

  // Multiple images: upload each unpublished, then attach them all to one feed post.
  const photoIds: string[] = [];
  for (const imageUrl of post.image_urls) {
    const params = new URLSearchParams({
      url: imageUrl,
      published: "false",
      access_token: token,
    });
    const res = await fetch(`${FB_BASE}/${pageId}/photos`, { method: "POST", body: params });
    const json = await res.json();
    if (!json.id) throw new Error(`Failed to upload Facebook photo for ${imageUrl}: ${JSON.stringify(json)}`);
    photoIds.push(json.id as string);
  }

  const feedParams = new URLSearchParams({ message: post.caption, access_token: token });
  photoIds.forEach((id, i) => {
    feedParams.append(`attached_media[${i}]`, JSON.stringify({ media_fbid: id }));
  });

  const feedRes = await fetch(`${FB_BASE}/${pageId}/feed`, { method: "POST", body: feedParams });
  const feedJson = await feedRes.json();
  if (!feedJson.id) throw new Error(`Failed to publish Facebook feed post: ${JSON.stringify(feedJson)}`);
  const mediaId = feedJson.id as string;

  return { mediaId, permalink: `https://www.facebook.com/${mediaId}` };
}

async function publishOne(post: SocialPost, supabase: SupabaseClient) {
  // _shared/meta-tokens.ts は npm: 指定の SupabaseClient 型を要求するが、
  // この関数は jsr: 指定で import している。実体は同じクライアントだが、
  // モジュール指定子が違うと TS 上は別型になるため橋渡しする
  // （_shared/admin-access.ts が isAdminUser に対して行っているのと同じ処理）。
  const supabaseForTokens = supabase as unknown as Parameters<typeof getToken>[0];

  if (post.platform === "instagram") {
    // Vault優先、無ければ env（meta-token-refresh 導入前の移行期フォールバック）。
    // Vaultのトークンは meta-token-refresh が定期的に回転させるため、生の
    // env値をここで直接読むと、回転後に env 側だけが静かに古くなる
    // （2026-09-04 障害と同じ壊れ方）。
    const igToken = await getToken(supabaseForTokens, "instagram_login");
    const igUserId = Deno.env.get("INSTAGRAM_USER_ID");
    if (!igToken || !igUserId) throw new Error("missing instagram credentials");
    return await publishInstagramCarousel(post, igToken.token, igUserId);
  }

  if (post.platform === "facebook") {
    const fbToken = await getToken(supabaseForTokens, "facebook_page");
    const fbPageId = Deno.env.get("FACEBOOK_PAGE_ID");
    if (!fbToken || !fbPageId) throw new Error("missing facebook credentials");
    return await publishFacebookPost(post, fbToken.token, fbPageId);
  }

  throw new Error(`unknown platform: ${post.platform}`);
}

Deno.serve(async (req: Request) => {
  try {
    const cronSecret = Deno.env.get("SOCIAL_CRON_SECRET");
    const providedSecret = req.headers.get("x-cron-secret");
    if (!cronSecret || providedSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // marketing_settings（管理画面から切り替え可能）を優先し、行が無ければ
    // 従来の env（Supabase Secrets の SOCIAL_AUTOPOST_ENABLED）にフォールバックする。
    // env は UI から変更できないため、行があるのに env だけを見続けると
    // 設定画面のトグルが何も効かない見た目になる。
    const { data: settings, error: settingsError } = await supabase
      .from("marketing_settings")
      .select("social_autopost_enabled")
      .eq("id", "global")
      .maybeSingle();
    if (settingsError) {
      console.error("marketing_settings の読み込みに失敗。env にフォールバックする:", settingsError);
    }
    const autopostEnabled = settings
      ? settings.social_autopost_enabled
      : Deno.env.get("SOCIAL_AUTOPOST_ENABLED") !== "false";
    if (!autopostEnabled) {
      return new Response(JSON.stringify({ skipped: "autopost disabled" }), { status: 200 });
    }

    const { data: claimed, error: claimError } = await supabase.rpc("claim_next_social_post_batch");
    if (claimError) throw claimError;
    const posts = (claimed ?? []) as SocialPost[];
    if (posts.length === 0) {
      return new Response(JSON.stringify({ skipped: "no pending posts" }), { status: 200 });
    }

    // Instagram and Facebook are independent APIs, so publish them concurrently:
    // sequentially, the slowest carousel plus the slowest feed post can exceed
    // the function's wall-clock limit and strand both rows in 'publishing'.
    const results = await Promise.all(posts.map(async (post) => {
      try {
        const { mediaId, permalink } = await publishOne(post, supabase);
        await supabase
          .from("social_posts")
          .update({ status: "posted", platform_media_id: mediaId, permalink, posted_at: new Date().toISOString() })
          .eq("id", post.id);
        return { platform: post.platform, published: post.slug, mediaId, permalink };
      } catch (publishError) {
        const message = publishError instanceof Error ? publishError.message : String(publishError);
        await supabase
          .from("social_posts")
          .update({ status: "failed", error: message })
          .eq("id", post.id);
        const failure: PublishFailure = { platform: post.platform, error: message, slug: post.slug, attempts: post.attempts };
        return failure;
      }
    }));

    // flatMap で絞ると型述語を書かずに narrowing できる
    const failures = results.flatMap((r) => ("error" in r ? [r] : []));

    if (failures.length > 0) {
      // 失敗は social_posts.error に残るが、それだけでは誰にも届かない。
      // attempts が上限未満の failed 行は、次回の実行で claim_next_social_post_batch() が
      // 自動的に拾い直す（その間、後続の投稿日は後ろへずれる）。上限に達した行は
      // 拾われなくなり、failed のまま後続へ進む。どちらの状態かを文面で伝える。
      const willRetry = failures.filter((f) => f.attempts < MAX_ATTEMPTS);
      const gaveUp = failures.filter((f) => f.attempts >= MAX_ATTEMPTS);
      const line = (f: PublishFailure) =>
        `・${f.slug} / ${f.platform}（${f.attempts}/${MAX_ATTEMPTS}回目）: ${f.error}`;

      const body: string[] = [];
      if (willRetry.length > 0) {
        body.push("【次回の自動投稿で再試行します】", ...willRetry.map(line), "");
      }
      if (gaveUp.length > 0) {
        body.push(
          `【${MAX_ATTEMPTS}回失敗したため、自動再試行を止めました】`,
          ...gaveUp.map(line),
          "",
        );
      }
      body.push(
        willRetry.length > 0
          ? "再試行が済むまで、後続の投稿は先に進みません。"
          : "この投稿は飛ばして、後続の投稿へ進みます。",
        "管理画面の「広報 > 投稿」で、「キューに戻す」（再試行）か「見送る」（キューから外す）を選べます。",
      );

      await sendAdminAlert(`SNS自動投稿が失敗しました（${failures.length}件）`, body);
    }

    return new Response(JSON.stringify({ results }), { status: failures.length > 0 ? 207 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
