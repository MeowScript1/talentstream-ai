import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { WebSocketService, buildWsUrl } from '@/services/websocket';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Send, Bot, User } from 'lucide-react';
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
      {/* How this interview works (it is a text chat: no camera or microphone is used) */}
      <div className="hidden lg:flex w-1/3 flex-col gap-3 border-r border-border-subtle bg-bg-surface p-4">
        <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4 text-sm text-text-secondary">
          <h3 className="mb-2 font-semibold text-text-primary">This interview is a text chat</h3>
          <ul className="list-disc space-y-1 pl-4">
            <li>No camera or microphone is used.</li>
            <li>Up to 5 questions, one at a time.</li>
            <li>Answer in full sentences. Be specific and give real examples.</li>
            <li>It cannot be repeated once it ends, so take your time.</li>
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
                  msg.role === 'ai' ? 'bg-accent-muted text-accent-primary' : 'bg-text-primary text-on-accent'
                }`}>
                  {msg.role === 'ai' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
                <div className={`min-w-0 p-3 sm:p-4 rounded-lg ${
                  msg.role === 'ai' 
                    ? 'bg-bg-elevated border border-border-subtle text-text-primary rounded-tl-none' 
                    : 'bg-accent-primary text-on-accent rounded-tr-none'
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
              className="min-w-0 flex-1 rounded-lg shadow-none"
            />
            <Button 
              type="submit" 
              disabled={!input.trim() || isCompleted || !isConnected}
              aria-label="Send"
              className="rounded-lg px-5 sm:px-6"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
