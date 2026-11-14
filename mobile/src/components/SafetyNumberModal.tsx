import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { generateSafetyNumber } from '../crypto/e2ee';

interface Props {
  visible: boolean;
  onClose: () => void;
  myUsername: string;
  peerUsername: string;
  myPublicKey: string;
  peerPublicKey: string;
}

const truncate = (key: string): string => `${key.slice(0, 12)}...${key.slice(-8)}`;

export default function SafetyNumberModal(props: Props): React.JSX.Element {
  const { visible, onClose, myUsername, peerUsername, myPublicKey, peerPublicKey } = props;
  const safetyNumber = visible ? generateSafetyNumber(myPublicKey, peerPublicKey) : '';
  const groups = safetyNumber.split(' ');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Verify Safety Number</Text>
          <Text style={styles.help}>
            Compare this number with {peerUsername} in person or over a trusted channel. If it matches on both
            devices, no one has substituted your keys (no MITM).
          </Text>
          <View style={styles.grid}>
            {groups.map((g, i) => (
              <Text key={`${g}-${i}`} style={styles.group}>
                {g}
              </Text>
            ))}
          </View>
          <Text style={styles.label}>Your public key ({myUsername})</Text>
          <Text style={styles.key}>{truncate(myPublicKey)}</Text>
          <Text style={styles.label}>{peerUsername}&apos;s public key</Text>
          <Text style={styles.key}>{truncate(peerPublicKey)}</Text>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  help: { color: '#555', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 },
  group: { fontFamily: 'monospace', fontSize: 22, fontWeight: '700', margin: 6, color: '#1b2a49' },
  label: { fontWeight: '600', marginTop: 8 },
  key: { fontFamily: 'monospace', color: '#444' },
  button: { backgroundColor: '#2d5be3', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
