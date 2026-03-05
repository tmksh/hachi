"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import {
  Upload,
  Search,
  FolderOpen,
  Folder,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  LayoutGrid,
  List,
  Building2,
  Briefcase,
  HardHat,
  Users,
  FileStack,
  Download,
  MoreHorizontal,
  ChevronRight,
} from "lucide-react";

interface FolderItem {
  id: string;
  name: string;
  icon: React.ElementType;
  count: number;
}

interface DocumentFile {
  id: string;
  name: string;
  type: "pdf" | "excel" | "word" | "image" | "other";
  size: string;
  updatedAt: string;
  owner: string;
  folder: string;
}

const FOLDERS: FolderItem[] = [
  { id: "all", name: "全社", icon: Building2, count: 15 },
  { id: "sales", name: "営業部", icon: Briefcase, count: 5 },
  { id: "construction", name: "工事部", icon: HardHat, count: 4 },
  { id: "general", name: "総務部", icon: Users, count: 3 },
  { id: "templates", name: "テンプレート", icon: FileStack, count: 5 },
];

const FILE_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  pdf: { icon: FileText, color: "text-red-500" },
  excel: { icon: FileSpreadsheet, color: "text-green-600" },
  word: { icon: FileText, color: "text-blue-600" },
  image: { icon: FileImage, color: "text-purple-500" },
  other: { icon: File, color: "text-muted-foreground" },
};

const MOCK_FILES: DocumentFile[] = [
  {
    id: "1",
    name: "見積書テンプレート.xlsx",
    type: "excel",
    size: "245 KB",
    updatedAt: "2026-03-04",
    owner: "鈴木花子",
    folder: "templates",
  },
  {
    id: "2",
    name: "工事報告書.pdf",
    type: "pdf",
    size: "1.2 MB",
    updatedAt: "2026-03-05",
    owner: "田中太郎",
    folder: "construction",
  },
  {
    id: "3",
    name: "契約書ひな形.docx",
    type: "word",
    size: "89 KB",
    updatedAt: "2026-02-28",
    owner: "山本裕子",
    folder: "templates",
  },
  {
    id: "4",
    name: "現場写真_山田邸_外観.jpg",
    type: "image",
    size: "3.4 MB",
    updatedAt: "2026-03-03",
    owner: "中村健太",
    folder: "construction",
  },
  {
    id: "5",
    name: "売上実績_2026年2月.xlsx",
    type: "excel",
    size: "512 KB",
    updatedAt: "2026-03-01",
    owner: "佐藤一郎",
    folder: "sales",
  },
  {
    id: "6",
    name: "安全衛生管理計画書.pdf",
    type: "pdf",
    size: "890 KB",
    updatedAt: "2026-02-25",
    owner: "高橋誠",
    folder: "construction",
  },
  {
    id: "7",
    name: "就業規則_改定版.pdf",
    type: "pdf",
    size: "456 KB",
    updatedAt: "2026-02-20",
    owner: "渡辺美咲",
    folder: "general",
  },
  {
    id: "8",
    name: "顧客リスト_2026.xlsx",
    type: "excel",
    size: "1.8 MB",
    updatedAt: "2026-03-02",
    owner: "鈴木花子",
    folder: "sales",
  },
  {
    id: "9",
    name: "請求書テンプレート.xlsx",
    type: "excel",
    size: "198 KB",
    updatedAt: "2026-01-15",
    owner: "山本裕子",
    folder: "templates",
  },
  {
    id: "10",
    name: "工事完了報告書テンプレート.docx",
    type: "word",
    size: "125 KB",
    updatedAt: "2026-01-20",
    owner: "田中太郎",
    folder: "templates",
  },
  {
    id: "11",
    name: "田中ビル_設計図面.pdf",
    type: "pdf",
    size: "5.6 MB",
    updatedAt: "2026-03-04",
    owner: "中村健太",
    folder: "construction",
  },
  {
    id: "12",
    name: "商談議事録_高橋商事.docx",
    type: "word",
    size: "67 KB",
    updatedAt: "2026-03-05",
    owner: "佐藤一郎",
    folder: "sales",
  },
  {
    id: "13",
    name: "給与明細一覧_2月.xlsx",
    type: "excel",
    size: "340 KB",
    updatedAt: "2026-02-28",
    owner: "渡辺美咲",
    folder: "general",
  },
  {
    id: "14",
    name: "現場写真_田中ビル_配管.jpg",
    type: "image",
    size: "2.8 MB",
    updatedAt: "2026-03-01",
    owner: "中村健太",
    folder: "construction",
  },
  {
    id: "15",
    name: "営業報告書テンプレート.docx",
    type: "word",
    size: "95 KB",
    updatedAt: "2026-02-10",
    owner: "鈴木花子",
    folder: "templates",
  },
  {
    id: "16",
    name: "社内規定集.pdf",
    type: "pdf",
    size: "2.1 MB",
    updatedAt: "2026-01-05",
    owner: "山本裕子",
    folder: "general",
  },
  {
    id: "17",
    name: "提案書_鈴木様邸リフォーム.pdf",
    type: "pdf",
    size: "4.2 MB",
    updatedAt: "2026-03-03",
    owner: "佐藤一郎",
    folder: "sales",
  },
  {
    id: "18",
    name: "会社案内パンフレット.pdf",
    type: "pdf",
    size: "8.5 MB",
    updatedAt: "2026-02-15",
    owner: "渡辺美咲",
    folder: "all",
  },
];

export default function DocumentsPage() {
  const [activeFolder, setActiveFolder] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");

  const currentFolder = FOLDERS.find((f) => f.id === activeFolder)!;

  const filteredFiles = MOCK_FILES.filter((file) => {
    const matchesFolder =
      activeFolder === "all" || file.folder === activeFolder;
    const matchesSearch =
      searchQuery === "" ||
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.owner.includes(searchQuery);
    return matchesFolder && matchesSearch;
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="文書管理" description="ファイル・ドキュメント管理">
        <Button className="gap-2" onClick={() => toast.success("ファイルをアップロードしました")}>
          <Upload className="h-4 w-4" />
          アップロード
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
        {/* Folder Sidebar */}
        <Card className="h-fit">
          <CardContent className="p-2">
            <nav className="space-y-0.5">
              {FOLDERS.map((folder) => {
                const Icon = folder.icon;
                const isActive = activeFolder === folder.id;
                return (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setActiveFolder(folder.id);
                      setSearchQuery("");
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? "bg-accent font-medium"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    {isActive ? (
                      <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="flex-1 text-left">{folder.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {folder.count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="space-y-4">
          {/* Breadcrumb + Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveFolder("all");
                    }}
                  >
                    文書管理
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {activeFolder !== "all" && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{currentFolder.name}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-[260px]">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="ファイルを検索..."
                  className="pl-8 h-9 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-9 w-9 rounded-r-none"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-9 w-9 rounded-l-none"
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Files */}
          <Card>
            {filteredFiles.length === 0 ? (
              <div className="flex items-center justify-center h-40">
                <p className="text-sm text-muted-foreground">
                  ファイルが見つかりません
                </p>
              </div>
            ) : viewMode === "list" ? (
              /* List View */
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[300px]">ファイル名</TableHead>
                      <TableHead className="w-[100px]">サイズ</TableHead>
                      <TableHead className="w-[120px]">更新日</TableHead>
                      <TableHead className="w-[100px]">所有者</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFiles.map((file) => {
                      const fileConfig = FILE_ICONS[file.type];
                      const Icon = fileConfig.icon;
                      return (
                        <TableRow
                          key={file.id}
                          className="cursor-pointer hover:bg-accent/50"
                          onClick={() =>
                            toast.success(`${file.name}を開きました`, {
                              description: `${file.size} - ${file.owner} - ${file.updatedAt}`,
                            })
                          }
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Icon
                                className={`h-5 w-5 shrink-0 ${fileConfig.color}`}
                              />
                              <span className="text-sm font-medium truncate">
                                {file.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {file.size}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {file.updatedAt}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {file.owner}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                toast.success("ダウンロードを開始しました", {
                                  description: file.name,
                                });
                              }}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              /* Grid View */
              <CardContent className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {filteredFiles.map((file) => {
                    const fileConfig = FILE_ICONS[file.type];
                    const Icon = fileConfig.icon;
                    return (
                      <div
                        key={file.id}
                        className="group flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-accent/50 hover:shadow-sm transition-all cursor-pointer"
                        onClick={() =>
                          toast.success(`${file.name}を開きました`, {
                            description: `${file.size} - ${file.owner} - ${file.updatedAt}`,
                          })
                        }
                      >
                        <div className="relative">
                          <Icon
                            className={`h-10 w-10 ${fileConfig.color}`}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute -top-2 -right-3 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="text-center w-full">
                          <p className="text-xs font-medium truncate">
                            {file.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {file.size} - {file.updatedAt}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>

          {/* File count summary */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {filteredFiles.length}件のファイル
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
