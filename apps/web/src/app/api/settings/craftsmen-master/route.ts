import { NextRequest, NextResponse } from "next/server";
import {
  createCraftsmanMasterItem,
  deleteCraftsmanMasterItem,
  listCraftsmanMasterItems,
  type CraftsmanMasterKind,
} from "@/lib/craftsmen-master";

export const dynamic = "force-dynamic";

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

/** 職人マスタ（職種区分・資格）の CRUD — Server Action ハッシュ不一致 / throw 伏せを避ける */
export async function GET(request: NextRequest) {
  const kind = parseKind(request.nextUrl.searchParams.get("kind"));
  if (!kind) {
    const [specialties, qualifications] = await Promise.all([
      listCraftsmanMasterItems("specialties"),
      listCraftsmanMasterItems("qualifications"),
    ]);
    return noStoreJson({ ok: true, specialties, qualifications });
  }

  const items = await listCraftsmanMasterItems(kind);
  return noStoreJson({ ok: true, items });
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
    const status = /ログイン|プロフィール|権限|管理者/.test(result.error) ? 403 : 400;
    return noStoreJson({ ok: false, error: result.error }, { status });
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
    const status = /ログイン|プロフィール|権限|管理者/.test(result.error) ? 403 : 400;
    return noStoreJson({ ok: false, error: result.error }, { status });
  }

  return noStoreJson({ ok: true });
}
