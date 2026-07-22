import AdminControl from "@/components/AdminControl";
import AdminLogin from "@/components/AdminLogin";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function AdminPage() {
  // Server-side gate: unauthenticated visitors only ever receive the login form.
  if (!isAuthed()) {
    return <AdminLogin />;
  }
  return <AdminControl rehearsalMode={process.env.REHEARSAL_MODE === "1"} />;
}
