import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { generateSafetyNumber } from '../crypto/e2ee';
import { colors, mono } from '../theme/colors';

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
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="shield-checkmark" size={26} color={colors.verified} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Verify Safety Number</Text>
              <Text style={styles.headerSub}>with {peerUsername}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.help}>
              Compare this number with {peerUsername} in person or over a trusted channel. If it matches on both
              devices, no one has substituted your keys (no MITM).
            </Text>

            <View style={styles.grid}>
              {groups.map((g, i) => (
                <View key={`${g}-${i}`} style={styles.groupBox}>
                  <Text style={styles.group}>{g}</Text>
                </View>
              ))}
            </View>

            <View style={styles.keyCard}>
              <Text style={styles.label}>You ({myUsername})</Text>
              <Text style={styles.key}>{truncate(myPublicKey)}</Text>
            </View>
            <View style={styles.keyCard}>
              <Text style={styles.label}>Peer ({peerUsername})</Text>
              <Text style={styles.key}>{truncate(peerPublicKey)}</Text>
            </View>

            <TouchableOpacity style={styles.button} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.buttonText}>Done</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 20, overflow: 'hidden', maxHeight: '90%' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.dark, padding: 16 },
  headerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(16,185,129,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, marginLeft: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.white },
  headerSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  body: { padding: 20 },
  help: { color: colors.textSecondary, lineHeight: 20, marginBottom: 16 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 16,
    padding: 10,
    marginBottom: 16,
  },
  groupBox: { width: '33.33%', alignItems: 'center', paddingVertical: 8 },
  group: { fontFamily: mono, fontSize: 20, fontWeight: '700', color: colors.dark, letterSpacing: 1 },
  keyCard: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  key: { fontFamily: mono, color: colors.text, marginTop: 4, fontSize: 13 },
  button: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
