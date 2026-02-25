import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { signInAnonymously, onAuthStateChanged, User } from "firebase/auth";
import { View, Text, StyleSheet } from "react-native";
import { auth } from "./src/firebase";
import { AuthContext } from "./src/hooks/useAuth";
import { BoardScreen } from "./src/screens/BoardScreen";
import { ScanScreen } from "./src/screens/ScanScreen";
import { RewardsScreen } from "./src/screens/RewardsScreen";
import { AdminScreen } from "./src/screens/AdminScreen";
import { ADMIN_UIDS } from "./src/config";

const Tab = createBottomTabNavigator();

export default function App() {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        await signInAnonymously(auth);
      } else {
        setUser(firebaseUser);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Signing in...</Text>
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user }}>
      <NavigationContainer>
        <Tab.Navigator screenOptions={{ headerShown: false }}>
          <Tab.Screen name="Board" component={BoardScreen} />
          <Tab.Screen name="Scan" component={ScanScreen} />
          <Tab.Screen name="Rewards" component={RewardsScreen} />
          {user && ADMIN_UIDS.includes(user.uid) ? (
            <Tab.Screen name="Admin" component={AdminScreen} />
          ) : null}
        </Tab.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  }
});
