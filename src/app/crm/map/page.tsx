'use client';

import { useSearchParams } from 'next/navigation';
import { DeskMapWorkspace } from '@/components/desk/DeskMapWorkspace';
import { useDeskInspector } from '@/components/desk/DeskShell';

export default function DeskMapPage() {
  const params = useSearchParams();
  const caseParam = params.get('caseId');
  const caseId = caseParam ? Number(caseParam) : null;
  const { caseId: ctxCaseId } = useDeskInspector();

  return (
    <div>
      <p className="eos-desk-kicker">Mapa operacyjna</p>
      <h1 className="eos-desk-h1">Map</h1>
      <p className="eos-desk-muted" style={{ marginBottom: '1rem', maxWidth: '42rem' }}>
        Oferty, klienci, dopasowania, Open House i aukcje — w kontekście bieżącej pracy. Z Inspectora: OPEN MAP →
        NAVIGATE.
      </p>
      <DeskMapWorkspace caseId={caseId || ctxCaseId} />
    </div>
  );
}
