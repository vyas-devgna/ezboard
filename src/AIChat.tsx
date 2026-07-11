import { useState, useEffect, useRef } from "react";
import { Icon } from "./ui";

export function AIChat({ onSendAiChat }: { onSendAiChat: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleChat = (e: Event) => {
      const { msg } = (e as CustomEvent).detail;
      setMessages((prev) => [...prev, { sender: "Antigravity", text: msg }]);
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
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { sender: "You", text: input }]);
    onSendAiChat(input);
    setInput("");
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
            {messages.length === 0 && (
              <div className="ai-chat-empty">
                No messages yet. Ask Antigravity to draw or modify something!
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`ai-message ${msg.sender === "You" ? "you" : "ai"}`}>
                <div className="ai-message-sender">{msg.sender}</div>
                <div>{msg.text}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="ai-chat-input-area">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask AI to draw..."
              className="ai-chat-input"
            />
            <button onClick={handleSend} className="ai-chat-send">Send</button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(!open)} className="ai-chat-fab">
        <Icon name="users" size={24} />
      </button>
    </div>
  );
}
