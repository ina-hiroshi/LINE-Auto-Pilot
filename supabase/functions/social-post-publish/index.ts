import { createClient } from "jsr:@supabase/supabase-js@2";

const IG_BASE = "https://graph.instagram.com/v21.0";
const FB_BASE = "https://graph.facebook.com/v21.0";

type SocialPost = {
  id: string;
  slug: string;
  platform: "instagram" | "facebook";
  caption: string;
  image_urls: string[];
  status: string;
  attempts: number;
};

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

async function publishInstagramCarousel(post: SocialPost, token: string, igUserId: string) {
  // 1. create child containers
  const childIds: string[] = [];
  for (const imageUrl of post.image_urls) {
    const params = new URLSearchParams({
      image_url: imageUrl,
      is_carousel_item: "true",
      access_token: token,
    });
    const res = await fetch(`${IG_BASE}/${igUserId}/media`, { method: "POST", body: params });
    const json = await res.json();
    if (!json.id) throw new Error(`Failed to create child for ${imageUrl}: ${JSON.stringify(json)}`);
    childIds.push(json.id);
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

async function publishOne(post: SocialPost, env: Record<string, string | undefined>) {
  if (post.platform === "instagram") {
    const igToken = env.INSTAGRAM_ACCESS_TOKEN;
    const igUserId = env.INSTAGRAM_USER_ID;
    if (!igToken || !igUserId) throw new Error("missing instagram credentials");
    return await publishInstagramCarousel(post, igToken, igUserId);
  }

  if (post.platform === "facebook") {
    const fbToken = env.FACEBOOK_ACCESS_TOKEN;
    const fbPageId = env.FACEBOOK_PAGE_ID;
    if (!fbToken || !fbPageId) throw new Error("missing facebook credentials");
    return await publishFacebookPost(post, fbToken, fbPageId);
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

    if (Deno.env.get("SOCIAL_AUTOPOST_ENABLED") === "false") {
      return new Response(JSON.stringify({ skipped: "autopost disabled" }), { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: claimed, error: claimError } = await supabase.rpc("claim_next_social_post_batch");
    if (claimError) throw claimError;
    const posts = (claimed ?? []) as SocialPost[];
    if (posts.length === 0) {
      return new Response(JSON.stringify({ skipped: "no pending posts" }), { status: 200 });
    }

    const env = {
      INSTAGRAM_ACCESS_TOKEN: Deno.env.get("INSTAGRAM_ACCESS_TOKEN"),
      INSTAGRAM_USER_ID: Deno.env.get("INSTAGRAM_USER_ID"),
      FACEBOOK_ACCESS_TOKEN: Deno.env.get("FACEBOOK_ACCESS_TOKEN"),
      FACEBOOK_PAGE_ID: Deno.env.get("FACEBOOK_PAGE_ID"),
    };

    // Instagram and Facebook are independent APIs, so publish them concurrently:
    // sequentially, the slowest carousel plus the slowest feed post can exceed
    // the function's wall-clock limit and strand both rows in 'publishing'.
    const results = await Promise.all(posts.map(async (post) => {
      try {
        const { mediaId, permalink } = await publishOne(post, env);
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
        return { platform: post.platform, error: message, slug: post.slug };
      }
    }));

    const hasError = results.some((r) => "error" in r);
    return new Response(JSON.stringify({ results }), { status: hasError ? 207 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
