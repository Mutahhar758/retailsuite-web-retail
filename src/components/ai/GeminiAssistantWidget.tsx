import React, { useState, useRef, useEffect } from 'react';
import { Drawer, Button, Input, Space, Typography, Tag, Tooltip, message } from 'antd';
import { 
  AudioOutlined, 
  SendOutlined, 
  SoundOutlined, 
  MutedOutlined,
  ThunderboltFilled,
  PlusOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useVoiceAssistant } from '../../hooks/useVoiceAssistant';
import { aiAssistantService, type AiChatMessage } from '../../services/aiAssistantService';
import { MarkdownRenderer } from './MarkdownRenderer';

const { Text } = Typography;

const generateChatId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
};

export const GeminiAssistantWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [chatId, setChatId] = useState<string>(generateChatId);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hello! I am your RetailSuite Voice & Navigation AI. You can speak or type commands like "Get me to payment listing from first of this month" or "Create a payment voucher of $500 for ABC".'
    }
  ]);

  const navigate = useNavigate();
  const location = useLocation();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const handleNewChat = () => {
    stopListening(false);
    stopSpeaking();
    setIsPushToTalk(false);
    hasDispatchedThisHoldRef.current = false;
    isHoldingRef.current = false;
    isKeyHoldingRef.current = false;
    setInputText('');
    setChatId(generateChatId());
    setMessages([
      {
        role: 'assistant',
        content: 'Hello! I am your RetailSuite Voice & Navigation AI. You can speak or type commands like "Get me to payment listing from first of this month" or "Create a payment voucher of $500 for ABC".'
      }
    ]);
    message.success('Started a fresh new chat session.');
  };

  const handleSendPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isLoading) return;

    // Immediately stop mic listener and any ongoing read-aloud speech
    stopListening(false);
    stopSpeaking();
    hasDispatchedThisHoldRef.current = true;
    setIsPushToTalk(false);

    setInputText('');
    const userMsg: AiChatMessage = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await aiAssistantService.chat({
        prompt: trimmed,
        chatId: chatId,
        currentRoute: location.pathname,
        history: messages
      });

      if (response.chatId && response.chatId !== chatId) {
        setChatId(response.chatId);
      }

      const assistantMsg: AiChatMessage = {
        role: 'assistant',
        content: response.replyText || 'Command processed.'
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Voice response if not muted
      if (!voiceMuted && response.replyText) {
        speak(response.replyText);
      }

      // Execute Action
      const isNavigate = String(response.actionType).toLowerCase() === 'navigate' || response.actionType === 1;
      const isDraft = String(response.actionType).toLowerCase() === 'draftvoucher' || response.actionType === 2;

      if (isNavigate && response.targetRoute) {
        let url = response.targetRoute;
        if (response.actionPayload) {
          const params = new URLSearchParams();
          Object.entries(response.actionPayload).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') {
              params.append(k, String(v));
            }
          });
          const qs = params.toString();
          if (qs) url += `?${qs}`;
        }
        navigate(url);
        setIsOpen(false);
      } else if (isDraft && response.targetRoute) {
        navigate(response.targetRoute, { state: { draftData: response.actionPayload } });
        setIsOpen(false);
      }
    } catch (error: any) {
      console.error('AI chat failed', error);
      message.error(error?.response?.data?.message || 'AI assistant request failed. Please check your connection.');
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an issue processing your request.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const {
    isSupported,
    isListening,
    volumeLevel,
    errorMessage: voiceError,
    startListening,
    stopListening,
    speak,
    stopSpeaking
  } = useVoiceAssistant({
    onFinalTranscript: (spokenText) => {
      handleSendPrompt(spokenText);
    }
  });

  useEffect(() => {
    if (voiceError) {
      message.warning(voiceError);
    }
  }, [voiceError]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const holdStartTimeRef = useRef<number>(0);
  const isHoldingRef = useRef(false);
  const isKeyHoldingRef = useRef(false);
  const hasDispatchedThisHoldRef = useRef(false);

  // Press & Hold (Walkie-Talkie) Handlers
  const handleHoldStart = () => {
    if (isLoading) return;
    if (!isSupported) {
      message.warning('Voice recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    holdStartTimeRef.current = Date.now();
    isHoldingRef.current = true;
    hasDispatchedThisHoldRef.current = false;
    setIsPushToTalk(true);
    setIsOpen(true);
    startListening();
  };

  const handleHoldEnd = () => {
    const wasHolding = isHoldingRef.current;
    isHoldingRef.current = false;
    setIsPushToTalk(false);

    if (!wasHolding) return;

    // If silence timer or prompt send already dispatched this speech, don't re-send.
    // User must release button and press & hold again for the next talk.
    if (hasDispatchedThisHoldRef.current) {
      hasDispatchedThisHoldRef.current = false;
      return;
    }

    const duration = Date.now() - holdStartTimeRef.current;
    // If held for more than 300ms, immediately send what was spoken
    if (duration > 300) {
      hasDispatchedThisHoldRef.current = true;
      stopListening(true);
    }
  };

  // Global hotkey: Hold Ctrl + Space or Alt + A to speak, release to send
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey && (e.key === 'a' || e.key === 'A')) || (e.ctrlKey && e.code === 'Space')) {
        e.preventDefault();
        if (isLoading) return;
        if (!isKeyHoldingRef.current) {
          stopSpeaking();
          isKeyHoldingRef.current = true;
          hasDispatchedThisHoldRef.current = false;
          setIsPushToTalk(true);
          setIsOpen(true);
          startListening();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.key === 'a' || e.key === 'A' || e.code === 'Space') && isKeyHoldingRef.current) {
        e.preventDefault();
        isKeyHoldingRef.current = false;
        setIsPushToTalk(false);

        if (hasDispatchedThisHoldRef.current) {
          hasDispatchedThisHoldRef.current = false;
          return;
        }
        hasDispatchedThisHoldRef.current = true;
        stopListening(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isLoading, startListening, stopListening, stopSpeaking]);

  const toggleVoiceMode = () => {
    if (!isSupported) {
      message.warning('Voice recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    if (isLoading) return;
    if (isListening) {
      hasDispatchedThisHoldRef.current = true;
      stopListening(true);
    } else {
      hasDispatchedThisHoldRef.current = false;
      setIsPushToTalk(false);
      startListening();
    }
  };

  const suggestionChips = [
    'Show payment listing for this month',
    'Show receipt vouchers of yesterday',
    'What is the balance of ABC?',
    'Create payment voucher of $500 for ABC',
    'Create receipt voucher of $1000 from XYZ'
  ];

  return (
    <>
      {/* Floating AI Assistant Orb Button (hidden when drawer is open so it never covers the input textbox) */}
      {!isOpen && (
        <div 
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <button
            onClick={() => setIsOpen(true)}
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: isListening
                ? 'linear-gradient(135deg, #d93025 0%, #ea4335 100%)'
                : 'linear-gradient(135deg, #1A73E8 0%, #8E24AA 50%, #00C9FF 100%)',
              border: 'none',
              boxShadow: isListening
                ? '0 0 20px rgba(217, 48, 37, 0.6)'
                : '0 6px 20px rgba(26, 115, 232, 0.35)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 22,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: isListening ? 'scale(1.1)' : 'scale(1)',
              userSelect: 'none'
            }}
            onMouseEnter={e => !isListening && (e.currentTarget.style.transform = 'scale(1.08)')}
            onMouseLeave={e => !isListening && (e.currentTarget.style.transform = 'scale(1)')}
            title="RetailSuite AI Assistant (Ctrl + Space to Speak)"
          >
            {isListening ? (
              <AudioOutlined style={{ animation: 'pulse 1s infinite' }} />
            ) : (
              <ThunderboltFilled style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
            )}
          </button>
        </div>
      )}

      {/* AI Assistant Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Space align="center">
              <span 
                style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1A73E8 0%, #8E24AA 100%)',
                  color: '#fff',
                  fontSize: 14
                }}
              >
                <ThunderboltFilled />
              </span>
              <span style={{ fontWeight: 600 }}>RetailSuite AI</span>
              <Tag color="blue">Assistant</Tag>
            </Space>
            <Space>
              <Tooltip title="Start New Chat (Clear History)">
                <Button 
                  type="text" 
                  size="small"
                  icon={<PlusOutlined />} 
                  onClick={handleNewChat}
                  style={{ color: '#1A73E8', fontWeight: 500 }}
                >
                  New Chat
                </Button>
              </Tooltip>
              <Tooltip title={voiceMuted ? 'Unmute AI Voice' : 'Mute AI Voice'}>
                <Button 
                  type="text" 
                  size="small"
                  icon={voiceMuted ? <MutedOutlined /> : <SoundOutlined />} 
                  onClick={() => {
                    setVoiceMuted(!voiceMuted);
                    if (!voiceMuted) stopSpeaking();
                  }}
                />
              </Tooltip>
            </Space>
          </div>
        }
        placement="right"
        width={420}
        onClose={() => {
          setIsOpen(false);
          isHoldingRef.current = false;
          isKeyHoldingRef.current = false;
          hasDispatchedThisHoldRef.current = false;
          setIsPushToTalk(false);
          stopListening();
          stopSpeaking();
        }}
        open={isOpen}
        bodyStyle={{ display: 'flex', flexDirection: 'column', padding: '16px', background: '#fafbfc' }}
      >
        {/* Messages Container */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 16 }}>
          {messages.map((m, idx) => (
            <div 
              key={idx}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: 16,
                background: m.role === 'user' 
                  ? 'linear-gradient(135deg, #1A73E8 0%, #1557b0 100%)' 
                  : '#ffffff',
                color: m.role === 'user' ? '#ffffff' : '#202124',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                border: m.role === 'user' ? 'none' : '1px solid #e8eaed',
                fontSize: 14,
                lineHeight: 1.5
              }}
            >
              {m.role === 'assistant' ? (
                <MarkdownRenderer content={m.content} />
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
              )}
            </div>
          ))}

          {isLoading && (
            <div style={{ alignSelf: 'flex-start', padding: '8px 14px', background: '#fff', borderRadius: 16, border: '1px solid #e8eaed' }}>
              <Space size="small">
                <span className="animate-spin">🌀</span>
                <Text type="secondary" style={{ fontSize: 13 }}>Processing intent & database...</Text>
              </Space>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Live Audio Waveform when Listening */}
        {isListening && (
          <div 
            style={{
              padding: '12px 16px',
              marginBottom: 12,
              borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(26,115,232,0.1) 0%, rgba(142,36,170,0.1) 100%)',
              border: '1px solid rgba(26,115,232,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <Space align="center">
              <span style={{ color: '#d93025', fontSize: 18, animation: 'pulse 1s infinite' }}>●</span>
              <Text strong style={{ color: '#1a73e8' }}>
                {isPushToTalk ? 'Listening... (Release to send)' : 'Listening... (Speak or tap mic to stop)'}
              </Text>
            </Space>

            {/* Simulated Animated Equalizer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 20 }}>
              {[1, 2, 3, 4, 5, 6].map(bar => {
                const height = Math.max(4, Math.round((volumeLevel / 100) * 20 * (bar % 2 === 0 ? 1 : 0.6)));
                return (
                  <div
                    key={bar}
                    style={{
                      width: 4,
                      height: `${height}px`,
                      borderRadius: 2,
                      background: 'linear-gradient(to top, #1a73e8, #8e24aa)',
                      transition: 'height 0.1s ease'
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Suggestion Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {suggestionChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSendPrompt(chip)}
              disabled={isLoading}
              style={{
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 14,
                border: '1px solid #dadce0',
                background: '#fff',
                color: '#3c4043',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#1a73e8';
                e.currentTarget.style.color = '#1a73e8';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#dadce0';
                e.currentTarget.style.color = '#3c4043';
              }}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isSupported && (
            <Button
              type={isListening ? 'primary' : 'default'}
              danger={isListening}
              shape="circle"
              size="large"
              icon={<AudioOutlined />}
              onMouseDown={handleHoldStart}
              onMouseUp={handleHoldEnd}
              onTouchStart={handleHoldStart}
              onTouchEnd={handleHoldEnd}
              onTouchCancel={handleHoldEnd}
              onClick={() => {
                if (Date.now() - holdStartTimeRef.current < 300) {
                  toggleVoiceMode();
                }
              }}
              title="Press & Hold to Speak (Walkie-Talkie) | Click to toggle"
              style={{
                boxShadow: isListening ? '0 0 14px rgba(217,48,37,0.6)' : undefined,
                transition: 'all 0.15s ease',
                transform: isListening ? 'scale(1.08)' : 'scale(1)'
              }}
            />
          )}

          <Input
            placeholder="Ask AI or speak naturally..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onPressEnter={() => handleSendPrompt(inputText)}
            disabled={isLoading}
            size="large"
            style={{ borderRadius: 24 }}
            suffix={
              <Button
                type="primary"
                shape="circle"
                size="small"
                icon={<SendOutlined />}
                disabled={!inputText.trim() || isLoading}
                onClick={() => handleSendPrompt(inputText)}
              />
            }
          />
        </div>
      </Drawer>
    </>
  );
};
