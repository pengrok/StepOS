import Link from "next/link";
import { Suspense } from "react";
import { ProblemSpecSchema } from "@/lib/schema";
import { SAMPLE_SCHEDULING } from "@/lib/samples";
import Simulator from "./Simulator";

export default function SimulatePage(props: PageProps<"/simulate">) {
  return (
    <Suspense fallback={<p className="p-8 text-pencil">불러오는 중…</p>}>
      <SimulateContent {...props} />
    </Suspense>
  );
}

async function SimulateContent({ searchParams }: PageProps<"/simulate">) {
  const { spec: raw } = await searchParams;
  let input: unknown = SAMPLE_SCHEDULING;
  try {
    if (typeof raw === "string") input = JSON.parse(raw);
  } catch {
    input = null;
  }
  const parsed = ProblemSpecSchema.safeParse(input);

  if (!parsed.success) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-bold">문제 조건을 읽을 수 없습니다</h1>
        <ul className="mt-4 list-disc pl-5 text-pencil">
          {parsed.error.issues.slice(0, 5).map((i, k) => (
            <li key={k}>{i.message}</li>
          ))}
        </ul>
        <Link href="/" className="mt-6 inline-block underline">
          조건 다시 입력하기
        </Link>
      </main>
    );
  }
  return <Simulator spec={parsed.data} />;
}
