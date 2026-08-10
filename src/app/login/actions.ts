"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1)
});

export async function signInWithPassword(formData: FormData) {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    redirect("/login?error=invalid-input");
  }

  let email = parsed.data.identifier;

  if (!email.includes("@")) {
    const roomLogin = await getPrisma().user.findFirst({
      where: {
        username: parsed.data.identifier.toUpperCase(),
        role: "RESIDENT",
        status: "ACTIVE",
        roomLoginAssignments: {
          some: {
            status: "ACTIVE",
            room: {
              status: "OCCUPIED"
            }
          }
        }
      },
      select: {
        email: true
      }
    });

    if (!roomLogin) {
      redirect("/login?error=no-active-room");
    }

    email = roomLogin.email;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password
  });

  if (error) {
    redirect("/login?error=invalid-credentials");
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
