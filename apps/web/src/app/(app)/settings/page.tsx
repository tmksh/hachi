"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Building2, Bell, Shield, Upload } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [notifications, setNotifications] = useState({
    email: true,
    workflow: true,
    construction: true,
    deal: false,
    calendar: true,
    report: false,
  });

  const [twoFa, setTwoFa] = useState(false);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="設定" description="アカウントとシステムの設定" />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="h-3.5 w-3.5" />
            プロフィール
          </TabsTrigger>
          <TabsTrigger value="company" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            会社情報
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            通知設定
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            セキュリティ
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">プロフィール設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.info("画像を選択してください")}>
                  画像を変更
                </Button>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lastName">姓</Label>
                  <Input id="lastName" defaultValue="田中" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">名</Label>
                  <Input id="firstName" defaultValue="太郎" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">メールアドレス</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue="tanaka@bridge-construction.co.jp"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">電話番号</Label>
                  <Input id="phone" defaultValue="090-1234-5678" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">部門</Label>
                  <Select defaultValue="sales">
                    <SelectTrigger id="department">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">営業部</SelectItem>
                      <SelectItem value="construction">工事部</SelectItem>
                      <SelectItem value="design">設計部</SelectItem>
                      <SelectItem value="admin">総務部</SelectItem>
                      <SelectItem value="accounting">経理部</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">役職</Label>
                  <Select defaultValue="manager">
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="executive">役員</SelectItem>
                      <SelectItem value="manager">部長</SelectItem>
                      <SelectItem value="chief">課長</SelectItem>
                      <SelectItem value="leader">主任</SelectItem>
                      <SelectItem value="staff">一般</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => toast.success("設定を保存しました")}>保存する</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Company Tab */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">会社情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="companyName">会社名</Label>
                  <Input
                    id="companyName"
                    defaultValue="株式会社ブリッジ建設"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">住所</Label>
                  <Input
                    id="address"
                    defaultValue="東京都渋谷区恵比寿1-2-3 ブリッジビル5F"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">電話番号</Label>
                  <Input id="companyPhone" defaultValue="03-1234-5678" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fax">FAX番号</Label>
                  <Input id="fax" defaultValue="03-1234-5679" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="website">Webサイト</Label>
                  <Input
                    id="website"
                    defaultValue="https://bridge-construction.co.jp"
                  />
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>会社ロゴ</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-accent/50 transition-colors cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    クリックまたはドラッグ&ドロップでアップロード
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG (最大2MB)
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => toast.success("設定を保存しました")}>保存する</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">通知設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                {
                  key: "email" as const,
                  label: "メール通知",
                  desc: "重要な更新をメールで受け取る",
                },
                {
                  key: "workflow" as const,
                  label: "ワークフロー通知",
                  desc: "承認依頼や申請の更新を通知",
                },
                {
                  key: "construction" as const,
                  label: "工事進捗通知",
                  desc: "担当工事の進捗変更を通知",
                },
                {
                  key: "deal" as const,
                  label: "商談通知",
                  desc: "商談のステータス変更を通知",
                },
                {
                  key: "calendar" as const,
                  label: "カレンダーリマインダー",
                  desc: "予定の15分前にリマインド",
                },
                {
                  key: "report" as const,
                  label: "レポート通知",
                  desc: "週次・月次レポートの配信",
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={notifications[item.key]}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({
                        ...prev,
                        [item.key]: checked,
                      }))
                    }
                  />
                </div>
              ))}
              <Separator />
              <div className="flex justify-end">
                <Button onClick={() => toast.success("設定を保存しました")}>保存する</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">パスワード変更</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">現在のパスワード</Label>
                  <Input id="currentPassword" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">新しいパスワード</Label>
                  <Input id="newPassword" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">
                    新しいパスワード（確認）
                  </Label>
                  <Input id="confirmPassword" type="password" />
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => toast.success("パスワードを変更しました")}>パスワードを変更</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">二要素認証（2FA）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">二要素認証を有効にする</p>
                    <p className="text-xs text-muted-foreground">
                      ログイン時に認証アプリのコードを要求します
                    </p>
                  </div>
                  <Switch checked={twoFa} onCheckedChange={setTwoFa} />
                </div>
                {twoFa && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      認証アプリ（Google Authenticator等）でQRコードをスキャンして設定してください。
                    </p>
                    <div className="mt-3 h-32 w-32 bg-white rounded-lg border flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">
                        QRコード
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
