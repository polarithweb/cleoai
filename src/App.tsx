import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ChatWindow from './components/ChatWindow';
import AdminDashboard from './components/AdminDashboard';
import { Message, RateLimitState } from './types';
import { canSendMessage, registerMessage, getRateLimitState } from './utils/rateLimiter';
import { sendChatMessage, getOrCreateClientId } from './utils/geminiClient';
import { trackUserSessionFirebase, trackMessageFirebase } from './utils/firebase';

const CHAT_STORAGE_KEY = 'polarith_chat_history_v1';
const MODEL_STORAGE_KEY = 'polarith_selected_model_v1';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rateTrigger, setRateTrigger] = useState(0);
  
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem(MODEL_STORAGE_KEY) || 'kodama';
  });

  const [rateLimit, setRateLimit] = useState<RateLimitState>(() => 
    getRateLimitState(selectedModel)
  );

  const [currentHash, setCurrentHash] = useState(window.location.hash);

  // Hash routing listener
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Track user session on app start
  useEffect(() => {
    try {
      const clientId = getOrCreateClientId();
      
      // Track in local server API
      fetch('/api/stats/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientId })
      }).catch(err => console.error('Error tracking session start locally:', err));
      
      // Track in Firebase Firestore (works fully on GitHub Pages!)
      trackUserSessionFirebase(clientId).catch(err => 
        console.warn('[Firebase Sync Info] Waiting for final rules deployment snapshot on next UI deploy/share. Using local session tracker fallback:', err)
      );
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Load chat history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        setMessages(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading chat history:', e);
    }
  }, []);

  // Save chat history to localStorage on change
  const saveChatHistory = (newMessages: Message[]) => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(newMessages));
    } catch (e) {
      console.error('Error saving chat history:', e);
    }
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem(MODEL_STORAGE_KEY, modelId);
    setRateLimit(getRateLimitState(modelId));
    setRateTrigger(prev => prev + 1);
  };

  const handleSendMessage = async (content: string, image?: string) => {
    // 1. Double check rate limit before sending
    if (!canSendMessage(selectedModel)) {
      setRateLimit(getRateLimitState(selectedModel));
      setRateTrigger(prev => prev + 1);
      return;
    }

    // 2. Increment rate limiter and update local trigger
    registerMessage(selectedModel);
    setRateLimit(getRateLimitState(selectedModel));
    setRateTrigger(prev => prev + 1);

    // 3. Construct user message and update state
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'success',
      image
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    saveChatHistory(updatedMessages);
    setIsLoading(true);

    try {
      // 4. Send the updated history with the selectedModel to the backend
      const reply = await sendChatMessage(updatedMessages, selectedModel, undefined, image);

      // Track message count in Firebase Firestore (works beautifully on GitHub Pages!)
      try {
        const clientId = getOrCreateClientId();
        trackMessageFirebase(clientId, selectedModel).catch(err => 
          console.warn('[Firebase Sync Info] Logging in fallback mode. Waiting for next rules deployment:', err)
        );
      } catch (fbErr) {
        console.warn('Firebase log exception handled:', fbErr);
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'model',
        content: reply,
        timestamp: Date.now(),
        status: 'success'
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      saveChatHistory(finalMessages);
    } catch (error: any) {
      const errorMessage = error?.message || 'An unexpected error occurred.';
      
      let assistantContent = "I ran into an issue while generating a response. Please check your network connection.";
      if (errorMessage.includes('POLARITH_COOKIE_BLOCK')) {
        assistantContent = "### Browser Cookie Restriction Detected\n\nPolarith cleo. is currently unable to communicate with the backend due to your browser's third-party cookie restrictions (iframe sandboxing).\n\n**To resolve this and unlock Polarith cleo.:**\n1. Click the **Open in New Tab** button in the very top-right corner of the preview panel.\n2. Once the app opens in a new tab, cookies will be initialized, and you can chat with Polarith cleo. both there and right here in this preview window!";
      }

      const assistantErrorMessage: Message = {
        id: `assistant-error-${Date.now()}`,
        role: 'model',
        content: assistantContent,
        timestamp: Date.now(),
        status: 'error',
        errorMessage: errorMessage.includes('POLARITH_COOKIE_BLOCK') ? undefined : errorMessage
      };

      const finalMessages = [...updatedMessages, assistantErrorMessage];
      setMessages(finalMessages);
      saveChatHistory(finalMessages);
    } finally {
      setIsLoading(false);
      // Force refresh header rate counter
      setRateTrigger(prev => prev + 1);
      setRateLimit(getRateLimitState(selectedModel));
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
  };

  if (currentHash === '#/admin') {
    return <AdminDashboard onBack={() => window.location.hash = ''} />;
  }

  return (
    <div className="h-[100dvh] w-screen bg-white overflow-hidden p-4 md:p-6 lg:p-8 flex flex-col items-center justify-center" id="polarith-app-root">
      <div className="w-full max-w-5xl h-full flex flex-col">
        
        {/* Sleek top header featuring title, credits and dropdown */}
        <Header 
          rateTrigger={rateTrigger} 
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
        />

        {/* Pure chatbot interface with flexible height to fit exactly the viewport */}
        <ChatWindow 
          messages={messages}
          onSendMessage={handleSendMessage}
          onClearHistory={handleClearHistory}
          isLoading={isLoading}
          rateLimit={rateLimit}
        />

      </div>
    </div>
  );
}
