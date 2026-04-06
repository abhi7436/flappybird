import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const POWERUP_DESCRIPTIONS: { key: string; title: string; desc: string }[] = [
  { key: 'shield', title: 'Shield', desc: 'Grants a temporary shield that prevents death for 10 seconds.' },
  { key: 'magnet', title: 'Magnet', desc: 'Attracts nearby coins to the bird for 7 seconds.' },
  { key: 'slow_pipes', title: 'Slow Pipes', desc: 'Slows pipe spawning/movement for a short time.' },
  { key: 'double_score', title: 'Double Score', desc: 'Doubles the points gained from passing pipes.' },
  { key: 'slow_motion', title: 'Slow Motion', desc: 'Briefly slows world speed so obstacles move slower.' },
  { key: 'golden_coin', title: 'Golden Coin', desc: 'Worth extra points and may trigger bonuses.' },
  { key: 'turbo_jump', title: 'Turbo Jump', desc: 'Temporarily increases jump strength.' },
];

export default function PowerUpHelpModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Power-ups</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            {POWERUP_DESCRIPTIONS.map((p) => (
              <View key={p.key} style={styles.item}>
                <Text style={styles.itemTitle}>{p.title}</Text>
                <Text style={styles.itemDesc}>{p.desc}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  title: { color: '#f7c59f', fontSize: 18, fontWeight: '800' },
  closeBtn: { padding: 8 },
  closeText: { color: 'rgba(255,255,255,0.6)' },
  scroll: { paddingHorizontal: 12 },
  content: { paddingBottom: 18 },
  item: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  itemTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  itemDesc: { color: 'rgba(255,255,255,0.6)', marginTop: 6, fontSize: 13 },
});
