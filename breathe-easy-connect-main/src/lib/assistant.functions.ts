import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { DISCLAIMER, MAX_PER_HOUR } from "./assistant.constants";

/**
 * Persistent, RBAC-scoped AI assistant.
 * - Conversations and messages persist in ai_conversations / ai_messages (RLS: owner only).
 * - Patient context is only injected after can_view_patient() authorises the caller.
 * - Rate limited per user: MAX_PER_HOUR assistant turns.
 * - The model is read-only: it can never write to clinical tables.
 */


export type AiMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: string };
export type AiConversation = { id: string; title: string; createdAt: string };

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiConversation[]> => {
    const { data } = await context.supabase
      .from("ai_conversations")
      .select("id, title, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(40);
    return (data ?? []).map((c: any) => ({ id: c.id, title: c.title, createdAt: c.created_at }));
  });

export const getConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversationId: string }) =>
    z.object({ conversationId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<AiMessage[]> => {
    const { data: convo } = await context.supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", data.conversationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!convo) throw new Error("Conversation not found.");
    const { data: rows } = await context.supabase
      .from("ai_messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    return (rows ?? []).map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
    }));
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversationId: string }) =>
    z.object({ conversationId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("ai_conversations")
      .delete()
      .eq("id", data.conversationId)
      .eq("user_id", context.userId);
    return { ok: true };
  });

async function buildScope(supabase: any, patientId: string) {
  const [patient, health, plan, adherence, alerts, sessions, battery, env] = await Promise.all([
    supabase
      .from("patients")
      .select("full_name, condition, spo2_threshold, bpm_high_threshold, temp_threshold")
      .eq("id", patientId)
      .maybeSingle(),
    supabase
      .from("health_telemetry")
      .select("bpm, spo2, body_temperature, recorded_at")
      .eq("patient_id", patientId)
      .order("recorded_at", { ascending: false })
      .limit(40),
    supabase
      .from("care_plans")
      .select("medication, dosage, duration_minutes, frequency_per_day, time_slots, instructions, status")
      .eq("patient_id", patientId)
      .eq("status", "published")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("adherence_records")
      .select("scheduled_for, status")
      .eq("patient_id", patientId)
      .order("scheduled_for", { ascending: false })
      .limit(30),
    supabase
      .from("alerts")
      .select("type, severity, message, status, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("nebulization_sessions")
      .select("started_at, status, elapsed_seconds, prescribed_seconds, medication")
      .eq("patient_id", patientId)
      .order("started_at", { ascending: false })
      .limit(10),
    supabase
      .from("battery_telemetry")
      .select("percentage, voltage, cell_temperature, recorded_at")
      .eq("patient_id", patientId)
      .order("recorded_at", { ascending: false })
      .limit(5),
    supabase
      .from("environmental_telemetry")
      .select("ambient_temperature, humidity, aqi, recorded_at")
      .eq("patient_id", patientId)
      .order("recorded_at", { ascending: false })
      .limit(5),
  ]);

  return JSON.stringify({
    patient: patient.data,
    recentVitals: health.data,
    carePlan: plan.data,
    adherence: adherence.data,
    alerts: alerts.data,
    sessions: sessions.data,
    battery: battery.data,
    environment: env.data,
  });
}

export const askAssistantPersistent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { question: string; patientId?: string; conversationId?: string }) =>
    z
      .object({
        question: z.string().trim().min(2).max(600),
        patientId: z.string().uuid().optional(),
        conversationId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ conversationId: string; answer: string; disclaimer: string }> => {
      const { supabase, userId } = context;

      // ---- rate limiting -------------------------------------------------
      const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
      const { data: convoIds } = await supabase
        .from("ai_conversations")
        .select("id")
        .eq("user_id", userId);
      const ids = (convoIds ?? []).map((c: any) => c.id);
      if (ids.length) {
        const { count } = await supabase
          .from("ai_messages")
          .select("id", { count: "exact", head: true })
          .in("conversation_id", ids)
          .eq("role", "user")
          .gte("created_at", hourAgo);
        if ((count ?? 0) >= MAX_PER_HOUR) {
          throw new Error(
            `Assistant rate limit reached (${MAX_PER_HOUR} questions per hour). Please try again later.`,
          );
        }
      }

      // ---- authorisation + context --------------------------------------
      let scope = "No patient record is linked to this account yet.";
      if (data.patientId) {
        const { data: allowed } = await supabase.rpc("can_view_patient", {
          _patient_id: data.patientId,
        });
        if (!allowed) throw new Error("You are not authorized to ask about this patient.");
        scope = await buildScope(supabase, data.patientId);
        await supabase.from("audit_logs").insert({
          actor_id: userId,
          action: "ai.patient_context_access",
          target_type: "patient",
          target_id: data.patientId,
          meta: { surface: "assistant" },
        });
      }

      // ---- conversation --------------------------------------------------
      let conversationId = data.conversationId ?? null;
      if (conversationId) {
        const { data: owned } = await supabase
          .from("ai_conversations")
          .select("id")
          .eq("id", conversationId)
          .eq("user_id", userId)
          .maybeSingle();
        if (!owned) throw new Error("Conversation not found.");
      } else {
        const { data: created, error } = await supabase
          .from("ai_conversations")
          .insert({
            user_id: userId,
            title: data.question.slice(0, 60),
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        conversationId = created.id as string;
      }

      const { data: history } = await supabase
        .from("ai_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(20);

      await supabase
        .from("ai_messages")
        .insert({ conversation_id: conversationId, role: "user", content: data.question });

      // ---- model call ----------------------------------------------------
      const apiKey = process.env["LOVABLE_API_KEY"];
      let answer: string;
      if (!apiKey) {
        answer = "The AI assistant is not configured yet.";
      } else {
        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content:
                    "You are SmartNeb Assistant inside a respiratory-therapy IoT platform. Answer ONLY from the authorized JSON context provided; never speculate about other patients and never reveal data that is not in the context. Be concise, cite concrete numbers and dates. You are not a doctor: never diagnose, never change a prescription, and always recommend contacting the care team for clinical decisions.",
                },
                ...(history ?? []).map((m: any) => ({ role: m.role, content: m.content })),
                {
                  role: "user",
                  content: `Authorized context:\n${scope}\n\nQuestion: ${data.question}`,
                },
              ],
            }),
          });
          if (res.status === 429) {
            answer = "The AI service is busy right now — please try again in a moment.";
          } else if (res.status === 402) {
            answer = "AI credits are exhausted for this workspace. Please add credits to continue.";
          } else if (!res.ok) {
            answer = "The assistant is temporarily unavailable. Please try again.";
          } else {
            const json = (await res.json()) as {
              choices?: Array<{ message?: { content?: string } }>;
            };
            answer = json.choices?.[0]?.message?.content ?? "No answer returned.";
          }
        } catch {
          answer = "The assistant could not be reached. Please try again.";
        }
      }

      await supabase
        .from("ai_messages")
        .insert({ conversation_id: conversationId, role: "assistant", content: answer });

      return { conversationId, answer, disclaimer: DISCLAIMER };
    },
  );
