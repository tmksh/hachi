import { NextRequest, NextResponse } from "next/server";
import {
  createCraftsmanMasterItem,
  deleteCraftsmanMasterItem,
  listCraftsmanMasterItems,
  type CraftsmanMasterKind,
} from "@/lib/craftsmen-master";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function parseKind(raw: string | null | undefined): CraftsmanMasterKind | null {
  if (raw === "specialties" || raw === "qualifications") return raw;
  return null;
}

function failStatus(error: string): number {
  return /ログイン|プロフィール|権限|管理者/.test(error) ? 403 : 400;
}

async function listOrFail(kind: CraftsmanMasterKind) {
  const result = await listCraftsmanMasterItems(kind);
  if ("error" in result) return { error: result.error };
  return { items: result.items };
}

/** 職人マスタ（職種区分・資格）の CRUD — Server Action ハッシュ不一致 / throw 伏せを避ける */
export async function GET(request: NextRequest) {
  const kind = parseKind(request.nextUrl.searchParams.get("kind"));
  if (!kind) {
    const [specialties, qualifications] = await Promise.all([
      listOrFail("specialties"),
      listOrFail("qualifications"),
    ]);
    if ("error" in specialties) {
      return noStoreJson({ ok: false, error: specialties.error }, { status: failStatus(specialties.error) });
    }
    if ("error" in qualifications) {
      return noStoreJson({ ok: false, error: qualifications.error }, { status: failStatus(qualifications.error) });
    }
    return noStoreJson({ ok: true, specialties: specialties.items, qualifications: qualifications.items });
  }

  const result = await listOrFail(kind);
  if ("error" in result) {
    return noStoreJson({ ok: false, error: result.error }, { status: failStatus(result.error) });
  }
  return noStoreJson({ ok: true, items: result.items });
}

export async function POST(request: NextRequest) {
  let body: { kind?: string; label?: string };
  try {
    body = await request.json();
  } catch {
    return noStoreJson({ ok: false, error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const kind = parseKind(body.kind);
  const label = body.label?.trim();
  if (!kind) {
    return noStoreJson({ ok: false, error: "種別（kind）が不正です" }, { status: 400 });
  }
  if (!label) {
    return noStoreJson({ ok: false, error: "名称を入力してください" }, { status: 400 });
  }

  const result = await createCraftsmanMasterItem(kind, label);
  if ("error" in result) {
    return noStoreJson({ ok: false, error: result.error }, { status: failStatus(result.error) });
  }

  return noStoreJson({ ok: true, item: result.item });
}

export async function DELETE(request: NextRequest) {
  const kind = parseKind(request.nextUrl.searchParams.get("kind"));
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!kind) {
    return noStoreJson({ ok: false, error: "種別（kind）が不正です" }, { status: 400 });
  }
  if (!id) {
    return noStoreJson({ ok: false, error: "削除対象が指定されていません" }, { status: 400 });
  }

  const result = await deleteCraftsmanMasterItem(kind, id);
  if ("error" in result) {
    return noStoreJson({ ok: false, error: result.error }, { status: failStatus(result.error) });
  }

  return noStoreJson({ ok: true });
}
