import { useState, useEffect, useRef } from "react";

export function AIChat({ onSendAiChat }: { onSendAiChat: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleChat = (e: Event) => {
      const { msg } = (e as CustomEvent).detail;
      setMessages((prev) => [...prev, { sender: "AI Collaborator", text: msg }]);
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
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {open && (
        <div className="w-80 h-96 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-2xl flex flex-col mb-4 overflow-hidden text-white font-sans">
          <div className="p-3 bg-[#2a2a2a] border-b border-[#333] font-bold flex justify-between items-center">
            <span>AI Collaborator</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
          </div>
          <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2 text-sm">
            {messages.length === 0 && (
              <div className="text-gray-500 italic text-center mt-4">
                No messages yet. Ask the AI to draw or modify something!
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`max-w-[80%] p-2 rounded-lg ${msg.sender === "You" ? "bg-blue-600 self-end" : "bg-gray-700 self-start"}`}>
                <div className="font-bold text-xs opacity-70 mb-1">{msg.sender}</div>
                <div>{msg.text}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-2 border-t border-[#333] flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask AI to draw..."
              className="flex-1 bg-[#333] text-white px-3 py-2 rounded outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleSend}
              className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-white font-bold"
            >
              Send
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-3 rounded-full shadow-lg flex items-center gap-2"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>
    </div>
  );
}
