import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OfflineExamImportForm } from "./OfflineExamImportForm";

export const dynamic = "force-dynamic";

export default async function OfflineTestAccessPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");
  const assigned = await prisma.student.count({ where: { offlineTestSecret: { not: null } } });
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Офлайн тестке кіру</h1>
          <p>Оқушы өз кабинетінде тек өз сілтемесін, телефонын және құпия сөзін көреді. Қазір {assigned} оқушыға берілген.</p>
        </div>
        <Link className="btn ghost" href="/students">Оқушыларға қайту</Link>
      </div>
      <OfflineExamImportForm />
    </>
  );
}
