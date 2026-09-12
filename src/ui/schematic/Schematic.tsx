import { useState } from 'react'
import type { BuildSpec } from '../../stages/build'
import type { BuildStage } from '../../solver/netlist'
import {
  Capacitor,
  CapsuleSymbol,
  DcSource,
  DependentSource,
  Ground,
  Inductor,
  Jfet,
  Label,
  Node,
  Part,
  Resistor,
  StageBox,
  Wire,
  Xlr,
} from './symbols'
import { eng } from '../../lib/format'

/**
 * The whole microphone, drawn as one schematic.
 *
 * The active stage is bright and the others are dimmed, so the drawing always
 * says where you are in the signal path. Clicking a part selects it; hovering
 * shows what it does.
 */

interface Props {
  build: BuildSpec
  activeStage: BuildStage
  selected: string | null
  onSelect: (id: string | null) => void
  /** Element notes from the netlist, for the hover strip. */
  notes: Record<string, { label: string; note: string; value?: string }>
  /** Assembly walkthrough: which parts are on the board, and which just arrived. */
  fitted?: Set<string>
  justAdded?: Set<string>
  /** Hide the stage boxes and the value read-out in the simplified walkthrough. */
  quiet?: boolean
  /** Replaces the default prompt under the schematic. */
  hint?: string
}

const W = 1120
const H = 300

export function Schematic({ build, activeStage, selected, onSelect, notes, fitted, justAdded, quiet, hint }: Props) {
  const [hover, setHover] = useState<string | null>(null)
  const info = hover ? notes[hover] : selected ? notes[selected] : null

  const dim = (stage: BuildStage) => stage !== activeStage

  const fitOf = (id: string): 'fitted' | 'new' | 'empty' => {
    if (!fitted) return 'fitted'
    if (justAdded?.has(id)) return 'new'
    return fitted.has(id) ? 'fitted' : 'empty'
  }

  const p = (id: string, stage: BuildStage, children: React.ReactNode) => (
    <Part
      key={id}
      id={id}
      selected={selected === id || hover === id}
      dimmed={fitted ? false : dim(stage)}
      fit={fitOf(id)}
      onSelect={onSelect}
      onHover={setHover}
    >
      {children}
    </Part>
  )

  const v = (stage: BuildStage, key: string): number => {
    const x = build[stage].values[key]
    return typeof x === 'number' ? x : 0
  }

  const polVariant = build.polarisation.variant
  const convVariant = build.converter.variant
  const outVariant = build.output.variant

  const railY = 40
  const sigY = 150
  const gndY = 250

  return (
    <div className="flex flex-col">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        onClick={() => onSelect(null)}
        role="img"
        aria-label="Microphone schematic"
      >
        {quiet ? null : (
          <>
        <StageBox x={8} y={16} w={190} h={268} title="Capsule" active={activeStage === 'capsule'} />
        <StageBox x={204} y={16} w={175} h={268} title="Polarisation" active={activeStage === 'polarisation'} />
        <StageBox x={385} y={16} w={265} h={268} title="Converter" active={activeStage === 'converter'} />
        <StageBox x={656} y={16} w={230} h={268} title="Output" active={activeStage === 'output'} />
        <StageBox x={892} y={16} w={220} h={268} title="Load" active={activeStage === 'load'} />
          </>
        )}

        {/* ---------------------------------------------------------- capsule */}
        {p(
          'capsule.C',
          'capsule',
          <>
            <CapsuleSymbol x={90} y={sigY} />
          </>,
        )}
        <Label x={90} y={sigY - 34}>
          {eng(v('capsule', 'Ccaps'), 'F')}
        </Label>
        <Label x={62} y={sigY + 40} dim>
          backplate
        </Label>
        <Label x={126} y={sigY + 40} dim>
          diaphragm
        </Label>

        {/* backplate side */}
        {polVariant === 'backplate' ? (
          <>
            <Wire d={`M 66 ${sigY} L 40 ${sigY} L 40 ${sigY - 60} L 250 ${sigY - 60}`} />
            <Node x={250} y={sigY - 60} />
          </>
        ) : (
          <>
            <Wire d={`M 66 ${sigY} L 40 ${sigY} L 40 ${gndY}`} />
            {p('pol.backGnd', 'polarisation', <Resistor x={40} y={gndY - 40} vertical />)}
            <Ground x={40} y={gndY} />
          </>
        )}

        {/* -------------------------------------------------- polarisation */}
        {polVariant === 'electret' ? (
          <>
            <Wire d={`M 116 ${sigY} L 420 ${sigY}`} />
            <Label x={280} y={sigY - 12} dim>
              built-in charge — no supply
            </Label>
          </>
        ) : polVariant === 'backplate' ? (
          <>
            {/* V_pol → R_pol → backplate, with the backplate bypassed to ground */}
            <Wire d={`M 250 ${sigY - 60} L 250 ${sigY - 60}`} />
            {p('pol.R_pol', 'polarisation', <Resistor x={290} y={sigY - 60} />)}
            <Wire d={`M 250 ${sigY - 60} L 269 ${sigY - 60}`} />
            <Wire d={`M 311 ${sigY - 60} L 340 ${sigY - 60} L 340 ${railY + 28}`} />
            {p('pol.V', 'polarisation', <DcSource x={340} y={railY + 8} label={`${v('polarisation', 'V_pol').toFixed(0)} V`} />)}
            <Ground x={340} y={railY - 20} />
            <Wire d={`M 250 ${sigY - 60} L 250 ${gndY - 52}`} />
            {p('pol.C_bypass', 'polarisation', <Capacitor x={250} y={gndY - 30} vertical />)}
            <Wire d={`M 250 ${gndY - 14} L 250 ${gndY}`} />
            <Ground x={250} y={gndY} />
            <Label x={290} y={sigY - 72}>
              {eng(v('polarisation', 'R_pol'), 'Ω')}
            </Label>
            <Label x={276} y={gndY - 30} anchor="start">
              {eng(v('polarisation', 'C_bypass'), 'F')}
            </Label>
            <Wire d={`M 116 ${sigY} L 420 ${sigY}`} />
          </>
        ) : (
          <>
            <Wire d={`M 116 ${sigY} L 235 ${sigY}`} />
            <Node x={235} y={sigY} />
            <Wire d={`M 235 ${sigY} L 235 ${sigY - 60}`} />
            {p('pol.R_pol', 'polarisation', <Resistor x={276} y={sigY - 60} />)}
            <Wire d={`M 235 ${sigY - 60} L 255 ${sigY - 60}`} />
            <Wire d={`M 297 ${sigY - 60} L 340 ${sigY - 60} L 340 ${railY + 28}`} />
            {p('pol.V', 'polarisation', <DcSource x={340} y={railY + 8} label={`${v('polarisation', 'V_pol').toFixed(0)} V`} />)}
            <Ground x={340} y={railY - 20} />
            <Label x={276} y={sigY - 72}>
              {eng(v('polarisation', 'R_pol'), 'Ω')}
            </Label>
            {p('pol.C_couple', 'polarisation', <Capacitor x={330} y={sigY} />)}
            <Wire d={`M 235 ${sigY} L 314 ${sigY}`} />
            <Wire d={`M 346 ${sigY} L 420 ${sigY}`} />
            <Label x={330} y={sigY - 22}>
              {eng(v('polarisation', 'C_couple'), 'F')}
            </Label>
          </>
        )}

        {/* ------------------------------------------------------- converter */}
        <Node x={430} y={sigY} />
        <Wire d={`M 430 ${sigY} L 430 ${gndY - 52}`} />
        {p('conv.C_stray', 'converter', <Capacitor x={430} y={gndY - 30} vertical />)}
        <Wire d={`M 430 ${gndY - 14} L 430 ${gndY}`} />
        <Ground x={430} y={gndY} />
        <Label x={412} y={gndY - 30} anchor="end">
          {eng(v('converter', 'C_stray'), 'F')}
        </Label>

        {convVariant === 'bootstrap' ? (
          <>
            <Wire d={`M 430 ${sigY} L 470 ${sigY}`} />
            <Node x={470} y={sigY} />
            <Wire d={`M 470 ${sigY} L 470 ${sigY + 30}`} />
            {p('conv.R_gate', 'converter', <Resistor x={470} y={sigY + 52} vertical />)}
            <Wire d={`M 470 ${sigY + 66} L 470 ${sigY + 76}`} />
            <Node x={470} y={sigY + 76} />
            {p('conv.R_gate2', 'converter', <Resistor x={470} y={sigY + 98} vertical />)}
            <Ground x={470} y={gndY + 20} />
            <Wire d={`M 470 ${sigY + 76} L 560 ${sigY + 76}`} />
            {p('conv.C_boot', 'converter', <Capacitor x={560} y={sigY + 60} vertical />)}
            <Wire d={`M 560 ${sigY + 76} L 560 ${sigY + 71}`} />
            <Wire d={`M 560 ${sigY + 44} L 560 ${sigY + 24}`} />
            <Label x={490} y={sigY + 56} anchor="start">
              {eng(v('converter', 'R_gate'), 'Ω')}
            </Label>
          </>
        ) : (
          <>
            <Wire d={`M 430 ${sigY} L 470 ${sigY}`} />
            <Node x={470} y={sigY} />
            <Wire d={`M 470 ${sigY} L 470 ${gndY - 62}`} />
            {p('conv.R_gate', 'converter', <Resistor x={470} y={gndY - 40} vertical />)}
            <Ground x={470} y={gndY} />
            <Label x={488} y={gndY - 40} anchor="start">
              {eng(v('converter', 'R_gate'), 'Ω')}
            </Label>
          </>
        )}

        <Wire d={`M 470 ${sigY} L 528 ${sigY}`} />
        {p('conv.J', 'converter', <Jfet x={550} y={sigY} />)}
        <Label x={550} y={sigY + 40}>
          {String(build.converter.values.jfet ?? '')}
        </Label>

        {/* drain side */}
        {convVariant === 'follower' || convVariant === 'bootstrap' ? (
          <>
            <Wire d={`M 560 ${sigY - 24} L 560 ${railY} L 412 ${railY}`} />
            {p('conv.V_dd', 'converter', <DcSource x={412} y={railY + 22} label={`${v('converter', 'V_dd').toFixed(0)} V`} />)}
            <Ground x={412} y={railY + 44} />
            <Wire d={`M 560 ${sigY + 24} L 560 ${sigY + 44}`} />
            <Node x={560} y={sigY + 44} />
            {p('conv.R_s', 'converter', <Resistor x={600} y={sigY + 44} />)}
            <Wire d={`M 560 ${sigY + 44} L 579 ${sigY + 44}`} />
            <Wire d={`M 621 ${sigY + 44} L 636 ${sigY + 44} L 636 ${gndY}`} />
            <Ground x={636} y={gndY} />
            <Label x={600} y={sigY + 34}>
              {eng(v('converter', 'R_s'), 'Ω')}
            </Label>
            <Wire d={`M 560 ${sigY + 44} L 560 ${sigY + 24}`} />
            <Wire d={`M 560 ${sigY + 44} L 700 ${sigY + 44} L 700 ${sigY}`} />
            <Node x={560} y={sigY + 44} />
          </>
        ) : (
          <>
            {p('conv.R_d', 'converter', <Resistor x={560} y={railY + 46} vertical />)}
            <Wire d={`M 560 ${sigY - 24} L 560 ${railY + 60}`} />
            <Wire d={`M 560 ${railY + 32} L 560 ${railY} L 412 ${railY}`} />
            {p('conv.V_dd', 'converter', <DcSource x={412} y={railY + 22} label={`${v('converter', 'V_dd').toFixed(0)} V`} />)}
            <Ground x={412} y={railY + 44} />
            <Label x={578} y={railY + 50} anchor="start">
              {eng(v('converter', 'R_d'), 'Ω')}
            </Label>
            <Node x={560} y={sigY - 40} />
            <Wire d={`M 560 ${sigY - 40} L 700 ${sigY - 40} L 700 ${sigY}`} />

            {/* source leg */}
            <Wire d={`M 560 ${sigY + 24} L 560 ${sigY + 44}`} />
            <Node x={560} y={sigY + 44} />
            {p('conv.R_s', 'converter', <Resistor x={530} y={sigY + 70} vertical />)}
            <Wire d={`M 530 ${sigY + 44} L 560 ${sigY + 44}`} />
            <Wire d={`M 530 ${sigY + 44} L 530 ${sigY + 48}`} />
            <Wire d={`M 530 ${sigY + 92} L 530 ${gndY + 12}`} />
            <Ground x={530} y={gndY + 12} />
            {p('conv.C_s', 'converter', <Capacitor x={596} y={sigY + 70} vertical />)}
            <Wire d={`M 560 ${sigY + 44} L 596 ${sigY + 44} L 596 ${sigY + 54}`} />
            <Wire d={`M 596 ${sigY + 86} L 596 ${gndY + 12}`} />
            <Ground x={596} y={gndY + 12} />
            <Label x={508} y={sigY + 74} anchor="end">
              {eng(v('converter', 'R_s'), 'Ω')}
            </Label>
            <Label x={614} y={sigY + 74} anchor="start">
              {eng(v('converter', 'C_s'), 'F')}
            </Label>

            {convVariant === 'cs-deemph' ? (
              <>
                <Node x={628} y={sigY - 40} />
                {p('conv.C_fb', 'converter', <Capacitor x={628} y={sigY - 18} vertical />)}
                <Wire d={`M 628 ${sigY - 40} L 628 ${sigY - 34}`} />
                <Wire d={`M 628 ${sigY - 2} L 628 ${sigY + 8}`} />
                {p('conv.R_fb', 'converter', <Resistor x={628} y={sigY + 24} vertical />)}
                <Wire d={`M 628 ${sigY + 37} L 628 ${sigY + 44} L 560 ${sigY + 44}`} />
                <Label x={644} y={sigY - 14} anchor="start">
                  {eng(v('converter', 'C_fb'), 'F')}
                </Label>
                <Label x={644} y={sigY + 28} anchor="start">
                  {eng(v('converter', 'R_fb'), 'Ω')}
                </Label>
                <Label x={628} y={sigY - 50}>
                  de-emphasis
                </Label>
              </>
            ) : null}
          </>
        )}

        {/* ---------------------------------------------------------- output */}
        {outVariant === 'transformer' ? (
          <>
            {p('out.drv', 'output', <DependentSource x={700} y={sigY + 30} sign="×1" />)}
            <Wire d={`M 700 ${sigY} L 700 ${sigY + 8}`} />
            <Wire d={`M 700 ${sigY + 52} L 700 ${sigY + 62} L 730 ${sigY + 62}`} />
            <Label x={676} y={sigY + 34} anchor="end">
              driver
            </Label>
            {p('out.C_out', 'output', <Capacitor x={730} y={sigY - 20} vertical />)}
            <Wire d={`M 730 ${sigY + 62} L 730 ${sigY - 4}`} />
            <Wire d={`M 730 ${sigY - 36} L 730 ${sigY - 52} L 754 ${sigY - 52}`} />
            {p('out.R_p', 'output', <Resistor x={754} y={sigY - 22} vertical />)}
            <Wire d={`M 754 ${sigY - 52} L 754 ${sigY - 44}`} />
            <Wire d={`M 754 ${sigY} L 754 ${sigY + 4}`} />
            {p('out.L_p', 'output', <Inductor x={754} y={sigY + 40} vertical />)}
            <Wire d={`M 754 ${sigY + 88} L 754 ${gndY + 12}`} />
            <Ground x={754} y={gndY + 12} />
            {/* core */}
            <Wire d={`M 768 ${sigY + 4} L 768 ${sigY + 78}`} />
            <Wire d={`M 774 ${sigY + 4} L 774 ${sigY + 78}`} />
            {p('out.L_s', 'output', <Inductor x={790} y={sigY + 40} vertical coils={3} />)}
            {p('out.C_w', 'output', <Capacitor x={824} y={sigY + 40} vertical />)}
            <Wire d={`M 790 ${sigY + 4} L 824 ${sigY + 4} L 824 ${sigY + 24}`} />
            <Wire d={`M 790 ${sigY + 78} L 824 ${sigY + 78} L 824 ${sigY + 56}`} />
            <Node x={824} y={sigY + 4} />
            <Node x={824} y={sigY + 78} />
            {p('out.R_s1', 'output', <Resistor x={856} y={sigY + 4} />)}
            {p('out.R_s2', 'output', <Resistor x={856} y={sigY + 78} />)}
            <Wire d={`M 824 ${sigY + 4} L 835 ${sigY + 4}`} />
            <Wire d={`M 824 ${sigY + 78} L 835 ${sigY + 78}`} />
            <Wire d={`M 877 ${sigY + 4} L 918 ${sigY + 4} L 918 ${sigY - 4}`} />
            <Wire d={`M 877 ${sigY + 78} L 918 ${sigY + 78} L 918 ${sigY + 66}`} />
            <Label x={790} y={sigY - 8}>
              {v('output', 'ratio').toFixed(0)}:1
            </Label>
          </>
        ) : outVariant === 'transformerless' ? (
          <>
            <Node x={700} y={sigY} />
            {p('out.Ep', 'output', <DependentSource x={700} y={sigY - 46} sign="+" />)}
            {p('out.En', 'output', <DependentSource x={700} y={sigY + 46} sign="−" />)}
            <Wire d={`M 700 ${sigY} L 700 ${sigY - 24}`} />
            <Wire d={`M 700 ${sigY} L 700 ${sigY + 24}`} />
            <Wire d={`M 700 ${sigY - 68} L 700 ${sigY - 78} L 736 ${sigY - 78}`} />
            <Wire d={`M 700 ${sigY + 68} L 700 ${sigY + 78} L 736 ${sigY + 78}`} />
            {p('out.C_outp', 'output', <Capacitor x={752} y={sigY - 78} />)}
            {p('out.C_outn', 'output', <Capacitor x={752} y={sigY + 78} />)}
            {p('out.R_outp', 'output', <Resistor x={812} y={sigY - 78} />)}
            {p('out.R_outn', 'output', <Resistor x={812} y={sigY + 78} />)}
            <Wire d={`M 768 ${sigY - 78} L 791 ${sigY - 78}`} />
            <Wire d={`M 768 ${sigY + 78} L 791 ${sigY + 78}`} />
            <Wire d={`M 833 ${sigY - 78} L 918 ${sigY - 78} L 918 ${sigY - 4}`} />
            <Wire d={`M 833 ${sigY + 78} L 918 ${sigY + 78} L 918 ${sigY + 66}`} />
            <Label x={752} y={sigY - 96}>
              {eng(v('output', 'C_out'), 'F')}
            </Label>
            <Label x={812} y={sigY - 96}>
              {eng(v('output', 'R_out'), 'Ω')}
            </Label>
            <Label x={676} y={sigY} anchor="end">
              phase
            </Label>
            <Label x={676} y={sigY + 12} anchor="end">
              splitter
            </Label>
          </>
        ) : (
          <>
            {p('out.C_out', 'output', <Capacitor x={730} y={sigY} />)}
            <Wire d={`M 700 ${sigY} L 714 ${sigY}`} />
            {p('out.R_out', 'output', <Resistor x={790} y={sigY} />)}
            <Wire d={`M 746 ${sigY} L 769 ${sigY}`} />
            <Wire d={`M 811 ${sigY} L 918 ${sigY} L 918 ${sigY - 4}`} />
            {p('out.gndLeg', 'output', <Resistor x={790} y={sigY + 78} />)}
            <Wire d={`M 700 ${sigY + 78} L 769 ${sigY + 78} L 769 ${sigY + 78}`} />
            <Wire d={`M 700 ${sigY} L 700 ${sigY + 78}`} />
            <Ground x={700} y={sigY + 90} />
            <Wire d={`M 811 ${sigY + 78} L 918 ${sigY + 78} L 918 ${sigY + 66}`} />
            <Label x={730} y={sigY - 22}>
              {eng(v('output', 'C_out'), 'F')}
            </Label>
          </>
        )}

        {/* ------------------------------------------------------------ load */}
        <Xlr x={926} y={sigY + 31} />
        <Wire d={`M 918 ${sigY - 4} L 926 ${sigY - 4} L 926 ${sigY + 21}`} />
        <Wire d={`M 918 ${sigY + 66} L 926 ${sigY + 66} L 926 ${sigY + 41}`} />
        <Wire d={`M 943 ${sigY + 24} L 1010 ${sigY + 24} L 1010 ${sigY + 12}`} />
        <Wire d={`M 943 ${sigY + 38} L 1010 ${sigY + 38} L 1010 ${sigY + 50}`} />
        {p('load.R_preamp', 'load', <Resistor x={1010} y={sigY + 31} vertical />)}
        {p('load.R_shield', 'load', <Resistor x={962} y={sigY + 80} vertical />)}
        <Wire d={`M 926 ${sigY + 48} L 926 ${sigY + 80} L 962 ${sigY + 80} L 962 ${sigY + 66}`} />
        <Wire d={`M 962 ${sigY + 94} L 962 ${sigY + 104}`} />
        <Ground x={962} y={sigY + 104} />
        <Label x={1028} y={sigY + 34} anchor="start">
          {eng(v('load', 'R_preamp'), 'Ω')}
        </Label>
        <Label x={1010} y={sigY - 2}>
          preamp
        </Label>
        <Label x={978} y={sigY + 84} anchor="start" dim>
          screen
        </Label>
        <Label x={926} y={sigY + 4} dim>
          {v('load', 'cable_m').toFixed(0)} m cable
        </Label>

        {build.faults.length > 0 ? (
          <text x={W - 12} y={26} fontSize={10} textAnchor="end" fill="var(--cat-fault)" className="uppercase tracking-wider">
            {build.faults.length} fault{build.faults.length > 1 ? 's' : ''} active
          </text>
        ) : null}
      </svg>

      <div className="flex min-h-[38px] items-center gap-2 border-t border-zinc-800 px-3 py-2 text-xs">
        {info ? (
          <>
            <span className="shrink-0 font-medium text-copper-300">{info.label}</span>
            {info.value ? <span className="shrink-0 tabular text-zinc-400">{info.value}</span> : null}
            <span className="truncate text-zinc-500">{info.note}</span>
          </>
        ) : (
          <span className="text-zinc-600">
            {hint ?? 'Hover a component to see what it does; click it to read more.'}
          </span>
        )}
      </div>
    </div>
  )
}
