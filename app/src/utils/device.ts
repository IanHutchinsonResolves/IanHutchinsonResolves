import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVICE_HASH_KEY = "deviceHash";

function generateDeviceHash(): string {
  const random = Math.random().toString(36).slice(2);
  return `device_${Date.now()}_${random}`;
}

export async function getDeviceHash(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_HASH_KEY);
  if (existing) {
    return existing;
  }
  const created = generateDeviceHash();
  await AsyncStorage.setItem(DEVICE_HASH_KEY, created);
  return created;
}
