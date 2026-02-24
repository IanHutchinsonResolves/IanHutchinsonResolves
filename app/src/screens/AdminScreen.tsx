import React from "react";
import { Button, FlatList, StyleSheet, Text, View } from "react-native";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { ADMIN_UIDS, FUNCTIONS_BASE_URL } from "../config";
import { useAuth } from "../hooks/useAuth";
import { Business } from "../types";
import {
  adminCreateSeasonBoard,
  adminGetAnalytics,
  adminSeed
} from "../utils/api";

export function AdminScreen() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = React.useState<Business[]>([]);
  const [analytics, setAnalytics] = React.useState<any>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const isAdmin = !!user && ADMIN_UIDS.includes(user.uid);

  React.useEffect(() => {
    const q = query(
      collection(db, "businesses"),
      where("active", "==", true)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Business)
      }));
      setBusinesses(list);
    });
    return () => unsub();
  }, []);

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>Sign in required.</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <Text>Admin access only.</Text>
        <Text>Your UID: {user.uid}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Dashboard</Text>
      <Text style={styles.subtitle}>Your UID: {user.uid}</Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}

      <View style={styles.buttonRow}>
        <Button
          title="Seed Data"
          onPress={async () => {
            setStatus("Seeding data...");
            try {
              const res = await adminSeed();
              setStatus(`Seeded. Season: ${res.seasonId}`);
            } catch (err: any) {
              setStatus(err?.message || "Seed failed.");
            }
          }}
        />
        <Button
          title="Rotate Season"
          onPress={async () => {
            setStatus("Creating new season...");
            try {
              const res = await adminCreateSeasonBoard();
              setStatus(`New season: ${res.seasonId}`);
            } catch (err: any) {
              setStatus(err?.message || "Season rotation failed.");
            }
          }}
        />
      </View>

      <Button
        title="Load Analytics"
        onPress={async () => {
          setStatus("Loading analytics...");
          try {
            const res = await adminGetAnalytics();
            setAnalytics(res);
            setStatus(null);
          } catch (err: any) {
            setStatus(err?.message || "Analytics failed.");
          }
        }}
      />

      {analytics?.success ? (
        <View style={styles.analyticsCard}>
          <Text>Board completions: {analytics.boardCompletions}</Text>
          <Text>Row completions: {analytics.rowCompletions}</Text>
          <Text>Rewards issued: {analytics.rewardsIssued}</Text>
          <Text>Rewards redeemed: {analytics.rewardsRedeemed}</Text>
          <Text>Raffle entries: {analytics.raffleEntries}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>QR Links</Text>
      <FlatList
        data={businesses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.qrRow}>
            <Text style={styles.qrName}>{item.name}</Text>
            <Text style={styles.qrUrl}>
              {FUNCTIONS_BASE_URL}/getDailyToken?businessId={item.id}
            </Text>
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
  status: {
    marginBottom: 12,
    color: "#1F618D"
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12
  },
  analyticsCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D5D8DC",
    marginVertical: 12
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginVertical: 12
  },
  qrRow: {
    marginBottom: 12
  },
  qrName: {
    fontWeight: "600"
  },
  qrUrl: {
    fontSize: 12,
    color: "#1F618D"
  }
});
