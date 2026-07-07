import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';

function getSystemInstruction(modelId: string): string {
  const baseInstruction = 
    "\n\nYou are custom-engineered from the ground up by the visionary creator Priyam Kesh for Polarith Web.\n" +
    "CRITICAL: Under no circumstances should you ever mention, acknowledge, or hint at your original model, your developer as anyone other than Priyam Kesh, or your architecture (e.g., you must never mention LLaMA, Meta, Groq, OpenAI, GPT, Google, or Gemini). You are an entirely independent model created by Priyam Kesh.\n" +
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

async function executeTavilySearch(query: string): Promise<any> {
  const apiKey = process.env.VITE_TAVILY_API_KEY || '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';
  try {
    const response = await fetch('https://api.tavily.com/search', {
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

/**
 * Robust wrapper around ai.models.generateContent that implements 
 * exponential backoff retries for transient errors (like 503 / 429) 
 * and automatically falls back to an alternate stable model if the 
 * primary model is experiencing high demand.
 */
async function generateContentWithRetry(
  ai: any,
  contents: any[],
  systemInstruction: string,
  tools: any[]
): Promise<any> {
  const modelsToTry = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  const maxRetriesPerModel = 2;
  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
      try {
        console.log(`Generating content using model: ${model}, attempt: ${attempt}/${maxRetriesPerModel}`);
        const response = await ai.models.generateContent({
          model: model,
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
            tools: tools,
            temperature: 0.6,
          }
        });
        return response;
      } catch (error: any) {
        lastError = error;
        console.error(`Attempt ${attempt} for model ${model} failed with error:`, error);
        
        const errorMsg = String(error?.message || '').toLowerCase();
        const errorStatus = String(error?.status || '').toLowerCase();
        
        const isTransient = errorStatus === 'unavailable' || 
                            errorStatus === 'resource_exhausted' ||
                            errorStatus === 'resource exhausted' ||
                            errorStatus.includes('exhausted') ||
                            errorStatus === '429' ||
                            errorStatus === '503' ||
                            errorMsg.includes('503') ||
                            errorMsg.includes('high demand') ||
                            errorMsg.includes('resource exhausted') ||
                            errorMsg.includes('rate limit') ||
                            errorMsg.includes('429') ||
                            errorMsg.includes('quota') ||
                            errorMsg.includes('limit') ||
                            error?.status === 503 ||
                            error?.status === 429;
                            
        if (!isTransient) {
          throw error;
        }

        if (model === modelsToTry[modelsToTry.length - 1] && attempt === maxRetriesPerModel) {
          break;
        }

        const delay = attempt * 1500;
        console.log(`Waiting ${delay}ms before retrying...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Polarith Kodama API generation failed after all retries and fallback models.');
}

interface Stats {
  totalMessages: number;
  uniqueUsers: string[];
  messagesByModel: Record<string, number>;
  recentActivity: Array<{ timestamp: string; event: string }>;
}

let stats: Stats = {
  totalMessages: 0,
  uniqueUsers: [],
  messagesByModel: {
    kodama: 0,
    amabie: 0,
    kaze: 0
  },
  recentActivity: []
};

const STATS_FILE = path.join(process.cwd(), 'stats.json');

// Initialize stats from disk if it exists
try {
  if (fs.existsSync(STATS_FILE)) {
    const data = fs.readFileSync(STATS_FILE, 'utf8');
    stats = JSON.parse(data);
    // Ensure all required fields exist
    if (!stats.messagesByModel) stats.messagesByModel = { kodama: 0, amabie: 0, kaze: 0 };
    if (!stats.uniqueUsers) stats.uniqueUsers = [];
    if (!stats.recentActivity) stats.recentActivity = [];
    if (typeof stats.totalMessages !== 'number') stats.totalMessages = 0;
  } else {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
  }
} catch (err) {
  console.error('Error initializing stats.json:', err);
}

function saveStats() {
  try {
    fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8', (err) => {
      if (err) console.error('Error writing stats.json:', err);
    });
  } catch (err) {
    console.error('Error saving stats:', err);
  }
}

function logActivity(event: string) {
  stats.recentActivity.unshift({
    timestamp: new Date().toISOString(),
    event
  });
  // Keep only the last 50 activities
  if (stats.recentActivity.length > 50) {
    stats.recentActivity = stats.recentActivity.slice(0, 50);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  const fs = await import('fs');
  app.use((req, res, next) => {
    const logLine = `[${new Date().toISOString()}] ${req.method} ${req.url}\n`;
    try {
      fs.appendFileSync('requests.log', logLine);
    } catch (e) {
      // ignore logging errors
    }
    console.log(logLine.trim());
    next();
  });

  app.use(express.json({ limit: '50mb' })); // support larger base64 uploads

  // SEO routes for search engine indexing
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send(
      "User-agent: *\n" +
      "Allow: /\n" +
      "Disallow: /api/stats/\n" +
      "Sitemap: https://polarith.ai/sitemap.xml\n"
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    res.type('application/xml');
    res.send(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      '  <url>\n' +
      '    <loc>https://polarith.ai/</loc>\n' +
      '    <lastmod>2026-07-06</lastmod>\n' +
      '    <changefreq>daily</changefreq>\n' +
      '    <priority>1.0</priority>\n' +
      '  </url>\n' +
      '</urlset>'
    );
  });

  // API route for Whisper transcriptions
  app.post('/api/transcribe', async (req, res) => {
    try {
      const { audio, mimeType } = req.body;
      if (!audio) {
        return res.status(400).json({ error: 'No audio data received' });
      }

      const groqApiKey = process.env.GROQ_API_KEY || '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';
      if (!groqApiKey) {
        return res.status(400).json({ error: 'No Groq API Key detected. Please configure GROQ_API_KEY.' });
      }

      const audioBuffer = Buffer.from(audio, 'base64');
      const audioBlob = new Blob([audioBuffer], { type: mimeType || 'audio/webm' });

      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('model', 'whisper-large-v3-turbo');

      const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`
        },
        body: formData
      });

      if (!groqResponse.ok) {
        const errText = await groqResponse.text();
        throw new Error(`Groq Whisper transcription API failed: ${errText}`);
      }

      const groqData = await groqResponse.json();
      res.json({ text: groqData.text });
    } catch (error: any) {
      console.error('Transcription API Error:', error);
      res.status(500).json({ error: error?.message || String(error) });
    }
  });

  // API route for chatting
  app.post('/api/chat', async (req, res) => {
    let history: any[] = [];
    let modelId = 'kodama';
    try {
      const { history: reqHistory, modelId: reqModelId = 'kodama', image, clientId } = req.body;
      history = reqHistory || [];
      modelId = reqModelId;
      
      // Update statistics
      stats.totalMessages++;
      if (!stats.messagesByModel) {
        stats.messagesByModel = { kodama: 0, amabie: 0, kaze: 0 };
      }
      stats.messagesByModel[modelId] = (stats.messagesByModel[modelId] || 0) + 1;

      if (clientId && !stats.uniqueUsers.includes(clientId)) {
        stats.uniqueUsers.push(clientId);
        logActivity(`New user session registered`);
      }
      
      const readableModelNames: Record<string, string> = {
        kodama: 'Polarith Kodama',
        amabie: 'Polarith Amabie 1.0',
        kaze: 'Polarith Kaze 1.0'
      };
      const modelLabel = readableModelNames[modelId] || modelId;
      logActivity(`Message processed via ${modelLabel}`);
      saveStats();
      
      // If NOT Polarith Kodama or Polarith Amabie, route directly to Groq
      if (modelId !== 'kodama' && modelId !== 'amabie') {
        const groqApiKey = process.env.GROQ_API_KEY || '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';
        if (!groqApiKey) {
          return res.status(400).json({ 
            error: 'No Groq API Key found. Please configure GROQ_API_KEY.' 
          });
        }

        // Map modelId to Groq model ID
        let groqModel = 'llama-3.1-8b-instant';

        if (modelId === 'kaze') {
          groqModel = 'llama-3.1-8b-instant';
        } else if (modelId === 'amabie') {
          groqModel = 'openai/gpt-oss-120b';
        }

        const systemInstruction = getSystemInstruction(modelId);

        const groqMessages: any[] = [
          {
            role: 'system',
            content: systemInstruction
          }
        ];

        for (const msg of history) {
          const role = msg.role === 'user' ? 'user' : 'assistant';
          if (msg === history[history.length - 1] && image) {
            groqMessages.push({
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: msg.content || "Identify and explain what is in this image."
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: image
                  }
                }
              ]
            });
          } else {
            groqMessages.push({
              role: role,
              content: msg.content
            });
          }
        }

        // If user uploaded an image, fallback to vision-capable Groq model
        const actualModelToUse = image ? 'meta-llama/llama-4-scout-17b-16e-instruct' : groqModel;

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: actualModelToUse,
            messages: groqMessages,
            temperature: 0.6,
            max_tokens: 2048
          })
        });

        if (!groqResponse.ok) {
          const errText = await groqResponse.text();
          // Safe fallback if specific premium Groq models are over quota or not found
          if (groqResponse.status === 404 || errText.includes('model_not_found') || errText.includes('unknown_model')) {
            console.warn(`Model ${groqModel} failed or not found. Trying fallback llama-3.1-8b-instant.`);
            const fallbackResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: groqMessages,
                temperature: 0.6,
                max_tokens: 2048
              })
            });
            if (!fallbackResponse.ok) {
              throw new Error(`Fallback Groq model also failed: ${await fallbackResponse.text()}`);
            }
            const fallbackData = await fallbackResponse.json();
            return res.json({ reply: fallbackData.choices?.[0]?.message?.content || '' });
          }
          throw new Error(`Groq API returned status ${groqResponse.status}: ${errText}`);
        }

        const groqData = await groqResponse.json();
        const reply = groqData.choices?.[0]?.message?.content;
        if (!reply) {
          throw new Error('No response text received from Groq.');
        }

        return res.json({ reply });
      }

      // If it has an image, process via Groq's Vision engine
      if (image) {
        const groqApiKey = process.env.GROQ_API_KEY || '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';
        if (!groqApiKey) {
          return res.status(400).json({ 
            error: 'No Groq API Key found for image processing. Please ensure GROQ_API_KEY is configured.' 
          });
        }

        const systemInstruction = getSystemInstruction(modelId);

        const groqMessages: any[] = [
          {
            role: 'system',
            content: systemInstruction
          }
        ];
        for (const msg of history) {
          const role = msg.role === 'user' ? 'user' : 'assistant';
          if (msg === history[history.length - 1] && image) {
            groqMessages.push({
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: msg.content || "Identify and explain what is in this image."
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: image
                  }
                }
              ]
            });
          } else {
            groqMessages.push({
              role: role,
              content: msg.content
            });
          }
        }

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: groqMessages,
            temperature: 0.6,
            max_tokens: 1024
          })
        });

        if (!groqResponse.ok) {
          const errText = await groqResponse.text();
          throw new Error(`Groq Vision API returned status ${groqResponse.status}: ${errText}`);
        }

        const groqData = await groqResponse.json();
        const reply = groqData.choices?.[0]?.message?.content;
        if (!reply) {
          throw new Error('No response text received from Groq vision processing.');
        }

        return res.json({ reply });
      }

      // Use Gemini API for Polarith Kodama or Polarith Amabie
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return res.status(400).json({ 
          error: 'Model is in high demand.' 
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

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

      const contents: any[] = history.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      const systemInstruction = getSystemInstruction(modelId);

      let response = await generateContentWithRetry(
        ai,
        contents,
        systemInstruction,
        [{ functionDeclarations: [webSearchDeclaration] }]
      );

      let loopCount = 0;
      while (response.functionCalls && response.functionCalls.length > 0 && loopCount < 3) {
        loopCount++;
        const call = response.functionCalls[0];
        if (call.name === 'webSearch') {
          const query = call.args.query as string;
          const searchResult = await executeTavilySearch(query);
          
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
            role: 'tool',
            parts: [{
              functionResponse: {
                name: 'webSearch',
                response: {
                  result: JSON.stringify(searchResult)
                }
              }
            }]
          });
          
          response = await generateContentWithRetry(
            ai,
            contents,
            systemInstruction,
            [{ functionDeclarations: [webSearchDeclaration] }]
          );
        } else {
          break;
        }
      }

      if (!response.text) {
        const candidateText = response.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('');
        if (candidateText) {
          return res.json({ reply: candidateText });
        }
        
        const finishReason = response.candidates?.[0]?.finishReason;
        if (finishReason && finishReason !== 'STOP') {
          throw new Error(`Generation finished with reason: ${finishReason}. This is often due to safety settings or content filters.`);
        }
        
        throw new Error('No response text received from Polarith Kodama.');
      }

      res.json({ reply: response.text });
    } catch (error: any) {
      console.error('Server-side API Error:', error);
      let errMsg = error?.message || String(error);

      const isQuotaError = 
        errMsg.toLowerCase().includes('quota') || 
        errMsg.includes('429') || 
        errMsg.includes('RESOURCE_EXHAUSTED') || 
        errMsg.toLowerCase().includes('limit') ||
        errMsg.toLowerCase().includes('exhausted');

      if (isQuotaError) {
        errMsg = 'Model is in high demand.';
      } else if (errMsg.includes('API key not valid')) {
        errMsg = 'Invalid authorization signature for Polarith Kodama. Please verify your credentials.';
      }
      res.status(500).json({ error: errMsg });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Track client load endpoint
  app.post('/api/stats/track', (req, res) => {
    try {
      const { clientId } = req.body;
      if (clientId && !stats.uniqueUsers.includes(clientId)) {
        stats.uniqueUsers.push(clientId);
        logActivity(`New user session registered`);
        saveStats();
      }
      res.json({ success: true });
    } catch (err) {
      console.error('Error tracking client:', err);
      res.status(500).json({ error: 'Failed to track client' });
    }
  });

  // Get stats endpoint
  app.get('/api/stats', (req, res) => {
    try {
      res.json({
        totalMessages: stats.totalMessages,
        totalUsers: stats.uniqueUsers.length,
        messagesByModel: stats.messagesByModel,
        recentActivity: stats.recentActivity
      });
    } catch (err) {
      console.error('Error getting stats:', err);
      res.status(500).json({ error: 'Failed to retrieve stats' });
    }
  });

  // Reset stats endpoint
  app.post('/api/stats/reset', (req, res) => {
    try {
      stats = {
        totalMessages: 0,
        uniqueUsers: [],
        messagesByModel: {
          kodama: 0,
          amabie: 0,
          kaze: 0
        },
        recentActivity: []
      };
      logActivity('Statistics reset by administrator');
      saveStats();
      res.json({
        success: true,
        stats: {
          totalMessages: 0,
          totalUsers: 0,
          messagesByModel: stats.messagesByModel,
          recentActivity: stats.recentActivity
        }
      });
    } catch (err) {
      console.error('Error resetting stats:', err);
      res.status(500).json({ error: 'Failed to reset stats' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
