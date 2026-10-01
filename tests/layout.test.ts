import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/simUI.css', import.meta.url), 'utf8')
const roster = readFileSync(new URL('../src/RosterBoard.tsx', import.meta.url), 'utf8')
const training = readFileSync(new URL('../src/TrainingGround.tsx', import.meta.url), 'utf8')

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


  it('stretches the desktop squad planner through the available game viewport', () => {
    expect(css).toMatch(/\.sim-roster-v2\s*\{[\s\S]*?height:100%;[\s\S]*?grid-template-rows:54px 44px minmax\(0,1fr\);/)
    expect(css).toMatch(/\.sim-squad-planner\s*\{[\s\S]*?height:100%;[\s\S]*?grid-template-rows:48px 42px minmax\(0,1fr\);/)
    expect(css).toMatch(/\.sim-planner-workspace\s*\{[\s\S]*?height:100%;[\s\S]*?overflow:hidden;/)
    expect(css).toMatch(/\.sim-planner-lanes\s*\{[\s\S]*?height:100%;[\s\S]*?align-items:stretch;/)
  })

  it('exposes global and per-role auto selection controls', () => {
    expect(roster).toContain('className="sim-planner-auto-all"')
    expect(roster).toContain('className="sim-planner-board-auto"')
    expect(roster).toContain('className="sim-planner-role-auto"')
    expect(roster).toContain('autoFillAllRoles')
    expect(roster).toContain('autoFillRole(role)')
  })


  it('keeps the training ground as a full-height manager workspace', () => {
    expect(css).toMatch(/\.training-ground\s*\{[\s\S]*?height:100%;[\s\S]*?grid-template-rows:70px minmax\(0,1fr\);/)
    expect(css).toMatch(/\.training-ground-body\s*\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) 372px;/)
    expect(css).toMatch(/\.training-week-grid\s*\{[\s\S]*?grid-template-columns:repeat\(7,minmax\(0,1fr\)\);/)
  })

  it('exposes the core training workflows without restoring instant card farming', () => {
    expect(training).toContain('AUTO PLAN')
    expect(training).toContain('SESSION BUILDER')
    expect(training).toContain('MATCH PREPARATION')
    expect(training).toContain('PLAYER DEVELOPMENT')
    expect(training).toContain('LAST SCRIM REPORT')
    expect(training).toContain('OVR GAIN')
    expect(training).toContain('<b>0</b>')
  })
})
