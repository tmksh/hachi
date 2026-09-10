export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Netlify のコールドスタート対策用。認証なし・キャッシュなし。 */
export async function GET() {
  return new Response("ok", {
    headers: { "cache-control": "no-store" },
  });
}
