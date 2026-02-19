import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Loader2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";
import { NoCreditsScreen } from "@/components/NoCreditsScreen";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatWindowProps {
  userId: string;
  imageBase64: string | null;
  planType: "free" | "basic" | "yearly";
  remainingChats: number;
  cooldownUntil: Date | null;
  userName?: string;
  onChatUsed: () => Promise<boolean>;
  canChat: () => { allowed: boolean; reason: "ok" | "cooldown" | "limit" };
  onUpgrade: () => void;
  onClose: () => void;
}

export function ChatWindow({
  userId,
  imageBase64,
  planType,
  remainingChats,
  cooldownUntil,
  userName,
  onChatUsed,
  canChat,
  onUpgrade,
  onClose,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hey${userName ? ` ${userName}` : ""}! I'm Styloren, your fashion advisor. Ask me anything about your outfit!`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showLimitScreen, setShowLimitScreen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const chatStatus = canChat();

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const status = canChat();
    if (!status.allowed) {
      setShowLimitScreen(true);
      return;
    }

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat-styloren", {
        body: {
          message: userMessage,
          imageBase64,
          conversationHistory: messages,
          userName,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);

      // Track usage - deduct 1 credit
      await onChatUsed();
    } catch (error: any) {
      console.error("Chat error:", error);
      toast({
        title: "Chat failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (showLimitScreen) {
    return (
      <div className="bg-card/90 backdrop-blur-sm rounded-2xl shadow-elevated animate-slide-up overflow-hidden">
        <NoCreditsScreen
          isExpired={false}
          onGetCredits={() => {
            onUpgrade();
            setShowLimitScreen(false);
          }}
        />
        <div className="p-4 border-t border-border/50">
          <Button 
            variant="ghost" 
            onClick={() => setShowLimitScreen(false)} 
            className="w-full text-muted-foreground"
          >
            Go back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card/90 backdrop-blur-sm rounded-2xl shadow-elevated animate-slide-up overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-semibold text-foreground">Chat with Styloren</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="h-80 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {message.role === "assistant" && (
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-secondary text-secondary-foreground rounded-bl-md"
              }`}
            >
              {message.role === "assistant" ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm">{message.content}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="bg-secondary text-secondary-foreground rounded-2xl rounded-bl-md px-4 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border/50">
        {!chatStatus.allowed && (
          <div className="mb-3 p-3 bg-primary/10 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground">
                Get credits to continue chatting
              </span>
            </div>
            <Button size="sm" onClick={onUpgrade} className="gradient-primary border-0">
              Get Credits
            </Button>
          </div>
        )}
        {chatStatus.allowed && remainingChats < Infinity && (
          <p className="text-xs text-muted-foreground mb-2">
            {remainingChats} credit{remainingChats !== 1 ? "s" : ""} available • Uses 1 credit per message
          </p>
        )}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={chatStatus.allowed ? "Ask about your outfit..." : "Get credits to continue chatting"}
            disabled={!chatStatus.allowed || isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!chatStatus.allowed || isLoading || !input.trim()}
            className="gradient-primary border-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
