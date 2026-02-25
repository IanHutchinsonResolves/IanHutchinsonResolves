import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  title: string;
  subtitle?: string;
  earned: boolean;
  isFree?: boolean;
  onPress?: () => void;
};

export function BoardTile({ title, subtitle, earned, isFree, onPress }: Props) {
  return (
    <Pressable
      style={[styles.tile, earned ? styles.earned : styles.locked]}
      onPress={onPress}
    >
      <View style={styles.inner}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {isFree ? <Text style={styles.free}>Free</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    aspectRatio: 1,
    margin: 4,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    padding: 6,
    borderWidth: 1
  },
  earned: {
    backgroundColor: "#D5F5E3",
    borderColor: "#2ECC71"
  },
  locked: {
    backgroundColor: "#F2F3F4",
    borderColor: "#D0D3D4"
  },
  inner: {
    alignItems: "center"
  },
  title: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    color: "#2C3E50"
  },
  subtitle: {
    fontSize: 10,
    color: "#566573",
    marginTop: 2
  },
  free: {
    marginTop: 6,
    fontSize: 10,
    color: "#1F618D"
  }
});
