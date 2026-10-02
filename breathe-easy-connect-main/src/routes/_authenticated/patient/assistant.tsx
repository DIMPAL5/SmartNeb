import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, MessageSquarePlus, Send, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import {
  askAssistantPersistent,
  deleteConversation,
  getConversation,
  listConversations,
} from "@/lib/assistant.functions";
import { DISCLAIMER } from "@/lib/assistant.constants";
import { PatientPage } from "@/components/smartneb/patient-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_authenticated/patient/assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant — SmartNeb" },
      {
        name: "description",
        content:
          "Ask questions about your therapy, adherence and vitals with an AI assistant scoped to your data.",
      },
      { property: "og:title", content: "AI Assistant — SmartNeb" },
      { property: "og:description", content: "Understand your therapy data in plain language." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

const SUGGESTION_KEYS = [
  "patient.assistant.suggestion1",
  "patient.assistant.suggestion2",
  "patient.assistant.suggestion3",
  "patient.assistant.suggestion4",
] as const;

type Msg = { role: "user" | "assistant"; content: string };

function RouteComponent() {
  const t = useT();
  return (
    <PatientPage title={t("nav.assistant")} subtitle={t("patient.assistant.subtitle")}>
      {({ patientId }) => <AssistantBody patientId={patientId} />}
    </PatientPage>
  );
}

function AssistantBody({ patientId }: { patientId: string }) {
  const t = useT();
  const GREETING: Msg = { role: "assistant", content: t("patient.assistant.greeting") };
  const SUGGESTIONS = SUGGESTION_KEYS.map((k) => t(k));
  const qc = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const conversations = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: () => listConversations(),
    retry: false,
  });

  const thread = useQuery({
    queryKey: ["ai-conversation", conversationId],
    queryFn: () => getConversation({ data: { conversationId: conversationId as string } }),
    enabled: Boolean(conversationId),
    retry: false,
  });

  const ask = useMutation({
    mutationFn: (question: string) =>
      askAssistantPersistent({
        data: {
          question,
          patientId,
          ...(conversationId ? { conversationId } : {}),
        },
      }),
    onSuccess: (res) => {
      setConversationId(res.conversationId);
      setPendingUser([]);
      void qc.invalidateQueries({ queryKey: ["ai-conversations"] });
      void qc.invalidateQueries({ queryKey: ["ai-conversation", res.conversationId] });
    },
    onError: (e: Error) => {
      setPendingUser([]);
      toast.error(e.message);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteConversation({ data: { conversationId: id } }),
    onSuccess: (_r, id) => {
      if (id === conversationId) setConversationId(null);
      void qc.invalidateQueries({ queryKey: ["ai-conversations"] });
      toast.success(t("patient.assistant.deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const messages: Msg[] = [
    ...(conversationId ? [] : [GREETING]),
    ...((thread.data ?? []).map((m) => ({ role: m.role, content: m.content })) as Msg[]),
    ...pendingUser,
  ];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, ask.isPending]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || ask.isPending) return;
    setPendingUser([{ role: "user", content: q }]);
    setInput("");
    ask.mutate(q);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="panel flex max-h-[70vh] flex-col p-3">
        <Button
          variant="outline"
          size="sm"
          className="mb-3 w-full"
          onClick={() => {
            setConversationId(null);
            setPendingUser([]);
          }}
        >
          <MessageSquarePlus className="mr-2 size-4" aria-hidden /> {t("patient.assistant.newConversation")}
        </Button>
        <ScrollArea className="min-h-0 flex-1">
          <ul className="space-y-1">
            {(conversations.data ?? []).length === 0 ? (
              <li className="px-2 py-3 text-xs text-muted-foreground">{t("patient.assistant.noConversations")}</li>
            ) : null}
            {(conversations.data ?? []).map((c) => (
              <li key={c.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setConversationId(c.id);
                    setPendingUser([]);
                  }}
                  className={`flex-1 truncate rounded-md px-2 py-2 text-left text-xs transition-colors ${
                    c.id === conversationId
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  {c.title}
                  <span className="block text-[10px] text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t("patient.assistant.deleteConversationAria", { title: c.title })}
                  onClick={() => remove.mutate(c.id)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </aside>

      <div className="panel flex h-[70vh] flex-col p-5">
        <div className="flex-1 space-y-4 overflow-y-auto pr-2">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-3"}>
              {m.role === "assistant" ? (
                <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Bot className="size-4" />
                </span>
              ) : null}
              <div
                className={
                  m.role === "user"
                    ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                    : "max-w-[80%] rounded-2xl rounded-bl-sm border bg-surface-2 px-4 py-2.5 text-sm whitespace-pre-wrap"
                }
              >
                {m.content}
              </div>
              {m.role === "user" ? (
                <span className="mt-1 ml-3 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <User className="size-4" />
                </span>
              ) : null}
            </div>
          ))}
          {ask.isPending ? (
            <p className="text-sm text-muted-foreground">{t("patient.assistant.thinking")}</p>
          ) : null}
          <div ref={endRef} />
        </div>

        <div className="mt-4 space-y-3 border-t pt-4">
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                onClick={() => send(s)}
                disabled={ask.isPending}
              >
                {s}
              </Button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("patient.assistant.inputPlaceholder")}
              aria-label={t("patient.assistant.inputAria")}
            />
            <Button type="submit" disabled={ask.isPending} aria-label={t("patient.assistant.sendAria")}>
              <Send className="size-4" />
            </Button>
          </form>
          <p className="text-[11px] text-muted-foreground">{DISCLAIMER}</p>
        </div>
      </div>
    </div>
  );
}
