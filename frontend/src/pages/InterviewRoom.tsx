import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { WebSocketService, buildWsUrl } from '@/services/websocket';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Send, Mic, Video, VideoOff, MicOff, Bot, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface Message {
  role: 'ai' | 'user';
  text: string;
}

export default function InterviewRoom() {
  const { id: applicationId } = useParams();
  const { token } = useAuthStore();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  
  const wsRef = useRef<WebSocketService | null>(null);
  // Mirrors isCompleted for the socket callbacks without making it an effect dependency:
  // otherwise finishing the interview re-runs the effect and reconnects to a finished interview.
  const isCompletedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!applicationId || !token) return;

    const wsUrl = buildWsUrl(`/ws/interview/${applicationId}`);
    const ws = new WebSocketService(wsUrl);
    wsRef.current = ws;

    ws.onMessage((data) => {
      if (data.type === 'message') {
        setMessages((prev) => [...prev, { role: data.role, text: data.text }]);
      } else if (data.type === 'system') {
        toast(data.text, { icon: 'ℹ️' });
        if (data.text.includes('completed')) {
          isCompletedRef.current = true;
          setIsCompleted(true);
        }
      } else if (data.type === 'error') {
        toast.error(data.text);
      }
    });

    ws.onOpen(() => setIsConnected(true));

    ws.onDisconnect(() => {
      setIsConnected(false);
      if (!isCompletedRef.current) toast.error('Disconnected from interview server');
    });

    ws.connect(token);

    return () => {
      ws.disconnect();
    };
  }, [applicationId, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !wsRef.current || isCompleted) return;

    setMessages((prev) => [...prev, { role: 'user', text: input }]);
    wsRef.current.send({ type: 'message', text: input });
    setInput('');
  };

  const leaveInterview = () => {
    if (!isCompleted && !confirm('Are you sure you want to leave? This will end the interview.')) return;
    wsRef.current?.disconnect();
    navigate('/dashboard/candidate');
  };

  return (
    <div className="flex h-[calc(100dvh-4rem)] bg-bg-base overflow-hidden">
      {/* Video Feed Area (Mock for now, but UI is there) */}
      <div className="hidden lg:flex w-1/3 flex-col border-r border-border-subtle bg-bg-surface p-4">
        <div className="flex-1 rounded-2xl bg-bg-base border border-border-subtle overflow-hidden relative group">
          <div className="absolute inset-0 flex items-center justify-center">
            {cameraEnabled ? (
              <div className="text-text-muted text-center">
                <User className="h-16 w-16 mx-auto mb-2 opacity-50" />
                <p>Camera Active</p>
              </div>
            ) : (
              <div className="text-text-muted text-center">
                <VideoOff className="h-16 w-16 mx-auto mb-2 opacity-50" />
                <p>Camera Disabled</p>
              </div>
            )}
          </div>
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
            <Button size="icon" variant={micEnabled ? 'secondary' : 'danger'} className="rounded-full shadow-lg" onClick={() => setMicEnabled(!micEnabled)}>
              {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>
            <Button size="icon" variant={cameraEnabled ? 'secondary' : 'danger'} className="rounded-full shadow-lg" onClick={() => setCameraEnabled(!cameraEnabled)}>
              {cameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        
        <div className="mt-4 p-4 rounded-2xl border border-border-subtle bg-bg-elevated text-sm text-text-secondary">
          <h3 className="font-medium text-text-primary mb-1">Interview Tips</h3>
          <ul className="list-disc pl-4 space-y-1">
            <li>Speak clearly and directly to the camera</li>
            <li>Take your time to formulate answers</li>
            <li>You can type or speak your responses</li>
          </ul>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-bg-surface relative">
        <div className="h-16 border-b border-border-subtle flex items-center justify-between gap-2 px-4 sm:px-6 bg-bg-surface/80 backdrop-blur-md z-10">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-accent-muted flex items-center justify-center border border-accent-primary/20">
              <Bot className="h-5 w-5 text-accent-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-bold text-text-primary leading-tight">AI Interviewer</h2>
              <p className="text-xs text-text-secondary flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-success' : 'bg-danger'}`} />
                {isConnected ? 'Connected' : 'Disconnected'}
              </p>
            </div>
          </div>
          <Button variant="danger" size="sm" className="flex-shrink-0" onClick={leaveInterview}>
            <span className="sm:hidden">Leave</span>
            <span className="hidden sm:inline">Leave Interview</span>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 sm:space-y-6">
          <AnimatePresence>
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-2 sm:gap-4 max-w-[92%] sm:max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div className={`h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                  msg.role === 'ai' ? 'bg-accent-muted text-accent-primary' : 'bg-text-primary text-bg-base'
                }`}>
                  {msg.role === 'ai' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
                <div className={`min-w-0 p-3 sm:p-4 rounded-2xl ${
                  msg.role === 'ai' 
                    ? 'bg-bg-elevated border border-border-subtle text-text-primary rounded-tl-none' 
                    : 'bg-accent-primary text-bg-base rounded-tr-none'
                }`}>
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-border-subtle bg-bg-surface" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <form onSubmit={handleSend} className="flex gap-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isCompleted ? "Interview completed" : "Type your answer..."}
              disabled={isCompleted || !isConnected}
              className="min-w-0 flex-1 rounded-2xl shadow-none"
            />
            <Button 
              type="submit" 
              disabled={!input.trim() || isCompleted || !isConnected}
              aria-label="Send"
              className="rounded-2xl px-5 sm:px-6"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
