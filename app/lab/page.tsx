import { Suspense } from "react";
import LabApp from "@/components/lab/LabApp";

export default function LabPage() {
  return (
    <Suspense>
      <LabApp />
    </Suspense>
  );
}
