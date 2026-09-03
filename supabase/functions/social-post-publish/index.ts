import { createClient } from "jsr:@supabase/supabase-js@2";

const IG_BASE = "https://graph.instagram.com/v21.0";

type SocialPost = {
  id: string;
  slug: string;
  caption: string;
  image_urls: string[];
  status: string;
  attempts: number;
};

async function pollStatus(id: string, token: string, maxAttempts = 10, delayMs = 4000) {
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

async function publishCarousel(post: SocialPost, token: string, igUserId: string) {
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

  // 2. wait for children to finish processing
  for (const id of childIds) {
    await pollStatus(id, token);
  }

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
  await pollStatus(parentId, token);

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

    const igToken = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
    const igUserId = Deno.env.get("INSTAGRAM_USER_ID");
    if (!igToken || !igUserId) {
      return new Response(JSON.stringify({ error: "missing instagram credentials" }), { status: 500 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: claimed, error: claimError } = await supabase.rpc("claim_next_social_post");
    if (claimError) throw claimError;
    if (!claimed) {
      return new Response(JSON.stringify({ skipped: "no pending posts" }), { status: 200 });
    }

    const post = claimed as SocialPost;

    try {
      const { mediaId, permalink } = await publishCarousel(post, igToken, igUserId);
      await supabase
        .from("social_posts")
        .update({ status: "posted", ig_media_id: mediaId, permalink, posted_at: new Date().toISOString() })
        .eq("id", post.id);

      return new Response(JSON.stringify({ published: post.slug, mediaId, permalink }), { status: 200 });
    } catch (publishError) {
      const message = publishError instanceof Error ? publishError.message : String(publishError);
      await supabase
        .from("social_posts")
        .update({ status: "failed", error: message })
        .eq("id", post.id);

      return new Response(JSON.stringify({ error: message, slug: post.slug }), { status: 500 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
