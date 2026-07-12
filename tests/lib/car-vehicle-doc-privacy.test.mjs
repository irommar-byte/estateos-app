import test from 'node:test';
import assert from 'node:assert/strict';
import {
  maskRestrictedVehicleValue,
  maskVehicleHistoryReport,
} from '../src/utils/carVehicleDocPrivacy.ts';

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
