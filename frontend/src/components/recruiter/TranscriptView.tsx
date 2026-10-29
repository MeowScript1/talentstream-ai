import { Bot, User } from 'lucide-react';

interface TranscriptItem {
  role: 'ai' | 'user';
  content: string;
}

export function TranscriptView({ transcript }: { transcript: TranscriptItem[] }) {
  if (!transcript || transcript.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-muted p-8 text-center">
        <Bot className="h-12 w-12 mb-4 opacity-20" />
        <p>No interview transcript available yet.</p>
        <p className="text-sm mt-2">The candidate has not started the interview or the session is currently empty.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {transcript.map((msg, idx) => (
        <div key={idx} className={`flex gap-4 max-w-[90%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
          <div className={`h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 ${
            msg.role === 'ai' ? 'bg-accent-muted text-accent-primary' : 'bg-text-primary text-on-accent'
          }`}>
            {msg.role === 'ai' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
          </div>
          <div>
            <span className={`text-xs font-medium mb-1 block ${msg.role === 'user' ? 'text-right text-text-secondary' : 'text-accent-primary'}`}>
              {msg.role === 'ai' ? 'AI Interviewer' : 'Candidate'}
            </span>
            <div className={`p-4 rounded-lg ${
              msg.role === 'ai' 
                ? 'bg-bg-surface border border-border-subtle text-text-primary rounded-tl-none' 
                : 'bg-bg-elevated border border-border-subtle text-text-primary rounded-tr-none'
            }`}>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
