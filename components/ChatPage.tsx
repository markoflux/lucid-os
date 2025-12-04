import HeaderDropDown from '@/components/HeaderDropDown';
import MessageInput from '@/components/MessageInput';
import { defaultStyles } from '@/constants/Styles';
import { storage } from '@/utils/Storage';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useMMKVString } from 'react-native-mmkv';
import { FlashList } from '@shopify/flash-list';
import ChatMessage from '@/components/ChatMessage';
import { Message, Role } from '@/utils/Interfaces';
import MessageIdeas from '@/components/MessageIdeas';
import { addChat, addMessage, getMessages } from '@/utils/Database';
import { useSQLiteContext } from 'expo-sqlite';
import { buildApiUrl } from '@/utils/api';

const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

const ChatPage = () => {
  const [gptVersion, setGptVersion] = useMMKVString('gptVersion', storage);
  const [height, setHeight] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [chatId, _setChatId] = useState<string | undefined>(id);
  const chatIdRef = useRef<string | undefined>(id);
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (id) {
      chatIdRef.current = id;
      _setChatId(id);
      getMessages(db, parseInt(id)).then((res) => setMessages(res));
    } else {
      chatIdRef.current = undefined;
      _setChatId(undefined);
      setMessages([]);
    }
  }, [db, id]);

  useEffect(() => {
    if (!gptVersion) {
      setGptVersion('4');
    }
  }, [gptVersion, setGptVersion]);

  // https://stackoverflow.com/questions/55265255/react-usestate-hook-event-handler-using-initial-state
  function setChatId(id?: string) {
    chatIdRef.current = id;
    _setChatId(id);
  }

  const onGptVersionChange = (version: string) => {
    setGptVersion(version);
  };

  const onLayout = (event: any) => {
    const { height } = event.nativeEvent.layout;
    setHeight(height / 2);
  };

  const ensureChatId = async (title: string) => {
    if (chatIdRef.current) {
      return parseInt(chatIdRef.current, 10);
    }

    const res = await addChat(db, title);
    const newId = Number(
      // expo-sqlite returns different keys on platforms
      // @ts-expect-error - native return shape is not typed
      res?.lastInsertRowId ?? res?.insertId ?? res?.changes
    );

    if (!newId || Number.isNaN(newId)) {
      throw new Error('Failed to create chat');
    }

    setChatId(newId.toString());
    return newId;
  };

  const updateLastBotMessage = (content: string) => {
    setMessages((prev) => {
      const updated = [...prev];
      const lastIndex = updated.length - 1;
      if (lastIndex >= 0 && updated[lastIndex].role === Role.Bot) {
        updated[lastIndex] = { ...updated[lastIndex], content };
      }
      return updated;
    });
  };

  const removePendingBotMessage = () => {
    setMessages((prev) => {
      if (!prev.length) return prev;
      const updated = [...prev];
      const lastIndex = updated.length - 1;
      if (updated[lastIndex].role === Role.Bot) {
        updated.splice(lastIndex, 1);
      }
      return updated;
    });
  };

  const getCompletion = async (text: string) => {
    if (!text.trim()) return;

    setIsStreaming(true);
    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;

    try {
      const chatRowId = await ensureChatId(text);
      await addMessage(db, chatRowId, { role: Role.User, content: text });

      setMessages((prev) => [
        ...prev,
        { role: Role.User, content: text },
        { role: Role.Bot, content: '' },
      ]);

      const response = await fetch(buildApiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          model: gptVersion === '4' ? 'gpt-4o' : 'gpt-4o-mini',
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error('Chat request failed');
      }

      const reader = response.body.getReader();
      let botContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        const chunk = decoder
          ? decoder.decode(value, { stream: true })
          : String.fromCharCode(...value);
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          const payload = JSON.parse(line);
          if (payload.type === 'chunk') {
            botContent += payload.value;
            updateLastBotMessage(botContent);
          } else if (payload.type === 'done') {
            await addMessage(db, chatRowId, { role: Role.Bot, content: botContent });
          } else if (payload.type === 'error') {
            throw new Error(payload.message);
          }
        }
      }
    } catch (error: any) {
      if (controller.signal.aborted) {
        return;
      }
      removePendingBotMessage();
      Alert.alert('Chat error', error?.message ?? 'Unable to reach chat service');
    } finally {
      setIsStreaming(false);
      abortController.current = null;
    }
  };

  return (
    <View style={defaultStyles.pageContainer}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <HeaderDropDown
              title="ChatGPT"
              items={[
                { key: '3.5', title: 'GPT-3.5', icon: 'bolt' },
                { key: '4', title: 'GPT-4', icon: 'sparkles' },
              ]}
              onSelect={onGptVersionChange}
              selected={gptVersion}
            />
          ),
        }}
      />
      <View style={styles.page} onLayout={onLayout}>
        {messages.length == 0 && (
          <View style={[styles.logoContainer, { marginTop: height / 2 - 100 }]}>
            <Image source={require('@/assets/images/logo-white.png')} style={styles.image} />
          </View>
        )}
        <FlashList
          data={messages}
          renderItem={({ item }) => <ChatMessage {...item} />}
          estimatedItemSize={400}
          contentContainerStyle={{ paddingTop: 30, paddingBottom: 150 }}
          keyboardDismissMode="on-drag"
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={70}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
        }}>
        {messages.length === 0 && <MessageIdeas onSelectCard={getCompletion} />}
        <MessageInput onShouldSend={getCompletion} />
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  logoContainer: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
    backgroundColor: '#000',
    borderRadius: 50,
  },
  image: {
    width: 30,
    height: 30,
    resizeMode: 'cover',
  },
  page: {
    flex: 1,
  },
});
export default ChatPage;
