"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Upload,
  Send,
  Eye,
  X,
  FileText,
  Users,
  User,
} from "lucide-react";

const departments = [
  { id: "general", name: "総務部", members: ["山田花子", "小林直樹"] },
  { id: "engineering", name: "工事部", members: ["田中太郎", "佐藤一郎", "中村誠"] },
  { id: "sales", name: "営業部", members: ["鈴木花子", "加藤恵"] },
  { id: "accounting", name: "経理部", members: ["高橋美咲"] },
  { id: "hr", name: "人事部", members: ["伊藤大輔"] },
  { id: "it", name: "情報システム部", members: ["渡辺裕子"] },
];

export default function CirculationNewPage() {
  const router = useRouter();
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);

  const toggleDept = (deptId: string) => {
    const dept = departments.find((d) => d.id === deptId);
    if (!dept) return;

    if (selectedDepts.includes(deptId)) {
      setSelectedDepts(selectedDepts.filter((id) => id !== deptId));
      setSelectedMembers(selectedMembers.filter((m) => !dept.members.includes(m)));
    } else {
      setSelectedDepts([...selectedDepts, deptId]);
      const newMembers = dept.members.filter((m) => !selectedMembers.includes(m));
      setSelectedMembers([...selectedMembers, ...newMembers]);
    }
  };

  const toggleMember = (member: string) => {
    if (selectedMembers.includes(member)) {
      setSelectedMembers(selectedMembers.filter((m) => m !== member));
    } else {
      setSelectedMembers([...selectedMembers, member]);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/circulation">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            戻る
          </Button>
        </Link>
      </div>

      <PageHeader title="回覧作成" description="新しい回覧を作成します" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">回覧内容</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">タイトル <span className="text-red-500">*</span></Label>
                <Input id="title" placeholder="回覧のタイトルを入力" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">カテゴリ <span className="text-red-500">*</span></Label>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="カテゴリを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="notice">お知らせ</SelectItem>
                    <SelectItem value="report">報告</SelectItem>
                    <SelectItem value="request">依頼</SelectItem>
                    <SelectItem value="share">共有</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">本文 <span className="text-red-500">*</span></Label>
                <Textarea
                  id="content"
                  placeholder="回覧の本文を入力してください"
                  rows={12}
                />
              </div>
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                添付ファイル
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attachments.length > 0 && (
                <div className="space-y-2 mb-4">
                  {attachments.map((name, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-accent/50 transition-colors cursor-pointer">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  クリックまたはドラッグ&ドロップでファイルを追加
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, Excel, Word, 画像ファイル (最大10MB)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pb-6">
            <Link href="/circulation">
              <Button variant="outline">キャンセル</Button>
            </Link>
            <Button variant="outline" className="gap-1.5" onClick={() => { toast.info("プレビューを表示しました"); }}>
              <Eye className="h-4 w-4" />
              プレビュー
            </Button>
            <Button className="gap-1.5" onClick={() => { toast.success("回覧を送信しました"); router.push("/circulation"); }}>
              <Send className="h-4 w-4" />
              送信する
            </Button>
          </div>
        </div>

        {/* Sidebar - Recipients */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                送信先
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {selectedMembers.length}名 選択中
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {departments.map((dept) => (
                <div key={dept.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox
                      id={`dept-${dept.id}`}
                      checked={selectedDepts.includes(dept.id)}
                      onCheckedChange={() => toggleDept(dept.id)}
                    />
                    <label
                      htmlFor={`dept-${dept.id}`}
                      className="text-sm font-medium cursor-pointer flex items-center gap-1.5"
                    >
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {dept.name}
                      <span className="text-xs text-muted-foreground">({dept.members.length})</span>
                    </label>
                  </div>
                  <div className="ml-6 space-y-1.5">
                    {dept.members.map((member) => (
                      <div key={member} className="flex items-center gap-2">
                        <Checkbox
                          id={`member-${member}`}
                          checked={selectedMembers.includes(member)}
                          onCheckedChange={() => toggleMember(member)}
                        />
                        <label
                          htmlFor={`member-${member}`}
                          className="text-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <User className="h-3 w-3 text-muted-foreground" />
                          {member}
                        </label>
                      </div>
                    ))}
                  </div>
                  <Separator className="mt-3" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
