import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { avatarColor, colors, initials } from '../theme/colors';

interface Props {
  name: string;
  size?: number;
  online?: boolean;
  ringColor?: string;
}

export default function Avatar({ name, size = 44, online, ringColor = colors.surface }: Props): React.JSX.Element {
  const dot = Math.max(10, size * 0.3);
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(name) }]}>
        <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials(name)}</Text>
      </View>
      {online !== undefined && (
        <View
          style={[
            styles.dot,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              borderColor: ringColor,
              backgroundColor: online ? colors.verified : colors.offline,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.white, fontWeight: '700' },
  dot: { position: 'absolute', right: -1, bottom: -1, borderWidth: 2 },
});
