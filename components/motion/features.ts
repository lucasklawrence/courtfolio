/**
 * Lazily-loaded Framer Motion feature bundle for {@link MotionProvider}.
 *
 * `domMax` is the full DOM feature set — animations, gestures, **and layout
 * animations** (`layout` / `layoutId`). The project-binder card→detail morph
 * relies on layout animations, so the smaller `domAnimation` set is not enough.
 *
 * This module exists as its own file so the provider can pull it in via a
 * dynamic `import()`, which lets the bundler code-split the feature code out of
 * the initial JS payload — it is only fetched when motion first mounts.
 *
 * @see https://www.framer.com/motion/lazy-motion/
 */
import { domMax } from 'framer-motion'

export default domMax
