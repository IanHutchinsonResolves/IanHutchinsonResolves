import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { Season } from "../types";

export function useActiveSeason() {
  const [season, setSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "seasons"),
      where("active", "==", true),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setSeason(null);
      } else {
        const doc = snap.docs[0];
        setSeason({ id: doc.id, ...(doc.data() as Season) });
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { season, loading };
}
