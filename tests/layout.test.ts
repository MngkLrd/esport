import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/simUI.css', import.meta.url), 'utf8')

describe('sim UI viewport contract', () => {
  it('forces redesigned desktop pages out of legacy two-row app grids', () => {
    for (const tab of ['world','calendar','play','training','roster','packs','scout','inbox','profile']) {
      expect(css).toContain('.app-main.app-main-' + tab)
    }
    expect(css).toContain('display:block !important;')
    expect(css).toContain('grid-template-rows:none !important;')
  })

  it('pins each redesigned screen to the full app viewport', () => {
    expect(css).toMatch(/\.app-main\s*>\s*\.sim-screen\s*\{[\s\S]*?position:absolute;[\s\S]*?inset:0;[\s\S]*?height:100%;/)
    expect(css).toContain('box-sizing:border-box;')
  })

  it('keeps the back button out of document flow', () => {
    expect(css).toMatch(/\.app-main\.app-main-world\s*>\s*\.screen-back-button[\s\S]*?position:absolute !important;/)
  })
})
