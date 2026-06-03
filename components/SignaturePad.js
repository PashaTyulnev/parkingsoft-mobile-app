import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  PanResponder,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import {
  lineSegmentsScaledToFit,
  COMPACT_PADDING,
} from "../lib/signatureRaster";

const STROKE_WIDTH = 2.5;
const COMPACT_STROKE_WIDTH = 1.8;
const MIN_POINT_DISTANCE = 2;

/**
 * @param {Array<Array<{ x: number; y: number }>>} strokes
 * @returns {Array<{ from: { x: number; y: number }; to: { x: number; y: number }; key: string }>}
 */
function lineSegmentsFromStrokes(strokes) {
  const segments = [];
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.length; i += 1) {
      segments.push({
        from: stroke[i - 1],
        to: stroke[i],
        key: `${segments.length}`,
      });
    }
  }
  return segments;
}

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
 * @param {(active: boolean) => void} [props.onDrawingActiveChange] while finger is down — lock parent scroll
 * @param {object} props.C
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.readOnly] display only, no drawing
 * @param {boolean} [props.large] fill available height (signature modal)
 * @param {boolean} [props.showClear] show inline clear link (default true when not readOnly/large)
 * @param {boolean} [props.compact] small preview height (read-only thumbnail)
 */
export default function SignaturePad({
  strokes,
  onChangeStrokes,
  onDrawingActiveChange,
  C,
  disabled = false,
  readOnly = false,
  large = false,
  compact = false,
  showClear,
}) {
  const interactive = !disabled && !readOnly;
  const showClearButton = showClear ?? (interactive && !large);
  const [displayStrokes, setDisplayStrokes] = useState(() => cloneSignatureStrokes(strokes));
  const strokesRef = useRef(displayStrokes);
  const activeStrokeRef = useRef(/** @type {{ x: number; y: number }[] | null} */ (null));
  const isDrawingRef = useRef(false);

  const [layout, setLayout] = useState(/** @type {{ width: number; height: number } | null} */ (null));

  useEffect(() => {
    if (isDrawingRef.current) return;
    const next = cloneSignatureStrokes(strokes);
    strokesRef.current = next;
    setDisplayStrokes(next);
  }, [strokes]);

  const setDrawingActive = useCallback(
    (active) => {
      if (isDrawingRef.current === active) return;
      isDrawingRef.current = active;
      onDrawingActiveChange?.(active);
    },
    [onDrawingActiveChange]
  );

  const finishStroke = useCallback(() => {
    activeStrokeRef.current = null;
    setDrawingActive(false);
    onChangeStrokes(cloneSignatureStrokes(strokesRef.current));
  }, [onChangeStrokes, setDrawingActive]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => interactive,
        onStartShouldSetPanResponderCapture: () => interactive,
        onMoveShouldSetPanResponder: () => interactive,
        onMoveShouldSetPanResponderCapture: () => interactive,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          setDrawingActive(true);
          const { locationX, locationY } = evt.nativeEvent;
          const stroke = [{ x: locationX, y: locationY }];
          activeStrokeRef.current = stroke;
          const nextStrokes = [...strokesRef.current, stroke];
          strokesRef.current = nextStrokes;
          setDisplayStrokes(cloneSignatureStrokes(nextStrokes));
        },
        onPanResponderMove: (evt) => {
          const stroke = activeStrokeRef.current;
          if (!stroke) return;
          const { locationX, locationY } = evt.nativeEvent;
          const last = stroke[stroke.length - 1];
          const next = { x: locationX, y: locationY };
          if (last && pointDistance(last, next) < MIN_POINT_DISTANCE) return;
          stroke.push(next);
          const nextStrokes = [...strokesRef.current.slice(0, -1), [...stroke]];
          strokesRef.current = nextStrokes;
          setDisplayStrokes(nextStrokes);
        },
        onPanResponderRelease: finishStroke,
        onPanResponderTerminate: finishStroke,
      }),
    [interactive, finishStroke, setDrawingActive]
  );

  const lineSegments = useMemo(() => {
    if (compact) {
      if (!layout || layout.width <= 0 || layout.height <= 0) return [];
      return lineSegmentsScaledToFit(
        displayStrokes,
        layout.width,
        layout.height,
        COMPACT_PADDING
      );
    }
    return lineSegmentsFromStrokes(displayStrokes);
  }, [displayStrokes, compact, layout]);

  const strokeThickness = compact ? COMPACT_STROKE_WIDTH : STROKE_WIDTH;

  const hasInk = signatureStrokesHasInk(displayStrokes);

  const handleClear = useCallback(() => {
    activeStrokeRef.current = null;
    strokesRef.current = [];
    setDisplayStrokes([]);
    onChangeStrokes([]);
  }, [onChangeStrokes]);

  return (
    <View style={[large ? s.wrapLarge : null, compact ? s.wrapCompact : null]}>
      <View
        collapsable={false}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setLayout({ width, height });
        }}
        style={[
          s.pad,
          large ? s.padLarge : null,
          compact ? s.padCompact : null,
          {
            borderColor: C.border,
            backgroundColor:
              readOnly && compact ? "#fff" : readOnly || disabled ? C.surface2 : "#fff",
          },
          (disabled || readOnly) && s.padDisabled,
          Platform.OS === "web" && interactive
            ? { touchAction: "none", userSelect: "none" }
            : null,
        ]}
        {...(interactive ? panResponder.panHandlers : {})}
      >
        {!hasInk && !compact ? (
          <Text style={[s.hint, { color: C.text3 }]} pointerEvents="none">
            Mit dem Finger unterschreiben
          </Text>
        ) : null}
        {!hasInk && compact ? (
          <Text style={[s.hintCompact, { color: C.text3 }]} pointerEvents="none">
            —
          </Text>
        ) : null}
        {lineSegments.map((seg) => (
          <SignatureLine
            key={seg.key}
            from={seg.from}
            to={seg.to}
            color="#111111"
            thickness={strokeThickness}
          />
        ))}
      </View>
      {layout && hasInk && showClearButton ? (
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
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const cx = (from.x + to.x) / 2;
  const cy = (from.y + to.y) / 2;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: cx - length / 2,
        top: cy - thickness / 2,
        width: length,
        height: thickness,
        backgroundColor: color,
        transform: [{ rotate: `${angleDeg}deg` }],
      }}
    />
  );
}

const s = StyleSheet.create({
  wrapLarge: { flex: 1, alignSelf: "stretch" },
  wrapCompact: { flex: 1, height: "100%" },
  pad: {
    height: 152,
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  padLarge: {
    flex: 1,
    height: undefined,
    minHeight: 240,
    borderRadius: 12,
  },
  padCompact: {
    flex: 1,
    height: undefined,
    borderWidth: 0,
    borderRadius: 0,
  },
  padDisabled: { opacity: 0.85 },
  hint: {
    fontSize: 14,
    fontWeight: "500",
    fontStyle: "italic",
    paddingHorizontal: 12,
    textAlign: "center",
  },
  hintCompact: { fontSize: 20, fontWeight: "300" },
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
