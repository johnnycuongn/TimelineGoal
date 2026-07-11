import { Dog } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import {
  friendlyAuthError,
  signInWithEmail,
  signUpWithEmail,
} from "@/features/auth/actions";
import { spacing, useTheme } from "@/theme";

type Mode = "sign-in" | "sign-up";

export default function SignInScreen() {
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const isSignUp = mode === "sign-up";

  async function submit() {
    setError(undefined);
    if (isSignUp && !name.trim()) {
      setError("What should we call you?");
      return;
    }
    if (!email.trim() || !password) {
      setError("We need an email and password to continue.");
      return;
    }
    setBusy(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, name);
      } else {
        await signInWithEmail(email, password);
      }
      // On success, the auth listener flips the session → routing takes over.
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Dog color={colors.primary} size={64} strokeWidth={2} />
          <Text variant="display">TimelineGoal</Text>
          <Text variant="body" color="textSecondary" style={styles.center}>
            {isSignUp
              ? "Make an account — then invite your person."
              : "Welcome back. Your den missed you."}
          </Text>
        </View>

        <View style={styles.form}>
          {isSignUp ? (
            <TextField
              label="Your name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              placeholder="e.g. Hong Dao"
            />
          ) : null}
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@example.com"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={isSignUp ? "new-password" : "password"}
            textContentType={isSignUp ? "newPassword" : "password"}
            placeholder="at least 6 characters"
            error={error}
          />

          <Button
            label={isSignUp ? "Create account" : "Sign in"}
            onPress={submit}
            loading={busy}
            style={styles.cta}
          />
          <Button
            label={
              isSignUp
                ? "I already have an account"
                : "New here? Create an account"
            }
            variant="ghost"
            onPress={() => {
              setError(undefined);
              setMode(isSignUp ? "sign-in" : "sign-up");
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  center: { textAlign: "center" },
  form: { gap: spacing.lg },
  cta: { marginTop: spacing.sm },
});
