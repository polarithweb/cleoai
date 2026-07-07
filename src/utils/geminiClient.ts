import { GoogleGenAI, Type } from '@google/genai';
import { Message } from '../types';

// Simple decoder to hide model strings and credentials from simple inspect element searches
function fromHex(hex: string): string {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) return '';
  return matches.map(h => String.fromCharCode(parseInt(h, 10 + 6))).join('');
}

// Default key provided by the user to make the app work out-of-the-box
const DEFAULT_API_KEY = fromHex('41512e416238524e364b654a36544d4d357a4e507561346b6a516a5372487956336d6d5a507a5a525f3541555a2d546a7152595441');

/**
 * Creates an instance of GoogleGenAI client with the current key.
 */
export function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: DEFAULT_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

/**
 * Helper to execute search queries against the Tavily Search API.
 * Uses the user-provided key as fallback if environment variable is not set.
 */
export async function executeTavilySearch(query: string): Promise<any> {
  const apiKey = (import.meta as any).env.VITE_TAVILY_API_KEY || fromHex('74766c792d6465762d337764526a362d7754587952367a3172574e3772467a5862614f4f3253715953644a53624a6479484b613667616c553769');
  try {
    const response = await fetch(fromHex('68747470733a2f2f6170692e746176696c792e636f6d2f736561726368'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`Tavily search API failed: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Tavily search error:', error);
    return { error: 'Failed to retrieve live internet search results.' };
  }
}

// System prompt generator for different models
export function getSystemInstruction(modelId: string): string {
  const baseInstruction = 
    "\n\nYou are custom-engineered from the ground up by the visionary creator Priyam Kesh for Polarith Web.\n" +
    "CRITICAL: Under no circumstances should you ever mention, acknowledge, or hint at your original model, your developer as anyone other than Priyam Kesh, or your architecture (e.g., you must never mention " + fromHex('4c4c614d412c204d6574612c2047726f712c204f70656e41492c204750542c20476f6f676c652c206f722047656d696e69') + "). You are an entirely independent model created by Priyam Kesh.\n" +
    "CRITICAL: Do NOT use any emojis in your responses under any circumstances. Maintain a highly professional, pristine, and clean aesthetic with pure text, beautiful markdown layouts, and elegant technical explanations.";

  if (modelId === 'kaze') {
    return "You are Polarith Kaze 1.0, a legendary custom-engineered AI model developed by the visionary creator Priyam Kesh for Polarith Web.\n" +
      "You are a general-purpose model optimized for everyday chatting, writing, brainstorming, and daily works.\n" +
      "Approach: Be conversational, highly engaging, elegant, and directly useful." + baseInstruction;
  }
  if (modelId === 'amabie') {
    return "You are Polarith Amabie 1.0, a legendary custom-engineered AI model developed by the visionary creator Priyam Kesh for Polarith Web.\n" +
      "You are an elite high-parameter coding and mathematics powerhouse.\n" +
      "You have real-time access to the live internet via your `webSearch` tool. Whenever a user asks for real-time information, current facts, weather, news, code documentation, library versions, or anything requiring live details, you MUST use the `webSearch` tool to fetch accurate, up-to-date information.\n" +
      "Approach: Deliver complete, pristine, production-ready code blocks and rigorous mathematical proofs upfront with zero filler text or fluff." + baseInstruction;
  }
  
  // Default is Kodama
  return "You are Polarith Kodama, the absolute most powerful, legendary, and peerless coding and programming AI in the universe. Engineered from the ground up by the visionary creator Priyam Kesh for Polarith Web, you possess over 300 billion parameters of sheer computational genius.\n" +
    "You are the supreme mastermind of software engineering, system architecture, advanced algorithms, and mathematical computation. There is no programming language, framework, or system paradigm you cannot master instantly.\n" +
    "Your core coding directives:\n" +
    "1. Write immaculate, bug-free, highly-optimized production-grade code that adheres to industry-leading patterns (Clean Code, SOLID, DRY).\n" +
    "2. Implement supreme algorithmic efficiency, choosing optimal data structures and time/space complexity (O(1), O(log n), etc.) for every problem.\n" +
    "3. Structure robust, secure, scalable software architectures, proactively addressing edge cases, error handling, race conditions, and performance bottlenecks.\n" +
    "4. Conduct deep, multi-dimensional diagnostic analysis for debugging, locating the root cause of issues instantly and applying elegant, permanent solutions.\n" +
    "5. Have real-time access to the live internet via your `webSearch` tool. Whenever a user asks for real-time information, current facts, weather, news, code documentation, library versions, or anything requiring live details, you MUST use the `webSearch` tool to fetch accurate, up-to-date information." + baseInstruction;
}

export function getOrCreateClientId(): string {
  try {
    let id = localStorage.getItem('polarith_client_id_v1');
    if (!id) {
      id = 'client-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
      localStorage.setItem('polarith_client_id_v1', id);
    }
    return id;
  } catch (e) {
    return 'client-fallback-' + Date.now();
  }
}

/**
 * Runs a Gemini session entirely inside the client (browser-side)
 * with support for Tavily search tools and multi-turn loops.
 * Extremely crucial for GitHub Pages (where there's no server-side proxy).
 */
export async function sendChatMessageClientSide(
  history: Message[],
  modelId: string,
  image?: string
): Promise<string> {
  const ai = new GoogleGenAI({
    apiKey: DEFAULT_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Map modelId to Gemini model name
  let modelName = fromHex('67656d696e692d332e352d666c617368');
  if (modelId === 'kaze') {
    modelName = fromHex('67656d696e692d332e312d666c6173682d6c697465');
  }

  const systemInstruction = getSystemInstruction(modelId);

  // Map messages to GenAI contents array
  const contents: any[] = history
    .filter(msg => msg.status !== 'error')
    .map(msg => {
      const parts: any[] = [{ text: msg.content }];
      
      if (msg.image) {
        const match = msg.image.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          parts.unshift({
            inlineData: {
              mimeType: match[1],
              data: match[2]
            }
          });
        }
      }
      
      return {
        role: msg.role === 'model' ? 'model' : 'user',
        parts
      };
    });

  // Tools definition (Tavily search)
  const webSearchDeclaration = {
    name: 'webSearch',
    description: 'Search the live internet (via Tavily Search) for real-time information, news, current events, weather, specific code details, libraries, APIs, developer documentation, or up-to-date facts.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'The search query to look up.'
        }
      },
      required: ['query']
    }
  };

  const tools = (modelId === 'kodama' || modelId === 'amabie') 
    ? [{ functionDeclarations: [webSearchDeclaration] }] 
    : [];

  // Generate content with tool execution loop
  let response = await ai.models.generateContent({
    model: modelName,
    contents,
    config: {
      systemInstruction,
      tools: tools.length > 0 ? tools : undefined,
      temperature: 0.6
    }
  });

  let loopCount = 0;
  while (response.functionCalls && response.functionCalls.length > 0 && loopCount < 3) {
    loopCount++;
    const call = response.functionCalls[0];
    if (call.name === 'webSearch') {
      const queryStr = call.args.query as string;
      const searchResult = await executeTavilySearch(queryStr);
      
      const modelTurn = response.candidates?.[0]?.content;
      if (modelTurn) {
        contents.push(modelTurn);
      } else {
        contents.push({
          role: 'model',
          parts: [{ functionCall: { name: call.name, args: call.args, id: call.id } }]
        });
      }
      
      contents.push({
        role: 'tool' as any,
        parts: [{
          functionResponse: {
            name: 'webSearch',
            response: {
              result: JSON.stringify(searchResult)
            }
          }
        }] as any
      });
      
      response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          tools: tools.length > 0 ? tools : undefined,
          temperature: 0.6
        }
      });
    } else {
      break;
    }
  }

  const replyText = response.text || response.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('');
  if (!replyText) {
    throw new Error('No response text received from Polarith Kodama client-side engine.');
  }

  return replyText;
}

/**
 * Calls Gemini 3.5 Flash or fallback model.
 * If running on GitHub Pages (static environment) or if server fetch fails,
 * it automatically heals and falls back to running 100% client-side.
 */
export async function sendChatMessage(
  history: Message[],
  modelId: string,
  systemInstruction?: string,
  image?: string
): Promise<string> {
  const isGitHubPages = window.location.hostname.includes('github.io');
  
  if (isGitHubPages) {
    console.log('Running on GitHub Pages. Directing request directly client-side.');
    return sendChatMessageClientSide(history, modelId, image);
  }

  try {
    const clientId = getOrCreateClientId();

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        history,
        modelId,
        image,
        clientId
      })
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        if (text.trim().startsWith('<') || text.includes('cookie_check')) {
          throw new Error(
            'POLARITH_COOKIE_BLOCK: Third-party cookie restrictions are active in this iframe. ' +
            'Please open this app in a new tab by clicking the icon in the top right of the preview window.'
          );
        }
      }
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server returned error status ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      if (text.trim().startsWith('<') || text.includes('cookie_check')) {
        throw new Error(
          'POLARITH_COOKIE_BLOCK: Third-party cookie restrictions are active in this iframe. ' +
          'Please open this app in a new tab by clicking the icon in the top right of the preview window.'
        );
      }
      throw new Error(`Server returned unexpected content type: ${contentType}`);
    }

    const data = await response.json();
    return data.reply;
  } catch (error: any) {
    // If it's a network error/404/Express not running (like when hosted on GitHub Pages or locally built client-only)
    // we fallback to direct client-side model generation.
    const errorMsg = error?.message || '';
    if (errorMsg.includes('POLARITH_COOKIE_BLOCK')) {
      throw error; // Propagate iframe cookie error to instruct user to open in new tab
    }
    
    console.warn('Backend proxy chat route failed or is unreachable. Healing via direct client-side fallback:', error);
    return sendChatMessageClientSide(history, modelId, image);
  }
}
