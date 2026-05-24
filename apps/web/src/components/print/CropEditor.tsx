import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import type { PrintCrop } from '@tedography/domain';

export interface CropEditorProps {
  imageUrl: string;
  printAspect: number;   // width / height of the target print (already orientation-adjusted)
  sourceWidth: number;   // source image pixel width
  sourceHeight: number;  // source image pixel height
  crop: PrintCrop;
  onChange: (crop: PrintCrop) => void;
}

const containerStyle: CSSProperties = {
  position: 'relative',
  display: 'inline-block',
  userSelect: 'none',
  lineHeight: 0,
};

const imageStyle: CSSProperties = {
  display: 'block',
  maxWidth: '100%',
  maxHeight: '52vh',
  objectFit: 'contain',
};

const overlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
};

type CornerHandle = 'nw' | 'ne' | 'sw' | 'se';

const CORNER_CURSORS: Record<CornerHandle, string> = {
  nw: 'nw-resize',
  ne: 'ne-resize',
  sw: 'sw-resize',
  se: 'se-resize',
};

const MIN_CROP_FRACTION = 0.05;
const HANDLE_HALF = 6;

export function computeDefaultCrop(sourceWidth: number, sourceHeight: number, printAspect: number): PrintCrop {
  const srcAspect = sourceWidth / sourceHeight;
  let cropW: number;
  let cropH: number;
  if (srcAspect > printAspect) {
    cropH = 1.0;
    cropW = printAspect / srcAspect;
  } else {
    cropW = 1.0;
    cropH = srcAspect / printAspect;
  }
  return {
    x: (1 - cropW) / 2,
    y: (1 - cropH) / 2,
    width: cropW,
    height: cropH,
  };
}

export function CropEditor({
  imageUrl,
  printAspect,
  sourceWidth,
  sourceHeight,
  crop,
  onChange,
}: CropEditorProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const dragStart = useRef<{ mouseX: number; mouseY: number; cropX: number; cropY: number } | null>(null);
  const resizeStart = useRef<{ corner: CornerHandle; fixedNX: number; fixedNY: number } | null>(null);

  // ── EXIF-rotation correction ───────────────────────────────────────────────
  // iPhones (and other cameras) often store landscape shots as portrait pixels
  // with an EXIF rotation tag. The browser auto-rotates the displayed <img>,
  // making displaySize.w > displaySize.h even though sourceWidth < sourceHeight.
  // When that happens the parent's printAspect (and the initial crop) were
  // computed for the wrong orientation. We detect the swap here and correct:
  //   • recompute the initial crop in display-normalized coordinates
  //   • invert printAspect so resize stays constrained to the right shape
  const exifCorrectedAspect = useRef<number | null>(null);
  useEffect(() => {
    if (displaySize.w === 0 || displaySize.h === 0) return;
    if (exifCorrectedAspect.current === printAspect) return; // already handled
    const displayIsLandscape = displaySize.w > displaySize.h;
    const storedIsLandscape  = sourceWidth  > sourceHeight;
    if (displayIsLandscape === storedIsLandscape) {
      exifCorrectedAspect.current = printAspect; // orientations match — nothing to fix
      return;
    }
    // Orientations differ: image has been EXIF-rotated by the browser.
    // Recompute the default crop in display-normalized space with the
    // corrected (inverted) print aspect so the box looks right on screen.
    exifCorrectedAspect.current = printAspect;
    onChange(computeDefaultCrop(displaySize.w, displaySize.h, 1 / printAspect));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displaySize, printAspect]);
  // ──────────────────────────────────────────────────────────────────────────

  const handleImageLoad = useCallback(() => {
    const el = imgRef.current;
    if (el) setDisplaySize({ w: el.offsetWidth, h: el.offsetHeight });
  }, []);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setDisplaySize({ w: el.offsetWidth, h: el.offsetHeight });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Move: drag anywhere on the image (except corner handles, which stop propagation)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      cropX: crop.x,
      cropY: crop.y,
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragStart.current || displaySize.w === 0) return;
      const dx = (ev.clientX - dragStart.current.mouseX) / displaySize.w;
      const dy = (ev.clientY - dragStart.current.mouseY) / displaySize.h;
      const newX = Math.max(0, Math.min(1 - crop.width, dragStart.current.cropX + dx));
      const newY = Math.max(0, Math.min(1 - crop.height, dragStart.current.cropY + dy));
      onChange({ ...crop, x: newX, y: newY });
    };

    const onMouseUp = () => {
      dragStart.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [crop, displaySize, onChange]);

  // Resize: drag a corner handle
  const handleCornerMouseDown = useCallback((e: React.MouseEvent, corner: CornerHandle) => {
    e.preventDefault();
    e.stopPropagation(); // don't trigger the move handler

    // The fixed (opposite) corner in normalized coords
    const fixedNX = corner === 'nw' || corner === 'sw' ? crop.x + crop.width : crop.x;
    const fixedNY = corner === 'nw' || corner === 'ne' ? crop.y + crop.height : crop.y;
    resizeStart.current = { corner, fixedNX, fixedNY };

    // The crop is stored in normalized display coords (fractions of the displayed image).
    // The target crop aspect in those coords is effectivePrintAspect * dh/dw.
    // For EXIF-rotated images the browser swaps orientation vs the stored dimensions,
    // so we detect that mismatch and invert printAspect accordingly.
    const displayIsLandscapeR = displaySize.w > displaySize.h;
    const storedIsLandscapeR  = sourceWidth  > sourceHeight;
    const exifSwapped = displayIsLandscapeR !== storedIsLandscapeR;
    const effectivePrintAspect = exifSwapped ? 1 / printAspect : printAspect;
    const normAspect = (displaySize.h > 0 && displaySize.w > 0)
      ? effectivePrintAspect * displaySize.h / displaySize.w
      : (printAspect * sourceHeight) / sourceWidth; // fallback (should not happen)

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizeStart.current) return;
      const imgEl = imgRef.current;
      if (!imgEl) return;
      const imgRect = imgEl.getBoundingClientRect();
      if (imgRect.width === 0 || imgRect.height === 0) return;

      const { corner: c, fixedNX: fx, fixedNY: fy } = resizeStart.current;

      // Mouse position in normalized image coords (clamped to image)
      const mouseNX = Math.max(0, Math.min(1, (ev.clientX - imgRect.left) / imgRect.width));
      const mouseNY = Math.max(0, Math.min(1, (ev.clientY - imgRect.top) / imgRect.height));

      // Raw extents from fixed corner
      let rawW = Math.abs(mouseNX - fx);
      let rawH = Math.abs(mouseNY - fy);

      // Clamp to what fits inside [0,1] from the fixed corner
      const maxW = c === 'sw' || c === 'nw' ? fx : 1 - fx;
      const maxH = c === 'ne' || c === 'nw' ? fy : 1 - fy;
      rawW = Math.min(rawW, maxW);
      rawH = Math.min(rawH, maxH);

      // Enforce normalized aspect ratio: use whichever dimension is the binding constraint
      let w: number;
      let h: number;
      if (rawW / normAspect <= rawH) {
        w = rawW;
        h = w / normAspect;
      } else {
        h = rawH;
        w = h * normAspect;
      }

      // Enforce minimum size
      const minW = Math.min(MIN_CROP_FRACTION, maxW);
      const minH = Math.min(MIN_CROP_FRACTION / normAspect, maxH);
      if (w < minW || h < minH) {
        w = Math.max(minW, minH * normAspect);
        h = w / normAspect;
      }

      // Compute top-left of crop from fixed corner
      let x: number;
      let y: number;
      if (c === 'se') { x = fx;     y = fy;     }
      else if (c === 'sw') { x = fx - w; y = fy;     }
      else if (c === 'ne') { x = fx;     y = fy - h; }
      else                 { x = fx - w; y = fy - h; }

      onChange({ x, y, width: w, height: h });
    };

    const onMouseUp = () => {
      resizeStart.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [crop, printAspect, onChange]);

  // Crop box in display pixels
  const boxLeft = crop.x * displaySize.w;
  const boxTop = crop.y * displaySize.h;
  const boxW = crop.width * displaySize.w;
  const boxH = crop.height * displaySize.h;

  const corners: Array<{ corner: CornerHandle; cx: number; cy: number }> = [
    { corner: 'nw', cx: boxLeft,        cy: boxTop        },
    { corner: 'ne', cx: boxLeft + boxW, cy: boxTop        },
    { corner: 'sw', cx: boxLeft,        cy: boxTop + boxH },
    { corner: 'se', cx: boxLeft + boxW, cy: boxTop + boxH },
  ];

  return (
    <div
      ref={containerRef}
      style={{ ...containerStyle, cursor: 'move' }}
      onMouseDown={handleMouseDown}
    >
      <img
        ref={imgRef}
        src={imageUrl}
        alt="Crop preview"
        style={imageStyle}
        onLoad={handleImageLoad}
        draggable={false}
      />
      {displaySize.w > 0 && (
        <>
          <svg style={overlayStyle} viewBox={`0 0 ${displaySize.w} ${displaySize.h}`} xmlns="http://www.w3.org/2000/svg">
            <defs>
              <mask id="crop-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect x={boxLeft} y={boxTop} width={boxW} height={boxH} fill="black" />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#crop-mask)" />
            <rect x={boxLeft} y={boxTop} width={boxW} height={boxH} fill="none" stroke="white" strokeWidth="2" />
            {/* Rule-of-thirds guides */}
            <line x1={boxLeft + boxW / 3} y1={boxTop} x2={boxLeft + boxW / 3} y2={boxTop + boxH} stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
            <line x1={boxLeft + (boxW * 2) / 3} y1={boxTop} x2={boxLeft + (boxW * 2) / 3} y2={boxTop + boxH} stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
            <line x1={boxLeft} y1={boxTop + boxH / 3} x2={boxLeft + boxW} y2={boxTop + boxH / 3} stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
            <line x1={boxLeft} y1={boxTop + (boxH * 2) / 3} x2={boxLeft + boxW} y2={boxTop + (boxH * 2) / 3} stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
          </svg>

          {/* Corner handles as DOM elements so they can capture pointer events */}
          {corners.map(({ corner, cx, cy }) => (
            <div
              key={corner}
              style={{
                position: 'absolute',
                left: cx - HANDLE_HALF,
                top: cy - HANDLE_HALF,
                width: HANDLE_HALF * 2,
                height: HANDLE_HALF * 2,
                background: 'white',
                border: '1px solid rgba(0,0,0,0.35)',
                borderRadius: 2,
                cursor: CORNER_CURSORS[corner],
                zIndex: 1,
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
              onMouseDown={(e) => handleCornerMouseDown(e, corner)}
            />
          ))}
        </>
      )}
    </div>
  );
}
