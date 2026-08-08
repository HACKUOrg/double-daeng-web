import { LogIn } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInWithPassword } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "invalid-input": "Enter a valid email and password.",
  "invalid-credentials": "The email or password is incorrect."
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const message = error ? errorMessages[error] : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <section className="w-full max-w-[420px] rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-8 flex items-center gap-3">
          <BrandLogo priority variant="wordmark" className="h-12" />
          <span className="sr-only">Double Daeng</span>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">Sign in to continue</p>

        <form action={signInWithPassword} className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium">
            Email
            <Input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Password
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {message ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {message}
            </p>
          ) : null}
          <Button type="submit" className="mt-2 w-full">
            <LogIn className="size-4" aria-hidden="true" />
            Sign in
          </Button>
        </form>
      </section>
    </main>
  );
}
