"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  Phone,
  Mail,
  Building2,
  User,
  Calendar,
} from "lucide-react";

type CustomerType = "corporation" | "individual";

interface Customer {
  id: string;
  name: string;
  company: string;
  type: CustomerType;
  phone: string;
  email: string;
  lastContact: string;
  status: string;
  address: string;
}

const customers: Customer[] = [
  {
    id: "1",
    name: "田中 太郎",
    company: "田中建設株式会社",
    type: "corporation",
    phone: "03-1234-5678",
    email: "tanaka@tanaken.co.jp",
    lastContact: "2026-03-03",
    status: "active",
    address: "東京都新宿区西新宿1-1-1",
  },
  {
    id: "2",
    name: "鈴木 花子",
    company: "鈴木工務店",
    type: "corporation",
    phone: "045-987-6543",
    email: "suzuki@suzuki-koumuten.jp",
    lastContact: "2026-03-01",
    status: "active",
    address: "神奈川県横浜市中区本町2-2-2",
  },
  {
    id: "3",
    name: "佐藤 一郎",
    company: "",
    type: "individual",
    phone: "090-1111-2222",
    email: "sato.ichiro@gmail.com",
    lastContact: "2026-02-25",
    status: "active",
    address: "千葉県千葉市美浜区幕張3-3-3",
  },
  {
    id: "4",
    name: "山田 美咲",
    company: "株式会社山田ハウス",
    type: "corporation",
    phone: "06-5555-4444",
    email: "yamada@yamada-house.co.jp",
    lastContact: "2026-02-20",
    status: "completed",
    address: "大阪府大阪市北区梅田4-4-4",
  },
  {
    id: "5",
    name: "高橋 健二",
    company: "",
    type: "individual",
    phone: "080-3333-7777",
    email: "takahashi.k@yahoo.co.jp",
    lastContact: "2026-02-18",
    status: "pending",
    address: "埼玉県さいたま市大宮区桜木町5-5-5",
  },
  {
    id: "6",
    name: "渡辺 裕子",
    company: "渡辺リフォーム株式会社",
    type: "corporation",
    phone: "052-8888-9999",
    email: "watanabe@w-reform.co.jp",
    lastContact: "2026-03-04",
    status: "active",
    address: "愛知県名古屋市中村区名駅6-6-6",
  },
  {
    id: "7",
    name: "伊藤 大輔",
    company: "伊藤設計事務所",
    type: "corporation",
    phone: "011-2222-3333",
    email: "ito@ito-sekkei.jp",
    lastContact: "2026-02-10",
    status: "suspended",
    address: "北海道札幌市中央区北一条7-7-7",
  },
  {
    id: "8",
    name: "小林 さくら",
    company: "",
    type: "individual",
    phone: "070-4444-5555",
    email: "kobayashi.s@icloud.com",
    lastContact: "2026-03-02",
    status: "active",
    address: "福岡県福岡市博多区博多駅前8-8-8",
  },
  {
    id: "9",
    name: "加藤 誠",
    company: "加藤総合建設株式会社",
    type: "corporation",
    phone: "078-6666-7777",
    email: "kato@kato-kensetsu.co.jp",
    lastContact: "2026-01-28",
    status: "completed",
    address: "兵庫県神戸市中央区三宮町9-9-9",
  },
  {
    id: "10",
    name: "中村 優希",
    company: "",
    type: "individual",
    phone: "090-8888-0000",
    email: "nakamura.y@outlook.jp",
    lastContact: "2026-02-28",
    status: "pending",
    address: "京都府京都市下京区四条通10-10-10",
  },
];

export default function CrmListPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "corporation" | "individual">("all");

  const filtered = customers.filter((c) => {
    const matchesSearch =
      !searchQuery ||
      c.name.includes(searchQuery) ||
      c.company.includes(searchQuery) ||
      c.email.includes(searchQuery);
    const matchesFilter =
      filter === "all" || c.type === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="顧客管理" description="顧客情報の一覧と管理">
        <Link href="/crm/new">
          <Button size="sm">
            <Plus className="size-4 mr-1" />
            新規顧客
          </Button>
        </Link>
      </PageHeader>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="顧客名、会社名、メールアドレスで検索..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            すべて
          </Button>
          <Button
            variant={filter === "corporation" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("corporation")}
          >
            <Building2 className="size-4 mr-1" />
            法人
          </Button>
          <Button
            variant={filter === "individual" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("individual")}
          >
            <User className="size-4 mr-1" />
            個人
          </Button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {filtered.length}件の顧客
      </p>

      {/* Customer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((customer) => (
          <Link key={customer.id} href={`/crm/${customer.id}`}>
            <Card className="transition-[box-shadow] duration-200 cursor-pointer">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-base">{customer.name}</h3>
                    {customer.company && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Building2 className="size-3.5" />
                        {customer.company}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {customer.type === "corporation" ? "法人" : "個人"}
                    </Badge>
                    <StatusBadge status={customer.status} />
                  </div>
                </div>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Phone className="size-3.5" />
                    <span>{customer.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="size-3.5" />
                    <span>{customer.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="size-3.5" />
                    <span>最終連絡: {customer.lastContact}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
