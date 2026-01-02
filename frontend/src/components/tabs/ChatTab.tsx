'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Paper,
  Stack,
  Group,
  TextInput,
  ActionIcon,
  Text,
  ScrollArea,
  Box,
  Badge,
  Loader,
  Alert,
  Accordion,
  Button,
  Tooltip,
  ThemeIcon,
  Collapse,
  Menu,
  Switch,
  Slider,
  Select,
  NavLink,
  Drawer,
  Title,
  Divider,
} from '@mantine/core';
import {
  IconSend,
  IconRobot,
  IconUser,
  IconAlertCircle,
  IconSparkles,
  IconTrash,
  IconSettings,
  IconBulb,
  IconRefresh,
  IconCpu,
  IconApps,
  IconPlus,
  IconHistory,
  IconChevronRight,
  IconMessage,
  IconBrain,
  IconX,
  IconMenu2,
  IconWorld,
  IconLink,
  IconPlayerStop,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import ReactMarkdown from 'react-markdown';
import { chatApi, ChatMessage, api } from '@/lib/api';

interface ChatTabProps {
  tabId?: number;
}

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface LocalMessage extends ChatMessage {
  id: string;
  timestamp: Date;
  isStreaming?: boolean;
  webSearchResults?: WebSearchResult[];
}

interface Conversation {
  id: number;
  title: string;
  model: string | null;
  message_count: number;
  messages?: Array<{ role: string; content: string; timestamp?: string }>;
  created_at: string;
  updated_at: string | null;
}

// Conversation API
const conversationApi = {
  list: async (): Promise<Conversation[]> => {
    const response = await api.get('/chat/conversations');
    return response.data;
  },
  get: async (id: number): Promise<Conversation> => {
    const response = await api.get(`/chat/conversations/${id}`);
    return response.data;
  },
  create: async (data: { title?: string; model?: string }): Promise<Conversation> => {
    const response = await api.post('/chat/conversations', data);
    return response.data;
  },
  update: async (id: number, data: { title?: string; messages?: Array<{ role: string; content: string }>; model?: string }): Promise<Conversation> => {
    const response = await api.put(`/chat/conversations/${id}`, data);
    return response.data;
  },
  addMessage: async (id: number, message: { role: string; content: string }): Promise<void> => {
    await api.post(`/chat/conversations/${id}/message`, message);
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/chat/conversations/${id}`);
  },
};

export function ChatTab({ tabId }: ChatTabProps) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [includeContext, setIncludeContext] = useState(true);
  const [temperature, setTemperature] = useState(0.7);
  const [useStreaming, setUseStreaming] = useState(true);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<LocalMessage[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keep messagesRef in sync
  messagesRef.current = messages;

  // Check Ollama status
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['ollamaStatus'],
    queryFn: chatApi.getStatus,
    refetchInterval: 30000,
  });

  // Get quick prompts
  const { data: quickPromptsData } = useQuery({
    queryKey: ['quickPrompts'],
    queryFn: chatApi.getQuickPrompts,
  });

  // Get conversations list
  const { data: conversations = [], refetch: refetchConversations } = useQuery({
    queryKey: ['chatConversations'],
    queryFn: conversationApi.list,
  });

  // Set default model from status
  useEffect(() => {
    if (status?.model && !selectedModel) {
      setSelectedModel(status.model);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.model]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const generateId = () => Math.random().toString(36).substring(7);

  // Create new conversation
  const createConversation = useMutation({
    mutationFn: conversationApi.create,
    onSuccess: (conv) => {
      setCurrentConversationId(conv.id);
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: ['chatConversations'] });
      setSidebarOpen(false);
    },
  });

  // Delete conversation
  const deleteConversation = useMutation({
    mutationFn: conversationApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatConversations'] });
      if (conversations.length > 1) {
        const remaining = conversations.filter(c => c.id !== currentConversationId);
        if (remaining.length > 0) {
          loadConversation(remaining[0].id);
        }
      } else {
        setCurrentConversationId(null);
        setMessages([]);
      }
    },
  });

  // Load a conversation
  const loadConversation = async (id: number) => {
    try {
      const conv = await conversationApi.get(id);
      setCurrentConversationId(conv.id);
      setMessages(
        (conv.messages || []).map((m, idx) => ({
          id: `loaded-${idx}`,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(m.timestamp || Date.now()),
        }))
      );
      if (conv.model) {
        setSelectedModel(conv.model);
      }
      setSidebarOpen(false);
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger la conversation',
        color: 'red',
      });
    }
  };

  // Start new conversation
  const handleNewConversation = () => {
    createConversation.mutate({ model: selectedModel || status?.model });
  };

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: LocalMessage = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Create conversation if none exists
    let convId = currentConversationId;
    if (!convId) {
      try {
        const conv = await conversationApi.create({ model: selectedModel || status?.model });
        convId = conv.id;
        setCurrentConversationId(conv.id);
        queryClient.invalidateQueries({ queryKey: ['chatConversations'] });
      } catch (error) {
        console.error('Failed to create conversation:', error);
      }
    }

    // Save user message to conversation
    if (convId) {
      try {
        await conversationApi.addMessage(convId, { role: 'user', content: userMessage.content });
        queryClient.invalidateQueries({ queryKey: ['chatConversations'] });
      } catch (error) {
        console.error('Failed to save message:', error);
      }
    }

    // Create assistant placeholder
    const assistantId = generateId();
    const assistantMessage: LocalMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      // Build messages history for API (use ref to avoid stale closure)
      const apiMessages: ChatMessage[] = messagesRef.current
        .map((m) => ({ role: m.role, content: m.content }))
        .concat({ role: 'user', content: userMessage.content });

      if (useStreaming) {
        // Streaming mode - create abort controller
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const response = await chatApi.streamMessage(apiMessages, {
          includeContext,
          temperature,
          webSearch: webSearchEnabled,
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error('Erreur de streaming');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let fullContent = '';
          let webResults: WebSearchResult[] | undefined;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  // Handle web search results
                  if (parsed.web_search_results) {
                    webResults = parsed.web_search_results;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? { ...m, webSearchResults: webResults }
                          : m
                      )
                    );
                  }
                  if (parsed.content) {
                    fullContent += parsed.content;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? { ...m, content: fullContent }
                          : m
                      )
                    );
                  }
                  if (parsed.error) {
                    throw new Error(parsed.error);
                  }
                } catch {
                  // Ignore JSON parse errors for incomplete chunks
                }
              }
            }
          }

          // Mark as done and save to conversation
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, isStreaming: false }
                : m
            )
          );

          // Clear abort controller
          abortControllerRef.current = null;

          // Save assistant message
          if (convId && fullContent) {
            await conversationApi.addMessage(convId, { role: 'assistant', content: fullContent });
            queryClient.invalidateQueries({ queryKey: ['chatConversations'] });
          }
        }
      } else {
        // Non-streaming mode
        const response = await chatApi.sendMessage(apiMessages, {
          includeContext,
          temperature,
          webSearch: webSearchEnabled,
        });

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: response.response,
                  isStreaming: false,
                  webSearchResults: response.web_search_results
                }
              : m
          )
        );

        // Save assistant message
        if (convId) {
          await conversationApi.addMessage(convId, { role: 'assistant', content: response.response });
          queryClient.invalidateQueries({ queryKey: ['chatConversations'] });
        }
      }
    } catch (error) {
      // Check if it's an abort error (user stopped generation)
      if (error instanceof Error && error.name === 'AbortError') {
        // Already handled by stopGeneration function
        return;
      }

      // Update message with error
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: `Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue'}`,
                isStreaming: false,
              }
            : m
        )
      );

      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Erreur de chat',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [input, isLoading, includeContext, temperature, useStreaming, webSearchEnabled, currentConversationId, selectedModel, status?.model, queryClient]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentConversationId(null);
    inputRef.current?.focus();
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Mark current streaming message as done
    setMessages((prev) =>
      prev.map((m) =>
        m.isStreaming ? { ...m, isStreaming: false, content: m.content + '\n\n*[Génération arrêtée]*' } : m
      )
    );
    setIsLoading(false);
  };

  const isAvailable = status?.available ?? false;
  const modelOptions = (status?.models || []).map((m: { name: string }) => ({
    value: m.name,
    label: m.name,
  }));

  return (
    <Box h="100%" style={{ display: 'flex', overflow: 'hidden' }}>
      {/* Sidebar Drawer for mobile/small screens */}
      <Drawer
        opened={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        title="Conversations"
        size="xs"
        padding="md"
      >
        <Stack gap="sm">
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleNewConversation}
            loading={createConversation.isPending}
            fullWidth
          >
            Nouvelle conversation
          </Button>

          <Divider label="Historique" labelPosition="center" />

          <ScrollArea h={400}>
            <Stack gap="xs">
              {conversations.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" py="md">
                  Aucune conversation
                </Text>
              ) : (
                conversations.map((conv) => (
                  <NavLink
                    key={conv.id}
                    label={conv.title}
                    description={`${conv.message_count} messages`}
                    leftSection={<IconMessage size={16} />}
                    active={conv.id === currentConversationId}
                    onClick={() => loadConversation(conv.id)}
                    rightSection={
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        color="red"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation.mutate(conv.id);
                        }}
                      >
                        <IconTrash size={12} />
                      </ActionIcon>
                    }
                    style={{ borderRadius: 8 }}
                  />
                ))
              )}
            </Stack>
          </ScrollArea>
        </Stack>
      </Drawer>

      {/* Main chat area */}
      <Paper
        withBorder
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header */}
        <Box p="sm" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
          <Group justify="space-between">
            <Group gap="xs">
              <Tooltip label="Historique">
                <ActionIcon
                  variant="subtle"
                  size="md"
                  onClick={() => setSidebarOpen(true)}
                >
                  <IconHistory size={18} />
                </ActionIcon>
              </Tooltip>
              <ThemeIcon size="md" color="violet" variant="light">
                <IconRobot size={18} />
              </ThemeIcon>
              <div>
                <Text fw={600} size="sm">Assistant Self-Hosted</Text>
                <Group gap={4}>
                  <Badge
                    size="xs"
                    color={isAvailable ? 'green' : 'red'}
                    variant="dot"
                  >
                    {statusLoading ? 'Vérification...' : isAvailable ? 'En ligne' : 'Hors ligne'}
                  </Badge>
                  {isAvailable && selectedModel && (
                    <Badge size="xs" color="gray" variant="light">
                      {selectedModel}
                    </Badge>
                  )}
                </Group>
              </div>
            </Group>

            <Group gap="xs">
              {/* Model selector */}
              {isAvailable && modelOptions.length > 0 && (
                <Select
                  size="xs"
                  placeholder="Modèle"
                  data={modelOptions}
                  value={selectedModel}
                  onChange={setSelectedModel}
                  w={140}
                  comboboxProps={{ withinPortal: true }}
                  leftSection={<IconBrain size={14} />}
                />
              )}
              <Tooltip label="Nouvelles suggestions">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => refetchStatus()}
                >
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Paramètres">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => setShowSettings(!showSettings)}
                  color={showSettings ? 'blue' : undefined}
                >
                  <IconSettings size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Nouvelle conversation">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  color="green"
                  onClick={handleNewConversation}
                  loading={createConversation.isPending}
                >
                  <IconPlus size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Effacer">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  color="red"
                  onClick={clearChat}
                  disabled={messages.length === 0}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          {/* Settings panel */}
          <Collapse in={showSettings}>
            <Stack gap="xs" mt="sm" p="xs" style={{ background: 'var(--mantine-color-dark-6)', borderRadius: 8 }}>
              <Group justify="space-between">
                <Group gap="xs">
                  <IconApps size={14} />
                  <Text size="xs">Contexte applications</Text>
                </Group>
                <Switch
                  size="xs"
                  checked={includeContext}
                  onChange={(e) => setIncludeContext(e.currentTarget.checked)}
                />
              </Group>
              <Group justify="space-between">
                <Group gap="xs">
                  <IconWorld size={14} />
                  <Text size="xs">Recherche Internet</Text>
                </Group>
                <Switch
                  size="xs"
                  checked={webSearchEnabled}
                  onChange={(e) => setWebSearchEnabled(e.currentTarget.checked)}
                  color="cyan"
                />
              </Group>
              <Group justify="space-between">
                <Group gap="xs">
                  <IconCpu size={14} />
                  <Text size="xs">Streaming</Text>
                </Group>
                <Switch
                  size="xs"
                  checked={useStreaming}
                  onChange={(e) => setUseStreaming(e.currentTarget.checked)}
                />
              </Group>
              <div>
                <Group justify="space-between" mb={4}>
                  <Text size="xs">Créativité: {temperature.toFixed(1)}</Text>
                </Group>
                <Slider
                  size="xs"
                  min={0}
                  max={1}
                  step={0.1}
                  value={temperature}
                  onChange={setTemperature}
                  marks={[
                    { value: 0, label: 'Précis' },
                    { value: 0.5, label: '' },
                    { value: 1, label: 'Créatif' },
                  ]}
                />
              </div>
            </Stack>
          </Collapse>
        </Box>

        {/* Messages area */}
        <ScrollArea
          ref={scrollRef}
          style={{ flex: 1 }}
          p="md"
          offsetScrollbars
        >
          {messages.length === 0 ? (
            <Stack gap="lg" align="center" py="xl">
              <ThemeIcon size={60} color="violet" variant="light" radius="xl">
                <IconSparkles size={32} />
              </ThemeIcon>
              <div style={{ textAlign: 'center' }}>
                <Text size="lg" fw={600} mb="xs">
                  Bienvenue dans l'assistant Self-Hosted
                </Text>
                <Text size="sm" c="dimmed" maw={400}>
                  Je connais vos applications installées et peux vous aider à trouver
                  des solutions self-hosted, configurer vos services, et répondre à
                  vos questions.
                </Text>
              </div>

              {/* Quick prompts */}
              {quickPromptsData?.prompts && (
                <Accordion
                  variant="separated"
                  w="100%"
                  maw={500}
                  styles={{
                    item: { background: 'var(--mantine-color-dark-6)' },
                  }}
                >
                  {quickPromptsData.prompts.map((category: { category: string; items: string[] }, idx: number) => (
                    <Accordion.Item key={idx} value={category.category}>
                      <Accordion.Control icon={<IconBulb size={16} />}>
                        <Text size="sm">{category.category}</Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="xs">
                          {category.items.map((prompt: string, pIdx: number) => (
                            <Button
                              key={pIdx}
                              variant="subtle"
                              size="xs"
                              justify="flex-start"
                              onClick={() => handleQuickPrompt(prompt)}
                              disabled={!isAvailable}
                            >
                              {prompt}
                            </Button>
                          ))}
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>
                  ))}
                </Accordion>
              )}
            </Stack>
          ) : (
            <Stack gap="md">
              {messages.map((message) => (
                <Box
                  key={message.id}
                  style={{
                    display: 'flex',
                    justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <Paper
                    p="sm"
                    radius="md"
                    maw="80%"
                    style={{
                      background:
                        message.role === 'user'
                          ? 'var(--mantine-color-blue-9)'
                          : 'var(--mantine-color-dark-5)',
                    }}
                  >
                    <Group gap="xs" mb="xs">
                      {message.role === 'assistant' ? (
                        <IconRobot size={14} />
                      ) : (
                        <IconUser size={14} />
                      )}
                      <Text size="xs" c="dimmed">
                        {message.role === 'assistant' ? 'Assistant' : 'Vous'}
                      </Text>
                      {message.isStreaming && <Loader size="xs" />}
                      {message.webSearchResults && message.webSearchResults.length > 0 && (
                        <Badge size="xs" color="cyan" variant="light" leftSection={<IconWorld size={10} />}>
                          {message.webSearchResults.length} sources
                        </Badge>
                      )}
                    </Group>

                    {/* Web search results */}
                    {message.webSearchResults && message.webSearchResults.length > 0 && (
                      <Box
                        mb="xs"
                        p="xs"
                        style={{
                          background: 'var(--mantine-color-dark-7)',
                          borderRadius: 6,
                          borderLeft: '3px solid var(--mantine-color-cyan-5)',
                        }}
                      >
                        <Group gap={4} mb={6}>
                          <IconWorld size={12} color="var(--mantine-color-cyan-5)" />
                          <Text size="xs" fw={600} c="cyan">Sources web</Text>
                        </Group>
                        <Stack gap={4}>
                          {message.webSearchResults.slice(0, 3).map((result, idx) => (
                            <Group key={idx} gap={4} wrap="nowrap">
                              <IconLink size={10} color="var(--mantine-color-dimmed)" />
                              <Text
                                size="xs"
                                c="dimmed"
                                component="a"
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  textDecoration: 'none',
                                  flex: 1,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={result.snippet}
                              >
                                {result.title}
                              </Text>
                            </Group>
                          ))}
                        </Stack>
                      </Box>
                    )}

                    <Box className="markdown-content" fz="sm">
                      {message.role === 'assistant' ? (
                        <ReactMarkdown>{message.content || '...'}</ReactMarkdown>
                      ) : (
                        <Text size="sm">{message.content}</Text>
                      )}
                    </Box>
                  </Paper>
                </Box>
              ))}
            </Stack>
          )}
        </ScrollArea>

        {/* Input area */}
        <Box p="sm" style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}>
          {!isAvailable && (
            <Alert
              color="red"
              icon={<IconAlertCircle size={16} />}
              mb="sm"
              p="xs"
            >
              <Text size="xs">
                Ollama n'est pas disponible. Vérifiez que le service est démarré.
              </Text>
            </Alert>
          )}

          <Group gap="xs">
            <Tooltip label={webSearchEnabled ? "Recherche Internet activée" : "Activer la recherche Internet"}>
              <ActionIcon
                variant={webSearchEnabled ? "filled" : "subtle"}
                color="cyan"
                size="md"
                onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                disabled={isLoading}
              >
                <IconWorld size={18} />
              </ActionIcon>
            </Tooltip>
            <TextInput
              ref={inputRef}
              placeholder={isAvailable ? (webSearchEnabled ? "Recherche avec Internet..." : "Posez votre question...") : "Ollama indisponible"}
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              onKeyPress={handleKeyPress}
              disabled={!isAvailable || isLoading}
              style={{ flex: 1 }}
              rightSection={
                <ActionIcon
                  variant="filled"
                  color="violet"
                  size="sm"
                  onClick={handleSendMessage}
                  disabled={!input.trim() || !isAvailable || isLoading}
                >
                  <IconSend size={14} />
                </ActionIcon>
              }
            />
            {isLoading && (
              <Tooltip label="Arrêter la génération">
                <ActionIcon
                  variant="filled"
                  color="red"
                  size="md"
                  onClick={stopGeneration}
                >
                  <IconPlayerStop size={18} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>

          {includeContext && (
            <Text size="xs" c="dimmed" mt="xs" ta="center">
              L'assistant a accès à vos {selectedModel ? `applications via ${selectedModel}` : 'applications installées'}
            </Text>
          )}
        </Box>

        {/* Markdown styles */}
        <style jsx global>{`
          .markdown-content h1,
          .markdown-content h2,
          .markdown-content h3 {
            margin-top: 0.5em;
            margin-bottom: 0.3em;
          }
          .markdown-content h1 { font-size: 1.3em; }
          .markdown-content h2 { font-size: 1.2em; }
          .markdown-content h3 { font-size: 1.1em; }
          .markdown-content p {
            margin: 0.3em 0;
          }
          .markdown-content ul,
          .markdown-content ol {
            margin: 0.3em 0;
            padding-left: 1.5em;
          }
          .markdown-content li {
            margin: 0.2em 0;
          }
          .markdown-content code {
            background: var(--mantine-color-dark-7);
            padding: 0.1em 0.3em;
            border-radius: 3px;
            font-size: 0.9em;
          }
          .markdown-content pre {
            background: var(--mantine-color-dark-7);
            padding: 0.5em;
            border-radius: 4px;
            overflow-x: auto;
          }
          .markdown-content pre code {
            background: none;
            padding: 0;
          }
          .markdown-content blockquote {
            border-left: 3px solid var(--mantine-color-violet-5);
            margin: 0.5em 0;
            padding-left: 0.8em;
            color: var(--mantine-color-dimmed);
          }
          .markdown-content a {
            color: var(--mantine-color-blue-4);
          }
          .markdown-content table {
            border-collapse: collapse;
            width: 100%;
            margin: 0.5em 0;
          }
          .markdown-content th,
          .markdown-content td {
            border: 1px solid var(--mantine-color-dark-4);
            padding: 0.3em 0.5em;
            text-align: left;
          }
          .markdown-content th {
            background: var(--mantine-color-dark-6);
          }
        `}</style>
      </Paper>
    </Box>
  );
}
