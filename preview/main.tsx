import { useState } from "react";
import { createRoot } from "react-dom/client";
import InputPage from "@/app/page";
import Simulator from "@/app/simulate/Simulator";
import { ProblemSpecSchema, type ProblemSpec } from "@/lib/schema";
import { setNavigate } from "./shims/navigation";

// 앱의 두 화면을 한 페이지 안에서 상태로 전환한다 (주소 이동 없음)
function App() {
  const [spec, setSpec] = useState<ProblemSpec | null>(null);
  setNavigate((url) => {
    const u = new URL(url, "https://stepos.local");
    const raw = u.searchParams.get("spec");
    const parsed = u.pathname === "/simulate" && raw ? ProblemSpecSchema.safeParse(JSON.parse(raw)) : null;
    setSpec(parsed?.success ? parsed.data : null);
    window.scrollTo(0, 0);
  });
  return spec ? <Simulator key={JSON.stringify(spec)} spec={spec} /> : <InputPage />;
}

createRoot(document.getElementById("root")!).render(<App />);
