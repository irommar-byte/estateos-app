import fs from 'fs';

export async function GET() {
  const base = '/home/rommar/snapshots';

  const list = fs.readdirSync(base).map(dir => {
    const metaPath = `${base}/${dir}/meta.json`;
    let meta = {};

    if (fs.existsSync(metaPath)) {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    }

    return { id: dir, ...meta };
  }).sort((a:any,b:any)=>b.id.localeCompare(a.id));

  return Response.json(list);
}
