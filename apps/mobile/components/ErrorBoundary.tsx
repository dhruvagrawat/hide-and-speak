import { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '@/constants/colors';
import { LogoMark } from '@/components/Logo';
import { Icon } from '@/components/Icon';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * App-wide crash guard. React error boundaries must be class components, so
 * this catches any render/lifecycle error in the tree below it and shows a
 * recover screen instead of a white screen or red box — far better for real
 * users testing a preview build. "Try again" clears the error and re-renders.
 *
 * Uses the static `Colors` palette (not the theme hook) on purpose: the
 * boundary has to render even if the theme provider is what crashed.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surfaced to Metro / device logs for debugging the preview build.
    console.error('[ErrorBoundary]', error);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.fill}>
        <ScrollView contentContainerStyle={styles.content}>
          <LogoMark size={64} />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            The app hit an unexpected error. Your chats are safe — try again.
          </Text>

          <View style={styles.detailBox}>
            <Text style={styles.detailLabel}>Details</Text>
            <Text style={styles.detailText}>{error.message || 'Unknown error'}</Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={this.reset} activeOpacity={0.85}>
            <Icon name="forward" size={18} color="#fff" />
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: Colors.background },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 14 },
  title: { color: Colors.text, fontSize: 22, fontWeight: '800', marginTop: 8 },
  subtitle: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  detailBox: {
    alignSelf: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginTop: 6,
  },
  detailLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  detailText: { color: Colors.textSecondary, fontSize: 13, fontFamily: 'monospace' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 10,
    elevation: 6,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
