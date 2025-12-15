import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { ArticleConfig, ImageSize, AspectRatio, ArticleType, Length } from '../types';

const getAiClient = () => {
  // Use process.env.API_KEY exclusively as per guidelines. 
  // The environment handles injection of the key selected via aistudio.
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

// Helper to handle 503 Overloaded errors with exponential backoff
const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    // Check for common overload indicators in Gemini API errors
    const isOverloaded = 
      error?.status === 503 || 
      error?.code === 503 || 
      (error?.message && typeof error.message === 'string' && (
          error.message.includes('503') || 
          error.message.toLowerCase().includes('overloaded')
      ));

    if (retries > 0 && isOverloaded) {
      console.warn(`Model overloaded. Retrying in ${delay}ms... (Attempts left: ${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(operation, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const streamArticleGeneration = async (
  config: ArticleConfig,
  onChunk: (text: string) => void
): Promise<void> => {
  const ai = getAiClient();
  const model = 'gemini-2.5-flash';

  let structureInstructions = '';

  if (config.type === ArticleType.FOOD) {
      structureInstructions = `
      3. **Structure (Recipe Format)**:
       - H1: Mouth-watering, descriptive title.
       - **Introduction**: Engaging story or description of the dish, flavor profile, and why it's special.
       - **Recipe Facts**: Present the following data in a **Markdown Table** with columns: Prep Time, Cook Time, Total Time, Servings, Calories/Serving.
       - **Ingredients**: Clear bulleted list with precise measurements.
       - **Instructions**: Numbered, step-by-step cooking directions.
       - **Nutritional Breakdown**: Estimated protein, carbs, and fat per serving.
       - **Chef's Tips**: Specific advice for best results or variations.
       - Conclusion: Serving suggestions.
      `;
  } else {
      structureInstructions = `
      3. **Structure**: 
       - H1: Engaging, click-worthy title.
       - Intro: Hook the reader immediately with a question, stat, or bold claim.
       - Body: Use H2/H3, bullet points, and **bold** text for scannability.
       - Conclusion: Actionable summary, no fluff.
      `;
  }

  let genZStyle = '';
  if (config.length.includes(Length.GEN_Z)) {
    genZStyle = `
    STYLE OVERRIDE: GEN Z MODE ACTIVE ⚡️
    - Vibe: Chaotic good, authentic, unhinged but helpful.
    - Formatting: Aesthetic > Formal. Use lowercase headings if it fits the vibe.
    - Slang: Use current internet slang (fr, no cap, bet, slays, cringe, based, delulu) but DON'T force it. It has to flow naturally.
    - Emojis: Yes. Use them liberally. 💀 😭 ✨
    - Structure: Extremely short paragraphs. Attention span is low. Get to the point.
    - Tone: Relatable bestie.
    `;
  }

  const prompt = `
    You are an elite Senior Content Writer and SEO Expert.
    Your absolute priority is to write a **100% original, human-quality article** that is safe for AdSense and ranks high on Google.
    
    TARGET: **95%+ Originality Score** (Must pass AI detection and Plagiarism checks).

    SPECIFICATIONS:
    - **Topic**: ${config.topic}
    - **Category**: ${config.type}
    - **Keywords**: ${config.keywords || 'Natural, high-traffic keywords'}
    - **Tone**: ${config.tone} (Must sound authentic, not robotic)
    - **Length**: ${config.length}
    - **Language**: ${config.language}
    - **Instructions**: ${config.additionalInstructions || 'None'}

    ${genZStyle}

    STRICT WRITING GUIDELINES FOR SAFETY & RANKING:
    1. **Anti-Plagiarism**: Never copy-paste. Synthesize information into completely new sentences.
    2. **Anti-AI Detection**: 
       - Vary sentence length drastically (mix short punchy sentences with longer descriptive ones).
       - Avoid "AI-isms" like "In the fast-paced world of...", "delve into", "unlock", "comprehensive guide".
       - Use active voice, personal perspective, and idiomatic language.
    ${structureInstructions}
    4. **Value**: Focus on unique insights, specific examples, or "unpopular opinions" to differentiate from generic web content.

    FORMAT:
    - Pure Markdown.
    - No preamble. Start with the H1.
  `;

  try {
    const response = await retryWithBackoff<AsyncIterable<GenerateContentResponse>>(() => ai.models.generateContentStream({
      model: model,
      contents: prompt,
      config: {
        temperature: 0.95, // Increased slightly for Gen Z creativity
        topP: 0.95,
        topK: 40,
      }
    }));

    for await (const chunk of response) {
      if (chunk.text) {
        onChunk(chunk.text);
      }
    }
  } catch (error) {
    console.error("Error generating content:", error);
    throw error;
  }
};

export const suggestKeywords = async (
  topic: string,
  type: string
): Promise<string[]> => {
  const ai = getAiClient();
  const model = 'gemini-2.5-flash';

  const prompt = `
    Generate 6-8 high-ranking, high-traffic, relevant SEO keywords (mix of short-tail and long-tail) for a blog article.
    
    Context:
    - Topic: ${topic}
    - Category: ${type}
    
    Return ONLY the keywords as a JSON array of strings.
  `;

  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    }));

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as string[];
  } catch (error) {
    console.error("Error suggesting keywords:", error);
    return [];
  }
};

export const suggestTopic = async (
  type: string
): Promise<string> => {
  const ai = getAiClient();
  const model = 'gemini-2.5-flash';

  const prompt = `
    Generate ONE engaging, search-optimized blog topic or product review title based on this category: "${type}".
    It should be catchy, specific, and something people actually search for.
    Return ONLY the text of the topic. Do not use quotes.
  `;

  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: model,
      contents: prompt,
    }));
    return response.text?.trim() || '';
  } catch (error) {
    console.error("Error suggesting topic:", error);
    return '';
  }
};

export const generateImage = async (
  promptText: string,
  size: ImageSize = ImageSize.S_1K,
  aspectRatio: AspectRatio = AspectRatio.S_16_9,
  count: number = 1
): Promise<string[]> => {
  const ai = getAiClient();
  
  let model = 'gemini-2.5-flash-image';
  let imageConfig: any = {
    aspectRatio: aspectRatio 
  };

  if (size === ImageSize.S_2K || size === ImageSize.S_4K) {
    model = 'gemini-3-pro-image-preview';
    imageConfig.imageSize = size;
  }

  // Ensure prompt is descriptive enough for a standalone image
  const enhancedPrompt = `High quality, photorealistic image. ${promptText}. No text.`;

  // Function to perform a single generation
  const generateSingle = async (): Promise<string | null> => {
    try {
      const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: model,
        contents: {
          parts: [{ text: enhancedPrompt }]
        },
        config: {
          imageConfig: imageConfig
        }
      }));

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          return `data:image/png;base64,${base64EncodeString}`;
        }
      }
      return null;
    } catch (error) {
      console.error("Error generating single image:", error);
      return null;
    }
  };

  // Execute multiple requests in parallel if count > 1
  try {
    const safeCount = Math.max(1, Math.min(count, 5));
    const promises = Array.from({ length: safeCount }, () => generateSingle());
    const results = await Promise.all(promises);
    return results.filter((url): url is string => url !== null);
  } catch (error) {
    console.error("Error generating images:", error);
    return [];
  }
};

export const generateCoverImage = async (
  topic: string, 
  size: ImageSize,
  aspectRatio: AspectRatio,
  count: number = 1
): Promise<string[]> => {
  const prompt = `Create a high-quality, modern, photorealistic cover image for a blog article about: ${topic}. 
  The image should be professional, visually striking, and suitable for a digital publication. 
  Avoid text in the image.`;
  
  return generateImage(prompt, size, aspectRatio, count);
};

export const editGeneratedImage = async (
  imageBase64: string,
  prompt: string,
  maskBase64?: string
): Promise<string | null> => {
  const ai = getAiClient();
  // Using the flash-image model for editing
  const model = 'gemini-2.5-flash-image';

  // Strip the data:image/...;base64, prefix
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const parts: any[] = [
    {
      inlineData: {
        mimeType: 'image/png', // Assuming PNG from previous generation
        data: base64Data,
      },
    }
  ];

  let promptText = prompt;

  if (maskBase64) {
      const maskData = maskBase64.replace(/^data:image\/\w+;base64,/, '');
      parts.push({
          inlineData: {
              mimeType: 'image/png',
              data: maskData
          }
      });
      promptText = `Edit the first image based on the mask provided in the second image. The white pixels in the mask indicate the area to be modified. Modification instruction: ${prompt}`;
  } else {
      promptText = prompt;
  }

  parts.push({ text: promptText });

  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: model,
      contents: {
        parts: parts,
      },
    }));

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64EncodeString = part.inlineData.data;
        return `data:image/png;base64,${base64EncodeString}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error editing image:", error);
    throw error;
  }
};

export const checkOriginality = async (content: string): Promise<string> => {
  const ai = getAiClient();
  const model = 'gemini-2.5-flash';

  const checkPrompt = `
    You are a strict Content Safety & SEO Auditor.
    Analyze the text below for SEO effectiveness, Human-like writing style, and AdSense safety.
    
    CRITERIA:
    1. **SEO**: Keyword usage, heading structure, and engagement.
    2. **Human-Like**: Assess for robotic patterns, repetition, and natural flow (simulate an AI detection check).
    3. **Safety**: Plagiarism risks and AdSense compliance.
    
    OUTPUT FORMAT (Markdown):
    **SEO Score**: [0-100] / 100
    **Human Score**: [0-100]%
    **Safety Score**: [0-100]%
    **Verdict**: [Safe to Publish / Needs Optimization]
    
    **Analysis**:
    - [Concise insight on SEO]
    - [Concise insight on Human/Safety qualities]

    Text (sample):
    "${content.substring(0, 3000)}..."
  `;

  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: model,
      contents: checkPrompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    }));
    
    let resultText = response.text || '';
    
    // Append search results if available
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks && groundingChunks.length > 0) {
       resultText += "\n\n**Found Sources (Potential overlaps):**\n";
       groundingChunks.forEach((chunk: any) => {
         if (chunk.web?.uri) {
           resultText += `- [${chunk.web.title || 'Source'}](${chunk.web.uri})\n`;
         }
       });
    }

    return resultText;
  } catch (error) {
    console.error("Error checking originality:", error);
    throw error;
  }
};

export const extractFocusKeyword = async (content: string): Promise<string> => {
  const ai = getAiClient();
  const model = 'gemini-2.5-flash';

  const prompt = `
    Analyze the following text and identify the single most important SEO focus keyword or keyphrase.
    Return ONLY the keyword/keyphrase as a plain string. Do not use quotes or markdown.

    Text:
    "${content.substring(0, 10000)}"
  `;

  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: model,
      contents: prompt,
    }));
    return response.text?.trim() || '';
  } catch (error) {
    console.error("Error extracting focus keyword:", error);
    return '';
  }
};