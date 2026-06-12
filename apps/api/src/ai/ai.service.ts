import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (apiKey) {
      this.logger.log(`GOOGLE_API_KEY loaded (Starts with: ${apiKey.substring(0, 4)})`);
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      this.logger.warn('GOOGLE_API_KEY not found in environment. AI features will be disabled.');
    }
  }

  async askAssistant(prompt: string): Promise<string> {
    if (!this.genAI) {
      return "AI Assistant is currently in maintenance mode (Missing API Key). Please contact the administrator.";
    }

    try {
      this.logger.log(`Calling Gemini API for prompt: ${prompt.substring(0, 20)}...`);
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const systemContext = `
        You are the WeConnect AI Assistant, an expert in e-waste management, sustainability, and circular economy.
        Your goal is to help administrators manage an e-waste platform. 
        Be concise, professional, and helpful. 
      `;

      const result = await model.generateContent([systemContext, prompt]);
      const response = await result.response;
      const text = response.text();
      this.logger.log(`Gemini response received (${text.length} chars)`);
      return text;
    } catch (error) {
      this.logger.error('Failed to get response from Gemini AI', error);
      return `I encountered an error while processing your request: ${error.message}`;
    }
  }
}
