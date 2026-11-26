import { FeatureItem, ToolCategory, ToolDefinition } from '../types/navigation';

export const TOOL_CATEGORIES: ToolCategory[] = [
  'All',
  'Image',
  'Documents',
  'Developer',
  'Text',
];

export const TOOLS_DATA: ToolDefinition[] = [
  {
    id: 'image-compressor',
    name: 'Image Compressor',
    metaTitle: 'Free Image Compressor (JPG, PNG, WebP) — AI Utility Hub',
    metaDescription:
      'Compress JPG, PNG, and WebP images locally in your browser with presets, custom quality sliders, and instant before-and-after previews.',
    shortDescription: 'Reduce image file sizes without compromising quality.',
    longDescription:
      'Compress JPG, PNG, and WebP images locally in your browser with Low, Medium, and High compression presets, custom quality controls, and format conversion.',
    category: 'Image',
    subcategory: 'Optimization',
    iconName: 'Image',
    instructions: [
      'Drag and drop or browse to upload a JPG/JPEG, PNG, or WebP image (up to 25 MB).',
      'Select Low, Medium, or High compression or adjust the 10%-100% quality slider and choose Keep Original, JPEG, WebP, or PNG output.',
      'Click Compress Image to compare previews and size change statistics, then click Download Image to save the result.',
    ],
    useCases: [
      'Shrinking hero banners, blog photos, and product shots before uploading to a CMS or static site.',
      'Converting heavy transparent PNG screenshots into compact WebP assets while keeping alpha transparency.',
      'Preparing lighter JPEG attachments with a clean background fill before sharing over email or messaging apps.',
    ],
    tips: [
      'Use WebP at 75%–85% quality when you want significant file-size savings with transparency support.',
      'Switching an already-compressed lossless PNG to JPEG or WebP yields far smaller files than re-saving as PNG.',
      'Inspect the percentage delta beside the output size before downloading—if a pre-optimized file grows slightly, switch output format or lower quality.',
    ],
    technicalNotes: {
      supportedFormats: 'Input & Export: JPG/JPEG, PNG, WebP (canvas re-encoding).',
      limits: 'Up to 25 MB per file and 33.2 MP output canvas limit (65 MP max source decode).',
      privacyModel: '100% local HTML5 Canvas processing; zero image uploads.',
      tradeoffs: 'PNG is lossless so the quality slider only alters JPEG and WebP outputs; EXIF metadata is stripped during canvas re-encoding.',
    },
    faqs: [
      {
        question: 'Which image formats are supported?',
        answer:
          'You can upload JPG/JPEG, PNG, and WebP images and export as the original format, JPEG, WebP, or PNG directly in your browser.',
      },
      {
        question: 'Why does PNG compression sometimes not reduce file size?',
        answer:
          'PNG is a lossless format. If an uploaded PNG was already heavily optimized, re-encoding it through the browser canvas can produce a similar or slightly larger file. Converting to WebP or JPEG usually yields much stronger size reductions.',
      },
      {
        question: 'How is transparency handled when converting to JPEG?',
        answer:
          'JPEG does not support alpha transparency. When converting a transparent PNG or WebP to JPEG, you can choose a background color to fill transparent areas cleanly.',
      },
    ],
    relatedIds: ['image-resizer', 'pdf-tools', 'qr-code-generator'],
  },
  {
    id: 'qr-code-generator',
    name: 'QR Code Generator',
    metaTitle: 'Free QR Code Generator (PNG & SVG) — AI Utility Hub',
    metaDescription:
      'Create custom QR codes for URLs, text, email, phone, and Wi-Fi right in your browser. Customize colors and download crisp PNG or SVG files.',
    shortDescription: 'Create QR codes quickly and easily.',
    longDescription:
      'Generate crisp, scannable QR codes for website URLs, plain text, email addresses, phone numbers, and Wi-Fi networks with custom sizing and colors.',
    category: 'Documents',
    subcategory: 'Sharing',
    iconName: 'QrCode',
    instructions: [
      'Select an input type (Website URL, Plain Text, Email, Phone, or Wi-Fi) and enter your details.',
      'Customize the QR code size (200px, 300px, or 500px), foreground and background colors, and error correction level.',
      'Click Generate QR Code to update the preview, then download as PNG or SVG or copy the encoded content.',
    ],
    useCases: [
      'Printing guest Wi-Fi credentials on table cards so visitors join with a single camera scan.',
      'Exporting crisp vector SVG QR codes for flyers, packaging labels, and presentation slides.',
      'Creating direct mailto: or tel: QR stickers for support desks and business cards.',
    ],
    tips: [
      'Keep a dark foreground on a light background; the workspace alerts you automatically if color contrast becomes risky for phone cameras.',
      'Download SVG whenever you plan to scale the QR code in print design software or high-DPI layouts.',
      'Choose Quartile (Q) or High (H) error correction for printed posters or labels that might get scuffed.',
    ],
    technicalNotes: {
      supportedFormats: 'Payloads: URL, Plain Text, Mailto, Tel, Wi-Fi (WPA/WEP/Open). Exports: PNG (200px/300px/500px) & SVG.',
      limits: 'Plain text limited to 2,000 characters to preserve camera scan reliability.',
      privacyModel: '100% client-side QR matrix encoding; Wi-Fi passwords and text never leave your browser.',
      tradeoffs: 'Static QR codes encode payload directly (they never expire, and cannot track scan analytics or be edited after printing).',
    },
    faqs: [
      {
        question: 'What does the error correction level control?',
        answer:
          'Higher error correction (Low, Medium, Quartile, High) adds redundancy so the code remains scannable even if printed on textured surfaces or partially obscured.',
      },
      {
        question: 'Do generated QR codes expire?',
        answer:
          'No. Static QR codes encode your URL, text, or Wi-Fi credentials directly in the matrix pattern, so they never rely on temporary redirect links.',
      },
      {
        question: 'Which export formats are supported?',
        answer:
          'You can download both crisp PNG images at your selected pixel size and scalable vector SVG files directly from the preview panel.',
      },
    ],
    relatedIds: ['pdf-tools', 'image-resizer', 'word-counter'],
  },
  {
    id: 'pdf-tools',
    name: 'PDF Tools',
    metaTitle: 'PDF Tools: Merge, Split & Rotate PDFs — AI Utility Hub',
    metaDescription:
      'Merge, split, rotate, extract, and delete PDF pages locally inside your browser. Organize documents quickly with zero server file uploads.',
    shortDescription: 'Manage and organize your PDF documents.',
    longDescription:
      'Merge, split, rotate, extract, and delete PDF pages locally inside your browser without uploading files to any server.',
    category: 'Documents',
    subcategory: 'Page Management',
    iconName: 'FileText',
    instructions: [
      'Choose an operation from the PDF Tools dashboard: Merge PDF, Split PDF, Rotate PDF, Extract PDF Pages, or Delete PDF Pages.',
      'Upload your PDF file(s) (up to 50 MB per file), review page counts and thumbnails, and set your file order, page ranges, or rotation angle.',
      'Run the operation to generate a valid PDF locally and download the resulting file(s).',
    ],
    useCases: [
      'Combining invoices, cover sheets, and signed appendices into one ordered packet before submission.',
      'Rotating sideways scanned pages by 90°, 180°, or 270° without re-exporting from desktop software.',
      'Splitting a multi-chapter report into separate PDF sections using ranges such as 1-4, 5-9.',
    ],
    tips: [
      'In Extract, Delete, and Specific-Page Rotate modes, click thumbnails directly or type compact ranges like 1-3, 7.',
      'Thumbnail previews render up to the first 24 pages to keep memory snappy, while page range inputs still apply to every page in larger PDFs.',
      'For large multi-file merges, combine files in batches under 120 MB total (up to 25 files at once).',
    ],
    technicalNotes: {
      supportedFormats: 'Standard unencrypted PDF (.pdf) documents.',
      limits: 'Up to 50 MB per file; Merge queues capped at 120 MB combined and 25 files; thumbnails preview first 24 pages.',
      privacyModel: '100% local processing via pdf-lib and PDF.js inside the browser.',
      tradeoffs: 'Password-protected or DRM-encrypted PDFs must be unlocked prior to upload.',
    },
    faqs: [
      {
        question: 'Which PDF operations are included?',
        answer:
          'You can merge multiple PDFs in custom order, split a PDF by page ranges into separate files, rotate pages by 90°, 180°, or 270°, extract specific pages, and delete unwanted pages.',
      },
      {
        question: 'Are my PDF documents uploaded to an external server?',
        answer:
          'No. All PDF parsing, page thumbnails, manipulation, and file generation run locally inside your browser using pdf-lib and PDF.js.',
      },
      {
        question: 'What happens if I try to delete every page in a PDF?',
        answer:
          'The workspace prevents deleting every page so you always keep at least one page in a valid output document.',
      },
    ],
    relatedIds: ['word-counter', 'qr-code-generator', 'image-compressor'],
  },
  {
    id: 'json-formatter',
    name: 'JSON Formatter',
    metaTitle: 'JSON Formatter, Validator & Minifier — AI Utility Hub',
    metaDescription:
      'Format, indent, validate, and minify JSON payloads directly in your browser. Spot syntax errors by line and column with instant export.',
    shortDescription: 'Format and organize JSON data beautifully.',
    longDescription:
      'Clean up raw API payloads, inspect nested objects with clear indentation, and validate syntax in a distraction-free code editor.',
    category: 'Developer',
    subcategory: 'Formatting',
    iconName: 'Braces',
    instructions: [
      'Paste or write your JSON payload into the left editor, or click Sample JSON to load an example.',
      'Choose 2 Spaces or 4 Spaces indentation and click Format JSON, Minify, or Validate.',
      'Inspect any line-specific syntax feedback or use Copy Output and Download .json to save the result.',
    ],
    useCases: [
      'Pretty-printing minified API responses or webhook payloads to inspect nested keys and arrays.',
      'Validating configuration files (package configs, schemas, geo/data payloads) for trailing commas or mismatched braces.',
      'Minifying multi-line JSON fixtures before embedding them into environment variables or network requests.',
    ],
    tips: [
      'Watch the numbered gutter in the input editor—validation pinpoints the failing line and column so you can fix syntax issues rapidly.',
      'Toggle between 2 Spaces and 4 Spaces indentation before clicking Format JSON to match your project style guide.',
      'Use Copy Output or Download .json after minifying to grab a clean, verified payload.',
    ],
    technicalNotes: {
      supportedFormats: 'Strict RFC 8259 JSON (.json) UTF-8 payloads.',
      limits: 'Bounded by browser tab memory; works smoothly on typical API and config payloads.',
      privacyModel: '100% local JSON.parse / JSON.stringify execution; sensitive tokens or payloads never touch a server.',
      tradeoffs: 'JSON5/JSONC features such as comments or trailing commas are flagged as invalid strict JSON.',
    },
    faqs: [
      {
        question: 'What happens if my JSON contains a syntax error?',
        answer:
          'Validation catches trailing commas, unquoted keys, or mismatched brackets and displays the error message along with its line and column location.',
      },
      {
        question: 'Can I also minify formatted JSON?',
        answer:
          'Yes, click Minify to strip unnecessary whitespace and line breaks into a compact single-line payload.',
      },
      {
        question: 'Is my JSON data sent to an external server?',
        answer:
          'No. Formatting, minification, validation, and file downloads all run locally inside your browser.',
      },
    ],
    relatedIds: ['word-counter', 'qr-code-generator', 'pdf-tools'],
  },
  {
    id: 'image-resizer',
    name: 'Image Resizer',
    metaTitle: 'Free Image Resizer (JPG, PNG, WebP) — AI Utility Hub',
    metaDescription:
      'Resize JPG, PNG, and WebP photos in your browser with custom pixel dimensions, aspect ratio lock, presets, and fast format conversion.',
    shortDescription: 'Resize images for different platforms and purposes.',
    longDescription:
      'Resize JPG, PNG, and WebP images directly in your browser with custom pixel dimensions, aspect ratio lock, presets, and format conversion.',
    category: 'Image',
    subcategory: 'Dimensions',
    iconName: 'Scan',
    instructions: [
      'Drag and drop or browse to upload a JPG/JPEG, PNG, or WebP image.',
      'Set custom pixel dimensions, pick a preset size, or keep original dimensions, then choose JPEG, PNG, or WebP output and quality.',
      'Click Resize Image to compare the original and resized previews, then download your exported file.',
    ],
    useCases: [
      'Downscaling high-resolution camera photos to 1920 × 1080 or 1080 × 1080 before social or blog publishing.',
      'Preparing square 256 × 256 or 512 × 512 avatars and thumbnails while keeping original sharpness.',
      'Shrinking oversized >25 MP images down into safe dimensions before running AI background removal.',
    ],
    tips: [
      'Keep Lock Aspect Ratio checked while editing width or height to avoid accidental stretching.',
      'When switching to a preset whose aspect ratio differs from your original image, verify the output preview before downloading.',
      'Enable Maintain Original Dimensions if you only want to convert between PNG, WebP, and JPEG cleanly.',
    ],
    technicalNotes: {
      supportedFormats: 'Input & Export: JPG/JPEG, PNG, WebP.',
      limits: 'Max 25 MB input file, up to 8,192 px per side and 33.2 MP output canvas (65 MP max source decode).',
      privacyModel: '100% local HTML5 Canvas scaling with high-quality smoothing.',
      tradeoffs: 'Upscaling far beyond original dimensions softens fine detail; preset mismatches unlock aspect lock so exact preset dimensions are honored.',
    },
    faqs: [
      {
        question: 'How does the aspect ratio lock work?',
        answer:
          'When Lock Aspect Ratio is enabled, changing either width or height automatically calculates the matching dimension based on the original image proportions.',
      },
      {
        question: 'Which output formats and transparency options are supported?',
        answer:
          'You can export as JPEG, PNG, or WebP. PNG preserves transparency losslessly, while converting transparent images to JPEG fills transparent pixels with your chosen background color.',
      },
      {
        question: 'Are my uploaded images sent to a server?',
        answer:
          'No. All image loading, resizing, format conversion, and downloading happen locally inside your browser using the Canvas API.',
      },
    ],
    relatedIds: ['image-compressor', 'qr-code-generator', 'pdf-tools'],
  },
  {
    id: 'word-counter',
    name: 'Word Counter',
    metaTitle: 'Word & Character Counter Online — AI Utility Hub',
    metaDescription:
      'Count words, characters with or without spaces, sentences, paragraphs, and reading time instantly in a clean, private browser workspace.',
    shortDescription: 'Count words, characters and sentences instantly.',
    longDescription:
      'Review word counts, character limits, sentence structure, and estimated reading time in a calm editorial workspace.',
    category: 'Text',
    subcategory: 'Writing',
    iconName: 'Type',
    instructions: [
      'Start typing directly in the text editor or use Paste Text to bring in an existing draft.',
      'Watch Total Words, Characters (with and without spaces), Sentences, Paragraphs, and Estimated Reading Time update automatically as you edit.',
      'Use Copy Text to copy your polished draft, or Clear All when you are ready to start fresh.',
    ],
    useCases: [
      'Checking essay, abstract, and grant application limits against strict word or character-without-spaces caps.',
      'Measuring meta descriptions, social captions, and newsletter intros in real time.',
      'Estimating talk or article reading duration at a 200-words-per-minute baseline before publishing.',
    ],
    tips: [
      'Your active draft stays stored in local browser storage across reloads until you click Clear All.',
      'Contractions and hyphenated compounds count as single words so totals align with standard editorial conventions.',
      'Separate sections with blank lines to verify accurate paragraph counts alongside sentence totals.',
    ],
    technicalNotes: {
      supportedFormats: 'Plain UTF-8 text and pasted clipboard content.',
      limits: 'No hard character cap; handles multi-thousand-word drafts smoothly in-memory.',
      privacyModel: '100% local counting with optional browser localStorage draft persistence (ai-utility-hub-word-counter-draft).',
      tradeoffs: 'Reading time uses a fixed 200 WPM baseline and will differ slightly for dense technical or dialogue-heavy prose.',
    },
    faqs: [
      {
        question: 'How is reading time estimated?',
        answer:
          'Estimated reading time uses an average pace of 200 words per minute and displays "< 1 min" for short drafts under 200 words.',
      },
      {
        question: 'How are contractions and hyphenated words counted?',
        answer:
          'Contractions (such as "don\'t") and hyphenated compounds (such as "well-known") are counted as one meaningful word token.',
      },
      {
        question: 'Is my text sent to any server?',
        answer:
          'No. All counting runs locally inside your browser, and your active draft is saved only in local browser storage so accidental refreshes do not lose your work.',
      },
    ],
    relatedIds: ['json-formatter', 'pdf-tools', 'qr-code-generator'],
  },
  {
    id: 'pdf-to-word',
    name: 'PDF to Word Converter',
    metaTitle: 'Free PDF to Word (.docx) Converter — AI Utility Hub',
    metaDescription:
      'Convert selectable-text PDF documents into editable Microsoft Word (.docx) files locally in your browser, keeping headings, lists, and tables.',
    shortDescription: 'Convert PDF documents into editable Word (.docx) files.',
    longDescription:
      'Extract text, headings, lists, and aligned tables from PDF files directly in your browser and export an editable Microsoft Word (.docx) document.',
    category: 'Documents',
    subcategory: 'Conversion',
    iconName: 'FileOutput',
    instructions: [
      'Drag and drop or browse to upload a selectable-text PDF document (up to 50 MB).',
      'Choose Preserve Layout or Flowing Text and configure heading detection, table reconstruction, and page breaks.',
      'Click Convert to Word (.docx), inspect the extracted preview, and click Download Word to save your .docx file.',
    ],
    useCases: [
      'Recovering editable drafts of contracts, reports, or resumes stored only as text-based PDFs.',
      'Extracting structured multi-column tables and bullet lists from digital invoices or spec sheets into Word.',
      'Converting multi-page handouts into editable .docx files without uploading confidential material to cloud converters.',
    ],
    tips: [
      'Use Preserve Layout for reports and invoices with columns or tables; switch to Flowing Text for prose documents you want to reflow cleanly.',
      'Inspect the extracted block preview before downloading to decide whether Table Reconstruction or Page Breaks suit your draft best.',
      'If the tool warns that pages contain no selectable text, run desktop/native OCR first because scanned image PDFs do not carry embedded text streams.',
    ],
    technicalNotes: {
      supportedFormats: 'Input: Selectable-text PDF (.pdf). Export: Microsoft Word (.docx).',
      limits: 'Up to 50 MB per PDF; password-protected PDFs are not supported.',
      privacyModel: '100% local extraction via PDF.js and .docx packaging via docx library.',
      tradeoffs: 'No built-in OCR for image-only scans; complex overlapping magazine/design grids simplify into sequential headings, paragraphs, lists, and tables.',
    },
    faqs: [
      {
        question: 'Will exact PDF formatting always transfer identically to Word?',
        answer:
          'Selectable text, headings, bullet lists, and aligned multi-column tables transfer cleanly into editable Word blocks. Complex magazine layouts, overlapping vector art, and custom embedded fonts may require manual layout adjustments.',
      },
      {
        question: 'What happens if I upload a scanned or image-only PDF?',
        answer:
          'The converter automatically detects pages without selectable text and warns you that Optical Character Recognition (OCR) is required, rather than generating an empty Word document.',
      },
      {
        question: 'Are my PDFs uploaded to a third-party server?',
        answer:
          'No. PDF text extraction with PDF.js and DOCX file generation happen locally inside your browser.',
      },
    ],
    relatedIds: ['word-to-pdf', 'pdf-tools', 'word-counter'],
  },
  {
    id: 'word-to-pdf',
    name: 'Word to PDF Converter',
    metaTitle: 'Free Word (.docx) to PDF Converter — AI Utility Hub',
    metaDescription:
      'Turn Microsoft Word (.docx) files into shareable multi-page PDFs locally in your browser with paper size options, lists, tables, and images.',
    shortDescription: 'Turn Word (.docx) documents into shareable PDFs.',
    longDescription:
      'Convert Microsoft Word (.docx) documents into multi-page PDF files locally inside your browser, preserving headings, paragraphs, lists, tables, page breaks, and embedded images.',
    category: 'Documents',
    subcategory: 'Conversion',
    iconName: 'FilePlus2',
    instructions: [
      'Drag and drop or browse to select a Microsoft Word (.docx) file up to 25 MB.',
      'Choose paper size (A4, Letter, or Legal), orientation (Portrait or Landscape), and click Convert to PDF.',
      'Inspect the rendered PDF pages and page count in the preview panel, then click Download PDF to save your document.',
    ],
    useCases: [
      'Turning .docx resumes, proposals, or coursework into clean A4 or US Letter PDFs ready for submission.',
      'Switching Landscape orientation on wide .docx tables so columns fit cleanly across pages.',
      'Generating shareable multi-page PDFs with embedded PNG/JPEG diagrams without external cloud converters.',
    ],
    tips: [
      'Save older binary .doc files as .docx in Word or LibreOffice before uploading.',
      'Choose Letter for North American distribution or A4 for international standard page layouts.',
      'Review the rendered page preview thumbnails to verify where tables and manual page breaks fall before downloading.',
    ],
    technicalNotes: {
      supportedFormats: 'Input: Modern OOXML Word (.docx). Export: Multi-page PDF (.pdf).',
      limits: 'Up to 25 MB per .docx file.',
      privacyModel: '100% local .docx parsing (mammoth + JSZip) and PDF construction (pdf-lib).',
      tradeoffs: 'Custom fonts, macros, floating text boxes, and headers/footers simplify cleanly to standard PDF typography rather than pixel-identical Office rendering.',
    },
    faqs: [
      {
        question: 'Which Word file formats are supported?',
        answer:
          'Standard Microsoft Word (.docx) files are supported. Legacy binary .doc files should be saved as .docx before uploading.',
      },
      {
        question: 'Are headings, lists, tables, and images preserved?',
        answer:
          'Yes. Headings, bold/italic/underline styling, bulleted and numbered lists, tables, manual page breaks, and embedded PNG/JPEG images are preserved. Complex floating elements, macros, headers/footers, and custom fonts simplify to clean standard PDF typography.',
      },
      {
        question: 'Is my Word document sent to an external server?',
        answer:
          'No. Document parsing, PDF generation, and page previews all execute locally inside your browser without uploading files.',
      },
    ],
    relatedIds: ['pdf-to-word', 'pdf-tools', 'qr-code-generator'],
  },
  {
    id: 'image-background-remover',
    name: 'Image Background Remover',
    metaTitle: 'AI Image Background Remover (Free PNG) — AI Utility Hub',
    metaDescription:
      'Remove photo backgrounds locally in your browser using AI segmentation. Compare previews, refine edges, and export transparent PNGs privately.',
    shortDescription: 'Isolate subjects and create clean transparent PNGs.',
    longDescription:
      'Remove photo backgrounds locally in your browser using ONNX AI segmentation (BRIA RMBG-1.4 with IMG.LY IS-Net & MODNet fallbacks), compare Before & After previews, refine edge feathering, and export a transparent PNG.',
    category: 'Image',
    subcategory: 'Background Editing',
    iconName: 'Eraser',
    instructions: [
      'Drag and drop or browse to upload a JPG, JPEG, PNG, or WebP photo (up to 25 MB and 25 MP).',
      'Click Remove Background to run local ONNX AI segmentation inside your browser (the first run downloads the ~44 MB model weights and caches them locally).',
      'Compare Before and Transparent After views, optionally adjust Edge Feathering or Fine Detail preservation, and click Download PNG.',
    ],
    useCases: [
      'Creating transparent product cutouts for storefronts, pitch decks, and catalog sheets.',
      'Isolating headshots, pets, or objects to layer cleanly inside presentations or design tools.',
      'Comparing Before and After transparency with live edge-feather adjustments without re-running AI inference.',
    ],
    tips: [
      'Use photos with clear subject contrast and resize oversized >25 MP camera files in Image Resizer first for faster results.',
      'Toggle Fine Detail & Hair Edge Refinement after segmentation completes—refinement runs instantaneously on pixels without re-downloading models.',
      'First-run model downloads (~44 MB) come from public model CDNs and stay cached in your browser so subsequent removals start immediately.',
    ],
    technicalNotes: {
      supportedFormats: 'Input: JPG/JPEG, PNG, WebP. Export: Full-resolution transparent PNG.',
      limits: 'Up to 25 MB, 8,000 px max side, and 25 MP total resolution.',
      privacyModel: 'Photos never leave your browser. First run fetches ONNX model weights from Hugging Face (or IMG.LY CDN fallback) into browser CacheStorage (ai-utility-hub-bg-models-v1).',
      tradeoffs: 'Complex glass reflections, heavy motion blur, or fine stray hair against cluttered backgrounds can require gentle Edge Feathering.',
    },
    faqs: [
      {
        question: 'Are my photos uploaded to a server?',
        answer:
          'No. Background removal runs entirely inside your browser via WebAssembly and ONNX Runtime (BRIA RMBG-1.4 / IS-Net / MODNet). On your first run, the browser downloads open model weights into local CacheStorage so your photos never leave your device.',
      },
      {
        question: 'Why is the output exported as PNG?',
        answer:
          'PNG supports full 8-bit alpha transparency, preserving soft edges and completely clear background pixels at your original image dimensions.',
      },
      {
        question: 'What types of photos work best and what are the limitations?',
        answer:
          'Clear subjects such as portraits, products, pets, and logos with distinct foreground/background contrast produce the cleanest cutouts. Results may vary with cluttered backgrounds, flyaway hair, transparent/reflective objects, or low-resolution images.',
      },
    ],
    relatedIds: ['image-background-changer', 'image-resizer', 'image-compressor'],
  },
  {
    id: 'image-background-changer',
    name: 'Image Background Changer',
    metaTitle: 'AI Image Background Changer Online — AI Utility Hub',
    metaDescription:
      'Swap photo backgrounds in your browser with cached AI segmentation. Apply solid colors, gradients, or custom photos and export JPG or PNG.',
    shortDescription: 'Swap photo backgrounds with colors, gradients, or images.',
    longDescription:
      'Isolate foreground subjects locally in your browser using cached AI segmentation and replace the backdrop with solid colors, gradients, or custom photos.',
    category: 'Image',
    subcategory: 'Background Editing',
    iconName: 'Palette',
    instructions: [
      'Drag and drop or browse to upload a JPG, JPEG, PNG, or WebP foreground subject photo (up to 25 MB and 25 MP).',
      'Click Remove Background & Apply to isolate your subject locally using the cached browser AI model.',
      'Switch freely between Solid Colors (or Transparent), Custom/Preset Gradients, and Custom Background Images (Cover, Contain, Fill), then download as JPG or PNG.',
    ],
    useCases: [
      'Putting portraits or team headshots onto consistent neutral Ivory, Forest Green, or brand gradient backdrops.',
      'Testing studio product shots over multiple colors or lifestyle background photos in seconds.',
      'Exporting ready-to-upload JPG thumbnails alongside transparent PNG master cutouts from one segmentation pass.',
    ],
    tips: [
      'Once your foreground is segmented, switch colors, gradients, and custom photos freely—only Canvas compositing re-runs, never the AI model.',
      'Use Cover fit when your custom backdrop should fill the entire frame without borders, or Contain when the whole backdrop photo must stay visible.',
      'Pick Transparent in Solid Color mode whenever you want a PNG cutout rather than an opaque JPG/PNG composite.',
    ],
    technicalNotes: {
      supportedFormats: 'Foreground & Backdrop Inputs: JPG/JPEG, PNG, WebP. Export: JPG or PNG.',
      limits: 'Up to 25 MB, 8,000 px max side, and 25 MP total resolution for foreground and backdrop images.',
      privacyModel: 'Images stay strictly in your browser; shares the cached ONNX model (ai-utility-hub-bg-models-v1) with Background Remover.',
      tradeoffs: 'Cutouts rely on local AI mask accuracy; lighting color-casts from the original scene are not relit onto new photo backdrops.',
    },
    faqs: [
      {
        question: 'Does switching backgrounds re-run AI segmentation every time?',
        answer:
          'No. Once your foreground image is segmented, the subject mask is kept in memory so switching solid colors, gradients, and custom backdrop photos updates the live preview instantaneously.',
      },
      {
        question: 'Does it reuse the AI model from Image Background Remover?',
        answer:
          'Yes. Both tools share the same cached browser ONNX model and Web Worker session, avoiding duplicate downloads.',
      },
      {
        question: 'When should I download PNG vs JPG?',
        answer:
          'Select the Transparent swatch in Solid Color to download a transparent PNG, or select any solid color, gradient, or custom background image to download a high-quality JPG (or opaque PNG).',
      },
    ],
    relatedIds: ['image-background-remover', 'image-resizer', 'image-compressor'],
  },
];

export const WHY_CHOOSE_FEATURES: FeatureItem[] = [
  {
    id: 'free-to-use',
    title: 'Free to Use',
    description:
      'Access essential file, image, text, and developer utilities without subscriptions or paywalls.',
    iconName: 'CheckCircle2',
  },
  {
    id: 'simple-and-easy',
    title: 'Simple and Easy',
    description:
      'Clear controls and thoughtful layouts help you complete routine tasks in just a few clicks.',
    iconName: 'SlidersHorizontal',
  },
  {
    id: 'fast-and-reliable',
    title: 'Fast and Reliable',
    description:
      'Lightweight interfaces stay responsive across desktop, tablet, and mobile browsers.',
    iconName: 'Zap',
  },
  {
    id: 'privacy-focused',
    title: 'Privacy Focused',
    description:
      'Designed with a clutter-free, respectful experience that puts your workflow and files first.',
    iconName: 'ShieldCheck',
  },
];
