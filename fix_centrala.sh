#!/bin/bash

FILE="/home/rommar/apple-style-website/src/app/centrala/page.tsx"

# 1. przenieś loadSnapshots poza handleLogout
sed -i '/const handleLogout/,$d' $FILE

cat << 'PATCH' >> $FILE

  const loadSnapshots = async () => {
    try {
      const res = await fetch("/api/admin/snapshots");
      const data = await res.json();
      setSnaps(data);
    } catch (e) {
      console.error("SNAP LOAD ERROR:", e);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };
PATCH

# 2. dodaj loadSnapshots do useEffect
sed -i 's/setIsAdmin(true);/setIsAdmin(true);\n          loadSnapshots();/' $FILE

# 3. podmień UI snapshotów
sed -i 's|<div id="snapshots-container" className="space-y-3"></div>|{snaps.map((snap) => (<div key={snap.id} className="bg-black border border-white/10 p-4 rounded-xl"><div className="font-bold text-sm">{snap.id}</div><div className="text-xs text-gray-400">{snap.commit}</div><button onClick={async () => { if (!confirm("Cofnąć system?")) return; await fetch("/api/admin/snapshot-rollback", { method: "POST", body: JSON.stringify({ id: snap.id }) }); loadSnapshots(); }} className="mt-3 bg-red-500 px-4 py-2 rounded-lg text-white font-bold">⏪ Rollback</button></div>))}|' $FILE

echo "✔ NAPRAWIONE"
