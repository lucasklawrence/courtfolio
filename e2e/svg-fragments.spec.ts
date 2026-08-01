import { expect, test } from '@playwright/test'

import { bypassHomeIntro } from './helpers/intro'

/**
 * Pins the #353 class of bug: an SVG fragment reference that resolves to
 * nothing in the document it renders in.
 *
 * The centre-court logo used to render as `<use href="/common/LogoSvg.svg#…">`.
 * A `<use>` pointing at an *external* file builds a shadow tree whose internal
 * fragment references — `textPath href="#circlePath"`, `filter="url(#…)"` —
 * resolve against the **host** document, where those ids don't exist. Browsers
 * disagree here and iOS Safari drops them, so exactly the parts that depended
 * on a fragment vanished while everything else drew. The mark looked almost
 * right, which is why it shipped.
 *
 * `LogoSvg.test.tsx` already asserts this at the unit level. The gap was that
 * no *browser* ever rendered the page — a jsdom unit test cannot reproduce an
 * engine-specific shadow-tree behaviour. This spec closes that by checking the
 * property against real rendered output, in WebKit.
 *
 * Deliberately generic rather than pinned to one component: it asserts the
 * invariant over whatever the app actually renders, so a future SVG that
 * reintroduces the pattern is caught without anyone remembering to add a case.
 * (Related: #383 — `LogoSvg` currently has no consumers, so the original mark
 * isn't reachable from any route. This check will cover it the moment it is.)
 */

/** Routes that render substantial SVG artwork and need no credentials to do it. */
const SVG_HEAVY_ROUTES = ['/', '/locker-room', '/projects', '/contact'] as const

test.describe('SVG fragment references', () => {
  for (const route of SVG_HEAVY_ROUTES) {
    test(`every fragment reference on ${route} resolves in its own document`, async ({ page }) => {
      await bypassHomeIntro(page)
      await page.goto(route)
      // Artwork is the point of these routes, so wait for at least one to exist
      // rather than racing a still-hydrating scene.
      await expect(page.locator('svg').first()).toBeAttached()

      const broken = await page.evaluate(() => {
        /** Attributes whose value can be a `url(#id)` reference. */
        const URL_REF_ATTRS = [
          'filter',
          'fill',
          'stroke',
          'mask',
          'clip-path',
          'marker-start',
          'marker-mid',
          'marker-end',
        ]
        const unresolved: string[] = []

        const check = (id: string, where: string): void => {
          if (id === '') return
          // `getElementById` searches the whole document, which is the right
          // scope: a reference is satisfied by any element in the same
          // document, wherever the defs happen to live.
          if (document.getElementById(id) === null) unresolved.push(`${where} -> #${id}`)
        }

        for (const el of document.querySelectorAll('svg *')) {
          for (const attr of URL_REF_ATTRS) {
            const value = el.getAttribute(attr)
            if (value === null) continue
            const match = /^url\(["']?#([^"')]+)["']?\)$/.exec(value.trim())
            if (match) check(match[1], `<${el.tagName.toLowerCase()} ${attr}>`)
          }
          // `textPath`/`use`/`tref` carry the reference on href (or the legacy
          // xlink:href). Only same-document fragments are checked — an
          // external-file href is a different mechanism and resolves fine as
          // long as the target needs no fragments of its own.
          const href =
            el.getAttribute('href') ?? el.getAttribute('xlink:href') ?? ''
          if (href.startsWith('#')) {
            check(href.slice(1), `<${el.tagName.toLowerCase()} href>`)
          }
        }
        return unresolved
      })

      expect(broken, `unresolved SVG fragment references on ${route}`).toEqual([])
    })
  }

  test('the rendered mark is not missing pieces that depend on fragments', async ({ page }) => {
    // The #353 symptom specifically: a `textPath` that renders as an empty box
    // because its path reference was dropped. Asserting a non-zero bounding
    // box is what a unit test can't do — jsdom has no layout.
    await bypassHomeIntro(page)
    await page.goto('/')
    await expect(page.locator('svg').first()).toBeAttached()

    const emptyTextPaths = await page.evaluate(() => {
      const offenders: string[] = []
      for (const tp of document.querySelectorAll('textPath')) {
        const text = tp.textContent?.trim() ?? ''
        if (text === '') continue
        const box = (tp as unknown as SVGGraphicsElement).getBBox?.()
        if (box && (box.width === 0 || box.height === 0)) offenders.push(text.slice(0, 40))
      }
      return offenders
    })

    expect(emptyTextPaths, 'textPath elements with content but no rendered box').toEqual([])
  })
})
