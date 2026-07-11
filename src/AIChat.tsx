import { useState, useEffect, useRef } from "react";
import { Icon } from "./ui";

export function AIChat({ onSendAiChat }: { onSendAiChat: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleChat = (e: Event) => {
      const { id, msg } = (e as CustomEvent).detail;
      if (id === "self") return;
      setMessages((prev) => [...prev, { sender: "AI Agent", text: msg }]);
      setIsTyping(false);
      setOpen(true);
    };
    window.addEventListener("ai-chat", handleChat);
    return () => window.removeEventListener("ai-chat", handleChat);
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = () => {
    const message = input.trim().slice(0, 4000);
    if (!message) return;
    setMessages((prev) => [...prev, { sender: "You", text: message }]);
    onSendAiChat(message);
    setInput("");
    setIsTyping(true);
  };

  return (
    <div className="ai-chat-wrap">
      {open && (
        <div className="ai-chat-panel">
          <div className="ai-chat-header">
            <span>AI Collaborator</span>
            <button onClick={() => setOpen(false)} className="ai-chat-close"><Icon name="leave" size={14} /></button>
          </div>
          <div className="ai-chat-messages">
            {messages.length === 0 && !isTyping && (
              <div className="ai-chat-empty">
                Ask your connected AI agent to draw, explain, or modify the board.
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`ai-message ${msg.sender === "You" ? "you" : "ai"}`}>
                <div className="ai-message-sender">{msg.sender}</div>
                <div>{msg.text}</div>
              </div>
            ))}
            {isTyping && (
              <div className="ai-message ai">
                <div className="ai-message-sender">AI Agent</div>
                <div className="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="ai-chat-input-area">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask AI to draw..."
              maxLength={4000}
              className="ai-chat-input"
            />
            <button onClick={handleSend} className="ai-chat-send">Send</button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(!open)} className="ai-chat-fab" aria-label="Toggle AI collaborator">
        <Icon name="users" size={24} />
      </button>
    </div>
  );
}
