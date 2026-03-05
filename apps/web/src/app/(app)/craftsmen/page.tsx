"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { Search, Plus, Star, Phone, MapPin } from "lucide-react";

const specialties = [
  { value: "all", label: "すべて" },
  { value: "大工", label: "大工" },
  { value: "左官", label: "左官" },
  { value: "電気", label: "電気" },
  { value: "設備", label: "設備" },
  { value: "塗装", label: "塗装" },
  { value: "内装", label: "内装" },
  { value: "板金", label: "板金" },
  { value: "防水", label: "防水" },
];

const craftsmen = [
  {
    id: "W-001",
    name: "木村正男",
    specialty: "大工",
    rating: 4.8,
    experience: 25,
    phone: "090-1234-5678",
    area: "東京都・神奈川県",
    availability: "available",
    projects: 156,
  },
  {
    id: "W-002",
    name: "斎藤幸雄",
    specialty: "左官",
    rating: 4.6,
    experience: 20,
    phone: "090-2345-6789",
    area: "東京都・埼玉県",
    availability: "busy",
    projects: 98,
  },
  {
    id: "W-003",
    name: "中島健二",
    specialty: "電気",
    rating: 4.9,
    experience: 18,
    phone: "090-3456-7890",
    area: "東京都",
    availability: "available",
    projects: 134,
  },
  {
    id: "W-004",
    name: "小林達也",
    specialty: "設備",
    rating: 4.5,
    experience: 15,
    phone: "090-4567-8901",
    area: "東京都・千葉県",
    availability: "busy",
    projects: 87,
  },
  {
    id: "W-005",
    name: "高田誠一",
    specialty: "塗装",
    rating: 4.7,
    experience: 22,
    phone: "090-5678-9012",
    area: "東京都・神奈川県",
    availability: "available",
    projects: 112,
  },
  {
    id: "W-006",
    name: "渡辺修",
    specialty: "内装",
    rating: 4.4,
    experience: 12,
    phone: "090-6789-0123",
    area: "東京都",
    availability: "unavailable",
    projects: 64,
  },
  {
    id: "W-007",
    name: "佐々木勇",
    specialty: "大工",
    rating: 4.3,
    experience: 10,
    phone: "090-7890-1234",
    area: "埼玉県・千葉県",
    availability: "available",
    projects: 45,
  },
  {
    id: "W-008",
    name: "松田光男",
    specialty: "板金",
    rating: 4.6,
    experience: 28,
    phone: "090-8901-2345",
    area: "東京都・神奈川県",
    availability: "busy",
    projects: 178,
  },
  {
    id: "W-009",
    name: "加藤裕介",
    specialty: "防水",
    rating: 4.5,
    experience: 16,
    phone: "090-9012-3456",
    area: "東京都・千葉県",
    availability: "available",
    projects: 92,
  },
  {
    id: "W-010",
    name: "山本和彦",
    specialty: "電気",
    rating: 4.2,
    experience: 8,
    phone: "090-0123-4567",
    area: "神奈川県",
    availability: "available",
    projects: 38,
  },
];

const availabilityMap: Record<string, { label: string; color: string }> = {
  available: { label: "対応可", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  busy: { label: "稼働中", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  unavailable: { label: "対応不可", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3.5 w-3.5 ${
            star <= Math.round(rating)
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground/30"
          }`}
        />
      ))}
      <span className="text-xs font-medium ml-1 tabular-nums">{rating}</span>
    </div>
  );
}

export default function CraftsmenListPage() {
  const [search, setSearch] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");

  const filtered = craftsmen.filter((c) => {
    const matchSearch =
      search === "" ||
      c.name.includes(search) ||
      c.specialty.includes(search) ||
      c.area.includes(search);
    const matchSpecialty =
      specialtyFilter === "all" || c.specialty === specialtyFilter;
    return matchSearch && matchSpecialty;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="職人管理" description="協力職人の情報とスケジュールを管理します">
        <Link href="/craftsmen/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            職人登録
          </Button>
        </Link>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="氏名、専門、エリアで検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="専門分野" />
          </SelectTrigger>
          <SelectContent>
            {specialties.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Craftsmen Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((c) => {
          const avail = availabilityMap[c.availability];
          return (
            <Link key={c.id} href={`/craftsmen/${c.id}`}>
              <Card className="transition-[box-shadow] duration-200 cursor-pointer h-full">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-base font-semibold text-primary">
                        {c.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{c.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-xs">
                          {c.specialty}
                        </Badge>
                        <Badge className={`text-xs border-0 ${avail.color}`}>
                          {avail.label}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <StarRating rating={c.rating} />

                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" />
                      <span>{c.area}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3" />
                      <span>{c.phone}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t flex justify-between text-xs text-muted-foreground">
                    <span>経験 {c.experience}年</span>
                    <span>実績 {c.projects}件</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          該当する職人が見つかりません
        </div>
      )}
    </div>
  );
}
