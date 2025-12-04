import ChatMessage from '@/components/ChatMessage';
import HeaderDropDown from '@/components/HeaderDropDown';
import MessageInput from '@/components/MessageInput';
import Colors from '@/constants/Colors';
import { defaultStyles } from '@/constants/Styles';
import { Message, Role } from '@/utils/Interfaces';
import { buildApiUrl } from '@/utils/api';
import { FlashList } from '@shopify/flash-list';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

// const dummyMessages = [
//   {
//     role: Role.Bot,
//     content: '',
//     imageUrl: 'https://galaxies.dev/img/meerkat_2.jpg',
//     prompt:
//       'A meerkat astronaut in a futuristic spacesuit, standing upright on a rocky, alien landscape resembling the surface of Mars. The spacesuit is highly detailed with reflective visor and intricate life-support systems. The background shows a distant starry sky and a small Earth visible in the far horizon. The meerkat looks curious and brave, embodying the spirit of exploration.',
//   },
// ];

const Page = () => {
  const [height, setHeight] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [working, setWorking] = useState(false);

  const onLayout = (event: any) => {
    const { height } = event.nativeEvent.layout;
    setHeight(height / 2);
  };

  const getCompletion = async (text: string) => {
    setWorking(true);
    setMessages((prev) => [...prev, { role: Role.User, content: text }]);

    try {
      const response = await fetch(buildApiUrl('/api/images'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      });
      const result = await response.json();

      if (!response.ok || !result?.url) {
        throw new Error(result?.error ?? 'Failed to generate image');
      }

      setMessages((prev) => [
        ...prev,
        { role: Role.Bot, content: '', imageUrl: result.url, prompt: text },
      ]);
    } catch (error: any) {
      Alert.alert('Image error', error?.message ?? 'Unable to generate an image right now.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <View style={defaultStyles.pageContainer}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <HeaderDropDown
              title="Dall·E"
              items={[
                { key: 'share', title: 'Share GPT', icon: 'square.and.arrow.up' },
                { key: 'details', title: 'See Details', icon: 'info.circle' },
                { key: 'keep', title: 'Keep in Sidebar', icon: 'pin' },
              ]}
              onSelect={() => {}}
            />
          ),
        }}
      />
      <View style={styles.page} onLayout={onLayout}>
        {messages.length == 0 && (
          <View style={[{ marginTop: height / 2 - 100, alignItems: 'center', gap: 16 }]}>
            <View style={styles.logoContainer}>
              <Image source={require('@/assets/images/dalle.png')} style={styles.image} />
            </View>
            <Text style={styles.label}>Let me turn your imagination into imagery.</Text>
          </View>
        )}
        <FlashList
          data={messages}
          renderItem={({ item }) => <ChatMessage {...item} />}
          estimatedItemSize={400}
          contentContainerStyle={{ paddingTop: 30, paddingBottom: 150 }}
          keyboardDismissMode="on-drag"
          ListFooterComponent={
            <>{working && <ChatMessage {...{ role: Role.Bot, content: '', loading: true }} />}</>
          }
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
    width: 80,
    height: 80,
    backgroundColor: '#000',
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.greyLight,
  },
  image: {
    resizeMode: 'cover',
  },
  page: {
    flex: 1,
  },
  label: {
    color: Colors.grey,
    fontSize: 16,
  },
});
export default Page;
