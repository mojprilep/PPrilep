import { ANDROID_PACKAGE, ANDROID_SHA256_FINGERPRINTS } from "@/lib/config/appLinks";

// Android verifies `autoVerify` intent filters against this file. Which paths
// open the app is decided by the intent filters in the app, not here.
export const dynamic = "force-static";

export function GET() {
  const body = ANDROID_SHA256_FINGERPRINTS.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: ANDROID_PACKAGE,
            sha256_cert_fingerprints: ANDROID_SHA256_FINGERPRINTS,
          },
        },
      ]
    : [];

  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
