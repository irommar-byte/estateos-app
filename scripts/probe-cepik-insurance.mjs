import {
  withCepikSession,
  fetchCepikInsuranceData,
  fetchCepikVehicleData,
} from '../src/lib/cepikHistoriaPojazduClient.ts';

async function main() {
  const q = {
    registrationNumber: process.argv[2] || 'WH9737A',
    vin: process.argv[3] || 'WBA5A31000FD12345',
    firstRegistrationDate: process.argv[4] || '2015-04-28',
  };
  await withCepikSession(async (session) => {
    try {
      const vehicleData = await fetchCepikVehicleData(session, q);
      console.log('VEHICLE', JSON.stringify(vehicleData, null, 2).slice(0, 6000));
    } catch (error) {
      console.log('VEHICLE_ERR', error?.message, error?.code);
    }
    try {
      const insuranceData = await fetchCepikInsuranceData(session, {
        ...q,
        checkDate: process.argv[5] || '2026-07-10',
      });
      console.log('INSURANCE', JSON.stringify(insuranceData, null, 2));
    } catch (error) {
      console.log('INSURANCE_ERR', error?.message, error?.code);
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
