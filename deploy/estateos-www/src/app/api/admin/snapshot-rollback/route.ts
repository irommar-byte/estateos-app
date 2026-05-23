import { execSync } from 'child_process';

export async function POST(req: Request) {
  const { id } = await req.json();

  execSync(`/home/rommar/snapshot-rollback.sh ${id}`);

  return Response.json({ success: true });
}
