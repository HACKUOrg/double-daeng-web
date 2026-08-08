import { redirect } from "next/navigation";
import { getLandingPath, getOptionalCurrentProfile } from "@/lib/auth/session";

export default async function HomePage() {
  const profile = await getOptionalCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  redirect(getLandingPath(profile.role));
}
