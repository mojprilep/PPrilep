import {
  APPLE_TEAM_ID,
  APP_LINK_EXCLUDE,
  APP_LINK_PATHS,
  IOS_BUNDLE_ID,
} from "@/lib/config/appLinks";

// Apple fetches this (via its CDN) when the app is installed/updated to decide
// which links open the app. Must be JSON, no redirect, no file extension.
export const dynamic = "force-static";

export function GET() {
  // Without a Team ID the file would be invalid — 404 is the honest answer.
  if (!APPLE_TEAM_ID) return new Response("Not found", { status: 404 });

  const body = {
    applinks: {
      details: [
        {
          appIDs: [`${APPLE_TEAM_ID}.${IOS_BUNDLE_ID}`],
          components: [
            ...APP_LINK_EXCLUDE.map((p) => ({ "/": p, exclude: true })),
            ...APP_LINK_PATHS.map((p) => ({ "/": p })),
          ],
        },
      ],
    },
  };

  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
