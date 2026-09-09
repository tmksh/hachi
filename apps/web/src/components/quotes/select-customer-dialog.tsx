"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fetchCustomers } from "@/lib/queries/customers";
import { CustomerAvatar } from "@/components/shared/customer-avatar";

type CustomerOption = { id: string; name: string };

interface SelectCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onSelect: (customerId: string) => void;
}

export function SelectCustomerDialog({
  open,
  onOpenChange,
  title = "見積を作成",
  description = "見積を作成する顧客を選んでください",
  onSelect,
}: SelectCustomerDialogProps) {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    setLoading(true);
    fetchCustomers({ page: 1, limit: 100 })
      .then(({ customers: rows }) => setCustomers(rows.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => setCustomers([]))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = customers.filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="px-5 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="顧客名で検索..."
              className="pl-9"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[360px] overflow-y-auto px-3 pb-3 space-y-1">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">読み込み中...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">該当する顧客がありません</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelect(c.id);
                  onOpenChange(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:border-border hover:bg-muted/40 transition-colors text-left"
              >
                <CustomerAvatar seed={c.id} name={c.name} size="sm" />
                <span className="font-medium truncate">{c.name}</span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
