export type UploadProgressJson = {
  url?: string;
  isHdr?: boolean;
  error?: string;
  message?: string;
};

export function uploadFormDataWithProgress(params: {
  url: string;
  formData: FormData;
  headers?: Record<string, string>;
  onProgress?: (percent: number) => void;
}): Promise<{ status: number; json: UploadProgressJson; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', params.url);
    xhr.withCredentials = true;
    for (const [key, value] of Object.entries(params.headers || {})) {
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      params.onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      const text = String(xhr.responseText || '');
      let json: UploadProgressJson = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { error: text || `HTTP ${xhr.status}` };
      }
      params.onProgress?.(xhr.status >= 200 && xhr.status < 300 ? 100 : 0);
      resolve({ status: xhr.status, json, text });
    };
    xhr.onerror = () => reject(new Error('Błąd sieci podczas wgrywania.'));
    xhr.ontimeout = () => reject(new Error('Przekroczono czas wgrywania.'));
    xhr.timeout = 120_000;
    xhr.send(params.formData);
  });
}
