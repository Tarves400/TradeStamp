import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

type AnimatedPressableProps = PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  activeScale?: number;
  activeOpacity?: number;
};

export default function AnimatedPressable({
  children,
  style,
  activeScale = 0.97,
  activeOpacity = 0.85,
  onPressIn,
  onPressOut,
  disabled,
  ...props
}: AnimatedPressableProps) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pressed.value, [0, 1], [1, activeScale]);
    const opacity = interpolate(pressed.value, [0, 1], [1, activeOpacity]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const handlePressIn = (e: any) => {
    if (!disabled) {
      pressed.value = withSpring(1, { stiffness: 400, damping: 25 });
    }
    onPressIn?.(e);
  };

  const handlePressOut = (e: any) => {
    if (!disabled) {
      pressed.value = withSpring(0, { stiffness: 400, damping: 25 });
    }
    onPressOut?.(e);
  };

  return (
    <AnimatedPressableBase
      {...props}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressableBase>
  );
}
