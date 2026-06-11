import React, { useEffect, useState } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';

const SPLASH_IMAGE =
  'https://miaoda-conversation-file.s3cdn.medo.dev/user-c74dr5xh1wjk/app-c74e0t74d2wx/20260609/Screenshot_20260610-010813.png';

/* ── Responsive ambient particles (percent-based) ── */
const PARTICLES = [
  { left: 0.08, top: 0.15, size: 3 },
  { left: 0.85, top: 0.22, size: 2 },
  { left: 0.15, top: 0.62, size: 2.5 },
  { left: 0.78, top: 0.68, size: 3.5 },
  { left: 0.48, top: 0.1, size: 2 },
  { left: 0.68, top: 0.48, size: 2 },
  { left: 0.22, top: 0.42, size: 3 },
  { left: 0.9, top: 0.35, size: 2.5 },
  { left: 0.55, top: 0.78, size: 2 },
  { left: 0.05, top: 0.85, size: 2.5 },
  { left: 0.38, top: 0.88, size: 3 },
  { left: 0.72, top: 0.15, size: 2 },
];

interface Props {
  onComplete: () => void;
}

export default function AnimatedSplashScreen({ onComplete }: Props) {
  const { width, height } = useWindowDimensions();

  /* ── Shared values ── */
  const imgScale = useSharedValue(0.2);
  const imgOpacity = useSharedValue(0);
  const imgTranslateY = useSharedValue(30);
  const ring1Scale = useSharedValue(0.6);
  const ring1Opacity = useSharedValue(0);
  const ring2Scale = useSharedValue(0.5);
  const ring2Opacity = useSharedValue(0);
  const containerOpacity = useSharedValue(1);
  const containerScale = useSharedValue(1);
  const particleOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  /* ── Animated styles ── */
  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ scale: imgScale.value }, { translateY: imgTranslateY.value }],
    opacity: imgOpacity.value,
  }));

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1Scale.value }],
    opacity: ring1Opacity.value,
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }],
    opacity: ring2Opacity.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  const particleStyle = useAnimatedStyle(() => ({
    opacity: particleOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  /* ── Animation timeline ── */
  useEffect(() => {
    // 0ms: image springs in from tiny with slight upward float
    imgScale.value = withSpring(1, { stiffness: 140, damping: 13, mass: 1.1 });
    imgOpacity.value = withSpring(1, { stiffness: 140, damping: 13 });
    imgTranslateY.value = withSpring(0, { stiffness: 140, damping: 13 });

    // 150ms: soft radial glow blooms behind the image
    glowOpacity.value = withDelay(150, withTiming(0.6, { duration: 700 }));

    // 200ms: inner cyan glow ring pulses outward
    ring1Opacity.value = withDelay(200, withTiming(0.5, { duration: 600 }));
    ring1Scale.value = withDelay(
      200,
      withSequence(
        withSpring(1.25, { stiffness: 90, damping: 10 }),
        withSpring(1.1, { stiffness: 90, damping: 10 })
      )
    );

    // 400ms: outer subtle ring follows
    ring2Opacity.value = withDelay(400, withTiming(0.3, { duration: 700 }));
    ring2Scale.value = withDelay(
      400,
      withSequence(
        withSpring(1.45, { stiffness: 70, damping: 12 }),
        withSpring(1.25, { stiffness: 70, damping: 12 })
      )
    );

    // 500ms: ambient particles fade in and gently pulse
    particleOpacity.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(0.65, { duration: 1400 }),
          withTiming(0.15, { duration: 1400 })
        ),
        -1,
        true
      )
    );

    // 3000ms: graceful exit — scale down + fade out
    const timeout = setTimeout(() => {
      containerScale.value = withTiming(0.96, { duration: 500 });
      containerOpacity.value = withTiming(0, { duration: 600 }, (finished) => {
        if (finished) {
          runOnJS(onComplete)();
        }
      });
    }, 3000);

    return () => clearTimeout(timeout);
  }, [onComplete]);

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          backgroundColor: '#0b1118',
          alignItems: 'center',
          justifyContent: 'center',
        },
        containerStyle,
      ]}
    >
      {/* ── Ambient floating particles ── */}
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, particleStyle]}>
        {PARTICLES.map((p, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: p.left * width,
              top: p.top * height,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: 'rgba(26,211,222,0.4)',
            }}
          />
        ))}
      </Animated.View>

      {/* ── Soft radial glow behind image ── */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 280,
            height: 280,
            borderRadius: 140,
            backgroundColor: 'rgba(26,211,222,0.08)',
          },
          glowStyle,
        ]}
      />

      {/* ── Outer subtle halo ring ── */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 380,
            height: 380,
            borderRadius: 190,
            borderWidth: 1,
            borderColor: 'rgba(26,211,222,0.1)',
          },
          ring2Style,
        ]}
      />

      {/* ── Inner cyan glow ring ── */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 300,
            height: 300,
            borderRadius: 150,
            borderWidth: 1.5,
            borderColor: 'rgba(26,211,222,0.2)',
            backgroundColor: 'rgba(26,211,222,0.02)',
          },
          ring1Style,
        ]}
      />

      {/* ── Full splash image (logo + text together) ── */}
      <Animated.View style={imgStyle}>
        <Image
          source={{ uri: SPLASH_IMAGE }}
          style={{ width: 280, height: 280 }}
          contentFit="contain"
          transition={200}
        />
        <Text style={{
          textAlign: 'center',
          fontSize: 14,
          fontWeight: '800',
          color: 'rgba(26,211,222,0.85)',
          letterSpacing: 3,
          marginTop: 12,
        }}>
          TRADESTAMP
        </Text>
      </Animated.View>
    </Animated.View>
  );
}
