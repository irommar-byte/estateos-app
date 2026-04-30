/** Dom API `FormData` resolves poorly with some TS lib combos; treat as browser FormData. */
export async function getWebFormData(request: Request): Promise<globalThis.FormData> {
  const data = await request.formData();
  return data as unknown as globalThis.FormData;
}
