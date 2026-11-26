export type ToolSlug =
  | 'image-compressor'
  | 'qr-code-generator'
  | 'pdf-tools'
  | 'json-formatter'
  | 'image-resizer'
  | 'word-counter'
  | 'pdf-to-word'
  | 'word-to-pdf'
  | 'image-background-remover'
  | 'image-background-changer';

export type RoutePath =
  | '/'
  | '/tools'
  | '/about'
  | '/contact'
  | '/privacy'
  | '/terms'
  | `/tools/${ToolSlug}`;

export type ToolCategory = 'All' | 'Image' | 'Documents' | 'Developer' | 'Text';

export interface ToolFaqItem {
  question: string;
  answer: string;
}

export interface ToolTechnicalNotes {
  supportedFormats: string;
  limits: string;
  privacyModel: string;
  tradeoffs: string;
}

export interface ToolDefinition {
  id: ToolSlug;
  name: string;
  metaTitle: string;
  metaDescription: string;
  shortDescription: string;
  longDescription: string;
  category: Exclude<ToolCategory, 'All'>;
  subcategory: string;
  iconName:
    | 'Image'
    | 'QrCode'
    | 'FileText'
    | 'Braces'
    | 'Scan'
    | 'Type'
    | 'FileOutput'
    | 'FilePlus2'
    | 'Eraser'
    | 'Palette';
  instructions: string[];
  useCases: string[];
  tips: string[];
  technicalNotes: ToolTechnicalNotes;
  faqs: ToolFaqItem[];
  relatedIds: ToolSlug[];
}

export interface FeatureItem {
  id: string;
  title: string;
  description: string;
  iconName: 'CheckCircle2' | 'SlidersHorizontal' | 'Zap' | 'ShieldCheck';
}
