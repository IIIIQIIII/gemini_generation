import { GoogleGenAI } from "@google/genai";

// Type definitions for better type safety
interface VideoGenerationConfig {
  aspectRatio?: '16:9' | '9:16';
  negativePrompt?: string;
  personGeneration?: 'allow_all' | 'allow_adult' | 'dont_allow';
}

interface VideoGenerationRequest {
  model: string;
  prompt: string;
  config?: VideoGenerationConfig;
}

// Use unknown for complex third-party types
type VideoOperation = unknown;

// Initialize the Google GenAI client with the API key
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Text generation function
export async function generateText(prompt: string): Promise<string> {
  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    if (!response.text) {
      throw new Error("No text was generated");
    }
    
    return response.text;
  } catch (error) {
    console.error("Error generating text:", error);
    throw new Error(`Failed to generate text: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Image generation function
export async function generateImage(prompt: string): Promise<string> {
  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: prompt,
    });
    
    if (!response.candidates?.[0]?.content?.parts) {
      throw new Error("No image candidates found");
    }
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData?.data) {
        return part.inlineData.data; // Base64 data of the generated image
      }
    }
    
    throw new Error("No image was generated");
  } catch (error) {
    console.error("Error generating image:", error);
    throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Image editing function (text + image to image)
export async function editImage(prompt: string, imageData: string): Promise<string> {
  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: imageData,
          },
        },
      ],
    });
    
    if (!response.candidates?.[0]?.content?.parts) {
      throw new Error("No image candidates found");
    }
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData?.data) {
        return part.inlineData.data; // Base64 data of the generated image
      }
    }
    
    throw new Error("No image was edited");
  } catch (error) {
    console.error("Error editing image:", error);
    throw new Error(`Failed to edit image: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Video analysis function
export async function analyzeVideo(prompt: string, videoData: string): Promise<string> {
  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: "video/mp4",
            data: videoData,
          },
        },
        { text: prompt },
      ],
    });
    
    if (!response.text) {
      throw new Error("No text response from video analysis");
    }
    
    return response.text;
  } catch (error) {
    console.error("Error analyzing video:", error);
    throw new Error(`Failed to analyze video: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Function to handle YouTube video analysis
export async function analyzeYouTubeVideo(prompt: string, youtubeUrl: string): Promise<string> {
  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { text: prompt },
        {
          fileData: {
            fileUri: youtubeUrl,
          },
        },
      ],
    });
    
    if (!response.text) {
      throw new Error("No text response from YouTube video analysis");
    }
    
    return response.text;
  } catch (error) {
    console.error("Error analyzing YouTube video:", error);
    throw new Error(`Failed to analyze YouTube video: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Video generation function with model selection
export async function generateVideo(
  prompt: string, 
  model: 'veo-3.0-fast-generate-preview' | 'veo-2.0-generate-001' = 'veo-3.0-fast-generate-preview',
  config?: VideoGenerationConfig
): Promise<VideoOperation> {
  try {
    const requestConfig: VideoGenerationRequest = {
      model,
      prompt,
    };

    // Add optional configuration
    if (config) {
      requestConfig.config = {
        aspectRatio: config.aspectRatio,
        negativePrompt: config.negativePrompt,
        personGeneration: config.personGeneration,
      };
    }

    const operation = await genAI.models.generateVideos(requestConfig);
    
    if (!operation) {
      throw new Error("Failed to start video generation operation");
    }
    
    return operation as VideoOperation;
  } catch (error) {
    console.error("Error generating video:", error);
    throw new Error(`Failed to generate video: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Poll video generation operation status
export async function getVideoOperation(operation: VideoOperation): Promise<VideoOperation> {
  try {
    const updatedOperation = await genAI.operations.getVideosOperation({ operation: operation as never });
    return updatedOperation as VideoOperation;
  } catch (error) {
    console.error("Error getting video operation:", error);
    throw new Error(`Failed to get video operation: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Download generated video
export async function downloadVideo(videoFile: { uri: string }, downloadPath: string): Promise<void> {
  try {
    await genAI.files.download({
      file: videoFile,
      downloadPath,
    });
  } catch (error) {
    console.error("Error downloading video:", error);
    throw new Error(`Failed to download video: ${error instanceof Error ? error.message : String(error)}`);
  }
}
