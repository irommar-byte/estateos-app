import test from 'node:test';
import assert from 'node:assert/strict';

const VISIBLE_CHARS = 2;

function maskRestrictedVehicleValue(value, visibleChars = VISIBLE_CHARS) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.length <= visibleChars) return raw;
  return raw.slice(0, visibleChars) + '*'.repeat(raw.length - visibleChars);
}

const SENSITIVE_ROW_LABELS = /vin|numer rejestr|rejestrac|tablic|pierwsz(a|ej) rejestrac/i;

function maskVehicleHistoryReport(report, secrets) {
  const maskText = (text) => {
    let result = String(text || '');
    for (const secret of [secrets.vin, secrets.registrationNumber, secrets.firstRegistrationDate]) {
      const raw = String(secret || '').trim();
      if (!raw || raw.length <= VISIBLE_CHARS) continue;
      const masked = maskRestrictedVehicleValue(raw);
      if (result.includes(raw)) result = result.split(raw).join(masked);
    }
    return result;
  };

  return {
    ...report,
    vin: maskRestrictedVehicleValue(secrets.vin || report.vin || ''),
    registrationNumber: maskRestrictedVehicleValue(secrets.registrationNumber || report.registrationNumber || ''),
    firstRegistrationDate: maskRestrictedVehicleValue(secrets.firstRegistrationDate || report.firstRegistrationDate || ''),
    summary: report.summary ? maskText(report.summary) : report.summary,
    sections: report.sections?.map((section) => ({
      ...section,
      rows: section.rows.map((row) => ({
        ...row,
        value: SENSITIVE_ROW_LABELS.test(row.label)
          ? maskRestrictedVehicleValue(row.value)
          : maskText(row.value),
      })),
    })),
  };
}

test('maskRestrictedVehicleValue keeps first two characters', () => {
  assert.equal(maskRestrictedVehicleValue('WBA5J710X0GZ75605'), 'WB***************');
  assert.equal(maskRestrictedVehicleValue('WH9737A'), 'WH*****');
  assert.equal(maskRestrictedVehicleValue('28.04.2015'), '28********');
});

test('maskVehicleHistoryReport hides sensitive rows and summary', () => {
  const masked = maskVehicleHistoryReport(
    {
      vin: 'WBA5J710X0GZ75605',
      registrationNumber: 'WH9737A',
      firstRegistrationDate: '28.04.2015',
      summary: 'Raport CEPIK Historia Pojazdu dla WH9737A.',
      sections: [
        {
          title: 'Dane',
          rows: [{ label: 'Numer VIN', value: 'WBA5J710X0GZ75605' }],
        },
      ],
    },
    {
      vin: 'WBA5J710X0GZ75605',
      registrationNumber: 'WH9737A',
      firstRegistrationDate: '28.04.2015',
    },
  );

  assert.equal(masked.vin, 'WB***************');
  assert.equal(masked.registrationNumber, 'WH*****');
  assert.equal(masked.firstRegistrationDate, '28********');
  assert.match(masked.summary || '', /WH\*\*\*\*\*/);
  assert.equal(masked.sections?.[0]?.rows[0]?.value, 'WB***************');
});
