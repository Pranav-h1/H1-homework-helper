// Turning whatever a student drops into H1 into something the AI can actually read.
//
// Shared by the chat composer and the Documents library, so a PDF is read the same way
// everywhere and there's one place to improve it.
//
// Everything here runs in the browser: the file never leaves the student's machine except as
// the extracted text or downscaled image that's sent with their question.

const PDFJS_BASE = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_PDF_PAGES = 60;
// Images are downscaled before sending: a phone photo is often 4000px wide, and nothing
// about reading homework needs more than this.
const IMAGE_MAX_DIM = 2048;
const IMAGE_KEEP_ORIGINAL_BYTES = 1.5 * 1024 * 1024;
const THUMB_DIM = 240;

const IMAGE_TYPES = /^image\/(png|jpe?g|webp|gif)$/i;
const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "xml", "yaml", "yml", "toml", "ini", "log",
  "html", "htm", "css", "scss", "js", "mjs", "cjs", "ts", "tsx", "jsx", "py", "ipynb", "java",
  "c", "h", "cpp", "hpp", "cc", "cs", "go", "rs", "rb", "php", "swift", "kt", "sql", "sh",
  "bat", "ps1", "r", "m", "tex", "srt", "vtt", "lua", "dart", "vue", "svelte",
]);

function extensionOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || "");
  return m ? m[1].toLowerCase() : "";
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// What kind of thing a file is, decided by type first and extension second (browsers report
// an empty type for plenty of perfectly ordinary files, e.g. .py or .md on Windows).
export function classifyFile(file) {
  const ext = extensionOf(file.name);
  const type = (file.type || "").toLowerCase();
  if (IMAGE_TYPES.test(type) || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "image";
  if (type === "application/pdf" || ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "pptx") return "pptx";
  if (ext === "xlsx") return "xlsx";
  if (["heic", "heif"].includes(ext) || /heic|heif/.test(type)) return "heic";
  if (["doc", "ppt", "xls"].includes(ext)) return "legacy-office";
  if (type.startsWith("text/") || TEXT_EXTENSIONS.has(ext) || type === "application/json") return "text";
  return "unsupported";
}

// A reason the student can act on, for everything H1 can't read.
export function unsupportedReason(kind, file) {
  if (kind === "heic") return "HEIC photos can't be read in the browser. On an iPhone, set Camera → Formats → Most Compatible, or send it as a screenshot.";
  if (kind === "legacy-office") return `.${extensionOf(file.name)} is the old Office format. Save it as .docx, .pptx, .xlsx or PDF and attach that instead.`;
  return `H1 can't read .${extensionOf(file.name) || "this"} files yet. Images, PDFs, Word, PowerPoint, Excel, and text or code files all work.`;
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image couldn't be opened — it may be damaged."));
    img.src = src;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Couldn't read that file."));
    reader.readAsDataURL(blob);
  });
}

function drawScaled(img, maxDim, type, quality) {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  // JPEG has no transparency; paint white so a transparent screenshot doesn't turn black.
  if (type === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  return { dataUrl: canvas.toDataURL(type, quality), width: w, height: h };
}

export async function makeThumb(dataUrl) {
  const img = await loadImage(dataUrl);
  return drawScaled(img, THUMB_DIM, "image/jpeg", 0.72).dataUrl;
}

// Accepts a File or Blob. Returns base64 without the data: prefix, as the API expects.
export async function readImage(file) {
  const originalUrl = await blobToDataUrl(file);
  const img = await loadImage(originalUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  let dataUrl = originalUrl;
  let mimeType = file.type && IMAGE_TYPES.test(file.type) ? file.type : "image/png";
  const tooBig = file.size > IMAGE_KEEP_ORIGINAL_BYTES || Math.max(w, h) > IMAGE_MAX_DIM;
  if (tooBig) {
    // PNG stays PNG while it's still reasonably small (screenshots of text stay crisp);
    // anything else becomes a high-quality JPEG.
    const asPng = drawScaled(img, IMAGE_MAX_DIM, "image/png");
    if (mimeType === "image/png" && asPng.dataUrl.length * 0.75 < IMAGE_KEEP_ORIGINAL_BYTES * 2) {
      dataUrl = asPng.dataUrl;
    } else {
      dataUrl = drawScaled(img, IMAGE_MAX_DIM, "image/jpeg", 0.9).dataUrl;
      mimeType = "image/jpeg";
    }
  }
  const data = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return {
    kind: "image",
    mimeType,
    data,
    dataUrl,
    thumb: await makeThumb(dataUrl),
    width: w,
    height: h,
    sentBytes: Math.round(data.length * 0.75),
    downscaled: tooBig,
  };
}

// ---------------------------------------------------------------------------
// PDF (pdf.js, loaded on first use)
// ---------------------------------------------------------------------------

let pdfJsReady = null;

export function loadPdfJs() {
  if (pdfJsReady) return pdfJsReady;
  pdfJsReady = new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }
    const script = document.createElement("script");
    script.src = PDFJS_BASE + "pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + "pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    script.onerror = () => {
      pdfJsReady = null;
      reject(new Error("Couldn't load the PDF reader. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return pdfJsReady;
}

// PDF.js takes ownership of the bytes it's handed: it transfers them to its worker, which
// leaves the caller's buffer detached and unusable. A scanned PDF needs two passes over the
// same file — look for text, then render the pages as images — so each pass gets its own copy.
// Without this, every scanned PDF failed with "detached ArrayBuffer" instead of being read.
function pdfBytes(input) {
  const view = input instanceof Uint8Array ? input : new Uint8Array(input);
  return view.slice();
}

export async function extractPdfText(arrayBuffer, maxPages = MAX_PDF_PAGES) {
  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: pdfBytes(arrayBuffer) }).promise;
  const pageCount = Math.min(pdf.numPages, maxPages);
  const pages = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" ").replace(/[ \t]+/g, " ").trim());
  }
  const text = pages
    .map((p, i) => (p ? `--- Page ${i + 1} ---\n${p}` : ""))
    .filter(Boolean)
    .join("\n\n");
  return { text, pages: pdf.numPages, pagesRead: pageCount };
}

// A scanned PDF has no text layer at all. Rather than refuse it, render the first pages as
// images so the vision model can read them — it's exactly what a student would do by hand.
export async function renderPdfPages(arrayBuffer, maxPages = 3) {
  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: pdfBytes(arrayBuffer) }).promise;
  const count = Math.min(pdf.numPages, maxPages);
  const images = [];
  for (let i = 1; i <= count; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 1600 / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    images.push({ mimeType: "image/jpeg", data: dataUrl.slice(dataUrl.indexOf(",") + 1), dataUrl });
  }
  return { images, pages: pdf.numPages };
}

// ---------------------------------------------------------------------------
// Office files (.docx / .pptx / .xlsx)
//
// These are ZIP archives of XML. Rather than pull in a library, this reads the archive's
// central directory and inflates entries with the browser's own DecompressionStream, which
// every current browser ships.
// ---------------------------------------------------------------------------

function u16(view, o) {
  return view.getUint16(o, true);
}
function u32(view, o) {
  return view.getUint32(o, true);
}

export async function readZipEntries(arrayBuffer, wanted) {
  const view = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);
  // End-of-central-directory record: search backwards (it may be followed by a comment).
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (u32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error("That file isn't a valid Office document (it may be damaged or password-protected).");

  const entryCount = u16(view, eocd + 10);
  let ptr = u32(view, eocd + 16);
  const decoder = new TextDecoder("utf-8");
  const out = {};

  for (let n = 0; n < entryCount; n++) {
    if (u32(view, ptr) !== 0x02014b50) break;
    const method = u16(view, ptr + 10);
    const compSize = u32(view, ptr + 20);
    const nameLen = u16(view, ptr + 28);
    const extraLen = u16(view, ptr + 30);
    const commentLen = u16(view, ptr + 32);
    const localOffset = u32(view, ptr + 42);
    const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    ptr += 46 + nameLen + extraLen + commentLen;

    if (!wanted(name)) continue;
    const localNameLen = u16(view, localOffset + 26);
    const localExtraLen = u16(view, localOffset + 28);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    const raw = bytes.subarray(start, start + compSize);

    let data;
    if (method === 0) {
      data = raw;
    } else if (method === 8) {
      if (typeof DecompressionStream === "undefined") throw new Error("This browser can't open Office files. Try saving it as a PDF.");
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      data = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      continue;
    }
    out[name] = decoder.decode(data);
  }
  return out;
}

function parseXml(text) {
  return new DOMParser().parseFromString(text, "application/xml");
}

export async function extractDocxText(arrayBuffer) {
  const files = await readZipEntries(arrayBuffer, (n) => n === "word/document.xml");
  const xml = files["word/document.xml"];
  if (!xml) throw new Error("That Word file has no readable document inside it.");
  const doc = parseXml(xml);
  const paragraphs = [...doc.getElementsByTagName("w:p")].map((p) => {
    let line = "";
    p.querySelectorAll("*").forEach((node) => {
      if (node.nodeName === "w:t") line += node.textContent;
      else if (node.nodeName === "w:tab") line += "\t";
      else if (node.nodeName === "w:br") line += "\n";
    });
    return line;
  });
  return { text: paragraphs.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
}

export async function extractPptxText(arrayBuffer) {
  const files = await readZipEntries(arrayBuffer, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  const slideNames = Object.keys(files).sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]));
  const slides = slideNames.map((name, i) => {
    const doc = parseXml(files[name]);
    const paras = [...doc.getElementsByTagName("a:p")]
      .map((p) => [...p.getElementsByTagName("a:t")].map((t) => t.textContent).join(""))
      .filter((t) => t.trim());
    return `--- Slide ${i + 1} ---\n${paras.join("\n")}`;
  });
  return { text: slides.join("\n\n").trim(), pages: slides.length };
}

export async function extractXlsxText(arrayBuffer) {
  const files = await readZipEntries(arrayBuffer, (n) => n === "xl/sharedStrings.xml" || n === "xl/workbook.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const shared = files["xl/sharedStrings.xml"]
    ? [...parseXml(files["xl/sharedStrings.xml"]).getElementsByTagName("si")].map((si) =>
        [...si.getElementsByTagName("t")].map((t) => t.textContent).join("")
      )
    : [];
  const sheetNames = files["xl/workbook.xml"]
    ? [...parseXml(files["xl/workbook.xml"]).getElementsByTagName("sheet")].map((s) => s.getAttribute("name"))
    : [];
  const sheets = Object.keys(files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]))
    .slice(0, 5);

  const blocks = sheets.map((name, idx) => {
    const doc = parseXml(files[name]);
    const rows = [...doc.getElementsByTagName("row")].slice(0, 400).map((row) =>
      [...row.getElementsByTagName("c")]
        .map((c) => {
          const v = c.getElementsByTagName("v")[0];
          const t = c.getAttribute("t");
          if (t === "inlineStr") return [...c.getElementsByTagName("t")].map((x) => x.textContent).join("");
          if (!v) return "";
          return t === "s" ? shared[Number(v.textContent)] ?? "" : v.textContent;
        })
        .join("\t")
    );
    return `--- Sheet: ${sheetNames[idx] || `Sheet ${idx + 1}`} ---\n${rows.join("\n")}`;
  });
  return { text: blocks.join("\n\n").trim(), pages: sheets.length };
}

// ---------------------------------------------------------------------------
// One entry point
// ---------------------------------------------------------------------------

// Resolves to one of:
//   { kind: "image", mimeType, data, dataUrl, thumb, ... }
//   { kind: "document", format, text, pages?, images? }   (images only for scanned PDFs)
// Rejects with an Error whose message is written for the student.
export async function readAnyFile(file) {
  const format = classifyFile(file);
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_FILE_BYTES)}.`);
  }
  if (format === "image") return readImage(file);
  if (["unsupported", "heic", "legacy-office"].includes(format)) throw new Error(unsupportedReason(format, file));

  if (format === "text") {
    const text = await file.text();
    if (!text.trim()) throw new Error(`${file.name} is empty.`);
    return { kind: "document", format: "text", text };
  }

  const buffer = await file.arrayBuffer();
  if (format === "pdf") {
    const { text, pages, pagesRead } = await extractPdfText(buffer);
    if (text.replace(/--- Page \d+ ---/g, "").trim().length > 20) {
      return { kind: "document", format: "pdf", text, pages, pagesRead };
    }
    const rendered = await renderPdfPages(buffer, 3);
    return {
      kind: "document",
      format: "pdf-scanned",
      text: "",
      pages: rendered.pages,
      images: rendered.images,
      thumb: rendered.images[0] ? await makeThumb(rendered.images[0].dataUrl) : null,
    };
  }

  const extractor = { docx: extractDocxText, pptx: extractPptxText, xlsx: extractXlsxText }[format];
  const result = await extractor(buffer);
  if (!result.text.replace(/--- (Slide|Sheet)[^\n]*---/g, "").trim()) {
    throw new Error(`Couldn't find any text in ${file.name}.`);
  }
  return { kind: "document", format, ...result };
}
