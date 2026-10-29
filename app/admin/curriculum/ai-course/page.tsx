import { Suspense } from "react";
import { connection } from "next/server";
import { requireAccount } from "@/lib/auth/roles";
import AICourseCreator from "@/components/admin/curriculum/AICourseCreator";

async function Content() {
  await connection();
  await requireAccount("admin");
  return <AICourseCreator />;
}
export default function AICoursePage() {
  return <Suspense fallback={<p role="status">Loading AI Course Creator…</p>}><Content /></Suspense>;
}
