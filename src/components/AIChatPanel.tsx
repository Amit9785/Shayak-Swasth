import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIChatPanelProps {
  recordId?: string;
  recordTitle?: string;
}

const AIChatPanel = ({ recordId, recordTitle }: AIChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      let response;
      
      if (recordId) {
        // Ask specific report using Query & Compliance Agent
        const { data, error } = await api.post<any>(
          `/ai/ask`,
          { record_id: recordId, question: userMessage }
        );
        
        if (error) {
          toast.error(error);
          setMessages(prev => prev.slice(0, -1));
          return;
        }
        
        // Extract answer from agent response
        response = data?.data?.answer || data?.answer || "No response received";
      } else {
        // Semantic search across all reports using Query & Compliance Agent
        const { data, error } = await api.post<any>("/ai/search", { 
          query: userMessage,
          top_k: 5
        });
        
        if (error) {
          toast.error(error);
          setMessages(prev => prev.slice(0, -1));
          return;
        }
        
        // Extract results from agent response
        const results = data?.data?.results || data?.results || [];
        response = results.length > 0
          ? `Found ${results.length} relevant records:\n\n${results
              .slice(0, 3)
              .map((r: any, i: number) => 
                `${i + 1}. ${r.title || 'Untitled'} (${(r.similarity * 100).toFixed(1)}% match)\n   ${r.text?.substring(0, 150) || 'No preview available'}...`
              )
              .join("\n\n")}`
          : "No relevant information found in your medical records.";
      }

      setMessages(prev => [...prev, { role: "assistant", content: response }]);
    } catch (error) {
      toast.error("Failed to get AI response");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Medical Assistant
          {recordTitle && (
            <span className="text-sm font-normal text-muted-foreground">
              - {recordTitle}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-6">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">
                {recordId 
                  ? "Ask me anything about this medical report"
                  : "Search across all your medical records"}
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={`rounded-lg px-4 py-2 max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === "user" && (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <UserIcon className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary-foreground animate-pulse" />
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <p className="text-sm">Thinking...</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder={
                recordId
                  ? "Ask about this report..."
                  : "Search your medical records..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !isLoading && handleSend()}
              disabled={isLoading}
            />
            <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIChatPanel;
