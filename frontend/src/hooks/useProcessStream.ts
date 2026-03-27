// frontend/src/hooks/useProcessStream.ts
/** Hook for subscribing to process stream via SSE */

import { useEffect, useState, useCallback } from "react";
import type { ProcessMessage } from "../types/messages";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function useProcessStream() {
  const [messages, setMessages] = useState<ProcessMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource(`${API_URL}/api/process-stream`);

    eventSource.onopen = () => {
      setIsConnected(true);
      console.log("Process stream connected");
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      console.error("Process stream error");
    };

    eventSource.onmessage = (event) => {
      try {
        const msg: ProcessMessage = JSON.parse(event.data);
        setMessages((prev) => [...prev, msg]);
      } catch (e) {
        console.error("Failed to parse message:", e);
      }
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isConnected, clearMessages };
}
