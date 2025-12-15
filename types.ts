export enum Tone {
  PROFESSIONAL = 'Professional',
  CASUAL = 'Casual',
  ENTHUSIASTIC = 'Enthusiastic',
  AUTHORITATIVE = 'Authoritative',
  WITTY = 'Witty',
  GEN_Z = 'Gen Z (Slang)'
}

export enum Length {
  SHORT = 'Short (Social Media)',
  MEDIUM = 'Medium (Blog Post)',
  LONG = 'Long (Deep Dive)',
  GEN_Z = 'Gen Z Style (Viral)'
}

export enum ArticleType {
  FINANCE = 'Personal Finance',
  TECH = 'Technology & Gadgets',
  HEALTH = 'Health & Fitness',
  FOOD = 'Food & Recipes',
  TRAVEL = 'Travel',
  BEAUTY = 'Beauty & Skincare',
  FASHION = 'Fashion',
  HOME = 'Home Improvement & DIY',
  PARENTING = 'Parenting',
  PETS = 'Pets & Animals',
  EDUCATION = 'Education',
  BUSINESS = 'Business & Entrepreneurship',
  GAMING = 'Gaming',
  AI = 'AI & Productivity Tools',
  SELF_IMPROVEMENT = 'Self-Improvement',
  REVIEWS = 'Product Reviews',
  LIFESTYLE = 'Lifestyle',
  KITCHEN = 'Kitchen & Cooking Gear',
  LUXURY = 'Luxury Products',
  TRENDS = 'Viral Trends',
  SMART_HOME = 'Smart Home',
  FINANCIAL = 'Financial',
  MONEY = 'Money',
  INSURANCE = 'Insurance',
  LOANS = 'Loans'
}

export enum ImageSize {
  S_1K = '1K',
  S_2K = '2K',
  S_4K = '4K'
}

export enum AspectRatio {
  S_1_1 = '1:1',
  S_3_4 = '3:4',
  S_4_3 = '4:3',
  S_9_16 = '9:16',
  S_16_9 = '16:9'
}

export enum Language {
  ENGLISH = 'English',
  SPANISH = 'Spanish',
  FRENCH = 'French',
  GERMAN = 'German',
  ITALIAN = 'Italian',
  DUTCH = 'Dutch',
  PORTUGUESE = 'Portuguese',
  RUSSIAN = 'Russian',
  CHINESE = 'Chinese',
  JAPANESE = 'Japanese',
  KOREAN = 'Korean',
  HINDI = 'Hindi',
  ARABIC = 'Arabic',
  TURKISH = 'Turkish',
  VIETNAMESE = 'Vietnamese',
  THAI = 'Thai',
  KHMER = 'Khmer'
}

export interface ArticleConfig {
  topic: string; // e.g., Product Name
  type: string; // Changed to string to support custom categories
  keywords: string;
  tone: Tone;
  length: Length[];
  language: Language;
  additionalInstructions: string;
  generateImage?: boolean;
  imageSize?: ImageSize;
  aspectRatio?: AspectRatio;
  numberOfImages?: number;
}

export interface GeneratedArticle {
  content: string;
  isComplete: boolean;
}

export interface SavedArticle {
  id: string;
  topic: string;
  content: string;
  date: number;
  type: string; // Changed to string to support custom categories
  imageUrl?: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: 'google' | 'facebook' | 'x' | 'email';
}