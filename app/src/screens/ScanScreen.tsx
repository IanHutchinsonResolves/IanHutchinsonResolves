import React from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { validateCheckIn } from "../utils/api";
import { getDeviceHash } from "../utils/device";

export function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = React.useState(true);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleScan = async (data: string) => {
    if (!isScanning) {
      return;
    }
    setIsScanning(false);
    setError(null);
    setMessage("Validating check-in...");
    try {
      let token = data;
      if (data.startsWith("http")) {
        const res = await fetch(data);
        const json = await res.json();
        if (!json.token) {
          throw new Error("Token not found in QR response");
        }
        token = json.token;
      }
      const deviceHash = await getDeviceHash();
      const result = await validateCheckIn(token, deviceHash);
      if (result.earnedSquare) {
        setMessage("Check-in successful! Square earned.");
      } else {
        setMessage("Check-in recorded. No new square this time.");
      }
    } catch (err: any) {
      setError(err?.message || "Check-in failed.");
      setMessage(null);
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text>Camera access is required to scan QR codes.</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        onBarcodeScanned={({ data }) => handleScan(data)}
      />
      <View style={styles.overlay}>
        <Text style={styles.helper}>Scan an in-store QR code</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Scan Again" onPress={() => setIsScanning(true)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000"
  },
  camera: {
    flex: 1
  },
  overlay: {
    padding: 16,
    backgroundColor: "#FFFFFF"
  },
  helper: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8
  },
  message: {
    color: "#1E8449",
    marginBottom: 8
  },
  error: {
    color: "#C0392B",
    marginBottom: 8
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16
  }
});
