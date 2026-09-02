declare module 'html2pdf.js' {
  type Html2PdfOptions = {
    margin?: number | number[];
    filename?: string;
    image?: { type?: string; quality?: number };
    html2canvas?: Record<string, unknown>;
    jsPDF?: Record<string, unknown>;
    pagebreak?: Record<string, unknown>;
  };

  type Html2PdfWorker = {
    set(options: Html2PdfOptions): Html2PdfWorker;
    from(element: HTMLElement): Html2PdfWorker;
    toCanvas(): Promise<HTMLCanvasElement>;
    toPdf(): Html2PdfWorker;
    get(key: 'canvas' | 'pdf' | string): Promise<unknown>;
    save(): Promise<void>;
  };

  function html2pdf(): Html2PdfWorker;

  export default html2pdf;
}
