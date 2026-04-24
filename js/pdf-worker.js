// PDF Worker for background compression
importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js');
importScripts('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

self.onmessage = async (e) => {
    const { file, fileName } = e.data;
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfjsLib = self['pdfjs-dist/build/pdf'];
        const { jsPDF } = self.jspdf;

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const outPdf = new jsPDF();

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const scale = 0.5;
            const viewport = page.getViewport({ scale });

            // Workers don't have DOM/Canvas, so we use OffscreenCanvas if available
            // Note: OffscreenCanvas is widely supported in modern browsers
            const canvas = new OffscreenCanvas(viewport.width, viewport.height);
            const context = canvas.getContext('2d');

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
            const reader = new FileReaderSync();
            const imgData = reader.readAsDataURL(blob);

            if (i > 1) outPdf.addPage();
            const pdfWidth = outPdf.internal.pageSize.getWidth();
            const pdfHeight = outPdf.internal.pageSize.getHeight();
            outPdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        }

        const finalBlob = outPdf.output('blob');
        self.postMessage({ success: true, blob: finalBlob, fileName });
    } catch (err) {
        self.postMessage({ success: false, error: err.message, fileName });
    }
};
