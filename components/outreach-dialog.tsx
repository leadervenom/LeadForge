"use client";

import { useState } from "react";
import { CopyIcon, MailIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, loadSender, saveSender, type Sender } from "@/lib/client";
import type { Business, Signals } from "@/lib/types";

export interface OutreachTarget {
  business: Business;
  signals?: Signals | null;
  leadId?: number;
  /** A previously saved draft ("Subject: …\n\nbody"). */
  existing?: string | null;
}

function splitDraft(draft: string) {
  const m = draft.match(/^Subject:\s*(.+)\n+([\s\S]*)$/);
  return m ? { subject: m[1], body: m[2] } : { subject: "", body: draft };
}

export function OutreachDialog({
  target,
  onClose,
  onSaved,
}: {
  target: OutreachTarget | null;
  onClose: () => void;
  onSaved?: (draft: string) => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        {target && (
          <OutreachForm key={target.leadId ?? target.business.osmId} target={target} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function OutreachForm({ target, onSaved }: { target: OutreachTarget; onSaved?: (draft: string) => void }) {
  const initial = target.existing ? splitDraft(target.existing) : { subject: "", body: "" };
  const [sender, setSender] = useState<Sender>(loadSender);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"ai" | "template" | null>(null);

  async function generate() {
    setLoading(true);
    saveSender(sender);
    try {
      const res = await api<{ subject: string; body: string; source: "ai" | "template" }>("/api/outreach", {
        method: "POST",
        json: {
          business: target.business,
          signals: target.signals ?? null,
          leadId: target.leadId,
          sender,
        },
      });
      setSubject(res.subject);
      setBody(res.body);
      setSource(res.source);
      onSaved?.(`Subject: ${res.subject}\n\n${res.body}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const email = target.business.email ?? target.signals?.emails[0] ?? null;
  const mailto = email
    ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : null;

  return (
    <>
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">First email to {target.business.name}</DialogTitle>
          <DialogDescription>
            Written from what we found on their site. Edit it before you send it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Your name
            <Input
              value={sender.name}
              onChange={(e) => setSender({ ...sender, name: e.target.value })}
              placeholder="Sam at Northside Web"
              className="h-10 text-base sm:text-sm"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            What you offer
            <Input
              value={sender.offer}
              onChange={(e) => setSender({ ...sender, offer: e.target.value })}
              placeholder="Websites and local SEO"
              className="h-10 text-base sm:text-sm"
            />
          </label>
        </div>

        {body || loading ? (
          <div className="grid gap-2">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              aria-label="Subject"
              className="h-10 font-medium"
              disabled={loading}
            />
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              aria-label="Email body"
              rows={10}
              className="min-h-56 text-base leading-relaxed sm:text-sm"
              disabled={loading}
              placeholder={loading ? "Drafting…" : ""}
            />
            {source === "template" && (
              <p className="text-xs text-muted-foreground">
                AI drafting is unavailable right now, so this is a template built from the site findings.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Fill in your name and offer, then draft. It takes about five seconds.
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button onClick={generate} disabled={loading} className="h-10 gap-2">
            {body ? <RefreshCwIcon className={loading ? "animate-spin" : ""} /> : <SparklesIcon />}
            {loading ? "Drafting…" : body ? "Redraft" : "Draft email"}
          </Button>
          {body && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-10 gap-2"
                onClick={() => {
                  navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
                  toast.success("Copied to clipboard");
                }}
              >
                <CopyIcon /> Copy
              </Button>
              {mailto && (
                <a
                  href={mailto}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-accent"
                >
                  <MailIcon className="size-4" /> Open in mail
                </a>
              )}
            </div>
          )}
        </DialogFooter>
    </>
  );
}
