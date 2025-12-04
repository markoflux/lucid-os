import Colors from '@/constants/Colors';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { View, Text, StyleSheet, Button } from 'react-native';
const Page = () => {
  const router = useRouter();

  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>API access is now managed on the server proxy.</Text>
      <Text style={styles.helper}>
        Ask your admin to set OPENAI_API_KEY in the server environment. If requests fail, ensure the
        proxy is reachable.
      </Text>
      <View style={{ height: 20 }} />
      <Button title="Sign Out" onPress={() => signOut()} color={Colors.grey} />
      <View style={{ height: 12 }} />
      <Button title="Back to chat" onPress={() => router.back()} color={Colors.primary} />
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  label: {
    fontSize: 18,
    marginBottom: 10,
  },
  helper: {
    fontSize: 14,
    color: Colors.grey,
    marginBottom: 10,
  },
});
export default Page;
