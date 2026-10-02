import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Wind, Trash2, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/delete-account")({
  head: () => ({
    meta: [
      { title: "Delete Account & Data Request — SmartNeb" },
      {
        name: "description",
        content: "Submit a request to delete your SmartNeb account and associated health data.",
      },
    ],
  }),
  component: DeleteAccountPage,
});

function DeleteAccountPage() {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    // Simulate deletion request processing or API call
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wind className="size-4" />
            </span>
            SmartNeb
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 size-4" /> Back to Home
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Request Account & Health Data Deletion
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          In compliance with Google Play Developer Policies and global data protection laws (India
          DPDP, GDPR, HIPAA), you can permanently request deletion of your account without opening
          the mobile app.
        </p>

        {submitted ? (
          <div className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <CheckCircle2 className="mx-auto size-12 text-emerald-400" />
            <h2 className="mt-4 text-xl font-bold text-emerald-300">Deletion Request Received</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A confirmation verification link has been sent to <strong>{email}</strong>. Once
              confirmed, your account credentials, live telemetry, and personal identifiers will be
              permanently expunged within 30 days.
            </p>
            <Button className="mt-6" variant="outline" onClick={() => setSubmitted(false)}>
              Submit Another Request
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="del-email">Account Email Address</Label>
              <Input
                id="del-email"
                type="email"
                required
                placeholder="patient@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="del-reason">Reason for Deletion (Optional)</Label>
              <Input
                id="del-reason"
                placeholder="No longer using the device, change of hospital, etc."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200/90 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-300">
                <AlertTriangle className="size-4" />
                <span>What happens upon deletion:</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>
                  <strong>Permanently Deleted:</strong> Profile details, phone number, login
                  credentials, push notification tokens, and linked caregiver relationships.
                </li>
                <li>
                  <strong>Anonymized Health Data:</strong> Historical vitals and session logs are
                  scrubbed of all patient personal identifiers (MRN, name, email).
                </li>
                <li>
                  <strong>Retained Records:</strong> Clinical prescription history may be preserved
                  in unlinked, de-identified form only where mandated by hospital accreditation and
                  clinical regulatory laws.
                </li>
                <li>
                  <strong>Timeline:</strong> Processing and database removal are executed within{" "}
                  <strong>30 calendar days</strong>.
                </li>
              </ul>
            </div>

            <Button type="submit" variant="destructive" className="w-full" disabled={loading}>
              <Trash2 className="mr-2 size-4" />
              {loading ? "Submitting Request..." : "Request Permanent Account Deletion"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
