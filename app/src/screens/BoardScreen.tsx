import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  doc
} from "firebase/firestore";
import { db } from "../firebase";
import { useActiveSeason } from "../hooks/useActiveSeason";
import { useAuth } from "../hooks/useAuth";
import { Business, SeasonSquare, UserSeasonProgress } from "../types";
import { BoardTile } from "../components/BoardTile";
import { BOARD_SIZE, FREE_SPACE_INDEX } from "../utils/board";

export function BoardScreen() {
  const { user } = useAuth();
  const { season, loading: seasonLoading } = useActiveSeason();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [squares, setSquares] = useState<SeasonSquare[]>([]);
  const [progress, setProgress] = useState<UserSeasonProgress | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);

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

  React.useEffect(() => {
    if (!season) {
      setSquares([]);
      return;
    }
    const q = query(
      collection(db, "seasonSquares"),
      where("seasonId", "==", season.id),
      orderBy("index", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as SeasonSquare)
      }));
      setSquares(list);
    });
    return () => unsub();
  }, [season?.id]);

  React.useEffect(() => {
    if (!user || !season) {
      setProgress(null);
      return;
    }
    const ref = doc(db, "userSeasonProgress", `${user.uid}_${season.id}`);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setProgress(snap.data() as UserSeasonProgress);
      } else {
        setProgress(null);
      }
    });
    return () => unsub();
  }, [user, season?.id]);

  const businessMap = useMemo(() => {
    const map = new Map<string, Business>();
    businesses.forEach((biz) => map.set(biz.id, biz));
    return map;
  }, [businesses]);

  const earnedIndices = useMemo(() => {
    const earned = progress?.earnedIndices ?? [];
    if (!earned.includes(FREE_SPACE_INDEX)) {
      return [...earned, FREE_SPACE_INDEX];
    }
    return earned;
  }, [progress?.earnedIndices]);

  const tiles = useMemo(() => {
    const empty = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, idx) => ({
      index: idx,
      businessId: null as string | null
    }));
    squares.forEach((sq) => {
      empty[sq.index] = { index: sq.index, businessId: sq.businessId };
    });
    return empty.map((sq) => {
      const business = sq.businessId ? businessMap.get(sq.businessId) : null;
      return {
        key: String(sq.index),
        index: sq.index,
        business,
        isFree: sq.index === FREE_SPACE_INDEX,
        earned: earnedIndices.includes(sq.index)
      };
    });
  }, [squares, businessMap, earnedIndices]);

  if (seasonLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading board...</Text>
      </View>
    );
  }

  if (!season) {
    return (
      <View style={styles.center}>
        <Text>No active season yet.</Text>
      </View>
    );
  }

  const completedRowsCount = progress?.completedRows?.length ?? 0;
  const boardComplete = progress?.boardComplete ?? false;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>This Week's Bingo Board</Text>
      <Text style={styles.subtitle}>Season: {season.id}</Text>
      <View style={styles.progressRow}>
        <Text>Completed Rows: {completedRowsCount}</Text>
        <Text>Board Complete: {boardComplete ? "Yes" : "No"}</Text>
      </View>

      <FlatList
        data={tiles}
        keyExtractor={(item) => item.key}
        numColumns={BOARD_SIZE}
        renderItem={({ item }) => (
          <BoardTile
            title={item.business?.name || "Free Space"}
            subtitle={item.business?.category}
            earned={item.earned}
            isFree={item.isFree}
            onPress={() => {
              if (item.business) {
                setSelectedBusiness(item.business);
              }
            }}
          />
        )}
        scrollEnabled={false}
        contentContainerStyle={styles.grid}
      />

      <Modal transparent visible={!!selectedBusiness} animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selectedBusiness?.name}</Text>
            <Text style={styles.modalText}>{selectedBusiness?.address}</Text>
            <Text style={styles.modalText}>{selectedBusiness?.category}</Text>
            <Pressable
              style={styles.modalButton}
              onPress={() => setSelectedBusiness(null)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#FFFFFF"
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1C2833"
  },
  subtitle: {
    marginTop: 4,
    color: "#566573"
  },
  progressRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  grid: {
    marginTop: 12
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8
  },
  modalText: {
    fontSize: 14,
    marginBottom: 6
  },
  modalButton: {
    marginTop: 12,
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#1F618D",
    borderRadius: 8
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontWeight: "600"
  }
});
