import { execSync } from 'child_process';

export async function POST() {
  execSync('/home/rommar/snapshot-create.sh');
  return Response.json({ success: true });
}
