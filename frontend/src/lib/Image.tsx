/**
 * Drop-in replacement for `next/image` (the app always ran with `images.unoptimized: true`).
 *
 *   import Image from '@/lib/Image'
 *
 * Renders the same single <img> element next/image 16 rendered for unoptimized images
 * (see node_modules/next/dist/shared/lib/get-img-props.js + client/image-component.js):
 *   - data-nimg="1" (or "fill" when `fill`)
 *   - loading="lazy" unless `priority`/`preload`/`loading="eager"` or a data:/blob: src
 *     (with `priority` the loading attribute is OMITTED, exactly like Next 16, and the image is preloaded)
 *   - decoding="async" (overridable), width/height attributes as integers
 *   - style: color:transparent (removed after a load error so the alt text shows),
 *     plus for `fill`: position:absolute; height:100%; width:100%; left/top/right/bottom:0
 *   - no srcset/sizes (unoptimized), `sizes`/`quality`/`loader` are accepted and ignored
 */
import { forwardRef, useState, type CSSProperties, type ImgHTMLAttributes, type SyntheticEvent } from 'react';
import { preload as reactPreload } from 'react-dom';

export interface StaticImageData {
  src: string;
  height: number;
  width: number;
  blurDataURL?: string;
  blurWidth?: number;
  blurHeight?: number;
}

export interface StaticRequire {
  default: StaticImageData;
}

export type StaticImport = StaticRequire | StaticImageData;

type NumberLike = number | `${number}`;
type PlaceholderValue = 'empty' | 'blur' | `data:image/${string}`;

export interface ImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'ref' | 'alt' | 'width' | 'height' | 'loading'> {
  src: string | StaticImport;
  alt: string;
  width?: NumberLike;
  height?: NumberLike;
  fill?: boolean;
  /** Ignored (images are never optimized). */
  loader?: unknown;
  /** Ignored. */
  quality?: NumberLike;
  priority?: boolean;
  preload?: boolean;
  loading?: 'lazy' | 'eager';
  placeholder?: PlaceholderValue;
  blurDataURL?: string;
  /** Ignored: always unoptimized. */
  unoptimized?: boolean;
  overrideSrc?: string;
  /** @deprecated use onLoad */
  onLoadingComplete?: (img: HTMLImageElement) => void;
  /** @deprecated legacy next/image props, accepted for compatibility */
  layout?: string;
  objectFit?: CSSProperties['objectFit'];
  objectPosition?: CSSProperties['objectPosition'];
  lazyBoundary?: string;
  lazyRoot?: string;
}

function getInt(x: unknown): number | undefined {
  if (typeof x === 'undefined') return undefined;
  if (typeof x === 'number') return Number.isFinite(x) ? x : NaN;
  if (typeof x === 'string' && /^[0-9]+$/.test(x)) return parseInt(x, 10);
  return NaN;
}

function isStaticRequire(src: StaticImport): src is StaticRequire {
  return (src as StaticRequire).default !== undefined;
}

function isStaticImport(src: unknown): src is StaticImport {
  return (
    !!src &&
    typeof src === 'object' &&
    ((src as StaticRequire).default !== undefined || (src as StaticImageData).src !== undefined)
  );
}

const INVALID_BACKGROUND_SIZE_VALUES = ['-moz-initial', 'fill', 'none', 'scale-down', undefined];

function getImageBlurSvg(
  widthInt: number | undefined,
  heightInt: number | undefined,
  blurWidth: number | undefined,
  blurHeight: number | undefined,
  blurDataURL: string,
  objectFit: CSSProperties['objectFit'],
): string {
  const std = 20;
  const svgWidth = blurWidth ? blurWidth * 40 : widthInt;
  const svgHeight = blurHeight ? blurHeight * 40 : heightInt;
  const viewBox = svgWidth && svgHeight ? `viewBox='0 0 ${svgWidth} ${svgHeight}'` : '';
  const preserveAspectRatio = viewBox
    ? 'none'
    : objectFit === 'contain'
      ? 'xMidYMid'
      : objectFit === 'cover'
        ? 'xMidYMid slice'
        : 'none';
  return `%3Csvg xmlns='http://www.w3.org/2000/svg' ${viewBox}%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='${std}'/%3E%3CfeColorMatrix values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 100 -1' result='s'/%3E%3CfeFlood x='0' y='0' width='100%25' height='100%25'/%3E%3CfeComposite operator='out' in='s'/%3E%3CfeComposite in2='SourceGraphic'/%3E%3CfeGaussianBlur stdDeviation='${std}'/%3E%3C/filter%3E%3Cimage width='100%25' height='100%25' x='0' y='0' preserveAspectRatio='${preserveAspectRatio}' style='filter: url(%23b);' href='${blurDataURL}'/%3E%3C/svg%3E`;
}

const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  {
    src: srcProp,
    sizes: _sizes,
    unoptimized: _unoptimized,
    priority = false,
    preload = false,
    loading,
    className,
    quality: _quality,
    width,
    height,
    fill: fillProp = false,
    style,
    overrideSrc,
    onLoad,
    onLoadingComplete,
    onError,
    placeholder = 'empty',
    blurDataURL: blurDataURLProp,
    fetchPriority,
    decoding = 'async',
    layout,
    objectFit,
    objectPosition,
    lazyBoundary: _lazyBoundary,
    lazyRoot: _lazyRoot,
    loader: _loader,
    ...rest
  },
  ref,
) {
  const [showAltText, setShowAltText] = useState(false);
  const [blurComplete, setBlurComplete] = useState(false);

  let fill = fillProp;
  let imgStyleInput = style;
  if (layout) {
    if (layout === 'fill') fill = true;
    if (layout === 'intrinsic') imgStyleInput = { ...imgStyleInput, maxWidth: '100%', height: 'auto' };
    if (layout === 'responsive') imgStyleInput = { ...imgStyleInput, width: '100%', height: 'auto' };
  }

  let widthInt = getInt(width);
  let heightInt = getInt(height);
  let staticSrc = '';
  let blurWidth: number | undefined;
  let blurHeight: number | undefined;
  let blurDataURL = blurDataURLProp;

  if (isStaticImport(srcProp)) {
    const data = isStaticRequire(srcProp) ? srcProp.default : srcProp;
    staticSrc = data.src;
    blurWidth = data.blurWidth;
    blurHeight = data.blurHeight;
    blurDataURL = blurDataURL || data.blurDataURL;
    if (!fill && data.width && data.height) {
      if (!widthInt && !heightInt) {
        widthInt = data.width;
        heightInt = data.height;
      } else if (widthInt && !heightInt) {
        heightInt = Math.round(data.height * (widthInt / data.width));
      } else if (!widthInt && heightInt) {
        widthInt = Math.round(data.width * (heightInt / data.height));
      }
    }
  }

  const src = typeof srcProp === 'string' ? srcProp : staticSrc;

  let isLazy = !priority && !preload && (loading === 'lazy' || typeof loading === 'undefined');
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) {
    isLazy = false;
  }
  const loadingFinal = isLazy ? 'lazy' : loading;

  const imgStyle: CSSProperties = Object.assign(
    fill
      ? {
          position: 'absolute',
          height: '100%',
          width: '100%',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          objectFit,
          objectPosition,
        }
      : {},
    showAltText ? {} : { color: 'transparent' },
    imgStyleInput,
  );

  const backgroundImage =
    !blurComplete && placeholder !== 'empty'
      ? placeholder === 'blur'
        ? `url("data:image/svg+xml;charset=utf-8,${getImageBlurSvg(
            widthInt,
            heightInt,
            blurWidth,
            blurHeight,
            blurDataURL || '',
            imgStyle.objectFit,
          )}")`
        : `url("${placeholder}")`
      : null;

  const backgroundSize = !INVALID_BACKGROUND_SIZE_VALUES.includes(imgStyle.objectFit as string | undefined)
    ? (imgStyle.objectFit as string)
    : imgStyle.objectFit === 'fill'
      ? '100% 100%'
      : 'cover';

  const placeholderStyle: CSSProperties = backgroundImage
    ? {
        backgroundSize,
        backgroundPosition: (imgStyle.objectPosition as string) || '50% 50%',
        backgroundRepeat: 'no-repeat',
        backgroundImage,
      }
    : {};

  const finalSrc = overrideSrc || src;

  if ((priority || preload) && finalSrc) {
    // Same as next/image: hint the browser to fetch the image early.
    reactPreload(finalSrc, { as: 'image', fetchPriority: fetchPriority as 'high' | 'low' | 'auto' | undefined });
  }

  return (
    <img
      {...rest}
      fetchPriority={fetchPriority}
      loading={loadingFinal}
      width={widthInt}
      height={heightInt}
      decoding={decoding}
      data-nimg={fill ? 'fill' : '1'}
      className={className}
      style={{ ...imgStyle, ...placeholderStyle }}
      src={finalSrc || undefined}
      ref={ref}
      onLoad={(event: SyntheticEvent<HTMLImageElement, Event>) => {
        if (placeholder !== 'empty') setBlurComplete(true);
        onLoad?.(event);
        onLoadingComplete?.(event.currentTarget);
      }}
      onError={(event: SyntheticEvent<HTMLImageElement, Event>) => {
        // if the real image fails to load, this will ensure "alt" is visible
        setShowAltText(true);
        if (placeholder !== 'empty') setBlurComplete(true);
        onError?.(event);
      }}
    />
  );
});

export default Image;
