
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const API_URL = "http://localhost:4000/api/items";

export async function fetchItems() {
  const res = await fetch(API_URL);
  return res.json();
}

export async function createItem(data: any) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return res.json();
}


export const enhanceDescription = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Enhance this description for a campus lost and found item to be more clear and descriptive, while keeping it concise. Return ONLY the enhanced description. Original: "${text}"`,
    });
    return response.text?.trim() || text;
  } catch (error) {
    console.error("Gemini enhancement failed:", error);
    return text;
  }
};

export const suggestCategory = async (title: string, description: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Based on this item title: "${title}" and description: "${description}", categorize it into one of these: Electronics, Books & Stationery, Clothing & Accessories, Keys, Cards & IDs, Other. Return ONLY the category name.`,
    });
    return response.text?.trim() || 'Other';
  } catch (error) {
    console.error("Gemini categorization failed:", error);
    return 'Other';
  }
};
