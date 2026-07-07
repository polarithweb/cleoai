import React, { useRef, useEffect, useState } from 'react';
import { Send, Trash2, AlertCircle, Copy, Check, Mic, Square, X, Camera, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Message, RateLimitState } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface ChatWindowProps {
  messages: Message[];
  onSendMessage: (content: string, image?: string) => void;
  onClearHistory: () => void;
  isLoading: boolean;
  rateLimit: RateLimitState;
}

export default function ChatWindow({
  messages,
  onSendMessage,
  onClearHistory,
  isLoading,
  rateLimit,
}: ChatWindowProps) {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const handleStartRecording = async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        setIsTranscribing(true);
        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            
            const res = await fetch('/api/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio: base64Audio, mimeType: 'audio/webm' })
            });

            if (!res.ok) {
              const contentType = res.headers.get('content-type') || '';
              if (!contentType.includes('application/json')) {
                const text = await res.text();
                if (text.trim().startsWith('<') || text.includes('cookie_check')) {
                  throw new Error(
                    'Third-party cookie restrictions are active in this iframe. Please open this app in a new tab by clicking the icon in the top right to use voice typing.'
                  );
                }
              }
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || 'Failed to transcribe audio');
            }

            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
              const text = await res.text();
              if (text.trim().startsWith('<') || text.includes('cookie_check')) {
                throw new Error(
                  'Third-party cookie restrictions are active in this iframe. Please open this app in a new tab by clicking the icon in the top right to use voice typing.'
                );
              }
              throw new Error(`Server returned unexpected response type: ${contentType}`);
            }

            const data = await res.json();
            if (data.text) {
              setInput((prev) => (prev ? `${prev} ${data.text}` : data.text));
            }
          };
        } catch (err: any) {
          console.error('Audio transcription error:', err);
          setMicError(`Transcription failed: ${err.message || err}`);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.warn('Mic permission denied or warning:', err);
      const errMsg = (err?.message || String(err) || '').toLowerCase();
      const errName = (err?.name || '').toLowerCase();
      const isPermissionDenied = 
        errName === 'notallowederror' || 
        errName === 'permissiondeniederror' || 
        errMsg.includes('denied') || 
        errMsg.includes('permission');
      
      if (isPermissionDenied) {
        setMicError('Microphone permission denied. To record, please enable microphone access. If inside the preview iframe, open the app in a new tab using the icon at the top right.');
      } else {
        setMicError(`Could not access microphone: ${err?.message || err}`);
      }
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
        if (mediaRecorderRef.current) {
          const stream = mediaRecorderRef.current.stream;
          stream.getTracks().forEach(track => track.stop());
        }
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || isLoading || rateLimit.isBlocked) return;
    onSendMessage(input.trim(), selectedImage || undefined);
    setInput('');
    setSelectedImage(null);
    
    // Only scroll when the user themselves submits a new message
    setTimeout(() => {
      scrollToBottom();
    }, 50);
  };

  const handleCopyText = React.useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col justify-between" id="chat-window">
      
      {/* Chat Header Controls */}
      {messages.length > 0 && (
        <div className="flex justify-end items-center pb-3 border-b border-slate-200/60 mb-4 shrink-0">
          <button
            onClick={onClearHistory}
            className="p-2 px-3 bg-white text-slate-450 hover:text-rose-500 hover:scale-105 active:scale-95 rounded-xl text-xs font-mono font-bold tracking-tight transition-all duration-300 flex items-center gap-1.5 nm-flat-sm border border-white/60"
            title="Clear Chat History"
            id="clear-chat-btn"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Feed
          </button>
        </div>
      )}

      {/* Message List area */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4 pb-2 scrollbar-thin" id="messages-container">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 max-w-lg mx-auto py-10">
            <h3 className="text-3xl font-display font-extrabold text-slate-850 mb-1.5 tracking-tight">
              Polarith <span className="text-sky-500 lowercase">cleo</span>
            </h3>
            <p className="text-sm font-sans text-slate-500 font-medium">
              AI LLMs by Polarith AI Lab
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  copiedId={copiedId}
                  onCopyText={handleCopyText}
                />
              ))}
            </AnimatePresence>

            {/* Simulated Animated typing indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start w-full"
              >
                <div className="max-w-[60%] flex flex-col gap-1">
                  <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase px-1">
                    Polarith Engine is computing...
                  </span>
                  <div className="p-4 rounded-2xl bg-white border border-slate-100 nm-inset-sm flex items-center gap-1.5 w-20 justify-center">
                    <span className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="mt-1.5 pt-2 border-t border-slate-200/50 shrink-0" id="message-form">
        <div className="flex flex-col gap-2">
          {rateLimit.isBlocked && (
            <div className="flex items-center gap-2 p-2.5 px-3 rounded-xl bg-red-50/80 text-red-600 text-xs font-semibold mb-1 border border-red-100" id="rate-limit-warning">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>You have reached your limit of 50 rolling messages. Please wait for the rate monitor to unlock.</span>
            </div>
          )}

          {isTranscribing && (
            <div className="flex items-center gap-2 p-2.5 px-3 rounded-xl bg-blue-50/80 text-blue-600 text-xs font-semibold mb-1 border border-blue-100">
              <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span>Whisper is transcribing your audio...</span>
            </div>
          )}

          {micError && (
            <div className="flex items-center justify-between gap-2 p-2.5 px-3 rounded-xl bg-amber-50/95 text-amber-800 text-xs font-semibold mb-1 border border-amber-200" id="mic-error-warning">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{micError}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setMicError(null)}
                className="text-amber-500 hover:text-amber-700 font-mono font-bold text-xs px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {selectedImage && (
            <div className="flex items-center gap-3 mb-2 p-2 px-3 bg-white border border-slate-150 rounded-xl w-fit relative group nm-flat-sm">
              <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-100">
                <img 
                  src={selectedImage} 
                  alt="Selected Attachment Preview" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-700">Image attached</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute -top-1.5 -right-1.5 p-1 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-colors shadow-sm"
                title="Remove image"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <input
            type="file"
            ref={galleryInputRef}
            onChange={handleImageChange}
            accept="image/*"
            className="hidden"
            id="gallery-input"
          />
          <input
            type="file"
            ref={cameraInputRef}
            onChange={handleImageChange}
            accept="image/*"
            capture="environment"
            className="hidden"
            id="camera-input"
          />
          
          <div className="flex gap-3 items-center">
            {isRecording ? (
              <div className="flex-1 h-12 flex items-center justify-between px-5 bg-rose-50/80 border border-rose-100 rounded-full animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                  <span className="text-xs font-mono font-bold text-rose-600">
                    Listening ({formatTime(recordingTime)})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancelRecording}
                    className="p-1.5 px-3 bg-white border border-rose-200 text-rose-500 text-xs font-mono font-bold rounded-full hover:bg-rose-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleStopRecording}
                    className="p-1.5 px-3 bg-rose-500 text-white text-xs font-mono font-bold rounded-full hover:bg-rose-600 transition-colors flex items-center gap-1"
                  >
                    <Square className="w-2.5 h-2.5 fill-white" />
                    Stop
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    isTranscribing
                      ? 'Transcribing audio...'
                      : rateLimit.isBlocked 
                        ? 'Rate limit reached (50/50 messages)' 
                        : 'Ask Polarith cleo to code, debug, or design...'
                  }
                  disabled={isLoading || rateLimit.isBlocked || isTranscribing}
                  className="w-full h-12 pl-6 pr-32 bg-white rounded-full text-sm font-medium text-slate-800 placeholder-slate-300 outline-none transition-all duration-300 shadow-md md:shadow-lg border border-slate-300/80 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:scale-[1.002]"
                  id="message-text-input"
                />
                
                <div className="absolute right-3 flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={isLoading || rateLimit.isBlocked || isTranscribing}
                    className="p-2 text-slate-450 hover:text-blue-600 hover:bg-slate-50 rounded-full transition-all duration-200 active:scale-95"
                    title="Upload Gallery Image"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isLoading || rateLimit.isBlocked || isTranscribing}
                    className="p-2 text-slate-450 hover:text-blue-600 hover:bg-slate-50 rounded-full transition-all duration-200 active:scale-95"
                    title="Capture from Camera"
                  >
                    <Camera className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleStartRecording}
                    disabled={isLoading || rateLimit.isBlocked || isTranscribing}
                    className="p-2 text-slate-450 hover:text-blue-600 hover:bg-slate-50 rounded-full transition-all duration-200 active:scale-95 animate-pulse"
                    title="Audio Listening"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            
            <button
              type="submit"
              disabled={(!input.trim() && !selectedImage) || isLoading || rateLimit.isBlocked || isRecording || isTranscribing}
              className="w-12 h-12 bg-blue-500 text-white hover:bg-blue-600 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed rounded-full transition-all duration-300 flex items-center justify-center nm-flat-sm shrink-0"
              id="send-message-btn"
            >
              <Send className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// Optimized Message Item wrapped in React.memo to completely bypass rendering work when input updates
const MessageItem = React.memo(function MessageItem({
  message,
  copiedId,
  onCopyText,
}: {
  message: Message;
  copiedId: string | null;
  onCopyText: (text: string, id: string) => void;
}) {
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} w-full`}
    >
      <div className={`${isUser ? 'max-w-[85%] md:max-w-[75%]' : 'w-full'} flex flex-col gap-1.5`}>
        {/* Name tag and meta */}
        <span className={`text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase px-1.5 flex items-center gap-1.5 ${
          isUser ? 'justify-end text-blue-500' : 'justify-start text-slate-500'
        }`}>
          {isUser ? 'User Core' : 'Polarith Engine'}
          <span className="text-[9px] font-normal text-slate-300">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </span>

        {/* Bubble shape */}
        <div className={`relative p-4 md:p-5 rounded-2xl group transition-all duration-300 border ${
          isUser 
            ? 'bg-white border-slate-150 nm-flat-sm text-slate-800 border-r-4 border-r-blue-400' 
            : 'bg-white border-slate-100 nm-inset-sm text-slate-700 w-full'
        }`}>
          {/* Copy button for text bubble */}
          <button
            onClick={() => onCopyText(message.content, message.id)}
            className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-all duration-200"
            title="Copy message text"
          >
            {copiedId === message.id ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Rendering content */}
          {isUser ? (
            <div className="flex flex-col gap-3">
              {message.image && (
                <img 
                  src={message.image} 
                  alt="Uploaded attachment" 
                  className="max-w-full max-h-[300px] rounded-xl object-contain border border-slate-150 self-start"
                  referrerPolicy="no-referrer"
                />
              )}
              {message.content && (
                <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap pr-4 text-slate-800">{message.content}</p>
              )}
            </div>
          ) : (
            <div className="pr-4">
              <MarkdownRenderer content={message.content} />
            </div>
          )}
          
          {/* Message status line */}
          {message.status === 'error' && (
            <div className="flex items-center gap-1 mt-2.5 text-xs font-semibold text-red-500 bg-red-50/50 p-2 rounded-xl border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>Error: {message.errorMessage || 'Failed to dispatch'}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});
