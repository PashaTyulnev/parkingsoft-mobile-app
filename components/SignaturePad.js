import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  PanResponder,
  Pressable,
  StyleSheet,
} from "react-native";

const STROKE_WIDTH = 2.5;
const MIN_POINT_DISTANCE = 2;

/**
 * @param {{ x: number; y: number }} a
 * @param {{ x: number; y: number }} b
 */
function pointDistance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * @param {Array<Array<{ x: number; y: number }>>} strokes
 */
export function signatureStrokesHasInk(strokes) {
  return (
    Array.isArray(strokes) &&
    strokes.some((stroke) => Array.isArray(stroke) && stroke.length > 0)
  );
}

/**
 * @param {Array<Array<{ x: number; y: number }>> | undefined} strokes
 * @returns {Array<Array<{ x: number; y: number }>>}
 */
export function cloneSignatureStrokes(strokes) {
  if (!Array.isArray(strokes)) return [];
  return strokes.map((stroke) =>
    Array.isArray(stroke) ? stroke.map((p) => ({ x: p.x, y: p.y })) : []
  );
}

/**
 * @param {object} props
 * @param {Array<Array<{ x: number; y: number }>>} props.strokes
 * @param {(strokes: Array<Array<{ x: number; y: number }>>) => void} props.onChangeStrokes
 * @param {object} props.C
 * @param {boolean} [props.disabled]
 */
export default function SignaturePad({ strokes, onChangeStrokes, C, disabled = false }) {
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  const [layout, setLayout] = useState(/** @type {{ width: number; height: number } | null} */ (null));
  const activeStrokeRef = useRef(/** @type {{ x: number; y: number }[] | null} */ (null));

  const commitStrokes = useCallback(
    (nextStrokes) => {
      onChangeStrokes(cloneSignatureStrokes(nextStrokes));
    },
    [onChangeStrokes]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onStartShouldSetPanResponderCapture: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponderCapture: () => !disabled,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          activeStrokeRef.current = [{ x: locationX, y: locationY }];
          commitStrokes([...strokesRef.current, activeStrokeRef.current]);
        },
        onPanResponderMove: (evt) => {
          const stroke = activeStrokeRef.current;
          if (!stroke) return;
          const { locationX, locationY } = evt.nativeEvent;
          const last = stroke[stroke.length - 1];
          const next = { x: locationX, y: locationY };
          if (last && pointDistance(last, next) < MIN_POINT_DISTANCE) return;
          stroke.push(next);
          commitStrokes([...strokesRef.current.slice(0, -1), [...stroke]]);
        },
        onPanResponderRelease: () => {
          activeStrokeRef.current = null;
        },
        onPanResponderTerminate: () => {
          activeStrokeRef.current = null;
        },
      }),
    [commitStrokes, disabled]
  );

  const lineSegments = useMemo(() => {
    const segments = [];
    for (const stroke of strokes) {
      for (let i = 1; i < stroke.length; i += 1) {
        segments.push({ from: stroke[i - 1], to: stroke[i], key: `${segments.length}` });
      }
    }
    return segments;
  }, [strokes]);

  const hasInk = signatureStrokesHasInk(strokes);

  const handleClear = useCallback(() => {
    activeStrokeRef.current = null;
    commitStrokes([]);
  }, [commitStrokes]);

  return (
    <View>
      <View
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setLayout({ width, height });
        }}
        style={[
          s.pad,
          {
            borderColor: C.border,
            backgroundColor: disabled ? C.surface2 : "#fff",
          },
          disabled && s.padDisabled,
        ]}
        {...(disabled ? {} : panResponder.panHandlers)}
      >
        {!hasInk ? (
          <Text style={[s.hint, { color: C.text3 }]} pointerEvents="none">
            Mit dem Finger unterschreiben
          </Text>
        ) : null}
        {lineSegments.map((seg) => (
          <SignatureLine
            key={seg.key}
            from={seg.from}
            to={seg.to}
            color={C.text}
            thickness={STROKE_WIDTH}
          />
        ))}
      </View>
      {layout && hasInk && !disabled ? (
        <Pressable
          onPress={handleClear}
          accessibilityRole="button"
          accessibilityLabel="Unterschrift löschen"
          style={({ pressed }) => [s.clearBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={[s.clearBtnText, { color: C.red }]}>Unterschrift löschen</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * @param {object} props
 * @param {{ x: number; y: number }} props.from
 * @param {{ x: number; y: number }} props.to
 * @param {string} props.color
 * @param {number} props.thickness
 */
function SignatureLine({ from, to, color, thickness }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.5) return null;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: from.x,
        top: from.y - thickness / 2,
        width: length,
        height: thickness,
        backgroundColor: color,
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

const s = StyleSheet.create({
  pad: {
    height: 152,
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  padDisabled: { opacity: 0.85 },
  hint: {
    fontSize: 14,
    fontWeight: "500",
    fontStyle: "italic",
    paddingHorizontal: 12,
    textAlign: "center",
  },
  clearBtn: {
    alignSelf: "flex-end",
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
