import React from "react";
import { Button, FlatList, StyleSheet, Text, View } from "react-native";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { db } from "../firebase";
import { useActiveSeason } from "../hooks/useActiveSeason";
import { useAuth } from "../hooks/useAuth";
import { UserReward } from "../types";
import { redeemReward } from "../utils/api";

export function RewardsScreen() {
  const { user } = useAuth();
  const { season } = useActiveSeason();
  const [rewards, setRewards] = React.useState<UserReward[]>([]);
  const [raffleEntry, setRaffleEntry] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!user || !season) {
      setRewards([]);
      return;
    }
    const q = query(
      collection(db, "userRewards"),
      where("userId", "==", user.uid),
      where("seasonId", "==", season.id),
      orderBy("issuedAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as UserReward)
      }));
      setRewards(list);
    });
    return () => unsub();
  }, [user, season?.id]);

  React.useEffect(() => {
    if (!user || !season) {
      setRaffleEntry(false);
      return;
    }
    const q = query(
      collection(db, "raffleEntries"),
      where("userId", "==", user.uid),
      where("seasonId", "==", season.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      setRaffleEntry(!snap.empty);
    });
    return () => unsub();
  }, [user, season?.id]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rewards</Text>
      <Text style={styles.subtitle}>
        {raffleEntry
          ? "Raffle entry recorded for this season."
          : "Complete the full board to earn a raffle entry."}
      </Text>

      <FlatList
        data={rewards}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.empty}>No rewards issued yet.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {item.title || (item.type === "ROW" ? "Row Reward" : "Raffle Entry")}
            </Text>
            {item.description ? <Text>{item.description}</Text> : null}
            <Text>Status: {item.status}</Text>
            {item.type === "ROW" && item.status === "AVAILABLE" ? (
              <Button
                title="Redeem"
                onPress={() => redeemReward(item.id)}
              />
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#FFFFFF"
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4
  },
  subtitle: {
    color: "#566573",
    marginBottom: 12
  },
  empty: {
    marginTop: 24,
    textAlign: "center",
    color: "#808B96"
  },
  card: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D5D8DC",
    marginBottom: 12
  },
  cardTitle: {
    fontWeight: "700"
  }
});
