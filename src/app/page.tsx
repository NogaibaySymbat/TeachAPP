import { Dashboard } from "@/components/dashboard";
import { getExams } from "@/server/content";

export default async function Home() {
  const exams = await getExams();
  return <Dashboard examTitles={exams.map((exam) => exam.title)} />;
}
