"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client";

export interface ListSummary {
  id: number;
  name: string;
  leadCount?: number;
}

export function NewListDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (list: ListSummary) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { list } = await api<{ list: ListSummary }>("/api/lists", { method: "POST", json: { name } });
      onCreated(list);
      setName("");
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={create} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="font-heading">New list</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Austin dentists, Q4"
            className="h-10 text-base sm:text-sm"
            maxLength={80}
          />
          <DialogFooter>
            <Button type="submit" disabled={busy || !name.trim()} className="h-10">
              Create list
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
